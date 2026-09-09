// ========== Imports: ==========
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsModule } from '../events/events.module';
import { Event, EventSchema } from '../events/schemas/event.schema';
import { Rsvp, RsvpSchema } from '../rsvp/schemas/rsvp.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { LstmService } from './lstm.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { User, UserSchema } from '../users/schemas/user.schema';


// Importing MongooseModule.forFeature here gives the LstmService direct access to the Rsvp model:

@Module ({
    imports: [  
        EventsModule,
        MongooseModule.forFeature([
            { name: Event.name, schema: EventSchema },
            { name: User.name, schema: UserSchema },
            { name: Rsvp.name, schema: RsvpSchema},
            { name: Payment.name, schema: PaymentSchema },
        ]),
    ],
    providers: [LstmService, AnalyticsService],
    controllers: [AnalyticsController],
    exports: [LstmService],
})
export class AnalyticsModule {}