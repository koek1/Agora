// ========== Imports: ==========
import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import configuration from './configuration';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PlacesModule } from '../places/places.module';
import { RsvpModule } from '../rsvp/rsvp.module';
import { PaymentsModule } from '../payments/payments.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { PhotographersModule } from '../photographers/photographers.module';
import { ExportModule } from '../export/export.module';
import { CalendarModule } from '../calendar/calendar.module';
import { AccountModule } from '../account/account.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from '../health/health.module';


@Module({
    imports: [
    // ========== Global configuration ==========
    ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: path.join(__dirname, '../../.env'),
        load: [configuration],
    }),

    // ========== MongoDB connection ==========
    MongooseModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
        uri: config.get<string>('mongoUri'),
        }),
    }),

    // ========== Throttler Module for Requests ==========
    // 'default' bly streng - vir sensitiewe aksies soos login/registrasie.
    // 'polling' is ruimer - vir periodieke leesroetes wat AutoRefresh (web)
    // en useFocusEffect (mobile) elke 60s herhaal, moontlik oor verskeie
    // gelyktydige panele/kaarte op een bladsy (bv. Insights).
    ThrottlerModule.forRoot({
        throttlers: [
            {
                name: 'default',
                ttl: 60000,
                limit: 10,
            },
            {
                name: 'polling',
                ttl: 60000,
                limit: 60,
            },
        ],
    }),

    // ========== Domain modules ==========
    HealthModule,
    MessagingModule,    // RabbitMQ must load before consumers
    UsersModule,
    AuthModule,
    NotificationsModule,
    AuditModule,
    EventsModule,
    PlacesModule,
    RsvpModule,
    PaymentsModule,
    AnalyticsModule,
    PhotographersModule,
    ExportModule,
    CalendarModule,
    AccountModule,
    ],
})
export class AppModule {}