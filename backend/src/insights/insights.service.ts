import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { AccountType } from '@prisma/client';

const BALANCE_ACCOUNT_TYPES: AccountType[] = ['BANK', 'INVESTMENT', 'PENSION', 'INSURANCE', 'CASH'];

export interface FinancialInsights {
  balanceForecast: string;
  savingsRecommendation: string;
  investmentRecommendations: string;
}

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async getFinancialData(householdId: string) {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const [accountsRaw, transactions] = await Promise.all([
      this.prisma.account.findMany({
        where: { householdId, isActive: true },
        select: { id: true, name: true, type: true, balance: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          householdId,
          date: { gte: sixMonthsAgo, lte: now },
        },
        select: { date: true, amount: true, accountId: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    const accountIds = accountsRaw.map((a) => a.id);
    const sums =
      accountIds.length > 0
        ? await this.prisma.transaction.groupBy({
            by: ['accountId'],
            where: { accountId: { in: accountIds } },
            _sum: { amount: true },
          })
        : [];
    const sumByAccount = new Map(sums.map((s) => [s.accountId, Number(s._sum.amount ?? 0)]));

    let totalBalance = 0;
    const accounts = accountsRaw.map((a) => {
      const initial = Number(a.balance ?? 0);
      const txSum = sumByAccount.get(a.id) ?? 0;
      const calculated = initial + txSum;
      const showBalance = BALANCE_ACCOUNT_TYPES.includes(a.type as AccountType);
      if (showBalance) totalBalance += calculated;
      return {
        name: a.name,
        type: a.type,
        balance: showBalance ? calculated : null,
      };
    });

    const byMonth = new Map<string, { income: number; expenses: number }>();
    for (const t of transactions) {
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) byMonth.set(key, { income: 0, expenses: 0 });
      const b = byMonth.get(key)!;
      const amt = Number(t.amount);
      if (amt > 0) b.income += amt;
      else b.expenses += Math.abs(amt);
    }

    const monthlyData = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }));

    return {
      totalBalance,
      accounts,
      monthlyData,
      currentMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    };
  }

  async getInsights(householdId: string): Promise<FinancialInsights> {
    const data = await this.getFinancialData(householdId);
    const client = this.getOpenAIClient();
    if (!client) {
      return this.getFallbackInsights(data);
    }

    const prompt = this.buildPrompt(data);
    try {
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial advisor for Israeli users. Respond in Hebrew (or English if user prefers). Be concise and practical. Use ILS currency. For investment recommendations, base on current market research and common Israeli investment channels (קרנות נאמנות, מניות, אגרות חוב, קופות גמל, קרנות השתלמות, תעודות סל). Return JSON with keys: balanceForecast, savingsRecommendation, investmentRecommendations.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) return this.getFallbackInsights(data);
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const fallback = this.getFallbackInsights(data);
      const toReadableString = (v: unknown, key: string): string => {
        if (typeof v === 'string' && v.trim()) return v;
        if (v != null && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          if (Array.isArray(o)) {
            return o
              .map((item) => {
                if (typeof item === 'string') return '• ' + item;
                if (item != null && typeof item === 'object') {
                  const t = (item as Record<string, unknown>).type ?? (item as Record<string, unknown>).name;
                  const d = (item as Record<string, unknown>).description ?? (item as Record<string, unknown>).desc;
                  if (t && d) return '• ' + String(t) + ': ' + String(d);
                  if (t) return '• ' + String(t);
                }
                return '• ' + JSON.stringify(item);
              })
              .join('\n');
          }
          const nextMonth = o.nextMonthStart ?? o.nextMonthStartBalance ?? o.forecast ?? o.balance;
          if (key === 'balanceForecast' && nextMonth != null) {
            const nextMonthStart = new Date(data.currentMonth + '-01');
            nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
            return `צפי ליתרה בתחילת החודש הקרוב (${nextMonthStart.toLocaleDateString('he-IL')}): כ־${Number(nextMonth).toLocaleString('he-IL')} ₪.`;
          }
          const emergencyFund = o.emergencyFund ?? o.savings ?? o.amount;
          if (key === 'savingsRecommendation' && emergencyFund != null) {
            return `מומלץ לחסוך לחירום: כ־${Number(emergencyFund).toLocaleString('he-IL')} ₪.`;
          }
        }
        if (typeof v === 'number') return String(v);
        return '';
      };
      return {
        balanceForecast: toReadableString(parsed.balanceForecast ?? parsed.nextMonthStartBalance ?? parsed.nextMonthStart, 'balanceForecast') || fallback.balanceForecast,
        savingsRecommendation: toReadableString(parsed.savingsRecommendation ?? parsed.emergencyFund, 'savingsRecommendation') || fallback.savingsRecommendation,
        investmentRecommendations: toReadableString(parsed.investmentRecommendations, 'investmentRecommendations') || fallback.investmentRecommendations,
      };
    } catch {
      return this.getFallbackInsights(data);
    }
  }

  private openai: OpenAI | null = null;

  private getOpenAIClient(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return null;
    if (!this.openai) this.openai = new OpenAI({ apiKey: key });
    return this.openai;
  }

  private buildPrompt(data: Awaited<ReturnType<typeof this.getFinancialData>>): string {
    const monthly = data.monthlyData
      .map((m) => `  ${m.month}: הכנסות ${m.income.toFixed(0)} ILS, הוצאות ${m.expenses.toFixed(0)} ILS`)
      .join('\n');
    const accs = data.accounts
      .map((a) => `  ${a.name} (${a.type}): ${a.balance != null ? a.balance.toFixed(0) + ' ILS' : '–'}`)
      .join('\n');

    return (
      'נתוני משק בית (6 חודשים אחרונים):\n' +
      `יתרה נוכחית כוללת: ${data.totalBalance.toFixed(0)} ILS\n` +
      'חשבונות:\n' +
      accs +
      '\n\nתנועות לפי חודש:\n' +
      (monthly || 'אין נתונים') +
      '\n\nתבסס על הנתונים: 1) תן צפי ליתרה בתחילת החודש הקרוב. 2) כמה כסף לחסוך בצד (חיסכון חירום). 3) המלצות להשקעה באילו אפיקים (תבסס על מחקר שוק עדכני, התאם לישראל).'
    );
  }

  private getFallbackInsights(data: Awaited<ReturnType<typeof this.getFinancialData>>): FinancialInsights {
    const avgExpenses =
      data.monthlyData.length > 0
        ? data.monthlyData.reduce((s, m) => s + m.expenses, 0) / data.monthlyData.length
        : 0;
    const avgIncome =
      data.monthlyData.length > 0
        ? data.monthlyData.reduce((s, m) => s + m.income, 0) / data.monthlyData.length
        : 0;
    const monthlySurplus = avgIncome - avgExpenses;
    const nextMonthStart = new Date(data.currentMonth + '-01');
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1);
    const forecast = data.totalBalance + monthlySurplus;

    return {
      balanceForecast: `על בסיס הממוצע של החודשים האחרונים: צפי ליתרה בתחילת החודש הקרוב (${nextMonthStart.toLocaleDateString('he-IL')}) בערך ${forecast.toFixed(0)} ₪.`,
      savingsRecommendation: `מומלץ להפריש 10-15% מההכנסה החודשית לחיסכון חירום. על בסיס הנתונים שלך: כ-${Math.round(avgIncome * 0.12)} ₪ לחודש.`,
      investmentRecommendations:
        'להמלצות מותאמות אישית יש להפעיל את הבינה המלאכותית (OPENAI_API_KEY). אפיקים נפוצים בישראל: קרנות נאמנות, קופות גמל, קרנות השתלמות, אגרות חוב ממשלתיות.',
    };
  }
}
