import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { AccountType } from '@prisma/client';

const BALANCE_ACCOUNT_TYPES: AccountType[] = ['BANK', 'INVESTMENT', 'PENSION', 'INSURANCE', 'CASH'];

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(
    householdId: string,
    from?: string,
    to?: string,
    accountId?: string,
    categoryId?: string,
  ) {
    const fromDate = from ? new Date(from) : startOfMonth(new Date());
    const toDate = to ? new Date(to) : new Date();
    const txWhere = {
      householdId,
      date: { gte: fromDate, lte: toDate } as { gte: Date; lte: Date },
      ...(accountId && { accountId }),
      ...(categoryId && { categoryId }),
    };

    const [accountsRaw, transactions] = await Promise.all([
      this.prisma.account.findMany({
        where: { householdId, isActive: true, ...(accountId && { id: accountId }) },
        select: { id: true, name: true, type: true, balance: true, currency: true },
      }),
      this.prisma.transaction.findMany({
        where: txWhere,
        select: { amount: true, categoryId: true, accountId: true, date: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const accountIds = accountsRaw.map((a) => a.id);
    const sums = accountIds.length > 0
      ? await this.prisma.transaction.groupBy({
          by: ['accountId'],
          where: { accountId: { in: accountIds } },
          _sum: { amount: true },
        })
      : [];
    const sumByAccount = new Map(sums.map((s) => [s.accountId, Number(s._sum.amount ?? 0)]));

    const accounts = accountsRaw.map((a) => {
      const initial = Number(a.balance ?? 0);
      const txSum = sumByAccount.get(a.id) ?? 0;
      const calculated = initial + txSum;
      const showBalance = BALANCE_ACCOUNT_TYPES.includes(a.type as AccountType);
      return {
        ...a,
        balance: showBalance ? calculated : null,
      };
    });

    const totalBalance = accounts
      .filter((a) => BALANCE_ACCOUNT_TYPES.includes(a.type as AccountType))
      .reduce((sum, a) => sum + Number(a.balance), 0);
    const income = transactions
      .filter((t) => Number(t.amount) > 0)
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = transactions
      .filter((t) => Number(t.amount) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

    const byCategory = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        householdId,
        date: { gte: fromDate, lte: toDate },
        amount: { lt: 0 },
        ...(accountId && { accountId }),
        ...(categoryId && { categoryId }),
      },
      _sum: { amount: true },
    });

    const categoryIds = [...new Set(byCategory.map((c) => c.categoryId).filter(Boolean))] as string[];
    const categories = categoryIds.length
      ? await this.prisma.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true, slug: true, color: true, icon: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const spendingByCategory = byCategory
      .filter((c) => c.categoryId)
      .map((c) => ({
        categoryId: c.categoryId,
        category: catMap.get(c.categoryId!),
        total: Math.abs(Number((c._sum.amount as Decimal) || 0)),
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalBalance,
      income,
      expenses,
      period: { from: fromDate.toISOString().slice(0, 10), to: toDate.toISOString().slice(0, 10) },
      accounts,
      spendingByCategory,
      transactionCount: transactions.length,
    };
  }

  async getTrends(
    householdId: string,
    from: string,
    to: string,
    groupBy: 'month' | 'year' = 'month',
    accountId?: string,
    categoryId?: string,
  ) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const transactions = await this.prisma.transaction.findMany({
      where: {
        householdId,
        date: { gte: fromDate, lte: toDate },
        ...(accountId && { accountId }),
        ...(categoryId && { categoryId }),
      },
      select: { date: true, amount: true },
    });

    const buckets = new Map<string, { income: number; expenses: number }>();
    for (const t of transactions) {
      const d = new Date(t.date);
      const key =
        groupBy === 'month'
          ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
          : String(d.getFullYear());
      if (!buckets.has(key)) buckets.set(key, { income: 0, expenses: 0 });
      const b = buckets.get(key)!;
      const amt = Number(t.amount);
      if (amt > 0) b.income += amt;
      else b.expenses += Math.abs(amt);
    }

    const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([period, data]) => ({ period, ...data }));
  }
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
