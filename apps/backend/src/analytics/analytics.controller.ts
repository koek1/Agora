// ========== Imports: ==========
import { Body, Controller, Get, Param, Post, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '../common/enums/role.enums';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { LstmService, TrainingDataItem, PredictionResult, PredictionAccuracyItem, ModelStatus } from './lstm.service';
import { AnalyticsService, AttendancePrediction, EventsPerMonth, RsvpPerEvent, AdminKpis, RecentRsvp, RsvpStatusCount, BudgetPerMonth, TicketRevenueSummary, EventRevenue, RevenuePerMonth } from './analytics.service';
import { Trend } from './dto/trend.dto';
import { PredictDraftEventDto } from './dto/predict-draft-event.dto';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';

interface EventsSummaryResponse {
    eventsPerMonth: EventsPerMonth[];
    top5Events: RsvpPerEvent[];
}

interface RsvpSummaryResponse {
    rsvpsPerEvent: RsvpPerEvent[];
    averageFillRate: number;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
    constructor(
        private readonly lstmService: LstmService,
        private readonly analyticsService: AnalyticsService,
    ) {}

    @Get('training-data')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    async getTrainingData(
        @Query('eventId') eventId?: string,
    ): Promise<TrainingDataItem[]> {
        return this.lstmService.getTrainingData(eventId);
    }

    @Get('events-summary')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getEventsSummary(): Promise<EventsSummaryResponse> {
        const [eventsPerMonth, top5Events] = await Promise.all([
            this.analyticsService.getEventsPerMonth(),
            this.analyticsService.getTop5Events(),
        ]);
        return { eventsPerMonth, top5Events };
    }

    @Get('rsvp-summary')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getRsvpSummary(): Promise<RsvpSummaryResponse> {
        const [rsvpsPerEvent, averageFillRate] = await Promise.all([
            this.analyticsService.getRsvpsPerEvent(),
            this.analyticsService.getAverageFillRate(),
        ]);
        return { rsvpsPerEvent, averageFillRate };
    }

    @Get('admin-kpis')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getAdminKpis(): Promise <AdminKpis> {
        return this.analyticsService.getAdminKpis();
    }

    @Get('rsvps-per-month')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getRsvpsPerMonth(): Promise <EventsPerMonth[]> {
        return this.analyticsService.getRsvpsPerMonth();
    }

    @Get('recent-rsvps')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getRecentRsvps(@Query('limit') limit?: string): Promise <RecentRsvp[]> {
        return this.analyticsService.getRecentRsvps(limit ? parseInt(limit, 10) : 10);
    }

    @Get('rsvp-status-breakdown')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getRsvpStatusBreakdown(): Promise<RsvpStatusCount[]> {
        return this.analyticsService.getRsvpStatusBreakdown();
    }

    @Get ('ticket-revenue-summary')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getTicketRevenueSummary(): Promise <TicketRevenueSummary> {
        return this.analyticsService.getTicketRevenueSummary();
    }

    @Get('revenue-per-event')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getRevenuePerEvent(): Promise <EventRevenue[]> {
        return this.analyticsService.getRevenuePerEvent();
    }

    @Get('revenue-per-month')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN)
    async getRevenuePerMonth(): Promise <RevenuePerMonth[]> {
        return this.analyticsService.getRevenuePerMonth();
    }

    @Get('events-trend')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    async getEventsTrend(): Promise<Trend> {
        return this.analyticsService.getEventsTrend();
    }

    @Get('rsvps-trend')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    async getRsvpsTrend(): Promise<Trend> {
        return this.analyticsService.getRsvpsTrend();
    }

    // Same scoping rule as budget-per-month: ADMIN sees the full trend, everyone else sees only their own.
    @Get('budget-trend')
    async getBudgetTrend(@CurrentUser() user: JwtPayload): Promise<Trend> {
        const assignedToUserId = user.role === Role.ADMIN ? undefined : user.sub;
        return this.analyticsService.getBudgetTrend(assignedToUserId);
    }

    @Get('revenue-trend')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    async getRevenueTrend(): Promise<Trend> {
        return this.analyticsService.getRevenueTrend();
    }

    // ADMIN sien die volle begroting oor alle geleenthede. Enige ander aangemelde
    // gebruiker sien slegs die begroting van geleenthede waaraan hulle (as die
    // Finansies-toegekende persoon) toegewys is, of 'n leë lys as hulle aan niks
    // toegewys is nie.
    @Get('budget-per-month')
    @UseGuards(ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    async getBudgetPerMonth(@CurrentUser() user: JwtPayload): Promise<BudgetPerMonth[]> {
        const assignedToUserId = user.role === Role.ADMIN ? undefined : user.sub;
        return this.analyticsService.getBudgetPerMonth(assignedToUserId);
    }

    @Get('export')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    async exportCsv(
        @Query('type') type: string,
        @Res() res: Response,
    ): Promise<void> {
        const date = new Date().toISOString().slice(0, 10);
        const csv = await this.analyticsService.exportToCsv(type);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="uitvoer-${type}-${date}.csv"`);
        res.send(csv);
    }

    // Wether a trained KI-model exists on disk right now, and how accurate it was during training - 
    // lets the 'Insigte' page show a status indicator without needing to run the real prediction first
    @Get('model-status')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({ polling: {limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN, Role.DOSENT)
    async getModelStatus(): Promise<ModelStatus> {
        return this.lstmService.getModelStatus();
    }

    @Get('predict/:eventId')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    async predictAttendance(
        @Param('eventId') eventId: string,
    ): Promise<AttendancePrediction> {
        return this.analyticsService.predictAttendance(eventId);
    }

    @Get('prediction')
    @UseGuards(ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    async getAttendancePrediction(
        @Query('eventId') eventId: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<PredictionResult> {
        await this.analyticsService.assertInsightAccess(eventId, user);
        return this.lstmService.predictAttendance(eventId);
    }

    @Post('predict-draft')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    async predictDraftAttendance(
        @Body() dto: PredictDraftEventDto,
    ): Promise<PredictionResult> {
        return this.lstmService.predictDraft(dto);
    }

    // Report-card view: for a set of completed events, how close was the model's
    // forward-looking guess to what actually happened.
    @Get('prediction-accuracy')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({polling: { limit: 60, ttl: 60000}})
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN, Role.DOSENT)
    async getPredictionAccuracy(
        @Query('eventIds') eventIds: string | undefined,
        @CurrentUser() user: JwtPayload,
    ): Promise <PredictionAccuracyItem[]> {
        const ids = (eventIds ?? '').split(',').map((id) => id.trim()).filter(Boolean);
        if (ids.length === 0) return [];
        for (const id of ids) {
            await this.analyticsService.assertInsightAccess(id, user);
        }
        return this.lstmService.getPredictionAccuracy(ids);
    }
}
