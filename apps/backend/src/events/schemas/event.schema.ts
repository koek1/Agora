// ========== Imports: ==========
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enums';
import { EventType } from '../../common/enums/event-type.enum';
import { ATTENDANCE_ROLES } from '../../common/rbac/event-visibility';

export type EventDocument = HydratedDocument<Event>;

@Schema ({ timestamps: true, collection: 'events' })
export class Event {
    @Prop ({ required: true, trim: true })
    title!: string;

    @Prop ({ required: true, trim: true })
    description!: string;

    @Prop ({ required: true, type: Date })
    date!: Date;

    @Prop ({ required: false, type: Date })
    endDate?: Date;

    @Prop ({ required: true, trim: true})
    location!: string;

    @Prop ({ required: false, trim: true, default: ''})
    address!: string;

    @Prop ({ required: false, trim: true, default: ''})
    placeId!: string;

    @Prop ({ required: false, type: Number, default: null})
    lat!: number | null;

    @Prop ({ required: false, type: Number, default: null})
    lon!: number | null;

    @Prop ({ required: true })
    maxCapacity!: number;

    @Prop ({ required: true, type: SchemaTypes.ObjectId, ref: 'User', index: true })
    createdBy!: Types.ObjectId;

    @Prop ({ type: [SchemaTypes.ObjectId], ref: 'User', default: [] })
    photographers!: Types.ObjectId[];

    @Prop ({ required: false, trim: true, default: '' })
    photographerInstructions!: string;

    @Prop ({ required: false, type: SchemaTypes.ObjectId, ref: 'User', default: null, index: true })
    assignedTo!: Types.ObjectId | null;

    // Tel RSVP's (bevestig of hangende) -- dit is "hoeveel mense het ingeskryf",
    // NIE "hoeveel mense het opgedaag" nie. Sien checkedInCount hieronder vir
    // werklike bywoning (QR-kode geskandeer).
    @Prop ({ default: 0 })
    confirmedAttendees!: number;

    // Tel net RSVP's wat werklik ingeteken is (checkedIn:true op die Rsvp-
    // dokument) -- word inkrementeer in rsvp.service.ts se checkInRsvp/scanRsvp,
    // presies soos confirmedAttendees vir skepping.
    @Prop ({ default: 0 })
    checkedInCount!: number;

    @Prop ({ default: 0, min: 0 })
    budget!: number;

    @Prop ({ type: String, enum: ATTENDANCE_ROLES, default: Role.GAS, index: true })
    intendedAttendance!: Role;

    @Prop ({ type: String, enum: Object.values(EventType), default: EventType.PUBLIC })
    type!: EventType;

    @Prop ({ default: false })
    sellsTickets!: boolean;

    @Prop ({ type: Number, default: null })
    ticketPrice!: number | null;

    @Prop ({ type: Number, default: null })
    ticketsAvailable!: number | null;

    createdAt?: Date;
    updatedAt?: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);