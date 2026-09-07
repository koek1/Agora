// ========== Imports: ==========
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { isValidObjectId, Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { toBuffer } from 'qrcode';
import { Rsvp, RsvpDocument, RsvpStatus } from './schemas/rsvp.schema';
import { CreateRsvpDto } from "./dto/create-rsvp.dto";
import { CreateWalkInDto } from "./dto/create-walk-in.dto";
import { EventsService } from "../events/events.service";
import { UsersService } from "../users/users.service";
import { CalendarSyncService } from "../calendar/calendar-sync.service";
import { Role } from '../common/enums/role.enums';
import { User } from '../users/schemas/user.schema';

export interface ScanResponse {
    guestName: string;
    eventTitle: string;
    eventDate: Date;
}

// geleenthede word vir so lank gesien deur die stelsel as aan die gang
// wanneer geen END DATE gegee was nie
const EVENT_GRACE_PERIOD_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class RsvpService {
    constructor(
        @InjectModel(Rsvp.name) private readonly rsvpModel: Model<RsvpDocument>,
        private readonly eventsService: EventsService,
        private readonly usersService: UsersService,
        private readonly calendarSyncService: CalendarSyncService,
    ) {}

    async createRsvp(dto: CreateRsvpDto, userId: string): Promise<RsvpDocument> {
        const event = await this.eventsService.findById(dto.eventId);

        if (event.sellsTickets) {
            throw new ForbiddenException('Hierdie geleentheid vereis \'n kaartjie-aankoop');
        }

        const effectiveEnd = event.endDate ?? new Date(event.date.getTime() + EVENT_GRACE_PERIOD_MS);
        if (effectiveEnd.getTime() < Date.now()) {
            throw new ConflictException('Hierdie geleentheid het reeds afgehandel');
        }

        const existing = await this.rsvpModel
        .findOne({ event: dto.eventId, user: userId })
        .exec();
        if (existing && existing.status !== RsvpStatus.GEKANSELLEER) {
            throw new ConflictException('Jy het alreeds vir hierdie geleentheid ingeskryf');
        }

        await this.eventsService.incrementConfirmedAttendees(dto.eventId);

        // 'n Vorige gekanselleerde RSVP vir dieselfde (event, user) bestaan reeds as 'n
        // dokument -- die unieke indeks op (event, user) laat nie 'n tweede toe nie, so
        // ons herleef die bestaande dokument met 'n vars QR-kode eerder as om een te skep.
        const rsvp = existing ?? new this.rsvpModel({
            event: dto.eventId,
            user: userId,
            qrPayload: uuidv4(),
        });
        if (existing) {
            rsvp.status = RsvpStatus.HANGENDE;
            rsvp.qrPayload = uuidv4();
            rsvp.checkedIn = false;
            rsvp.checkedInAt = null;
            rsvp.googleCalendarEventId = null;
            rsvp.outlookCalendarEventId = null;
        }
        await rsvp.save();

        const user = await this.usersService.findById(userId);
        const syncResult = await this.calendarSyncService.syncRsvpCreated(user, event);

        if (syncResult.googleCalendarEventId || syncResult.outlookCalendarEventId) {
            rsvp.googleCalendarEventId = syncResult.googleCalendarEventId;
            rsvp.outlookCalendarEventId = syncResult.outlookCalendarEventId;
            await rsvp.save();
        }

        return rsvp;
    }

    async hasTicket(eventId: string, userId: string): Promise<boolean> {
        const existing = await this.rsvpModel
        .findOne({ event: eventId, user: userId, status: { $ne: RsvpStatus.GEKANSELLEER } })
        .exec();
        return existing !== null;
    }

    async createPaidTicket(eventId: string, userId: string, paymentId: string): Promise<RsvpDocument> {
        await this.eventsService.incrementConfirmedAttendees(eventId);

        // Sien createRsvp hierbo -- 'n vorige gekanselleerde RSVP blokkeer 'n nuwe
        // dokument weens die unieke indeks op (event, user), so herleef dit eerder.
        const existing = await this.rsvpModel
        .findOne({ event: eventId, user: userId })
        .exec();

        const rsvp = existing ?? new this.rsvpModel({ event: eventId, user: userId, qrPayload: uuidv4() });
        if (existing) {
            rsvp.qrPayload = uuidv4();
            rsvp.checkedIn = false;
            rsvp.checkedInAt = null;
            rsvp.googleCalendarEventId = null;
            rsvp.outlookCalendarEventId = null;
        }
        rsvp.status = RsvpStatus.BEVESTIG;
        rsvp.paid = true;
        rsvp.payment = new Types.ObjectId(paymentId);

        return rsvp.save();
    }

    async findMyRsvps(userId: string): Promise<RsvpDocument[]> {
        return this.rsvpModel
        .find({ user: userId })
        .populate('event')
        .exec();
    }

    async findRsvpsByEvent(eventId: string, requesterId: string, requesterRole: Role): Promise<RsvpDocument[]>{
        const event = await this.eventsService.findById(eventId);
        this.eventsService.assertOwnership(event, requesterId, requesterRole);

        return this.rsvpModel
        .find({ event: eventId })
        .populate('user', '-passwordHash -__v')
        .exec();
    }

    async cancelRsvp(rsvpId: string, requesterId: string, requesterRole: Role): Promise<void> {
        if (!isValidObjectId(rsvpId)) {
            throw new NotFoundException(`RSVP ${rsvpId} nie gevind nie`);
        }

        const rsvp = await this.rsvpModel.findById(rsvpId).exec();
        if (!rsvp) throw new NotFoundException(`RSVP ${rsvpId} nie gevind nie`);

        const event = await this.eventsService.findById(rsvp.event.toString());

        // 'n Gebruiker mag altyd sy eie RSVP kanselleer; om iemand anders s'n te
        // kanselleer (of 'n walk-in sonder gekoppelde gebruiker) moet jy ADMIN wees,
        // of die DOSENT wat die geleentheid geskep het.
        const isOwnRsvp = rsvp.user?.toString() === requesterId;
        if (!isOwnRsvp) {
            this.eventsService.assertOwnership(event, requesterId, requesterRole);
        }

        const wasCheckedIn = rsvp.checkedIn;

        rsvp.status = RsvpStatus.GEKANSELLEER;
        await rsvp.save();

        event.confirmedAttendees = Math.max(0, event.confirmedAttendees - 1);
        await event.save();

        // Ongewone geval: iemand wat reeds ingeteken is se RSVP word daarna
        // gekanselleer -- moenie hulle steeds as "bygewoon" tel nie.
        if (wasCheckedIn) {
            await this.eventsService.decrementCheckedInCount(event._id.toString());
        }

        if (rsvp.user && (rsvp.googleCalendarEventId || rsvp.outlookCalendarEventId)) {
            const user = await this.usersService.findById(rsvp.user.toString());
            await this.calendarSyncService.syncRsvpCancelled(
                user,
                rsvp.googleCalendarEventId,
                rsvp.outlookCalendarEventId,
            );
        }
    }

    // Gebruik wanneer 'n gebruiker sy rekening verwyder: kanselleer al sy aktiewe RSVP's
    // sodat geleentheidkapasiteit en gekoppelde kalender-inskrywings korrek vrygestel word,
    // eerder as om weeskop-RSVP's met 'n verwysing na 'n nie-bestaande gebruiker agter te laat.
    async cancelAllForUser(userId: string): Promise<void> {
        const activeRsvps = await this.rsvpModel
            .find({ user: userId, status: { $ne: RsvpStatus.GEKANSELLEER } })
            .exec();

        for (const rsvp of activeRsvps) {
            await this.cancelRsvp(rsvp._id.toString(), userId, Role.GAS);
        }
    }

    async checkInRsvp(rsvpId: string, requesterId: string, requesterRole: Role): Promise<RsvpDocument> {
        if (!isValidObjectId(rsvpId)) {
            throw new NotFoundException(`RSVP ${rsvpId} nie gevind nie`);
        }

        const rsvp = await this.rsvpModel
        .findById(rsvpId)
        .populate('user', '-passwordHash -__v')
        .exec();
        if (!rsvp) throw new NotFoundException(`RSVP ${rsvpId} nie gevind nie`);

        const event = await this.eventsService.findById(rsvp.event.toString());
        this.eventsService.assertOwnership(event, requesterId, requesterRole);

        if (rsvp.status === RsvpStatus.GEKANSELLEER) {
            throw new ConflictException('Kan nie \'n gekanselleerde RSVP inteken nie');
        }
        if (rsvp.checkedIn) {
            throw new ConflictException('Gas het reeds ingecheck');
        }

        rsvp.checkedIn = true;
        rsvp.checkedInAt = new Date();
        rsvp.status = RsvpStatus.BEVESTIG;
        await rsvp.save();
        await this.eventsService.incrementCheckedInCount(event._id.toString());

        return rsvp;
    }

    async getQrCode(rsvpId: string, requesterId: string, requesterRole: Role):Promise<Buffer>{
        if (!isValidObjectId(rsvpId)) {
            throw new NotFoundException(`RSVP ${rsvpId} nie gevind nie`);
        }

        const rsvp = await this.rsvpModel.findById(rsvpId).exec();
        if (!rsvp) throw new NotFoundException(`RSVP ${rsvpId} nie gevind nie`);

        if (requesterRole !== Role.ADMIN && rsvp.user?.toString() !== requesterId) {
            throw new ForbiddenException(`Jy mag nie hierdie QR-kode opvra nie`);
        }
        

        return toBuffer(rsvp.qrPayload);
    }

    async scanRsvp(qrPayload: string, requesterId: string, requesterRole: Role): Promise <ScanResponse> {
        const rsvp = await this.rsvpModel
        .findOne({ qrPayload })
        .populate<{ user: User }>('user')
        .exec();

        if (!rsvp) {
            throw new NotFoundException('Ongeldige QR-kode');
        }

        const event = await this.eventsService.findById(rsvp.event.toString());
        this.eventsService.assertOwnership(event, requesterId, requesterRole);

        if (rsvp.checkedIn) {
            throw new ConflictException('Gas het reeds ingecheck');
        }

        rsvp.checkedIn = true;
        rsvp.checkedInAt = new Date();
        rsvp.status = RsvpStatus.BEVESTIG;
        await rsvp.save();
        await this.eventsService.incrementCheckedInCount(event._id.toString());

        return {
            guestName: `${rsvp.user.name} ${rsvp.user.surname}`,
            eventTitle: event.title,
            eventDate: event.date,
        };
    }

    // Iemand wat sonder 'n vooraf-RSVP opdaag: ons skep 'n RSVP sonder gekoppelde
    // gebruiker (net 'n naam) en teken hulle onmiddellik in, net soos 'n kaartjie
    // by die deur. Dit tel steeds teen die geleentheid se kapasiteit.
    async registerWalkIn(dto: CreateWalkInDto, requesterId: string, requesterRole: Role): Promise<RsvpDocument> {
        const event = await this.eventsService.findById(dto.eventId);
        this.eventsService.assertOwnership(event, requesterId, requesterRole);

        await this.eventsService.incrementConfirmedAttendees(dto.eventId);
        await this.eventsService.incrementCheckedInCount(dto.eventId);

        const rsvp = new this.rsvpModel({
            event: dto.eventId,
            guestName: dto.guestName.trim(),
            qrPayload: uuidv4(),
            status: RsvpStatus.BEVESTIG,
            checkedIn: true,
            checkedInAt: new Date(),
        });

        return rsvp.save();
    }
}
