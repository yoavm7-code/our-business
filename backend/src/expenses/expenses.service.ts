import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    businessId: string,
    params: {
      from?: string;
      to?: string;
      categoryId?: string;
      search?: string;
      page: number;
      limit: number;
    },
  ) {
    const where: Record<string, unknown> = { businessId };

    if (params.from || params.to) {
      where.date = {};
      if (params.from) (where.date as any).gte = new Date(params.from);
      if (params.to) (where.date as any).lte = new Date(params.to);
    }
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.search) {
      where.OR = [
        { description: { contains: params.search, mode: 'insensitive' } },
        { vendor: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, total, page: params.page, limit: params.limit };
  }

  async getSummary(businessId: string, from?: string, to?: string) {
    const dateFilter: Record<string, unknown> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);

    const where: Record<string, unknown> = {
      businessId,
      ...(from || to ? { date: dateFilter } : {}),
    };

    const [result, byCategory, totalCount] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true, vatAmount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['categoryId'],
        where,
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      totalExpenses: Number(result._sum.amount ?? 0),
      totalVat: Number(result._sum.vatAmount ?? 0),
      count: totalCount,
      byCategory,
    };
  }

  async findOne(businessId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, businessId },
    });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async create(
    businessId: string,
    dto: {
      accountId: string;
      categoryId?: string;
      date: string;
      description: string;
      amount: number;
      currency?: string;
      vendor?: string;
      vatAmount?: number;
      isRecurring?: boolean;
      isTaxDeductible?: boolean;
      deductionRate?: number;
      notes?: string;
      customFields?: Record<string, unknown>;
    },
  ) {
    return this.prisma.expense.create({
      data: {
        businessId,
        accountId: dto.accountId,
        categoryId: dto.categoryId ?? null,
        date: new Date(dto.date),
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'ILS',
        vendor: dto.vendor ?? null,
        vatAmount: dto.vatAmount ?? null,
        isRecurring: dto.isRecurring ?? false,
        isTaxDeductible: dto.isTaxDeductible ?? true,
        deductionRate: dto.deductionRate ?? null,
        notes: dto.notes ?? null,
        customFields: dto.customFields ?? null,
      },
    });
  }

  async update(
    businessId: string,
    id: string,
    dto: {
      accountId?: string;
      categoryId?: string | null;
      date?: string;
      description?: string;
      amount?: number;
      vendor?: string;
      vatAmount?: number;
      isRecurring?: boolean;
      isTaxDeductible?: boolean;
      deductionRate?: number;
      notes?: string;
      customFields?: Record<string, unknown>;
    },
  ) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Expense not found');

    const data: Record<string, unknown> = {};
    if (dto.accountId !== undefined) data.accountId = dto.accountId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.vendor !== undefined) data.vendor = dto.vendor || null;
    if (dto.vatAmount !== undefined) data.vatAmount = dto.vatAmount;
    if (dto.isRecurring !== undefined) data.isRecurring = dto.isRecurring;
    if (dto.isTaxDeductible !== undefined) data.isTaxDeductible = dto.isTaxDeductible;
    if (dto.deductionRate !== undefined) data.deductionRate = dto.deductionRate;
    if (dto.notes !== undefined) data.notes = dto.notes || null;
    if (dto.customFields !== undefined) data.customFields = dto.customFields;

    return this.prisma.expense.update({ where: { id }, data });
  }

  async remove(businessId: string, id: string) {
    const existing = await this.prisma.expense.findFirst({
      where: { id, businessId },
    });
    if (!existing) throw new NotFoundException('Expense not found');
    return this.prisma.expense.delete({ where: { id } });
  }
}
