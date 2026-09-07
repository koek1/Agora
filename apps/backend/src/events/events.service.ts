// ========== Imports: ==========
import { ForbiddenException, Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, isValidObjectId, Model, Types } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AssignPhotographerDto } from './dto/assign-photographer.dto';
import { Role } from '../common/enums/role.enums';
import { UserTag } from '../common/enums/user-tag.enum';
import { visibleAttendanceRoles } from '../common/rbac/event-visibility';
import { RabbitMQService } from '../messaging/rabbitmq.service';
import { EXCHANGES, ROUTING_KEYS, PhotographerAssignedEvent } from '../messaging/events.constants';
import { UsersService } from '../users/users.service';
import { PlacesService } from '../places/places.service';

@Injectable()
export class EventsService {
    constructor(
        @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
        private readonly rabbitMQService: RabbitMQService,
        private readonly usersService: UsersService,
        private readonly placesService: PlacesService,
    ) {}

    async create(dto: CreateEventDto, creatorId: string): Promise<EventDocument> {
        const start = new Date(dto.date);
        const end   = dto.endDate ? new Date(dto.endDate) : undefined;
        this.assertEndAfterStart(start, end);
        this.assertTicketsWithinCapacity(dto.sellsTickets, dto.ticketsAvailable, dto.maxCapacity);

        if (dto.assignedTo) {
            await this.assertValidAssignee(dto.assignedTo);
        }

        const place = await this.placesService.getDetails(dto.address);

        const created = new this.eventModel({
            ...dto,
            date:       start,
            endDate:    end,
            address:    place.address,
            placeId:    place.placeId,
            lat:        place.lat,
            lon:        place.lon,
            createdBy:  creatorId,
            assignedTo: dto.assignedTo ? new Types.ObjectId(dto.assignedTo) : null,
        });
        return created.save();
    }

    async findAll(
        viewerRole: Role,
        viewerId: string,
        from?: string,
        to?: string,
    ): Promise<EventDocument[]> {
        const filter: FilterQuery<EventDocument> = {};
        const andConditions: FilterQuery<EventDocument>[] = [];

        // 'n Geleentheid val binne die venster as dit nog nie klaar is nie (endDate,
        // of die begin-datum as daar nie een is nie, >= from) en nie na die venster begin
        // nie (date <= to), so tel "aangaande" geleenthede wat voor `from` begin
        // het maar steeds loop, ook, nie net die wat na `from` begin nie
        if (from) {
            const fromDate = new Date(from);
            andConditions.push({
                $or: [
                    { endDate: { $gte: fromDate } },
                    { endDate: { $in: [null, undefined] }, date: { $gte: fromDate } },
                ],
            });
        }
        if (to) {
            andConditions.push({ date: { $lte: new Date(to) } });
        }

        // Rol-gebaseerde sigbaarheid: 'n gebruiker sien geleenthede op sy vlak en laer.
        // ADMIN sien alles. PHOTOGRAPHER is 'n uitsondering op die vlak-stelsel: hulle
        // sien NOOIT geleenthede op grond van intendedAttendance nie -- slegs geleenthede
        // waaraan 'n Dosent/Admin hulle spesifiek as fotograaf toegewys het. 'n Gebruiker
        // met die Finansies-tag sien (ongeag rol) ook enige geleentheid waaraan
        // hulle finansieel toegeken is, bo en behalwe hul normale rol-sigbaarheid.
        if (viewerRole === Role.PHOTOGRAPHER) {
            filter.photographers = new Types.ObjectId(viewerId);
        } else if (viewerRole !== Role.ADMIN) {
            andConditions.push({
                $or: [
                    { intendedAttendance: { $in: visibleAttendanceRoles(viewerRole) } },
                    { assignedTo: new Types.ObjectId(viewerId) },
                ],
            });
        }

        if (andConditions.length > 0) {
            filter.$and = andConditions;
        }

        return this.eventModel.find(filter).sort({ date: 1 }).exec();
    }

    async findById(id: string, viewerRole?: Role, viewerId?: string): Promise<EventDocument> {
        if (!isValidObjectId(id)) {
            throw new NotFoundException(`Event ${id} not found`);
        }

        const event = await this.eventModel.findById(id).exec();
        if (!event) throw new NotFoundException(`Event ${id} not found`);

        // dwing rol-sigbaarheid, geen lek van versteekte geleenthede nie. Gee 404
        if (viewerRole && !this.canView(event, viewerRole, viewerId)) {
            throw new NotFoundException(`Event ${id} not found`);
        }

        return event;
    }

    private canView(event: EventDocument, viewerRole: Role, viewerId?: string): boolean {
        if (viewerRole === Role.ADMIN) return true;
        // Die Finansies-toegekende gebruiker mag hierdie geleentheid altyd sien,
        // ongeag rol-vlak, sodat hulle die begroting kan bereik.
        if (viewerId && event.assignedTo && event.assignedTo.toString() === viewerId) return true;
        // PHOTOGRAPHER is 'n uitsondering: nooit op grond van intendedAttendance sigbaar
        // nie, slegs as hulle spesifiek as fotograaf aan hierdie geleentheid toegewys is.
        if (viewerRole === Role.PHOTOGRAPHER) {
            return !!viewerId && event.photographers.some((p) => p.toString() === viewerId);
        }
        return visibleAttendanceRoles(viewerRole).includes(event.intendedAttendance);
    }

    async incrementConfirmedAttendees(id: string): Promise<EventDocument> {
        if (!isValidObjectId(id)) {
            throw new NotFoundException(`Event ${id} not found`);
        }

        // Atomiese voorwaardelike inkrement voorkom die TOCTOU-wedloop tussen die
        // kapasiteitstoets en die skrywe wanneer verskeie RSVP's gelyktydig inkom.
        const updated = await this.eventModel.findOneAndUpdate(
            { _id: id, $expr: { $lt: ['$confirmedAttendees', '$maxCapacity'] } },
            { $inc: { confirmedAttendees: 1 } },
            { new: true },
        ).exec();

        if (updated) return updated;

        const event = await this.eventModel.findById(id).exec();
        if (!event) throw new NotFoundException(`Event ${id} not found`);
        throw new ConflictException('Hierdie geleentheid is vol bespreek');
    }

    async decrementTicketsAvailable(id: string): Promise<EventDocument> {
        if (!isValidObjectId(id)) {
            throw new NotFoundException(`Event ${id} not found`);
        }

        // Dieselfde atomiese patroon as incrementConfirmedAttendees hierbo: die
        // voorwaarde (ticketsAvailable > 0) en die skrywe gebeur in een databasis-
        // operasie, sodat twee gelyktydige betalings nie dieselfde laaste kaartjie
        // albei kan wen nie.
        const updated = await this.eventModel.findOneAndUpdate(
            { _id: id, ticketsAvailable: { $gt: 0 } },
            { $inc: { ticketsAvailable: -1 } },
            { new: true },
        ).exec();

        if (updated) return updated;

        const event = await this.eventModel.findById(id).exec();
        if (!event) throw new NotFoundException(`Event ${id} not found`);
        throw new ConflictException('Geen kaartjies meer beskikbaar nie');
    }

    // Word inkrementeer wanneer 'n RSVP se QR-kode werklik geskandeer word
    // (checkInRsvp/scanRsvp) -- dus "hoeveel mense het opgedaag", nie hoeveel
    // ingeskryf het nie (dis confirmedAttendees hierbo).
    async incrementCheckedInCount(id: string): Promise<EventDocument> {
        if (!isValidObjectId(id)) {
            throw new NotFoundException(`Event ${id} not found`);
        }

        const updated = await this.eventModel.findOneAndUpdate(
            { _id: id },
            { $inc: { checkedInCount: 1 } },
            { new: true },
        ).exec();

        if (!updated) throw new NotFoundException(`Event ${id} not found`);
        return updated;
    }

    // Terugrolling vir die uitsonderlike geval waar iemand wat reeds ingeteken
    // is se RSVP daarna gekanselleer word (sien rsvp.service.ts se cancelRsvp).
    async decrementCheckedInCount(id: string): Promise<EventDocument> {
        if (!isValidObjectId(id)) {
            throw new NotFoundException(`Event ${id} not found`);
        }

        const updated = await this.eventModel.findOneAndUpdate(
            { _id: id, checkedInCount: { $gt: 0 } },
            { $inc: { checkedInCount: -1 } },
            { new: true },
        ).exec();

        if (updated) return updated;

        const event = await this.eventModel.findById(id).exec();
        if (!event) throw new NotFoundException(`Event ${id} not found`);
        return event;
    }

    // Gebruik om 'n voorheen-afgetrekte kaartjie terug te gee wanneer 'n betaling
    // uiteindelik geen nuwe kaartjie geskep het nie (bv. die gebruiker het reeds
    // een uit 'n ander, aparte betaling).
    async incrementTicketsAvailable(id: string): Promise<EventDocument> {
        if (!isValidObjectId(id)) {
            throw new NotFoundException(`Event ${id} not found`);
        }

        const updated = await this.eventModel.findOneAndUpdate(
            { _id: id },
            { $inc: { ticketsAvailable: 1 } },
            { new: true },
        ).exec();

        if (!updated) throw new NotFoundException(`Event ${id} not found`);
        return updated;
    }

    async updateEvent(
        id: string,
        dto: UpdateEventDto,
        requesterId: string,
        requesterRole: Role,
    ): Promise<EventDocument> {

        const event = await this.findById(id);

        this.assertOwnership(event, requesterId, requesterRole);

        if (dto.photographers) {
            await this.assertValidPhotographers(dto.photographers);
        }

        if (dto.assignedTo) {
            await this.assertValidAssignee(dto.assignedTo);
        }

        const { date, endDate, address, ...rest } = dto;
        Object.assign(event, rest);
        if (date)          event.date       = new Date(date);
        if (endDate)       event.endDate    = new Date(endDate);
        if (dto.assignedTo) event.assignedTo = new Types.ObjectId(dto.assignedTo);
        if (address) {
            const place = await this.placesService.getDetails(address);
            event.address = place.address;
            event.placeId = place.placeId;
            event.lat     = place.lat;
            event.lon     = place.lon;
        }

        this.assertEndAfterStart(event.date, event.endDate);
        this.assertTicketsWithinCapacity(event.sellsTickets, event.ticketsAvailable, event.maxCapacity);

        return event.save();
    }

    async deleteEvent(
        id: string,
        requesterId: string,
        requesterRole: Role,
    ): Promise<void> {

        const event = await this.findById(id);

        this.assertOwnership(event, requesterId, requesterRole);

        await event.deleteOne();
    }

    async assignPhotographer(
        id: string,
        dto: AssignPhotographerDto,
    ): Promise<EventDocument> {
        const event = await this.findById(id);

        const alreadyAssigned = event.photographers.some(
            (p) => p.toString() === dto.photographerId,
        );

        if (!alreadyAssigned) {
            event.photographers.push(new Types.ObjectId(dto.photographerId));
        }

        event.photographerInstructions = dto.brief;
        const saved = await event.save();

        await this.rabbitMQService.publish<PhotographerAssignedEvent>(
            EXCHANGES.EVENT,
            ROUTING_KEYS.PHOTOGRAPHER_ASSIGNED,
            {
                eventId:        saved._id.toString(),
                photographerId: dto.photographerId,
                brief:          dto.brief,
                timestamp:      new Date().toISOString(),
            },
        );

        return saved;
    }

    private async assertValidPhotographers(photographerIds: string[]): Promise<void> {
        const uniqueIds = Array.from(new Set(photographerIds));
        const found = await this.usersService.search(Role.PHOTOGRAPHER, undefined, uniqueIds);
        const foundIds = new Set(found.map((user) => user.id));

        const invalidIds = uniqueIds.filter((photographerId) => !foundIds.has(photographerId));
        if (invalidIds.length > 0) {
            throw new BadRequestException(
                `Ongeldige fotograaf-ID('s): ${invalidIds.join(', ')}`,
            );
        }
    }

    private async assertValidAssignee(userId: string): Promise<void> {
        const found = await this.usersService.search(undefined, undefined, [userId], UserTag.FINANCE);
        if (found.length === 0) {
            throw new BadRequestException(
                `Die gekose gebruiker het nie die Finansies-tag nie`,
            );
        }
    }

    assertOwnership(
        event: EventDocument,
        requesterId: string,
        requesterRole: Role,
    ): void {
        if (requesterRole === Role.ADMIN) return;

        if (event.createdBy.toString() !== requesterId) {
            throw new ForbiddenException(
                `You do not have permission to modify this event`,
            );
        }
    }

    private assertEndAfterStart(start: Date, end?: Date): void {
        if (end && end.getTime() <= start.getTime()) {
            throw new BadRequestException('Die eind-datum moet ná die begin-datum wees');
        }
    }

    private assertTicketsWithinCapacity(
        sellsTickets: boolean | undefined,
        ticketsAvailable: number | null | undefined,
        maxCapacity: number,
    ): void {
        if (sellsTickets && ticketsAvailable != null && ticketsAvailable > maxCapacity) {
            throw new BadRequestException('Kaartjies beskikbaar kan nie die kapasiteit oorskry nie');
        }
    }
}
