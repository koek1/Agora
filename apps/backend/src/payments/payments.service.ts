// ========== Imports: ==========
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ConfigService } from "@nestjs/config";
import { Model } from "mongoose";
import { createHash } from "crypto";
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentDocument, PaymentStatus } from './schemas/payment.schema';
import { EventsService } from "../events/events.service";
import { DuplicateTicketException, RsvpService } from "../rsvp/rsvp.service";
import { UsersService } from "../users/users.service";
import { PayfastNotifyDto, PayfastNotifyResultDto } from "./dto/payfast-notify.dto";
import { InitiatePaymentResponseDto } from "./dto/initiate-payment-response.dto";
import { PaymentPlatform } from "./dto/initiate-payment.dto";

interface PayfastNotifyFields {
    [key: string]: string;
    m_payment_id: string;
    pf_payment_id: string;
    payment_status: string;
    item_name: string;
    amount_gross: string;
}

@Injectable()
export class PaymentsService {
    constructor (
        @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
        private readonly configService: ConfigService,
        private readonly eventsService: EventsService,
        private readonly rsvpService: RsvpService,
        private readonly usersService: UsersService,
    ) {}

    async initiate(eventId: string, userId: string, platform: PaymentPlatform = 'web'): Promise<InitiatePaymentResponseDto> {
        const event = await this.eventsService.findById(eventId);

        if (!event.sellsTickets || event.ticketPrice === null) {
            throw new BadRequestException('Hierdie geleentheid verkoop nie kaartjies nie');
        }
        if (event.ticketsAvailable === null || event.ticketsAvailable <= 0) {
            throw new ConflictException('Geen kaartjies meer beskikbaar nie');
        }

        const alreadyHasTicket = await this.rsvpService.hasTicket(eventId, userId);
        if (alreadyHasTicket) {
            throw new ConflictException("Jy het reeds 'n kaartjie vir hierdie geleentheid");
        }

        const user = await this.usersService.findById(userId);
        const reference = uuidv4();
        const amount = event.ticketPrice;

        const payment = await new this.paymentModel({
            event: event._id,
            user: userId,
            reference, 
            amount,
            status: PaymentStatus.HANGENDE,
        }).save();

        const merchantId = this.configService.get<string>('payfast.merchantId')!;
        const merchantKey = this.configService.get<string>('payfast.merchantKey')!;
        const passphrase = this.configService.get<string>('payfast.passphrase')!;
        const notifyUrl = this.configService.get<string>('payfast.notifyUrl')!;
        const publicBaseUrl = this.configService.get<string>('payfast.publicBaseUrl')!;
        const returnUrl = `${publicBaseUrl}/return?platform=${platform}`;
        const cancelUrl = `${publicBaseUrl}/cancel?platform=${platform}`;
        const checkoutUrl = this.configService.get<string>('payfast.processUrl')!;
        const mode = this.configService.get<string>('payfast.mode');

        const itemName = event.title.slice(0, 100);
        const amountStr = amount.toFixed(2);

        const checkoutFields = {
            merchant_id: merchantId,
            merchant_key: merchantKey,
            return_url: returnUrl,
            cancel_url: cancelUrl,
            notify_url: notifyUrl,
            name_first: user.name,
            name_last: user.surname,
            email_address: user.email,
            m_payment_id: reference,
            amount: amountStr,
            item_name: itemName,
        };
        const checkoutSignature = this.buildSignature(checkoutFields, passphrase);

        const simulation = mode === 'simulate'
        ? {
            success: this.buildSimulatedNotify(reference, payment._id.toString(), 'COMPLETE', itemName, amountStr, passphrase),
            failed: this.buildSimulatedNotify(reference, payment._id.toString(), 'FAILED', itemName, amountStr, passphrase),
        }
        : null;

        return {
            paymentId: payment._id.toString(),
            reference, 
            amount, 
            itemName, 
            checkout: { ...checkoutFields, signature: checkoutSignature },
            checkoutUrl,
            simulation,
        };
    }

    async handleNotify(dto: PayfastNotifyDto): Promise<PayfastNotifyResultDto> {
        const payment = await this.paymentModel.findOne({ reference: dto.m_payment_id }).exec();
        if (!payment) {
            throw new NotFoundException('Onbekende betaalverwysing');
        }

        if (payment.status !== PaymentStatus.HANGENDE) {
            return { status: payment.status };
        }

        const passphrase = this.configService.get<string>('payfast.passphrase')!;
        const { signature, ...fields } = dto as unknown as Record<string, string>;
        const expectedSignature = this.buildSignature(fields, passphrase);

        if (expectedSignature !== signature) {
            payment.status = PaymentStatus.MISLUK;
            await payment.save();
            throw new ForbiddenException('Ongeldige betaal-handtekening');
        }

        if (dto.payment_status !== 'COMPLETE' || Number(dto.amount_gross) !== payment.amount) {
            payment.status = PaymentStatus.MISLUK;
            await payment.save();
            return { status: PaymentStatus.MISLUK };
        }

        // Atomies "eis" hierdie betaling voordat 'n kaartjie geskep word — PayFast
        // stuur soms meer as een ITN-oproep vir dieselfde transaksie. Slegs die
        // versoek wat werklik van HANGENDE na VOLTOOI oorgaan, mag voortgaan; enige
        // gelyktydige duplikaat kry hier niks terug nie en probeer nie weer 'n
        // kaartjie skep nie.
        const claimed = await this.paymentModel.findOneAndUpdate(
            { _id: payment._id, status: PaymentStatus.HANGENDE },
            { status: PaymentStatus.VOLTOOI, providerPaymentId: dto.pf_payment_id },
        ).exec();

        if (!claimed) {
            return { status: PaymentStatus.VOLTOOI };
        }

        await this.eventsService.decrementTicketsAvailable(payment.event.toString());

        let rsvp;
        try {
            rsvp = await this.rsvpService.createPaidTicket(
                payment.event.toString(),
                payment.user.toString(),
                payment._id.toString(),
            );
        } catch (err) {
            if (err instanceof DuplicateTicketException || this.isDuplicateTicketError(err)) {
                // Die gebruiker het reeds 'n kaartjie vir hierdie geleentheid, uit 'n
                // ander, aparte betaling (bv. 'n PayFast ITN-herhaling vir 'n ou
                // poging wat eers nou deur handtekening-verifikasie kom). Geen nuwe
                // kaartjie word geskep nie, so gee die voorraad wat pas afgetrek is
                // weer terug.
                await this.eventsService.incrementTicketsAvailable(payment.event.toString());
                return { status: PaymentStatus.VOLTOOI };
            }
            
            await this.eventsService.incrementTicketsAvailable(payment.event.toString());
            payment.status = PaymentStatus.MISLUK;
            await payment.save();
            throw err;
        }

        await this.paymentModel.updateOne({ _id: payment._id }, { rsvp: rsvp._id }).exec();

        return { status: PaymentStatus.VOLTOOI };
    }

    private buildSimulatedNotify(
        mPaymentId: string,
        paymentDocId: string,
        outcome: 'COMPLETE' | 'FAILED',
        itemName: string,
        amountGross: string,
        passphrase: string,
    ) {
        const pfPaymentId = `SIM-${paymentDocId}`;
        const fields = this.notifyFields(mPaymentId, pfPaymentId, outcome, itemName, amountGross);
        return { ...fields, signature: this.buildSignature(fields, passphrase) };
    }

    private notifyFields(
        mPaymentId: string,
        pfPaymentId: string,
        paymentStatus: string,
        itemName: string,
        amountGross: string,
    ): PayfastNotifyFields {
        return {
            m_payment_id:   mPaymentId,
            pf_payment_id: pfPaymentId,
            payment_status: paymentStatus,
            item_name: itemName,
            amount_gross: amountGross,
        };
    }

    private buildSignature( fields: Record<string, string>, passphrase: string ): string {
        const parts: string[] = [];
        for ( const [key, value] of Object.entries(fields)) {
            if (value === undefined || value === null) continue;
            parts.push(`${key}=${this.phpUrlEncode(value.trim())}`);
        }
        let paramString = parts.join('&');
        if (passphrase) {
            paramString += `&passphrase=${this.phpUrlEncode(passphrase.trim())}`;
        }
        return createHash('md5').update(paramString).digest('hex');
    }

    private isDuplicateTicketError(err: unknown): boolean {
        return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
    }

    private phpUrlEncode(value: string): string {
        return encodeURIComponent(value)
        .replace(/%20/g, '+')
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A')
        .replace(/~/g, '%7E')
    }
}