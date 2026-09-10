// ========== Imports: ==========
import { Module } from "@nestjs/common";
import { AnalyticsModule } from "../analytics/analytics.module";
import { EventPlannerService } from "./event-planner.service";
import { EventPlannerController } from "./event-planner.controller";

@Module({
    imports: [AnalyticsModule],
    providers: [EventPlannerService],
    controllers: [EventPlannerController],
    exports: [],
})

export class EventPlannerModule {}