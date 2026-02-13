import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZReportService {
  constructor(private prisma: PrismaService) {}

  /** Generate a Z-Report for a specific date by aggregating transactions and invoices */
  async generate(businessId: string, dateStr: string) {
    const date = new Date(dateStr);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    // Check if report already exists for this date
    const existing = await this.prisma.zReport.findUnique({
      where: {
        businessId_reportDate: {
          businessId,
          reportDate: startOfDay,
        },
      },
    });

    if (existing?.isClosed) {
      throw new BadRequestException('Z-Report for this date is already closed and cannot be regenerated');
    }

    // Aggregate transactions for the day
    const transactions = await this.prisma.transaction.findMany({
      where: {
        businessId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: { account: true },
    });

    // Aggregate invoices for the day
    const invoices = await this.prisma.invoice.findMany({
      where: {
        businessId,
        issueDate: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
      orderBy: { invoiceNumber: 'asc' },
    });

    // Calculate totals
    let totalSales = 0;
    let totalCash = 0;
    let totalCredit = 0;
    let totalChecks = 0;
    let totalTransfers = 0;
    let totalRefunds = 0;
    let totalVat = 0;

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (amount > 0) {
        totalSales += amount;
        // Categorize by account type
        const accType = tx.account?.type;
        if (accType === 'CASH') totalCash += amount;
        else if (accType === 'CREDIT_CARD') totalCredit += amount;
        else if (accType === 'BANK') totalTransfers += amount;
        else totalTransfers += amount;
      } else {
        totalRefunds += Math.abs(amount);
      }

      if (tx.vatAmount) totalVat += Number(tx.vatAmount);
    }

    // Also sum from invoices if different
    for (const inv of invoices) {
      if (inv.vatAmount) totalVat += Number(inv.vatAmount);
    }

    const netTotal = totalSales - totalRefunds;

    // Get invoice number range
    const firstInvoiceNum = invoices.length > 0 ? invoices[0].invoiceNumber : null;
    const lastInvoiceNum = invoices.length > 0 ? invoices[invoices.length - 1].invoiceNumber : null;

    // Get next report number
    const lastReport = await this.prisma.zReport.findFirst({
      where: { businessId },
      orderBy: { reportNumber: 'desc' },
      select: { reportNumber: true },
    });
    const reportNumber = existing?.reportNumber ?? (lastReport ? lastReport.reportNumber + 1 : 1);

    // Upsert the report
    const report = await this.prisma.zReport.upsert({
      where: {
        businessId_reportDate: {
          businessId,
          reportDate: startOfDay,
        },
      },
      create: {
        businessId,
        reportDate: startOfDay,
        reportNumber,
        totalSales,
        totalCash,
        totalCredit,
        totalChecks,
        totalTransfers,
        totalRefunds,
        totalVat,
        netTotal,
        transactionCount: transactions.length,
        invoiceCount: invoices.length,
        firstInvoiceNum,
        lastInvoiceNum,
      },
      update: {
        totalSales,
        totalCash,
        totalCredit,
        totalChecks,
        totalTransfers,
        totalRefunds,
        totalVat,
        netTotal,
        transactionCount: transactions.length,
        invoiceCount: invoices.length,
        firstInvoiceNum,
        lastInvoiceNum,
      },
    });

    return this.formatReport(report);
  }

  /** Get Z-Report by date */
  async getByDate(businessId: string, dateStr: string) {
    const date = new Date(dateStr);
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const report = await this.prisma.zReport.findUnique({
      where: {
        businessId_reportDate: {
          businessId,
          reportDate: startOfDay,
        },
      },
    });

    if (!report) {
      throw new NotFoundException('No Z-Report found for this date');
    }

    return this.formatReport(report);
  }

  /** List Z-Reports in date range */
  async list(businessId: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { businessId };

    if (from || to) {
      where.reportDate = {};
      if (from) (where.reportDate as any).gte = new Date(from);
      if (to) (where.reportDate as any).lte = new Date(to);
    }

    const reports = await this.prisma.zReport.findMany({
      where,
      orderBy: { reportDate: 'desc' },
    });

    return reports.map((r) => this.formatReport(r));
  }

  /** Close/finalize a Z-Report */
  async close(businessId: string, id: string) {
    const report = await this.prisma.zReport.findFirst({
      where: { id, businessId },
    });

    if (!report) {
      throw new NotFoundException('Z-Report not found');
    }

    if (report.isClosed) {
      throw new BadRequestException('Z-Report is already closed');
    }

    const updated = await this.prisma.zReport.update({
      where: { id },
      data: {
        isClosed: true,
        closedAt: new Date(),
      },
    });

    return this.formatReport(updated);
  }

  private formatReport(report: any) {
    return {
      id: report.id,
      reportDate: report.reportDate.toISOString().slice(0, 10),
      reportNumber: report.reportNumber,
      totalSales: Number(report.totalSales),
      totalCash: Number(report.totalCash),
      totalCredit: Number(report.totalCredit),
      totalChecks: Number(report.totalChecks),
      totalTransfers: Number(report.totalTransfers),
      totalRefunds: Number(report.totalRefunds),
      totalVat: Number(report.totalVat),
      netTotal: Number(report.netTotal),
      transactionCount: report.transactionCount,
      invoiceCount: report.invoiceCount,
      firstInvoiceNum: report.firstInvoiceNum,
      lastInvoiceNum: report.lastInvoiceNum,
      notes: report.notes,
      isClosed: report.isClosed,
      closedAt: report.closedAt?.toISOString() ?? null,
    };
  }
}
