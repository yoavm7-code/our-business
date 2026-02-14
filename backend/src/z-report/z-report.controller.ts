import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdId } from '../common/decorators/household.decorator';
import { ZReportService } from './z-report.service';

@Controller('api/reports/z-report')
@UseGuards(JwtAuthGuard)
export class ZReportController {
  constructor(private zReportService: ZReportService) {}

  /** Generate a Z-Report for a specific date */
  @Post('generate')
  generate(
    @HouseholdId() businessId: string,
    @Body() dto: { date: string },
  ) {
    return this.zReportService.generate(businessId, dto.date);
  }

  /** Get Z-Report for a specific date */
  @Get()
  getByDate(
    @HouseholdId() businessId: string,
    @Query('date') date: string,
  ) {
    return this.zReportService.getByDate(businessId, date);
  }

  /** List Z-Reports */
  @Get('list')
  list(
    @HouseholdId() businessId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.zReportService.list(businessId, from, to);
  }

  /** Generate monthly Z-Report */
  @Post('generate-monthly')
  generateMonthly(
    @HouseholdId() businessId: string,
    @Body() dto: { year: number; month: number },
  ) {
    return this.zReportService.generateMonthly(businessId, dto.year, dto.month);
  }

  /** Close/finalize a Z-Report */
  @Post(':id/close')
  close(
    @HouseholdId() businessId: string,
    @Param('id') id: string,
  ) {
    return this.zReportService.close(businessId, id);
  }
}
