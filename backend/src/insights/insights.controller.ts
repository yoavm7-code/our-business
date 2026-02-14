import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { HouseholdId } from '../common/decorators/household.decorator';
import { INSIGHT_SECTIONS, InsightSection } from './insights.service';
import { InsightsService } from './insights.service';

// Map frontend section aliases → backend section names
const SECTION_ALIASES: Record<string, InsightSection> = {
  monthlySummary: 'cashFlowHealth',
  taxTips: 'taxOptimization',
  spendingInsights: 'spendingPatterns',
  clientInsights: 'clientDiversification',
  invoiceInsights: 'invoiceBehavior',
};

@Controller('api/insights')
@UseGuards(JwtAuthGuard)
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get()
  async getInsights(
    @HouseholdId() businessId: string,
    @Query('lang') lang?: string,
    @CurrentUser() user?: { countryCode?: string | null; businessField?: string | null },
  ) {
    const data = await this.insightsService.getInsights(businessId, lang, user?.countryCode ?? undefined, user?.businessField ?? undefined);
    // Return data with both backend keys AND frontend alias keys
    return {
      ...data,
      monthlySummary: data.cashFlowHealth,
      taxTips: data.taxOptimization,
      spendingInsights: data.spendingPatterns,
      clientInsights: data.clientDiversification,
      invoiceInsights: data.invoiceBehavior,
    };
  }

  @Get(':section')
  getInsightSection(
    @HouseholdId() businessId: string,
    @Param('section') section: string,
    @Query('lang') lang?: string,
    @CurrentUser() user?: { countryCode?: string | null; businessField?: string | null },
  ) {
    const resolved = SECTION_ALIASES[section] ?? section;
    if (!INSIGHT_SECTIONS.includes(resolved as InsightSection)) {
      throw new BadRequestException(`Invalid section: ${section}. Valid sections: ${INSIGHT_SECTIONS.join(', ')}`);
    }
    return this.insightsService.getInsightSection(businessId, resolved as InsightSection, lang, user?.countryCode ?? undefined, user?.businessField ?? undefined);
  }
}
