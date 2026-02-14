'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  dashboard,
  transactions as txApi,
  accounts,
  categories,
  type AccountItem,
  type CategoryItem,
  type FixedItem,
  type TransactionItem,
} from '@/lib/api';
import { useTranslation } from '@/i18n/context';
import PageGuide from '@/components/PageGuide';
import HelpTooltip from '@/components/HelpTooltip';
import VoiceInputButton from '@/components/VoiceInputButton';
import { useToast } from '@/components/Toast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* ──────────────────────────────────────────────────────── */
/*  Types                                                    */
/* ──────────────────────────────────────────────────────── */

type ActiveTab = 'income' | 'expenses';
type PeriodFilter = 'month' | 'quarter' | 'year' | 'custom';

/* ──────────────────────────────────────────────────────── */
/*  Helpers                                                  */
/* ──────────────────────────────────────────────────────── */

function formatCurrency(n: number, locale: string, currency = 'ILS') {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function getCatName(name: string, slug: string | undefined, t: (k: string) => string) {
  if (slug) {
    const tr = t('categories.' + slug);
    if (tr !== 'categories.' + slug) return tr;
  }
  return name || (slug ? slug.replace(/_/g, ' ') : '');
}

function getMonthRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    from: d.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
  };
}

/* ──────────────────────────────────────────────────────── */
/*  Skeleton                                                 */
/* ──────────────────────────────────────────────────────── */

function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────── */
/*  Main Page Component                                      */
/* ──────────────────────────────────────────────────────── */

export default function IncomeExpensesPage() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  /* ── Active tab ── */
  const initialTab: ActiveTab = searchParams.get('tab') === 'expenses' ? 'expenses' : 'income';
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);

  const handleTabSwitch = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    const url = tab === 'expenses' ? '/income?tab=expenses' : '/income';
    router.replace(url, { scroll: false });
  }, [router]);

  /* ── Period filter ── */
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const getDateRange = useCallback((): { from: string; to: string } => {
    const now = new Date();
    switch (periodFilter) {
      case 'month':
        return getMonthRange(0);
      case 'quarter': {
        const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const qEnd = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 0);
        return { from: qStart.toISOString().slice(0, 10), to: qEnd.toISOString().slice(0, 10) };
      }
      case 'year': {
        const yStart = new Date(now.getFullYear(), 0, 1);
        return { from: yStart.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
      }
      case 'custom':
        return {
          from: customFrom || now.toISOString().slice(0, 10),
          to: customTo || now.toISOString().slice(0, 10),
        };
    }
  }, [periodFilter, customFrom, customTo]);

  /* ── Data state ── */
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof dashboard.summary>> | null>(null);
  const [fixedIncomeList, setFixedIncomeList] = useState<FixedItem[]>([]);
  const [fixedExpensesList, setFixedExpensesList] = useState<FixedItem[]>([]);
  const [trendData, setTrendData] = useState<Array<{ period: string; income: number; expenses: number }>>([]);
  const [incomeCategories, setIncomeCategories] = useState<CategoryItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<CategoryItem[]>([]);
  const [accountsList, setAccountsList] = useState<AccountItem[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Income form state ── */
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    accountId: '',
    categoryId: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    isRecurring: false,
  });
  const [incomeSaving, setIncomeSaving] = useState(false);
  const [incomeSuggestingCat, setIncomeSuggestingCat] = useState(false);

  /* ── Expense form state ── */
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    accountId: '',
    categoryId: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    vendor: '',
    notes: '',
    taxDeductible: false,
    deductionRate: '100',
    receiptFile: null as File | null,
    customFields: [] as Array<{ key: string; value: string }>,
  });
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseSuggestingCat, setExpenseSuggestingCat] = useState(false);

  /* ── Load data ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    const { from, to } = getDateRange();
    try {
      const [summaryData, fixedIncome, fixedExpenses, trends, incomeCats, expenseCats, accts, recentExp] = await Promise.all([
        dashboard.summary(from, to),
        dashboard.fixedIncome().catch(() => []),
        dashboard.fixedExpenses().catch(() => []),
        dashboard.trends(
          new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
          new Date().toISOString().slice(0, 10),
          'month'
        ).catch(() => []),
        categories.list(true).catch(() => []),
        categories.list().catch(() => []),
        accounts.list().catch(() => []),
        txApi.list({ from, to, type: 'expense', limit: 10 }).catch(() => ({ items: [], total: 0, page: 1, limit: 10 })),
      ]);
      setSummary(summaryData);
      setFixedIncomeList(fixedIncome);
      setFixedExpensesList(fixedExpenses);
      setTrendData(trends);
      setIncomeCategories(incomeCats);
      setExpenseCategories(expenseCats.filter((c) => !c.isIncome));
      setAccountsList(accts);
      setRecentExpenses(recentExp.items);
    } catch {
      toast(t('common.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [getDateRange, t, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Suggest category (income) ── */
  async function handleIncomeSuggestCategory() {
    if (!incomeForm.description.trim()) return;
    setIncomeSuggestingCat(true);
    try {
      const res = await txApi.suggestCategory(incomeForm.description.trim());
      if (res.categoryId) setIncomeForm((f) => ({ ...f, categoryId: res.categoryId! }));
    } finally {
      setIncomeSuggestingCat(false);
    }
  }

  /* ── Suggest category (expense) ── */
  async function handleExpenseSuggestCategory() {
    if (!expenseForm.description.trim()) return;
    setExpenseSuggestingCat(true);
    try {
      const res = await txApi.suggestCategory(expenseForm.description.trim());
      if (res.categoryId) setExpenseForm((f) => ({ ...f, categoryId: res.categoryId! }));
    } finally {
      setExpenseSuggestingCat(false);
    }
  }

  /* ── Add income ── */
  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    if (!incomeForm.accountId || !incomeForm.description || !incomeForm.amount) return;
    setIncomeSaving(true);
    try {
      await txApi.create({
        accountId: incomeForm.accountId,
        categoryId: incomeForm.categoryId || undefined,
        date: incomeForm.date,
        description: incomeForm.description,
        amount: Math.abs(parseFloat(incomeForm.amount) || 0),
        isRecurring: incomeForm.isRecurring,
      });
      toast(t('income.incomeAdded'), 'success');
      setIncomeForm((f) => ({ ...f, description: '', amount: '', isRecurring: false }));
      setShowIncomeForm(false);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.failedToLoad'), 'error');
    } finally {
      setIncomeSaving(false);
    }
  }

  /* ── Add expense ── */
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseForm.accountId || !expenseForm.description || !expenseForm.amount) return;
    setExpenseSaving(true);
    try {
      await txApi.create({
        accountId: expenseForm.accountId,
        categoryId: expenseForm.categoryId || undefined,
        date: expenseForm.date,
        description: expenseForm.vendor
          ? `${expenseForm.vendor} - ${expenseForm.description}`
          : expenseForm.description,
        amount: -Math.abs(parseFloat(expenseForm.amount) || 0),
      });
      toast(t('expenses.expenseAdded'), 'success');
      setExpenseForm((f) => ({
        ...f,
        description: '',
        amount: '',
        vendor: '',
        notes: '',
        taxDeductible: false,
        deductionRate: '100',
        receiptFile: null,
        customFields: [],
      }));
      setShowExpenseForm(false);
      fetchData();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.failedToLoad'), 'error');
    } finally {
      setExpenseSaving(false);
    }
  }

  /* ── Add custom field (expense form) ── */
  function addCustomField() {
    setExpenseForm((f) => ({
      ...f,
      customFields: [...f.customFields, { key: '', value: '' }],
    }));
  }

  function removeCustomField(idx: number) {
    setExpenseForm((f) => ({
      ...f,
      customFields: f.customFields.filter((_, i) => i !== idx),
    }));
  }

  function updateCustomField(idx: number, field: 'key' | 'value', val: string) {
    setExpenseForm((f) => ({
      ...f,
      customFields: f.customFields.map((cf, i) => (i === idx ? { ...cf, [field]: val } : cf)),
    }));
  }

  /* ── Calculations ── */
  const totalFixedIncome = fixedIncomeList.reduce((s, f) => s + f.amount, 0);
  const totalFixedExpenses = fixedExpensesList.reduce((s, f) => s + f.amount, 0);
  const monthlyIncome = summary?.income ?? 0;
  const monthlyExpenses = summary?.expenses ?? 0;
  const annualIncomeEstimate = monthlyIncome * 12;
  const annualExpenseEstimate = monthlyExpenses * 12;
  const netIncome = monthlyIncome - monthlyExpenses;

  /* ── Category breakdowns ── */
  const incomeByCategory = summary?.incomeByCategory ?? [];
  const expenseByCategory = summary?.spendingByCategory ?? [];

  /* ── Period options ── */
  const periodOptions: { key: PeriodFilter; label: string }[] = [
    { key: 'month', label: t('income.thisMonth') },
    { key: 'quarter', label: t('income.thisQuarter') },
    { key: 'year', label: t('income.thisYear') },
    { key: 'custom', label: t('income.custom') },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── Header with Tab Toggle ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-3">
          {/* Pill-style tab switcher */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 w-fit">
            <button
              type="button"
              onClick={() => handleTabSwitch('income')}
              className={`relative px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'income'
                  ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                {t('income.title')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('expenses')}
              className={`relative px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
                activeTab === 'expenses'
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                  <polyline points="17 18 23 18 23 12" />
                </svg>
                {t('expenses.title')}
              </span>
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {activeTab === 'income' ? t('income.subtitle') : t('expenses.subtitle')}
            <HelpTooltip text={activeTab === 'income' ? t('help.income') : t('help.expenses')} className="ms-1" />
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => activeTab === 'income' ? setShowIncomeForm(true) : setShowExpenseForm(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-0.5 me-1">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {activeTab === 'income' ? t('income.addIncomeEntry') : t('expenses.addExpenseEntry')}
        </button>
      </div>

      {/* Page action guide */}
      <PageGuide
        pageKey="income"
        steps={[
          { labelHe: 'הוסף הכנסה או הוצאה', labelEn: 'Add income or expense' },
          { labelHe: 'סווג לקטגוריה', labelEn: 'Categorize' },
          { labelHe: 'צרף קבלה', labelEn: 'Attach receipt' },
          { labelHe: 'עקוב אחר הסיכומים', labelEn: 'Track totals' },
        ]}
      />

      {/* ── Period filter ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
          {periodOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPeriodFilter(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                periodFilter === opt.key
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {periodFilter === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="input py-1.5 text-sm"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              className="input py-1.5 text-sm"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  INCOME TAB                                        */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'income' && (
        <div className="space-y-6 animate-fadeIn">
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('income.incomeThisPeriod')}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                    {formatCurrency(monthlyIncome, locale)}
                  </p>
                </>
              )}
            </div>
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('income.expensesThisPeriod')}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
                    {formatCurrency(monthlyExpenses, locale)}
                  </p>
                </>
              )}
            </div>
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('income.netIncome')}</p>
                  <p className={`text-lg sm:text-2xl font-bold mt-1 ${netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(netIncome, locale)}
                  </p>
                </>
              )}
            </div>
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('income.annualEstimate')}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(annualIncomeEstimate, locale)}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Income Trend Chart ── */}
          {trendData.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-4">{t('income.trendChart')}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => {
                        const d = new Date(v + '-01');
                        return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL', { month: 'short' });
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value, locale),
                        name === 'income' ? t('income.income') : t('income.expenses'),
                      ]}
                      labelFormatter={(label) => {
                        const d = new Date(label + '-01');
                        return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL', { month: 'long', year: 'numeric' });
                      }}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#incomeGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#expenseGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                  {t('income.income')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  {t('income.expenses')}
                </span>
              </div>
            </div>
          )}

          {/* ── Income by Category ── */}
          {incomeByCategory.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-4">{t('income.incomeByCategory')}</h2>
              <div className="space-y-3">
                {incomeByCategory.map((cat) => {
                  const pct = monthlyIncome > 0 ? (cat.total / monthlyIncome) * 100 : 0;
                  return (
                    <div key={cat.categoryId} className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium shrink-0"
                        style={{
                          background: cat.category.color ? `${cat.category.color}20` : '#e2e8f0',
                          color: cat.category.color || '#64748b',
                        }}
                      >
                        {cat.category.name.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium truncate">
                            {getCatName(cat.category.name, cat.category.slug, t)}
                          </span>
                          <span className="font-bold text-green-600 dark:text-green-400">
                            {formatCurrency(cat.total, locale)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: cat.category.color || '#22c55e',
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-end">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Fixed / Recurring Income ── */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">{t('income.fixedIncome')}</h2>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {t('income.totalFixed')}: {formatCurrency(totalFixedIncome, locale)}
              </span>
            </div>
            {fixedIncomeList.length === 0 ? (
              <div className="text-center py-8">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-slate-300 dark:text-slate-600 mb-3">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
                <p className="text-sm text-slate-500">{t('income.noFixedIncome')}</p>
                <p className="text-xs text-slate-400 mt-1">{t('income.noFixedIncomeHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-start py-2 px-3 font-medium">{t('common.description')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('common.category')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('income.amountIls')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('income.installments')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('income.expectedEnd')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedIncomeList.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{item.description}</td>
                        <td className="py-2.5 px-3 text-slate-500">{item.categorySlug ? (getCatName(item.categoryName || '', item.categorySlug, t) || '-') : (item.categoryName || '-')}</td>
                        <td className="py-2.5 px-3 text-green-600 dark:text-green-400 font-medium">
                          {formatCurrency(item.amount, locale)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.installmentCurrent != null && item.installmentTotal != null
                            ? `${item.installmentCurrent}/${item.installmentTotal}`
                            : t('income.ongoing')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.expectedEndDate
                            ? new Date(item.expectedEndDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  EXPENSES TAB                                      */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'expenses' && (
        <div className="space-y-6 animate-fadeIn">
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('expenses.expensesThisPeriod')}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
                    {formatCurrency(monthlyExpenses, locale)}
                  </p>
                </>
              )}
            </div>
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('expenses.incomeThisPeriod')}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                    {formatCurrency(monthlyIncome, locale)}
                  </p>
                </>
              )}
            </div>
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('income.netIncome')}</p>
                  <p className={`text-lg sm:text-2xl font-bold mt-1 ${netIncome >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(netIncome, locale)}
                  </p>
                </>
              )}
            </div>
            <div className="card">
              {loading ? (
                <CardSkeleton />
              ) : (
                <>
                  <p className="text-sm text-slate-500">{t('expenses.annualExpenseEstimate')}</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-orange-600 dark:text-orange-400">
                    {formatCurrency(annualExpenseEstimate, locale)}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ── Expense by Category ── */}
          {expenseByCategory.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-4">{t('expenses.expenseByCategory')}</h2>
              <div className="space-y-3">
                {expenseByCategory.map((cat) => {
                  const pct = monthlyExpenses > 0 ? (cat.total / monthlyExpenses) * 100 : 0;
                  return (
                    <div key={cat.categoryId} className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium shrink-0"
                        style={{
                          background: cat.category.color ? `${cat.category.color}20` : '#e2e8f0',
                          color: cat.category.color || '#64748b',
                        }}
                      >
                        {cat.category.name.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium truncate">
                            {getCatName(cat.category.name, cat.category.slug, t)}
                          </span>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {formatCurrency(cat.total, locale)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(pct, 100)}%`,
                              background: cat.category.color || '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-end">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Expense Trend Chart ── */}
          {trendData.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-4">{t('expenses.trendChart')}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="expTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="incTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => {
                        const d = new Date(v + '-01');
                        return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL', { month: 'short' });
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value, locale),
                        name === 'expenses' ? t('income.expenses') : t('income.income'),
                      ]}
                      labelFormatter={(label) => {
                        const d = new Date(label + '-01');
                        return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL', { month: 'long', year: 'numeric' });
                      }}
                      contentStyle={{
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="#ef4444"
                      strokeWidth={2}
                      fill="url(#expTrendGradient)"
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#22c55e"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      fill="url(#incTrendGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  {t('income.expenses')}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-green-500 opacity-50" />
                  {t('income.income')}
                </span>
              </div>
            </div>
          )}

          {/* ── Fixed / Recurring Expenses ── */}
          {fixedExpensesList.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">{t('expenses.fixedExpenses')}</h2>
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {t('expenses.totalFixed')}: {formatCurrency(totalFixedExpenses, locale)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-start py-2 px-3 font-medium">{t('common.description')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('common.category')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('expenses.amountIls')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('income.installments')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('income.expectedEnd')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedExpensesList.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 font-medium">{item.description}</td>
                        <td className="py-2.5 px-3 text-slate-500">{item.categorySlug ? (getCatName(item.categoryName || '', item.categorySlug, t) || '-') : (item.categoryName || '-')}</td>
                        <td className="py-2.5 px-3 text-red-600 dark:text-red-400 font-medium">
                          {formatCurrency(Math.abs(item.amount), locale)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.installmentCurrent != null && item.installmentTotal != null
                            ? `${item.installmentCurrent}/${item.installmentTotal}`
                            : t('income.ongoing')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.expectedEndDate
                            ? new Date(item.expectedEndDate).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL')
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Recent Expenses ── */}
          {recentExpenses.length > 0 && (
            <div className="card">
              <h2 className="font-semibold mb-4">{t('expenses.recentExpenses')}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-start py-2 px-3 font-medium">{t('common.date')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('common.description')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('common.category')}</th>
                      <th className="text-start py-2 px-3 font-medium">{t('common.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map((tx) => (
                      <tr key={tx.id} className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500">
                          {new Date(tx.date).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL')}
                        </td>
                        <td className="py-2.5 px-3 font-medium">{tx.description}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {tx.categorySlug
                            ? getCatName(tx.categoryName || '', tx.categorySlug, t)
                            : tx.categoryName || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-red-600 dark:text-red-400 font-medium">
                          {formatCurrency(Math.abs(tx.amount), locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  ADD INCOME MODAL                                  */}
      {/* ═══════════════════════════════════════════════════ */}
      {showIncomeForm && (
        <div className="modal-overlay" onClick={() => setShowIncomeForm(false)}>
          <div
            className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold text-lg">{t('income.addIncome')}</h3>
              <button type="button" onClick={() => setShowIncomeForm(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddIncome} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.account')}</label>
                <select
                  className="input w-full"
                  value={incomeForm.accountId}
                  onChange={(e) => setIncomeForm((f) => ({ ...f, accountId: e.target.value }))}
                  required
                >
                  <option value="">{t('common.chooseAccount')}</option>
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.description')}</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="input w-full pe-9"
                    value={incomeForm.description}
                    onChange={(e) => setIncomeForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t('income.descriptionPlaceholder')}
                    required
                  />
                  <div className="absolute end-2 top-1/2 -translate-y-1/2">
                    <VoiceInputButton onResult={(text) => setIncomeForm((f) => ({ ...f, description: text }))} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.category')}</label>
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={incomeForm.categoryId}
                    onChange={(e) => setIncomeForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">{t('common.optional')}</option>
                    {incomeCategories.map((c) => (
                      <option key={c.id} value={c.id}>{getCatName(c.name, c.slug, t)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary text-sm whitespace-nowrap"
                    onClick={handleIncomeSuggestCategory}
                    disabled={!incomeForm.description.trim() || incomeSuggestingCat}
                  >
                    {incomeSuggestingCat ? '...' : t('transactionsPage.suggestCategory')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.date')}</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={incomeForm.date}
                    onChange={(e) => setIncomeForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('income.amountIls')}</label>
                  <input
                    type="number"
                    className="input w-full"
                    step="0.01"
                    min="0"
                    value={incomeForm.amount}
                    onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    required
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incomeForm.isRecurring}
                  onChange={(e) => setIncomeForm((f) => ({ ...f, isRecurring: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm">{t('income.markAsRecurring')}</span>
              </label>
              <button type="submit" className="btn-primary w-full" disabled={incomeSaving}>
                {incomeSaving ? t('common.loading') : t('common.save')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  ADD EXPENSE MODAL                                 */}
      {/* ═══════════════════════════════════════════════════ */}
      {showExpenseForm && (
        <div className="modal-overlay" onClick={() => setShowExpenseForm(false)}>
          <div
            className="bg-[var(--card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <h3 className="font-semibold text-lg">{t('expenses.addExpense')}</h3>
              <button type="button" onClick={() => setShowExpenseForm(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.account')}</label>
                <select
                  className="input w-full"
                  value={expenseForm.accountId}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, accountId: e.target.value }))}
                  required
                >
                  <option value="">{t('common.chooseAccount')}</option>
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('expenses.vendor')}</label>
                <input
                  type="text"
                  className="input w-full"
                  value={expenseForm.vendor}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, vendor: e.target.value }))}
                  placeholder={t('expenses.vendorPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.description')}</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    className="input w-full pe-9"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t('expenses.descriptionPlaceholder')}
                    required
                  />
                  <div className="absolute end-2 top-1/2 -translate-y-1/2">
                    <VoiceInputButton onResult={(text) => setExpenseForm((f) => ({ ...f, description: text }))} />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.category')}</label>
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={expenseForm.categoryId}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">{t('common.optional')}</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>{getCatName(c.name, c.slug, t)}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary text-sm whitespace-nowrap"
                    onClick={handleExpenseSuggestCategory}
                    disabled={!expenseForm.description.trim() || expenseSuggestingCat}
                  >
                    {expenseSuggestingCat ? '...' : t('transactionsPage.suggestCategory')}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('common.date')}</label>
                  <input
                    type="date"
                    className="input w-full"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('expenses.amountIls')}</label>
                  <input
                    type="number"
                    className="input w-full"
                    step="0.01"
                    min="0"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              {/* Receipt upload */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('expenses.receipt')}</label>
                <div className="flex items-center gap-3">
                  <label className="btn-secondary text-sm cursor-pointer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline -mt-0.5 me-1">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    {t('common.upload')}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setExpenseForm((f) => ({ ...f, receiptFile: file }));
                      }}
                    />
                  </label>
                  {expenseForm.receiptFile && (
                    <span className="text-sm text-slate-500 truncate max-w-[200px]">
                      {expenseForm.receiptFile.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Tax deductible toggle */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={expenseForm.taxDeductible}
                    onChange={(e) => setExpenseForm((f) => ({ ...f, taxDeductible: e.target.checked }))}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">{t('expenses.taxDeductible')}</span>
                </label>
                {expenseForm.taxDeductible && (
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('expenses.deductionRate')}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="input w-24"
                        min="0"
                        max="100"
                        value={expenseForm.deductionRate}
                        onChange={(e) => setExpenseForm((f) => ({ ...f, deductionRate: e.target.value }))}
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1">{t('common.notes')}</label>
                <textarea
                  className="input w-full min-h-[60px] resize-y"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={t('expenses.notesPlaceholder')}
                  rows={2}
                />
              </div>

              {/* Custom fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">{t('expenses.customFields')}</label>
                  <button
                    type="button"
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                    onClick={addCustomField}
                  >
                    + {t('expenses.addField')}
                  </button>
                </div>
                {expenseForm.customFields.map((cf, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      className="input flex-1 text-sm"
                      placeholder={t('expenses.fieldName')}
                      value={cf.key}
                      onChange={(e) => updateCustomField(idx, 'key', e.target.value)}
                    />
                    <input
                      type="text"
                      className="input flex-1 text-sm"
                      placeholder={t('expenses.fieldValue')}
                      value={cf.value}
                      onChange={(e) => updateCustomField(idx, 'value', e.target.value)}
                    />
                    <button
                      type="button"
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                      onClick={() => removeCustomField(idx)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1" disabled={expenseSaving}>
                  {expenseSaving ? t('common.loading') : t('common.save')}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowExpenseForm(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
