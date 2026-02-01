import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdId } from '../common/decorators/household.decorator';
import { InsightsService } from './insights.service';

@Controller('api/insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get()
  getInsights(@HouseholdId() householdId: string) {
    return this.insightsService.getInsights(householdId);
  }
}
