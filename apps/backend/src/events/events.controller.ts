// ========== Imports: ==========
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enums';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AssignPhotographerDto } from './dto/assign-photographer.dto';
import { EventResponseDto } from './dto/event-response.dto';
import { FindEventsQueryDto } from './dto/find-events-query.dto';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    @UseGuards(ThrottlerGuard)
    @Throttle({ polling: { limit: 60, ttl: 60000 } })
    @SkipThrottle({ default: true })
    async findAll(
        @CurrentUser() user: JwtPayload,
        @Query() query: FindEventsQueryDto,
    ): Promise<EventResponseDto[]> {
        const events = await this.eventsService.findAll(
            user.role,
            user.sub,
            query.from,
            query.to,
        );
        return events.map(EventResponseDto.fromDocument);
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<EventResponseDto> {
        const event = await this.eventsService.findById(id, user.role, user.sub);
        return EventResponseDto.fromDocument(event);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() dto: CreateEventDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<EventResponseDto> {
        const event = await this.eventsService.create(dto, user.sub);
        return EventResponseDto.fromDocument(event);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateEventDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<EventResponseDto> {
        const event = await this.eventsService.updateEvent(id, dto, user.sub, user.role);
        return EventResponseDto.fromDocument(event);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(
        @Param('id') id: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<void> {
        await this.eventsService.deleteEvent(id, user.sub, user.role);
    }

    @Patch(':id/assign-photographer')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    async assignPhotographer(
        @Param('id') id: string,
        @Body() dto: AssignPhotographerDto,
    ): Promise<EventResponseDto> {
        const event = await this.eventsService.assignPhotographer(id, dto);
        return EventResponseDto.fromDocument(event);
    }
}
