import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { CreateAlertRuleDto, UpdateAlertRuleDto } from './dto/create-alert-rule.dto';
import { CreateReportScheduleDto, UpdateReportScheduleDto } from './dto/create-report-schedule.dto';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  // ─── Alert Rules ───────────────────────────────────────

  @Get('alert-rules')
  getAlertRules(@CurrentUser() user: { id: string; businessId: string }) {
    return this.service.getAlertRules(user.businessId, user.id);
  }

  @Post('alert-rules')
  createAlertRule(
    @CurrentUser() user: { id: string; businessId: string },
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.service.createAlertRule(user.businessId, user.id, dto);
  }

  @Put('alert-rules/:id')
  updateAlertRule(
    @CurrentUser() user: { id: string; businessId: string },
    @Param('id') id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.service.updateAlertRule(id, user.businessId, dto);
  }

  @Delete('alert-rules/:id')
  deleteAlertRule(
    @CurrentUser() user: { id: string; businessId: string },
    @Param('id') id: string,
  ) {
    return this.service.deleteAlertRule(id, user.businessId);
  }

  // ─── Report Schedules ─────────────────────────────────

  @Get('report-schedules')
  getReportSchedules(@CurrentUser() user: { id: string; businessId: string }) {
    return this.service.getReportSchedules(user.businessId, user.id);
  }

  @Post('report-schedules')
  createReportSchedule(
    @CurrentUser() user: { id: string; businessId: string },
    @Body() dto: CreateReportScheduleDto,
  ) {
    return this.service.createReportSchedule(user.businessId, user.id, dto);
  }

  @Put('report-schedules/:id')
  updateReportSchedule(
    @CurrentUser() user: { id: string; businessId: string },
    @Param('id') id: string,
    @Body() dto: UpdateReportScheduleDto,
  ) {
    return this.service.updateReportSchedule(id, user.businessId, dto);
  }

  @Delete('report-schedules/:id')
  deleteReportSchedule(
    @CurrentUser() user: { id: string; businessId: string },
    @Param('id') id: string,
  ) {
    return this.service.deleteReportSchedule(id, user.businessId);
  }
}
