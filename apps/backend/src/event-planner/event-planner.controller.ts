// ========== Imports: ==========
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enums';
import { PredictionResult } from '../analytics/lstm.service';
import { EventPlannerService } from './event-planner.service';
import { PreviewEventDto } from './dto/preview-event.dto';

@Controller('event-planner')
@UseGuards(JwtAuthGuard)
export class EventPlannerController {
    constructor (
        private readonly eventPlannerService: EventPlannerService,
    ) {}

    @Post('preview')
    @UseGuards(RolesGuard, ThrottlerGuard)
    @Throttle({ polling: { limit: 60, ttl: 60000 } })
    @SkipThrottle({ default: true })
    @Roles(Role.ADMIN, Role.DOSENT)
    async preview(
        @Body() dto: PreviewEventDto,
    ): Promise<PredictionResult> {
        return this.eventPlannerService.PreviewEventDto(dto);
    }
}