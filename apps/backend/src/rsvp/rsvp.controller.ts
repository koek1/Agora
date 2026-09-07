// ========== Imports: ==========
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Res, StreamableFile, UseGuards, Query } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { Role } from '../common/enums/role.enums';
import { RsvpService, ScanResponse } from './rsvp.service';
import { CreateRsvpDto } from './dto/create-rsvp.dto';
import { CreateWalkInDto } from './dto/create-walk-in.dto';
import { RsvpDocument } from './schemas/rsvp.schema';
import { ScanRsvpDto } from './dto/scan-rsvp.dto';
import { RsvpResponseDto } from './dto/rsvp-response.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FindMyRsvpsQueryDto } from './dto/find-my-rsvps-query.dto';

@Controller('rsvp')
@UseGuards(JwtAuthGuard)
export class RsvpController {
    constructor(private readonly rsvpService: RsvpService) {}

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createRsvp(
        @Body() dto: CreateRsvpDto,
        @CurrentUser() user: JwtPayload,
    ): Promise <RsvpDocument> {
        return this.rsvpService.createRsvp(dto, user.sub);
    }

    @Post('scan')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    @HttpCode(HttpStatus.OK)
    async scanRsvp(
        @Body() dto: ScanRsvpDto,
        @CurrentUser() user: JwtPayload,
    ): Promise <ScanResponse> {
        return this.rsvpService.scanRsvp(dto.qrPayload, user.sub, user.role);
    }

    @Post('walk-in')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    @HttpCode(HttpStatus.CREATED)
    async registerWalkIn(
        @Body() dto: CreateWalkInDto,
        @CurrentUser() user: JwtPayload,
    ): Promise<RsvpResponseDto> {
        const rsvp = await this.rsvpService.registerWalkIn(dto, user.sub, user.role);
        return RsvpResponseDto.fromDocument(rsvp as RsvpDocument & { user?: UserDocument | null });
    }

    @Get('my')
    @UseGuards(ThrottlerGuard)
    @Throttle({ polling: { limit: 60, ttl: 60000 } })
    async findMyRsvps(
        @CurrentUser() user: JwtPayload,
        @Query() query: FindMyRsvpsQueryDto,
    ): Promise <RsvpDocument[]> {
        return this.rsvpService.findMyRsvps(user.sub, query.dateFrom, query.dateTo);
    }

    @Get('event/:eventId')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    async findRsvpsByEvent(
        @Param('eventId') eventId: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<RsvpResponseDto[]> {
        const rsvps = await this.rsvpService.findRsvpsByEvent(eventId, user.sub, user.role);
        return rsvps.map(r => RsvpResponseDto.fromDocument(r as RsvpDocument & { user: UserDocument }));
    }

    @Patch(':id/check-in')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.DOSENT)
    async checkIn(
        @Param('id') id: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<RsvpResponseDto> {
        const rsvp = await this.rsvpService.checkInRsvp(id, user.sub, user.role);
        return RsvpResponseDto.fromDocument(rsvp as RsvpDocument & { user: UserDocument });
    }

    @Get (':id/qr')
    async getQrCode(
        @Param('id') id: string,
        @CurrentUser() user: JwtPayload,
        @Res ({ passthrough: true }) res: Response,
    ): Promise <StreamableFile> {
        const buffer = await this.rsvpService.getQrCode(id, user.sub, user.role);
        res.set('Content-Type', 'image/png');
        return new StreamableFile(buffer);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async cancelRsvp(
        @Param('id') id: string,
        @CurrentUser() user: JwtPayload,
    ): Promise<void> {
        return this.rsvpService.cancelRsvp(id, user.sub, user.role);
    }
}
