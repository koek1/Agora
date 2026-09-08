// ========== Imports: ==========
import { Types } from 'mongoose';
import { EventDocument } from '../schemas/event.schema';
import { Role } from '../../common/enums/role.enums';
import { EventType } from '../../common/enums/event-type.enum';

/**
 * Public facing Event Shape
 * NEVER Includes internal mongoose fields such as _v
 */

export class EventResponseDto {
    id!: string;
    title!: string;
    description!: string;
    date!: Date;
    endDate?: Date;
    location!: string;
    address!: string;
    placeId!: string;
    lat!: number | null;
    lon!: number | null;
    maxCapacity!: number;
    budget!: number;
    createdBy!: string;
    photographers!: string[];
    photographerInstructions!: string;
    assignedTo!: string | null;
    confirmedAttendees!: number;
    checkedInCount!: number;
    intendedAttendance!: Role;
    type!: EventType;
    sellsTickets!: boolean;
    ticketPrice!: number | null;
    ticketsAvailable!: number | null;
    createdAt!: Date;
    updatedAt!: Date;

    static fromDocument(event: EventDocument): EventResponseDto {
        return {
            id:                         event._id.toString(),
            title:                      event.title,
            description:                event.description,
            date:                       event.date,
            endDate:                    event.endDate,
            location:                   event.location,
            address:                    event.address,
            placeId:                    event.placeId,
            lat:                        event.lat,
            lon:                        event.lon,
            maxCapacity:                event.maxCapacity,
            budget:                     event.budget ?? 0,
            createdBy:                  event.createdBy.toString(),
            photographers:              event.photographers.map((id: Types.ObjectId) => id.toString()),
            photographerInstructions:   event.photographerInstructions,
            assignedTo:                 event.assignedTo ? event.assignedTo.toString() : null,
            confirmedAttendees:         event.confirmedAttendees,
            checkedInCount:             event.checkedInCount,
            intendedAttendance:         event.intendedAttendance,
            type:                       event.type,
            sellsTickets:               event.sellsTickets,
            ticketPrice:                event.ticketPrice,
            ticketsAvailable:           event.ticketsAvailable,
            createdAt:                  event.createdAt!,
            updatedAt:                  event.updatedAt!,
        };
    }
}