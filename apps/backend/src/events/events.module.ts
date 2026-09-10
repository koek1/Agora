// ========== Imports: ==========
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Event, EventSchema } from './schemas/event.schema';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { UsersModule } from '../users/users.module';
import { PlacesModule } from '../places/places.module';

@Module ({
    imports: [
        MongooseModule.forFeature ([{ name: Event.name, schema: EventSchema }]),
        UsersModule, PlacesModule,
    ],
    providers: [EventsService],
    controllers: [EventsController],
    exports: [EventsService],
})
export class EventsModule {}