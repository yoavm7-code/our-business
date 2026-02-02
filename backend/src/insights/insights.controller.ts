import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdId } from '../common/decorators/household.decorator';
import { INSIGHT_SECTIONS, InsightSection } from './insights.service';
import { InsightsService } from './insights.service';

@Controller('api/insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get()
  getInsights(@HouseholdId() householdId: string, @Query('lang') lang?: string) {
    return this.insightsService.getInsights(householdId, lang);
  }

  @Get(':section')
  getInsightSection(
    @HouseholdId() householdId: string,
    @Param('section') section: string,
    @Query('lang') lang?: string,
  ) {
    if (!INSIGHT_SECTIONS.includes(section as InsightSection)) {
      throw new BadRequestException(`Invalid section: ${section}`);
    }
    return this.insightsService.getInsightSection(householdId, section as InsightSection, lang);
  }
}
