import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ─── Alert Rules CRUD ──────────────────────────────────

  async getAlertRules(businessId: string, userId: string) {
    return this.prisma.alertRule.findMany({
      where: { businessId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAlertRule(businessId: string, userId: string, data: {
    name: string; metric: string; operator: string; threshold: number;
    enabled?: boolean; emailNotify?: boolean; cooldownHours?: number;
  }) {
    return this.prisma.alertRule.create({
      data: {
        businessId,
        userId,
        name: data.name,
        metric: data.metric,
        operator: data.operator,
        threshold: data.threshold,
        enabled: data.enabled ?? true,
        emailNotify: data.emailNotify ?? true,
        cooldownHours: data.cooldownHours ?? 24,
      },
    });
  }

  async updateAlertRule(id: string, businessId: string, data: {
    name?: string; metric?: string; operator?: string; threshold?: number;
    enabled?: boolean; emailNotify?: boolean; cooldownHours?: number;
  }) {
    return this.prisma.alertRule.update({
      where: { id, businessId },
      data,
    });
  }

  async deleteAlertRule(id: string, businessId: string) {
    return this.prisma.alertRule.delete({
      where: { id, businessId },
    });
  }

  // ─── Report Schedules CRUD ─────────────────────────────

  async getReportSchedules(businessId: string, userId: string) {
    return this.prisma.reportSchedule.findMany({
      where: { businessId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createReportSchedule(businessId: string, userId: string, data: {
    reportType: string; frequency: string; dayOfWeek?: number;
    dayOfMonth?: number; hour?: number; enabled?: boolean;
  }) {
    return this.prisma.reportSchedule.create({
      data: {
        businessId,
        userId,
        reportType: data.reportType,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        hour: data.hour ?? 8,
        enabled: data.enabled ?? true,
      },
    });
  }

  async updateReportSchedule(id: string, businessId: string, data: {
    reportType?: string; frequency?: string; dayOfWeek?: number;
    dayOfMonth?: number; hour?: number; enabled?: boolean;
  }) {
    return this.prisma.reportSchedule.update({
      where: { id, businessId },
      data,
    });
  }

  async deleteReportSchedule(id: string, businessId: string) {
    return this.prisma.reportSchedule.delete({
      where: { id, businessId },
    });
  }

  // ─── Scheduled Alert Checking (every hour) ─────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkAlertRules() {
    if (!this.email.isConfigured) return;

    const rules = await this.prisma.alertRule.findMany({
      where: { enabled: true, emailNotify: true },
    });

    for (const rule of rules) {
      try {
        // Check cooldown
        if (rule.lastTriggeredAt) {
          const hoursSince = (Date.now() - rule.lastTriggeredAt.getTime()) / (1000 * 60 * 60);
          if (hoursSince < rule.cooldownHours) continue;
        }

        const currentValue = await this.computeMetric(rule.businessId, rule.metric);
        if (currentValue === null) continue;

        const triggered = this.evaluateCondition(currentValue, rule.operator, Number(rule.threshold));
        if (!triggered) continue;

        // Get user email
        const user = await this.prisma.user.findFirst({ where: { id: rule.userId } });
        if (!user?.email) continue;

        // Send alert email
        await this.sendAlertEmail(user.email, user.name || user.email, rule.name, rule.metric, currentValue, Number(rule.threshold), rule.operator);

        // Update last triggered
        await this.prisma.alertRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: new Date(), lastValue: currentValue },
        });

        this.logger.log(`Alert "${rule.name}" triggered for user ${user.email}: ${rule.metric} = ${currentValue}`);
      } catch (err) {
        this.logger.error(`Error checking alert rule ${rule.id}: ${err}`);
      }
    }
  }

  // ─── Scheduled Report Sending (every hour) ─────────────

  @Cron(CronExpression.EVERY_HOUR)
  async checkReportSchedules() {
    if (!this.email.isConfigured) return;

    const now = new Date();
    const currentHour = now.getHours();
    const currentDow = now.getDay(); // 0=Sun
    const currentDom = now.getDate();

    const schedules = await this.prisma.reportSchedule.findMany({
      where: { enabled: true, hour: currentHour },
    });

    for (const schedule of schedules) {
      try {
        // Check if today is the right day
        if (schedule.frequency === 'weekly' && schedule.dayOfWeek !== currentDow) continue;
        if (schedule.frequency === 'monthly' && schedule.dayOfMonth !== currentDom) continue;

        // Check if already sent today
        if (schedule.lastSentAt) {
          const lastSent = new Date(schedule.lastSentAt);
          if (lastSent.toDateString() === now.toDateString()) continue;
        }

        // Get user email
        const user = await this.prisma.user.findFirst({ where: { id: schedule.userId } });
        if (!user?.email) continue;

        // Send report email
        await this.sendReportEmail(user.email, user.name || user.email, schedule.reportType, schedule.businessId);

        // Update last sent
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { lastSentAt: now },
        });

        this.logger.log(`Report "${schedule.reportType}" sent to ${user.email}`);
      } catch (err) {
        this.logger.error(`Error sending scheduled report ${schedule.id}: ${err}`);
      }
    }
  }

  // ─── Metric Computation ────────────────────────────────

  private async computeMetric(businessId: string, metric: string): Promise<number | null> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    switch (metric) {
      case 'monthly_income': {
        const result = await this.prisma.transaction.aggregate({
          where: { businessId, date: { gte: startOfMonth, lte: endOfMonth }, amount: { gt: 0 } },
          _sum: { amount: true },
        });
        return Number(result._sum.amount) || 0;
      }
      case 'monthly_expenses': {
        const result = await this.prisma.transaction.aggregate({
          where: { businessId, date: { gte: startOfMonth, lte: endOfMonth }, amount: { lt: 0 } },
          _sum: { amount: true },
        });
        return Math.abs(Number(result._sum.amount) || 0);
      }
      case 'cash_flow': {
        const result = await this.prisma.transaction.aggregate({
          where: { businessId, date: { gte: startOfMonth, lte: endOfMonth } },
          _sum: { amount: true },
        });
        return Number(result._sum.amount) || 0;
      }
      case 'account_balance': {
        const accounts = await this.prisma.account.findMany({
          where: { businessId, isActive: true, type: { in: ['BANK', 'CASH'] } },
        });
        return accounts.reduce((sum, a) => sum + Number(a.balance), 0);
      }
      case 'unpaid_invoices': {
        const result = await this.prisma.invoice.aggregate({
          where: { businessId, status: { in: ['SENT', 'VIEWED', 'OVERDUE'] } },
          _sum: { total: true },
        });
        return Number(result._sum.total) || 0;
      }
      case 'overdue_invoices': {
        const count = await this.prisma.invoice.count({
          where: { businessId, status: { in: ['SENT', 'VIEWED'] }, dueDate: { lt: now } },
        });
        return count;
      }
      case 'budget_usage': {
        // Returns the maximum budget usage percentage across all active budgets
        const budgets = await this.prisma.budget.findMany({
          where: { businessId, isActive: true },
        });
        let maxPercent = 0;
        for (const budget of budgets) {
          const spent = await this.prisma.transaction.aggregate({
            where: {
              businessId,
              categoryId: budget.categoryId,
              date: { gte: startOfMonth, lte: endOfMonth },
              amount: { lt: 0 },
            },
            _sum: { amount: true },
          });
          const totalSpent = Math.abs(Number(spent._sum.amount) || 0);
          const percent = Number(budget.amount) > 0 ? (totalSpent / Number(budget.amount)) * 100 : 0;
          if (percent > maxPercent) maxPercent = percent;
        }
        return Math.round(maxPercent);
      }
      default:
        return null;
    }
  }

  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      default: return false;
    }
  }

  // ─── Email Templates ───────────────────────────────────

  private async sendAlertEmail(
    to: string, userName: string, ruleName: string,
    metric: string, value: number, threshold: number, operator: string,
  ) {
    const operatorText = { gt: '>', lt: '<', gte: '>=', lte: '<=' }[operator] || operator;
    const subject = `FreelancerOS Alert: ${ruleName}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 20px;">FreelancerOS</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Alert Notification</p>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
          <p>Hi ${userName},</p>
          <p>Your alert rule <strong>${ruleName}</strong> has been triggered:</p>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-weight: 600;">Metric: ${metric.replace(/_/g, ' ')}</p>
            <p style="margin: 4px 0 0;">Current value: <strong>${value.toLocaleString()}</strong> (threshold: ${operatorText} ${threshold.toLocaleString()})</p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Log in to FreelancerOS to review your data and take action.</p>
        </div>
      </div>
    `;
    await (this.email as any).send(to, subject, html);
  }

  private async sendReportEmail(to: string, userName: string, reportType: string, businessId: string) {
    const reportNames: Record<string, string> = {
      pnl: 'Profit & Loss',
      cashflow: 'Cash Flow',
      clients: 'Clients Summary',
      categories: 'Category Breakdown',
      tax: 'Tax Summary',
    };

    const subject = `FreelancerOS Report: ${reportNames[reportType] || reportType}`;
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; padding: 24px; color: white; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 20px;">FreelancerOS</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Scheduled Report</p>
        </div>
        <div style="background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
          <p>Hi ${userName},</p>
          <p>Your scheduled <strong>${reportNames[reportType] || reportType}</strong> report is ready.</p>
          <p>Log in to FreelancerOS to view the full report with charts and detailed breakdowns.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            You're receiving this because you set up a scheduled report. You can manage your schedules in Settings > Notifications.
          </p>
        </div>
      </div>
    `;
    await (this.email as any).send(to, subject, html);
  }
}
