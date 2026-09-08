// ========== Imports: ==========
import { Injectable } from '@nestjs/common';
import { LstmService, PredictionResult } from '../analytics/lstm.service';
import { PreviewEventDto } from './dto/preview-event.dto';

@Injectable()
export class EventPlannerService {
    constructor (
        private readonly lstmService: LstmService,
    ) {}

    async PreviewEventDto(dto: PreviewEventDto): Promise<PredictionResult> {
        return this.lstmService.predictDraft(dto);
    }
}