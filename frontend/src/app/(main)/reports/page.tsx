'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { reports, zReports } from '@/lib/api';
import type { ZReportData } from '@/lib/api';
import { useTranslation } from '@/i18n/context';
import PageGuide from '@/components/PageGuide';
import DateRangePicker, { getQuickRangeDates } from '@/components/DateRangePicker';
import HelpTooltip from '@/components/HelpTooltip';
import { useToast } from '@/components/Toast';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────
type ReportTab = 'pnl' | 'cashflow' | 'clients' | 'categories' | 'tax' | 'forecast' | 'zreport';
type ExportFormat = 'pdf' | 'excel' | 'csv';
type LogoPosition = 'left' | 'center' | 'right';
type TitleStyle = 'normal' | 'bold' | 'larger';

type PnlData = Awaited<ReturnType<typeof reports.getProfitLoss>>;
type CashFlowData = Awaited<ReturnType<typeof reports.getCashFlow>>;
type ClientRevenueData = Awaited<ReturnType<typeof reports.getClientRevenue>>;
type CategoryData = Awaited<ReturnType<typeof reports.getCategoryBreakdown>>;
type TaxData = Awaited<ReturnType<typeof reports.getTaxSummary>>;
type ForecastData = Awaited<ReturnType<typeof reports.getForecast>>;

// ─── Constants ───────────────────────────────────────────────
const PIE_COLORS = [
  '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#22c55e',
  '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899',
  '#8b5cf6', '#a855f7', '#06b6d4', '#d946ef', '#f43f5e',
];

const BAR_INCOME_COLOR = '#22c55e';
const BAR_EXPENSE_COLOR = '#ef4444';

// ─── Helpers ─────────────────────────────────────────────────
function getCategoryDisplayName(name: string, slug: string | null | undefined, t: (k: string) => string): string {
  if (slug) {
    const translated = t('categories.' + slug);
    if (translated !== 'categories.' + slug) return translated;
  }
  return name;
}

function fmtCurrency(n: number, locale: string, compact = false) {
  const opts: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 0 : 2,
    ...(compact && Math.abs(n) >= 10000 ? { notation: 'compact' } : {}),
  };
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', opts).format(n);
}

function fmtPercent(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtMonth(monthStr: string, locale: string) {
  try {
    const d = new Date(monthStr + '-01');
    return d.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL', { month: 'short', year: '2-digit' });
  } catch {
    return monthStr;
  }
}

function fmtQuarter(q: number) {
  return `Q${q}`;
}

// ─── Icons ───────────────────────────────────────────────────
const ChartBarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const CashFlowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const PieChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
  </svg>
);

const TaxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M7 15h0M2 9.5h20" />
  </svg>
);

const ForecastIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const ReceiptIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
);

const TableIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

const PrintIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const TrendUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>
);

const CheckCircle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

// ─── Tab Config ──────────────────────────────────────────────
type TabConfig = {
  id: ReportTab;
  labelKey: string;
  icon: React.ReactNode;
};

const TABS: TabConfig[] = [
  { id: 'pnl', labelKey: 'reports.tabs.pnl', icon: <ChartBarIcon /> },
  { id: 'cashflow', labelKey: 'reports.tabs.cashflow', icon: <CashFlowIcon /> },
  { id: 'clients', labelKey: 'reports.tabs.clients', icon: <UsersIcon /> },
  { id: 'categories', labelKey: 'reports.tabs.categories', icon: <PieChartIcon /> },
  { id: 'tax', labelKey: 'reports.tabs.tax', icon: <TaxIcon /> },
  { id: 'forecast', labelKey: 'reports.tabs.forecast', icon: <ForecastIcon /> },
  { id: 'zreport', labelKey: 'reports.tabs.zreport', icon: <ReceiptIcon /> },
];

// ─── Shimmer skeleton ────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

function ReportSkeleton() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({
  label,
  value,
  subValue,
  colorClass = '',
  cardClass = '',
}: {
  label: string;
  value: string;
  subValue?: string;
  colorClass?: string;
  cardClass?: string;
}) {
  return (
    <div className={`card ${cardClass}`}>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1.5 ${colorClass}`}>{value}</p>
      {subValue && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subValue}</p>
      )}
    </div>
  );
}

// ─── Custom Recharts tooltip ─────────────────────────────────
function CustomTooltip({ active, payload, label, locale }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  locale: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-lg p-3 text-sm">
      <p className="font-medium text-slate-600 dark:text-slate-300 mb-1.5">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500 dark:text-slate-400">{entry.name}:</span>
          <span className="font-semibold">{fmtCurrency(entry.value, locale)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Custom Pie Label ────────────────────────────────────────
function renderPieLabel({
  cx, cy, midAngle, innerRadius, outerRadius, percent, name,
}: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number; name: string;
}) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central"
      className="fill-slate-600 dark:fill-slate-300 text-xs">
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// ═════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════
export default function ReportsPage() {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  // Date range
  const defaultRange = getQuickRangeDates('thisYear');
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);

  // Active tab
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl');

  // Data states
  const [pnlData, setPnlData] = useState<PnlData | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [clientData, setClientData] = useState<ClientRevenueData | null>(null);
  const [catExpenseData, setCatExpenseData] = useState<CategoryData | null>(null);
  const [catIncomeData, setCatIncomeData] = useState<CategoryData | null>(null);
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Export states
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Tax year derived from the date range
  const taxYear = useMemo(() => {
    return new Date(from).getFullYear();
  }, [from]);

  // ─── Data fetching ──────────────────────────────────────
  const fetchData = useCallback(async (tab: ReportTab) => {
    setLoading(true);
    setError('');
    try {
      switch (tab) {
        case 'pnl': {
          const data = await reports.getProfitLoss({ from, to });
          setPnlData(data);
          break;
        }
        case 'cashflow': {
          const data = await reports.getCashFlow({ from, to });
          setCashFlowData(data);
          break;
        }
        case 'clients': {
          const data = await reports.getClientRevenue({ from, to });
          setClientData(data);
          break;
        }
        case 'categories': {
          const [exp, inc] = await Promise.all([
            reports.getCategoryBreakdown({ from, to, type: 'expense' }),
            reports.getCategoryBreakdown({ from, to, type: 'income' }),
          ]);
          setCatExpenseData(exp);
          setCatIncomeData(inc);
          break;
        }
        case 'tax': {
          const data = await reports.getTaxSummary({ year: taxYear });
          setTaxData(data);
          break;
        }
        case 'forecast': {
          const data = await reports.getForecast({ months: 6 });
          setForecastData(data);
          break;
        }
        case 'zreport': {
          // Z-Report manages its own data fetching
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.failedToLoad');
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [from, to, taxYear, t, toast]);

  // Fetch on tab change or date change
  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, fetchData]);

  // ─── Handlers ───────────────────────────────────────────
  function handleDateChange(f: string, t2: string) {
    setFrom(f);
    setTo(t2);
  }

  function handleTabChange(tab: ReportTab) {
    setActiveTab(tab);
  }

  function handlePrint() {
    window.print();
  }

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    }
    if (exportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportDropdownOpen]);

  function handleOpenExportModal(format: ExportFormat) {
    setExportFormat(format);
    setExportModalOpen(true);
    setExportDropdownOpen(false);
  }

  function handleExportCSV() {
    // Simple CSV export based on active tab data
    let csvContent = '';
    const BOM = '\uFEFF';

    if (activeTab === 'pnl' && pnlData) {
      csvContent = `${t('reports.month')},${t('reports.income')},${t('reports.expenses')},${t('reports.netProfit')}\n`;
      pnlData.byMonth.forEach((m) => {
        csvContent += `${m.month},${m.income},${m.expenses},${m.net}\n`;
      });
    } else if (activeTab === 'cashflow' && cashFlowData) {
      csvContent = `${t('reports.month')},${t('reports.inflows')},${t('reports.outflows')},${t('reports.net')}\n`;
      cashFlowData.byMonth.forEach((m) => {
        csvContent += `${m.month},${m.inflows},${m.outflows},${m.net}\n`;
      });
    } else if (activeTab === 'clients' && clientData) {
      csvContent = `${t('reports.clientName')},${t('reports.invoiceCount')},${t('reports.totalInvoiced')},${t('reports.totalPaid')},${t('reports.outstanding')}\n`;
      clientData.forEach((c) => {
        csvContent += `${c.clientName},${c.invoiceCount},${c.totalInvoiced},${c.totalPaid},${c.outstanding}\n`;
      });
    } else if (activeTab === 'categories' && catExpenseData) {
      csvContent = `${t('common.category')},${t('common.amount')},${t('reports.percentage')},${t('reports.transactionCount')}\n`;
      catExpenseData.forEach((c) => {
        csvContent += `${getCategoryDisplayName(c.categoryName, c.categorySlug, t)},${c.total},${c.percentage},${c.transactionCount}\n`;
      });
    } else if (activeTab === 'tax' && taxData) {
      csvContent = `${t('reports.quarter')},${t('reports.income')},${t('reports.expenses')},${t('reports.tax')}\n`;
      taxData.quarterlyBreakdown.forEach((q) => {
        csvContent += `Q${q.quarter},${q.income},${q.expenses},${q.tax}\n`;
      });
    } else if (activeTab === 'forecast' && forecastData) {
      csvContent = `${t('reports.month')},${t('reports.income')},${t('reports.expenses')},${t('reports.net')},${t('reports.confidence')}\n`;
      forecastData.monthlyForecast.forEach((m) => {
        csvContent += `${m.month},${m.income},${m.expenses},${m.net},${(m.confidence * 100).toFixed(0)}%\n`;
      });
    }

    if (!csvContent) return;

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${activeTab}-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(t('reports.exportSuccess'), 'success');
  }

  function handleExportExcel() {
    // Generate CSV with BOM for Excel compatibility with Hebrew
    let csvContent = '';
    const BOM = '\uFEFF';
    const SEP = '\t'; // Tab-separated for better Excel import

    if (activeTab === 'pnl' && pnlData) {
      csvContent = `${t('reports.month')}${SEP}${t('reports.income')}${SEP}${t('reports.expenses')}${SEP}${t('reports.netProfit')}\n`;
      pnlData.byMonth.forEach((m) => {
        csvContent += `${m.month}${SEP}${m.income}${SEP}${m.expenses}${SEP}${m.net}\n`;
      });
    } else if (activeTab === 'cashflow' && cashFlowData) {
      csvContent = `${t('reports.month')}${SEP}${t('reports.inflows')}${SEP}${t('reports.outflows')}${SEP}${t('reports.net')}\n`;
      cashFlowData.byMonth.forEach((m) => {
        csvContent += `${m.month}${SEP}${m.inflows}${SEP}${m.outflows}${SEP}${m.net}\n`;
      });
    } else if (activeTab === 'clients' && clientData) {
      csvContent = `${t('reports.clientName')}${SEP}${t('reports.invoiceCount')}${SEP}${t('reports.totalInvoiced')}${SEP}${t('reports.totalPaid')}${SEP}${t('reports.outstanding')}\n`;
      clientData.forEach((c) => {
        csvContent += `${c.clientName}${SEP}${c.invoiceCount}${SEP}${c.totalInvoiced}${SEP}${c.totalPaid}${SEP}${c.outstanding}\n`;
      });
    } else if (activeTab === 'categories' && catExpenseData) {
      csvContent = `${t('common.category')}${SEP}${t('common.amount')}${SEP}${t('reports.percentage')}${SEP}${t('reports.transactionCount')}\n`;
      catExpenseData.forEach((c) => {
        csvContent += `${getCategoryDisplayName(c.categoryName, c.categorySlug, t)}${SEP}${c.total}${SEP}${c.percentage}${SEP}${c.transactionCount}\n`;
      });
    } else if (activeTab === 'tax' && taxData) {
      csvContent = `${t('reports.quarter')}${SEP}${t('reports.income')}${SEP}${t('reports.expenses')}${SEP}${t('reports.tax')}\n`;
      taxData.quarterlyBreakdown.forEach((q) => {
        csvContent += `Q${q.quarter}${SEP}${q.income}${SEP}${q.expenses}${SEP}${q.tax}\n`;
      });
    } else if (activeTab === 'forecast' && forecastData) {
      csvContent = `${t('reports.month')}${SEP}${t('reports.income')}${SEP}${t('reports.expenses')}${SEP}${t('reports.net')}${SEP}${t('reports.confidence')}\n`;
      forecastData.monthlyForecast.forEach((m) => {
        csvContent += `${m.month}${SEP}${m.income}${SEP}${m.expenses}${SEP}${m.net}${SEP}${(m.confidence * 100).toFixed(0)}%\n`;
      });
    }

    if (!csvContent) return;

    const blob = new Blob([BOM + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${activeTab}-${from}-${to}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    toast(t('reports.exportSuccess'), 'success');
  }

  function handleExportPDF() {
    window.print();
  }

  function handleExport(format: ExportFormat) {
    switch (format) {
      case 'pdf':
        handleExportPDF();
        break;
      case 'excel':
        handleExportExcel();
        break;
      case 'csv':
        handleExportCSV();
        break;
    }
  }

  // ─── Previous period comparison for P&L ─────────────────
  const pnlPrevComparison = useMemo(() => {
    if (!pnlData) return null;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const durationMs = toDate.getTime() - fromDate.getTime();
    const prevFrom = new Date(fromDate.getTime() - durationMs);
    const prevTo = new Date(fromDate.getTime() - 1);
    return {
      prevFrom: prevFrom.toISOString().slice(0, 10),
      prevTo: prevTo.toISOString().slice(0, 10),
    };
  }, [pnlData, from, to]);

  // P&L derived metrics
  const pnlMetrics = useMemo(() => {
    if (!pnlData) return null;
    const grossProfit = pnlData.income - pnlData.expenses;
    const margin = pnlData.income > 0 ? (grossProfit / pnlData.income) * 100 : 0;
    return { grossProfit, margin };
  }, [pnlData]);

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            {t('reports.title')}
            <HelpTooltip text={t('help.reports')} />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          {/* Export Dropdown */}
          <div className="relative" ref={exportDropdownRef}>
            <button
              type="button"
              className="btn-secondary flex items-center gap-1.5 text-sm"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            >
              <DownloadIcon /> {t('reports.exportDropdown')} <ChevronDownIcon />
            </button>
            {exportDropdownOpen && (
              <div className="absolute end-0 top-full mt-1.5 w-48 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn">
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleOpenExportModal('pdf')}
                >
                  <FileTextIcon />
                  <span>{t('reports.exportPdf')}</span>
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleOpenExportModal('excel')}
                >
                  <TableIcon />
                  <span>{t('reports.exportExcel')}</span>
                </button>
                <button
                  type="button"
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleOpenExportModal('csv')}
                >
                  <DownloadIcon />
                  <span>{t('reports.exportCsv')}</span>
                </button>
              </div>
            )}
          </div>
          <button type="button" className="btn-secondary flex items-center gap-1.5 text-sm" onClick={handlePrint}>
            <PrintIcon /> {t('reports.print')}
          </button>
        </div>
      </div>

      {/* Page action guide */}
      <PageGuide
        pageKey="reports"
        steps={[
          { labelHe: 'בחר טווח תאריכים', labelEn: 'Select date range' },
          { labelHe: 'בחר סוג דוח', labelEn: 'Choose report type' },
          { labelHe: 'צפה בנתונים', labelEn: 'View data' },
          { labelHe: 'ייצא או הדפס', labelEn: 'Export or print' },
        ]}
      />

      {/* Date Range + Tabs */}
      <div className="card no-print space-y-4">
        {/* Date Range */}
        <DateRangePicker from={from} to={to} onChange={handleDateChange} />

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }
              `}
            >
              {tab.icon}
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="card border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Report Content */}
      <div ref={printRef}>
        {loading ? (
          <ReportSkeleton />
        ) : (
          <>
            {activeTab === 'pnl' && pnlData && <PnLReport data={pnlData} metrics={pnlMetrics!} locale={locale} t={t} from={from} to={to} />}
            {activeTab === 'cashflow' && cashFlowData && <CashFlowReport data={cashFlowData} locale={locale} t={t} />}
            {activeTab === 'clients' && clientData && <ClientRevenueReport data={clientData} locale={locale} t={t} />}
            {activeTab === 'categories' && (catExpenseData || catIncomeData) && (
              <CategoryReport expenseData={catExpenseData} incomeData={catIncomeData} locale={locale} t={t} />
            )}
            {activeTab === 'tax' && taxData && <TaxReport data={taxData} locale={locale} t={t} year={taxYear} />}
            {activeTab === 'forecast' && forecastData && <ForecastReport data={forecastData} locale={locale} t={t} />}
            {activeTab === 'zreport' && <ZReportTab locale={locale} t={t} toast={toast} />}

            {/* Empty state */}
            {!loading && !error && activeTab !== 'zreport' && (
              (activeTab === 'pnl' && !pnlData) ||
              (activeTab === 'cashflow' && !cashFlowData) ||
              (activeTab === 'clients' && !clientData) ||
              (activeTab === 'categories' && !catExpenseData && !catIncomeData) ||
              (activeTab === 'tax' && !taxData) ||
              (activeTab === 'forecast' && !forecastData)
            ) && (
              <div className="card text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                  <ChartBarIcon />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">{t('reports.noData')}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Export Preview Modal */}
      {exportModalOpen && (
        <ReportExportModal
          format={exportFormat}
          onFormatChange={setExportFormat}
          activeTab={activeTab}
          onExport={handleExport}
          onClose={() => setExportModalOpen(false)}
          locale={locale}
          t={t}
          from={from}
          to={to}
          pnlData={pnlData}
          cashFlowData={cashFlowData}
          clientData={clientData}
          catExpenseData={catExpenseData}
          taxData={taxData}
          forecastData={forecastData}
        />
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// P&L REPORT
// ═════════════════════════════════════════════════════════════
function PnLReport({
  data, metrics, locale, t, from, to,
}: {
  data: PnlData;
  metrics: { grossProfit: number; margin: number };
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  from: string;
  to: string;
}) {
  const chartData = data.byMonth.map((m) => ({
    month: fmtMonth(m.month, locale),
    [t('reports.income')]: m.income,
    [t('reports.expenses')]: Math.abs(m.expenses),
    [t('reports.netProfit')]: m.net,
  }));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label={t('reports.totalRevenue')}
          value={fmtCurrency(data.income, locale)}
          colorClass="text-green-600 dark:text-green-400"
          cardClass="stat-card-green"
        />
        <StatCard
          label={t('reports.totalExpenses')}
          value={fmtCurrency(Math.abs(data.expenses), locale)}
          colorClass="text-red-600 dark:text-red-400"
          cardClass="stat-card-red"
        />
        <StatCard
          label={t('reports.netProfit')}
          value={fmtCurrency(data.netProfit, locale)}
          colorClass={data.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          cardClass={data.netProfit >= 0 ? 'stat-card-green' : 'stat-card-red'}
        />
        <StatCard
          label={t('reports.profitMargin')}
          value={`${metrics.margin.toFixed(1)}%`}
          subValue={metrics.margin >= 20 ? t('reports.healthy') : metrics.margin >= 0 ? t('reports.moderate') : t('reports.negative')}
          colorClass={metrics.margin >= 20 ? 'text-green-600 dark:text-green-400' : metrics.margin >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
          cardClass={metrics.margin >= 20 ? 'stat-card-green' : metrics.margin >= 0 ? 'stat-card-amber' : 'stat-card-red'}
        />
      </div>

      {/* Monthly Bar Chart */}
      <div className="card">
        <h3 className="text-base font-semibold mb-4">{t('reports.monthlyBreakdown')}</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--border)" tickFormatter={(v) => fmtCurrency(v, locale, true)} />
              <RTooltip content={<CustomTooltip locale={locale} />} />
              <Legend />
              <Bar dataKey={t('reports.income')} fill={BAR_INCOME_COLOR} radius={[4, 4, 0, 0]} />
              <Bar dataKey={t('reports.expenses')} fill={BAR_EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
        )}
      </div>

      {/* Revenue by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Categories */}
        <div className="card">
          <h3 className="text-base font-semibold mb-4">{t('reports.revenueBySource')}</h3>
          {data.incomeByCategory.length > 0 ? (
            <div className="space-y-3">
              {data.incomeByCategory
                .sort((a, b) => b.total - a.total)
                .map((cat, i) => {
                  const pct = data.income > 0 ? (cat.total / data.income) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{cat.category}</span>
                        <span className="text-green-600 dark:text-green-400 font-semibold">{fmtCurrency(cat.total, locale)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all duration-700 animate-progressFill"
                          style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">{t('reports.noData')}</p>
          )}
        </div>

        {/* Expense Categories */}
        <div className="card">
          <h3 className="text-base font-semibold mb-4">{t('reports.expensesByCategory')}</h3>
          {data.expensesByCategory.length > 0 ? (
            <div className="space-y-3">
              {data.expensesByCategory
                .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
                .map((cat, i) => {
                  const absTotal = Math.abs(cat.total);
                  const absExpenses = Math.abs(data.expenses);
                  const pct = absExpenses > 0 ? (absTotal / absExpenses) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{cat.category}</span>
                        <span className="text-red-600 dark:text-red-400 font-semibold">{fmtCurrency(absTotal, locale)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full transition-all duration-700 animate-progressFill"
                          style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">{t('reports.noData')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// CASH FLOW REPORT
// ═════════════════════════════════════════════════════════════
function CashFlowReport({
  data, locale, t,
}: {
  data: CashFlowData;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  // Waterfall chart data: each month shows cumulative balance
  const waterfallData = useMemo(() => {
    let cumulative = 0;
    return data.byMonth.map((m) => {
      cumulative += m.net;
      return {
        month: fmtMonth(m.month, locale),
        [t('reports.inflows')]: m.inflows,
        [t('reports.outflows')]: Math.abs(m.outflows),
        [t('reports.net')]: m.net,
        cumulative,
      };
    });
  }, [data, locale, t]);

  const netColor = data.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary Flow */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 py-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{t('reports.totalInflows')}</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmtCurrency(data.inflows, locale)}</p>
          </div>
          <div className="text-2xl text-slate-300 dark:text-slate-600 font-light">-</div>
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{t('reports.totalOutflows')}</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{fmtCurrency(Math.abs(data.outflows), locale)}</p>
          </div>
          <div className="text-2xl text-slate-300 dark:text-slate-600 font-light">=</div>
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{t('reports.netCashFlow')}</p>
            <p className={`text-xl font-bold ${netColor}`}>{fmtCurrency(data.net, locale)}</p>
          </div>
        </div>
      </div>

      {/* Monthly Cash Flow Chart */}
      <div className="card">
        <h3 className="text-base font-semibold mb-4">{t('reports.monthlyCashFlow')}</h3>
        {waterfallData.length > 0 ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={waterfallData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--border)" tickFormatter={(v) => fmtCurrency(v, locale, true)} />
              <RTooltip content={<CustomTooltip locale={locale} />} />
              <Legend />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey={t('reports.inflows')} fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey={t('reports.outflows')} fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
        )}
      </div>

      {/* Cumulative Cash Flow Line */}
      <div className="card">
        <h3 className="text-base font-semibold mb-4">{t('reports.cumulativeCashFlow')}</h3>
        {waterfallData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={waterfallData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--border)" tickFormatter={(v) => fmtCurrency(v, locale, true)} />
              <RTooltip content={<CustomTooltip locale={locale} />} />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2.5} fill="url(#cashGradient)" name={t('reports.balance')} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
        )}
      </div>

      {/* Monthly Breakdown Table */}
      <div className="card overflow-x-auto">
        <h3 className="text-base font-semibold mb-4">{t('reports.monthlyBreakdown')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--border)]">
              <th className="text-start pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.month')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.inflows')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.outflows')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.net')}</th>
            </tr>
          </thead>
          <tbody>
            {data.byMonth.map((m, i) => (
              <tr key={i} className="table-row">
                <td className="py-2.5 font-medium">{fmtMonth(m.month, locale)}</td>
                <td className="py-2.5 text-end text-green-600 dark:text-green-400">{fmtCurrency(m.inflows, locale)}</td>
                <td className="py-2.5 text-end text-red-600 dark:text-red-400">{fmtCurrency(Math.abs(m.outflows), locale)}</td>
                <td className={`py-2.5 text-end font-semibold ${m.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {fmtCurrency(m.net, locale)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] font-bold">
              <td className="py-3">{t('reports.total')}</td>
              <td className="py-3 text-end text-green-600 dark:text-green-400">{fmtCurrency(data.inflows, locale)}</td>
              <td className="py-3 text-end text-red-600 dark:text-red-400">{fmtCurrency(Math.abs(data.outflows), locale)}</td>
              <td className={`py-3 text-end ${data.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {fmtCurrency(data.net, locale)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// CLIENT REVENUE REPORT
// ═════════════════════════════════════════════════════════════
function ClientRevenueReport({
  data, locale, t,
}: {
  data: ClientRevenueData;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const sortedData = useMemo(() => [...data].sort((a, b) => b.totalInvoiced - a.totalInvoiced), [data]);

  const barData = sortedData.slice(0, 10).map((c) => ({
    name: c.clientName.length > 15 ? c.clientName.slice(0, 15) + '...' : c.clientName,
    [t('reports.revenue')]: c.totalInvoiced,
    [t('reports.paid')]: c.totalPaid,
  }));

  const pieData = sortedData.filter((c) => c.totalInvoiced > 0).map((c) => ({
    name: c.clientName,
    value: c.totalInvoiced,
  }));

  const totalRevenue = sortedData.reduce((s, c) => s + c.totalInvoiced, 0);
  const totalOutstanding = sortedData.reduce((s, c) => s + c.outstanding, 0);
  const totalPaid = sortedData.reduce((s, c) => s + c.totalPaid, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('reports.totalInvoiced')}
          value={fmtCurrency(totalRevenue, locale)}
          colorClass="text-primary-600 dark:text-primary-400"
          cardClass="stat-card-indigo"
        />
        <StatCard
          label={t('reports.totalPaid')}
          value={fmtCurrency(totalPaid, locale)}
          colorClass="text-green-600 dark:text-green-400"
          cardClass="stat-card-green"
        />
        <StatCard
          label={t('reports.totalOutstanding')}
          value={fmtCurrency(totalOutstanding, locale)}
          colorClass="text-amber-600 dark:text-amber-400"
          cardClass="stat-card-amber"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="card">
          <h3 className="text-base font-semibold mb-4">{t('reports.revenueByClient')}</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--border)" tickFormatter={(v) => fmtCurrency(v, locale, true)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--border)" width={110} />
                <RTooltip content={<CustomTooltip locale={locale} />} />
                <Legend />
                <Bar dataKey={t('reports.revenue')} fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey={t('reports.paid')} fill="#22c55e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
          )}
        </div>

        {/* Pie chart */}
        <div className="card">
          <h3 className="text-base font-semibold mb-4">{t('reports.revenueDistribution')}</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  dataKey="value"
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(value: number) => fmtCurrency(value, locale)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
          )}
        </div>
      </div>

      {/* Client Table */}
      <div className="card overflow-x-auto">
        <h3 className="text-base font-semibold mb-4">{t('reports.clientDetails')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--border)]">
              <th className="text-start pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.clientName')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.invoiceCount')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.totalInvoiced')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.avgInvoice')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.totalPaid')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.outstanding')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((c) => {
              const avg = c.invoiceCount > 0 ? c.totalInvoiced / c.invoiceCount : 0;
              return (
                <tr key={c.clientId} className="table-row">
                  <td className="py-2.5 font-medium">{c.clientName}</td>
                  <td className="py-2.5 text-end">{c.invoiceCount}</td>
                  <td className="py-2.5 text-end">{fmtCurrency(c.totalInvoiced, locale)}</td>
                  <td className="py-2.5 text-end text-slate-500 dark:text-slate-400">{fmtCurrency(avg, locale)}</td>
                  <td className="py-2.5 text-end text-green-600 dark:text-green-400">{fmtCurrency(c.totalPaid, locale)}</td>
                  <td className={`py-2.5 text-end font-semibold ${c.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                    {fmtCurrency(c.outstanding, locale)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedData.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">{t('reports.noClients')}</p>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// CATEGORY BREAKDOWN REPORT
// ═════════════════════════════════════════════════════════════
function CategoryReport({
  expenseData, incomeData, locale, t,
}: {
  expenseData: CategoryData | null;
  incomeData: CategoryData | null;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [viewType, setViewType] = useState<'expense' | 'income'>('expense');
  const activeData = viewType === 'expense' ? expenseData : incomeData;
  const sortedData = useMemo(() => activeData ? [...activeData].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)) : [], [activeData]);

  const pieData = sortedData.filter((c) => c.total !== 0).map((c) => ({
    name: getCategoryDisplayName(c.categoryName, c.categorySlug, t),
    value: Math.abs(c.total),
    color: c.categoryColor,
  }));

  const totalAmount = sortedData.reduce((s, c) => s + Math.abs(c.total), 0);
  const totalCount = sortedData.reduce((s, c) => s + c.transactionCount, 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewType('expense')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            viewType === 'expense'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {t('reports.expenses')}
        </button>
        <button
          type="button"
          onClick={() => setViewType('income')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            viewType === 'income'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {t('reports.income')}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={viewType === 'expense' ? t('reports.totalExpenses') : t('reports.totalIncome')}
          value={fmtCurrency(totalAmount, locale)}
          colorClass={viewType === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
          cardClass={viewType === 'expense' ? 'stat-card-red' : 'stat-card-green'}
        />
        <StatCard
          label={t('reports.categories')}
          value={String(sortedData.length)}
          cardClass="stat-card-indigo"
        />
        <StatCard
          label={t('reports.transactionCount')}
          value={String(totalCount)}
          cardClass="stat-card-blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="card">
          <h3 className="text-base font-semibold mb-4">
            {viewType === 'expense' ? t('reports.expenseDistribution') : t('reports.incomeDistribution')}
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={45}
                  dataKey="value"
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(value: number) => fmtCurrency(value, locale)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
          )}
        </div>

        {/* Bar chart */}
        <div className="card">
          <h3 className="text-base font-semibold mb-4">{t('reports.byCategory')}</h3>
          {sortedData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={sortedData.slice(0, 8).map((c) => ({
                  name: (() => { const n = getCategoryDisplayName(c.categoryName, c.categorySlug, t); return n.length > 12 ? n.slice(0, 12) + '...' : n; })(),
                  [t('common.amount')]: Math.abs(c.total),
                  color: c.categoryColor,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--border)" tickFormatter={(v) => fmtCurrency(v, locale, true)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--border)" width={100} />
                <RTooltip content={<CustomTooltip locale={locale} />} />
                <Bar dataKey={t('common.amount')} fill={viewType === 'expense' ? '#ef4444' : '#22c55e'} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
          )}
        </div>
      </div>

      {/* Detail Table */}
      <div className="card overflow-x-auto">
        <h3 className="text-base font-semibold mb-4">{t('reports.detailedBreakdown')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--border)]">
              <th className="text-start pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('common.category')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('common.amount')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.percentage')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.transactionCount')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.avgTransaction')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((cat) => {
              const avg = cat.transactionCount > 0 ? Math.abs(cat.total) / cat.transactionCount : 0;
              return (
                <tr key={cat.categoryId} className="table-row">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.categoryColor || '#94a3b8' }}
                      />
                      <span className="font-medium">{getCategoryDisplayName(cat.categoryName, cat.categorySlug, t)}</span>
                    </div>
                  </td>
                  <td className={`py-2.5 text-end font-semibold ${viewType === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {fmtCurrency(Math.abs(cat.total), locale)}
                  </td>
                  <td className="py-2.5 text-end">
                    <span className="badge-primary">{cat.percentage.toFixed(1)}%</span>
                  </td>
                  <td className="py-2.5 text-end">{cat.transactionCount}</td>
                  <td className="py-2.5 text-end text-slate-500 dark:text-slate-400">{fmtCurrency(avg, locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedData.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">{t('reports.noData')}</p>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// TAX SUMMARY REPORT
// ═════════════════════════════════════════════════════════════
function TaxReport({
  data, locale, t, year,
}: {
  data: TaxData;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  year: number;
}) {
  const quarterData = data.quarterlyBreakdown.map((q) => ({
    quarter: fmtQuarter(q.quarter),
    [t('reports.income')]: q.income,
    [t('reports.expenses')]: Math.abs(q.expenses),
    [t('reports.tax')]: q.tax,
  }));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Year Badge */}
      <div className="flex items-center gap-3">
        <span className="badge-primary text-base px-4 py-1.5 font-bold">{t('reports.taxYear', { year })}</span>
      </div>

      {/* Annual Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label={t('reports.annualRevenue')}
          value={fmtCurrency(data.income, locale)}
          colorClass="text-green-600 dark:text-green-400"
          cardClass="stat-card-green"
        />
        <StatCard
          label={t('reports.deductions')}
          value={fmtCurrency(data.deductions, locale)}
          colorClass="text-blue-600 dark:text-blue-400"
          cardClass="stat-card-blue"
        />
        <StatCard
          label={t('reports.taxableIncome')}
          value={fmtCurrency(data.taxableIncome, locale)}
          colorClass="text-primary-600 dark:text-primary-400"
          cardClass="stat-card-indigo"
        />
        <StatCard
          label={t('reports.estimatedTax')}
          value={fmtCurrency(data.estimatedTax, locale)}
          colorClass="text-amber-600 dark:text-amber-400"
          cardClass="stat-card-amber"
        />
      </div>

      {/* VAT Summary */}
      <div className="card">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          {t('reports.vatSummary')}
          <HelpTooltip text={t('reports.vatSummaryHelp')} />
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{t('reports.vatCollected')}</p>
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{fmtCurrency(data.vatCollected, locale)}</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{t('reports.vatDeductible')}</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{fmtCurrency(data.vatDeductible, locale)}</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{t('reports.vatPayable')}</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{fmtCurrency(data.vatPayable, locale)}</p>
          </div>
        </div>
      </div>

      {/* Quarterly Breakdown Chart */}
      <div className="card">
        <h3 className="text-base font-semibold mb-4">{t('reports.quarterlyBreakdown')}</h3>
        {quarterData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={quarterData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="quarter" tick={{ fontSize: 13 }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--border)" tickFormatter={(v) => fmtCurrency(v, locale, true)} />
              <RTooltip content={<CustomTooltip locale={locale} />} />
              <Legend />
              <Bar dataKey={t('reports.income')} fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey={t('reports.expenses')} fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey={t('reports.tax')} fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
        )}
      </div>

      {/* Quarterly Table */}
      <div className="card overflow-x-auto">
        <h3 className="text-base font-semibold mb-4">{t('reports.quarterlyDetails')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--border)]">
              <th className="text-start pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.quarter')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.income')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.expenses')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.profit')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.tax')}</th>
            </tr>
          </thead>
          <tbody>
            {data.quarterlyBreakdown.map((q) => (
              <tr key={q.quarter} className="table-row">
                <td className="py-2.5 font-medium">{fmtQuarter(q.quarter)}</td>
                <td className="py-2.5 text-end text-green-600 dark:text-green-400">{fmtCurrency(q.income, locale)}</td>
                <td className="py-2.5 text-end text-red-600 dark:text-red-400">{fmtCurrency(Math.abs(q.expenses), locale)}</td>
                <td className={`py-2.5 text-end ${q.income + q.expenses >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {fmtCurrency(q.income + q.expenses, locale)}
                </td>
                <td className="py-2.5 text-end font-semibold text-amber-600 dark:text-amber-400">{fmtCurrency(q.tax, locale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] font-bold">
              <td className="py-3">{t('reports.total')}</td>
              <td className="py-3 text-end text-green-600 dark:text-green-400">{fmtCurrency(data.income, locale)}</td>
              <td className="py-3 text-end text-red-600 dark:text-red-400">
                {fmtCurrency(data.quarterlyBreakdown.reduce((s, q) => s + Math.abs(q.expenses), 0), locale)}
              </td>
              <td className="py-3 text-end">{fmtCurrency(data.taxableIncome, locale)}</td>
              <td className="py-3 text-end text-amber-600 dark:text-amber-400">{fmtCurrency(data.estimatedTax, locale)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Tax Deductions Info */}
      <div className="card bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/30 dark:to-accent-950/20 border-primary-200 dark:border-primary-800/40">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <CheckCircle />
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-1">{t('reports.taxDeductionTip')}</h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('reports.taxDeductionTipDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// FORECAST REPORT
// ═════════════════════════════════════════════════════════════
function ForecastReport({
  data, locale, t,
}: {
  data: ForecastData;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const chartData = data.monthlyForecast.map((m) => ({
    month: fmtMonth(m.month, locale),
    [t('reports.income')]: m.income,
    [t('reports.expenses')]: Math.abs(m.expenses),
    [t('reports.net')]: m.net,
    confidenceHigh: m.income * (1 + (1 - m.confidence) * 0.5),
    confidenceLow: m.income * (1 - (1 - m.confidence) * 0.5),
  }));

  const avgConfidence = data.monthlyForecast.length > 0
    ? data.monthlyForecast.reduce((s, m) => s + m.confidence, 0) / data.monthlyForecast.length
    : 0;

  const netPositive = data.projectedNet >= 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label={t('reports.projectedIncome')}
          value={fmtCurrency(data.projectedIncome, locale)}
          colorClass="text-green-600 dark:text-green-400"
          cardClass="stat-card-green"
        />
        <StatCard
          label={t('reports.projectedExpenses')}
          value={fmtCurrency(Math.abs(data.projectedExpenses), locale)}
          colorClass="text-red-600 dark:text-red-400"
          cardClass="stat-card-red"
        />
        <StatCard
          label={t('reports.projectedNet')}
          value={fmtCurrency(data.projectedNet, locale)}
          colorClass={netPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
          cardClass={netPositive ? 'stat-card-green' : 'stat-card-red'}
        />
        <StatCard
          label={t('reports.avgConfidence')}
          value={`${(avgConfidence * 100).toFixed(0)}%`}
          subValue={avgConfidence >= 0.7 ? t('reports.highConfidence') : avgConfidence >= 0.4 ? t('reports.medConfidence') : t('reports.lowConfidence')}
          colorClass={avgConfidence >= 0.7 ? 'text-green-600 dark:text-green-400' : avgConfidence >= 0.4 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}
          cardClass={avgConfidence >= 0.7 ? 'stat-card-green' : avgConfidence >= 0.4 ? 'stat-card-amber' : 'stat-card-red'}
        />
      </div>

      {/* Projection Line Chart */}
      <div className="card">
        <h3 className="text-base font-semibold mb-4">{t('reports.sixMonthProjection')}</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--border)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--border)" tickFormatter={(v) => fmtCurrency(v, locale, true)} />
              <RTooltip content={<CustomTooltip locale={locale} />} />
              <Legend />
              <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
              <Area type="monotone" dataKey={t('reports.income')} stroke="#22c55e" strokeWidth={2.5} fill="url(#incomeGradient)" />
              <Area type="monotone" dataKey={t('reports.expenses')} stroke="#ef4444" strokeWidth={2.5} fill="url(#expenseGradient)" />
              <Line type="monotone" dataKey={t('reports.net')} stroke="#6366f1" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-sm text-slate-400">{t('reports.noData')}</div>
        )}
      </div>

      {/* Monthly Forecast Table */}
      <div className="card overflow-x-auto">
        <h3 className="text-base font-semibold mb-4">{t('reports.monthlyForecast')}</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--border)]">
              <th className="text-start pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.month')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.income')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.expenses')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.net')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.trend')}</th>
              <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.confidence')}</th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyForecast.map((m, i) => (
              <tr key={i} className="table-row">
                <td className="py-2.5 font-medium">{fmtMonth(m.month, locale)}</td>
                <td className="py-2.5 text-end text-green-600 dark:text-green-400">{fmtCurrency(m.income, locale)}</td>
                <td className="py-2.5 text-end text-red-600 dark:text-red-400">{fmtCurrency(Math.abs(m.expenses), locale)}</td>
                <td className={`py-2.5 text-end font-semibold ${m.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {fmtCurrency(m.net, locale)}
                </td>
                <td className="py-2.5 text-end">
                  {m.net >= 0 ? <TrendUp /> : <TrendDown />}
                </td>
                <td className="py-2.5 text-end">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${m.confidence * 100}%`,
                          backgroundColor: m.confidence >= 0.7 ? '#22c55e' : m.confidence >= 0.4 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[36px] text-end">
                      {(m.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assumptions / Disclaimer */}
      <div className="card bg-gradient-to-br from-slate-50 to-primary-50/50 dark:from-slate-900/50 dark:to-primary-950/20 border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">{t('reports.forecastAssumptions')}</h4>
            <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary-400 shrink-0 mt-1.5" />
                {t('reports.assumptionHistory')}
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary-400 shrink-0 mt-1.5" />
                {t('reports.assumptionRecurring')}
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary-400 shrink-0 mt-1.5" />
                {t('reports.assumptionInvoices')}
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-primary-400 shrink-0 mt-1.5" />
                {t('reports.assumptionDisclaimer')}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// REPORT EXPORT MODAL
// ═════════════════════════════════════════════════════════════
function ReportExportModal({
  format,
  onFormatChange,
  activeTab,
  onExport,
  onClose,
  locale,
  t,
  from,
  to,
  pnlData,
  cashFlowData,
  clientData,
  catExpenseData,
  taxData,
  forecastData,
}: {
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  activeTab: ReportTab;
  onExport: (format: ExportFormat) => void;
  onClose: () => void;
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  from: string;
  to: string;
  pnlData: PnlData | null;
  cashFlowData: CashFlowData | null;
  clientData: ClientRevenueData | null;
  catExpenseData: CategoryData | null;
  taxData: TaxData | null;
  forecastData: ForecastData | null;
}) {
  const [logoPosition, setLogoPosition] = useState<LogoPosition>('right');
  const [titleStyle, setTitleStyle] = useState<TitleStyle>('bold');
  const [includeCharts, setIncludeCharts] = useState(true);

  const tabLabels: Record<ReportTab, string> = {
    pnl: t('reports.tabs.pnl'),
    cashflow: t('reports.tabs.cashflow'),
    clients: t('reports.tabs.clients'),
    categories: t('reports.tabs.categories'),
    tax: t('reports.tabs.tax'),
    forecast: t('reports.tabs.forecast'),
    zreport: t('reports.tabs.zreport'),
  };

  const formatLabels: { id: ExportFormat; label: string; icon: React.ReactNode }[] = [
    { id: 'pdf', label: t('reports.exportPdf'), icon: <FileTextIcon /> },
    { id: 'excel', label: t('reports.exportExcel'), icon: <TableIcon /> },
    { id: 'csv', label: t('reports.exportCsv'), icon: <DownloadIcon /> },
  ];

  const logoPositions: { id: LogoPosition; label: string }[] = [
    { id: 'left', label: t('reports.logoLeft') },
    { id: 'center', label: t('reports.logoCenter') },
    { id: 'right', label: t('reports.logoRight') },
  ];

  const titleStyles: { id: TitleStyle; label: string }[] = [
    { id: 'normal', label: t('reports.titleNormal') },
    { id: 'bold', label: t('reports.titleBold') },
    { id: 'larger', label: t('reports.titleLarger') },
  ];

  function handleConfirmExport() {
    onExport(format);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold">{t('reports.exportPreview')}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Format Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{t('reports.exportFormat')}</label>
            <div className="flex gap-2">
              {formatLabels.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onFormatChange(f.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    format === f.id
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Logo Position */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{t('reports.logoPosition')}</label>
            <div className="flex gap-3">
              {logoPositions.map((pos) => (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => setLogoPosition(pos.id)}
                  className={`flex-1 rounded-xl border-2 p-3 transition-all ${
                    logoPosition === pos.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                      : 'border-[var(--border)] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="h-8 flex items-center mb-1.5" style={{ justifyContent: pos.id === 'left' ? 'flex-start' : pos.id === 'center' ? 'center' : 'flex-end' }}>
                    <div className={`w-8 h-6 rounded bg-slate-300 dark:bg-slate-600 ${logoPosition === pos.id ? 'bg-primary-400 dark:bg-primary-500' : ''}`} />
                  </div>
                  <p className="text-xs text-center font-medium text-slate-500 dark:text-slate-400">{pos.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Title Style */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{t('reports.titleStyle')}</label>
            <div className="flex gap-2">
              {titleStyles.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTitleStyle(s.id)}
                  className={`px-4 py-2 rounded-xl text-sm transition-all ${
                    titleStyle === s.id
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                  style={{
                    fontWeight: s.id === 'bold' || s.id === 'larger' ? 700 : 400,
                    fontSize: s.id === 'larger' ? '1rem' : '0.875rem',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Include Charts Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{t('reports.includeCharts')}</label>
            <button
              type="button"
              onClick={() => setIncludeCharts(!includeCharts)}
              className={`relative w-11 h-6 rounded-full transition-colors ${includeCharts ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includeCharts ? 'start-[22px]' : 'start-0.5'}`} />
            </button>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">{t('reports.reportPreview')}</label>
            <div className="border border-[var(--border)] rounded-xl bg-white dark:bg-slate-900 p-5 min-h-[200px]">
              {/* Preview header with logo position */}
              <div className="flex items-start mb-4" style={{ justifyContent: logoPosition === 'left' ? 'flex-start' : logoPosition === 'center' ? 'center' : 'flex-end' }}>
                <div className="w-16 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
                  {t('reports.noLogo')}
                </div>
              </div>
              {/* Preview title */}
              <h3
                className="mb-2 text-slate-800 dark:text-slate-200"
                style={{
                  fontWeight: titleStyle === 'bold' || titleStyle === 'larger' ? 700 : 400,
                  fontSize: titleStyle === 'larger' ? '1.25rem' : titleStyle === 'bold' ? '1.1rem' : '1rem',
                }}
              >
                {tabLabels[activeTab]}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{from} - {to}</p>
              {/* Actual data preview table */}
              <div className="overflow-x-auto">
                {activeTab === 'pnl' && pnlData ? (
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-start py-1.5 px-2 font-semibold text-slate-500">{t('reports.month')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.income')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.expenses')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.netProfit')}</th>
                    </tr></thead>
                    <tbody>{pnlData.byMonth.slice(0, 5).map((m, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1 px-2">{m.month}</td>
                        <td className="py-1 px-2 text-end text-green-600">{fmtCurrency(m.income, locale)}</td>
                        <td className="py-1 px-2 text-end text-red-500">{fmtCurrency(m.expenses, locale)}</td>
                        <td className="py-1 px-2 text-end font-semibold">{fmtCurrency(m.net, locale)}</td>
                      </tr>
                    ))}</tbody>
                    {pnlData.byMonth.length > 5 && <tfoot><tr><td colSpan={4} className="py-1 px-2 text-center text-slate-400 text-[10px]">...{locale === 'he' ? `\u05D5\u05E2\u05D5\u05D3 ${pnlData.byMonth.length - 5} \u05E9\u05D5\u05E8\u05D5\u05EA` : `and ${pnlData.byMonth.length - 5} more rows`}</td></tr></tfoot>}
                  </table>
                ) : activeTab === 'cashflow' && cashFlowData ? (
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-start py-1.5 px-2 font-semibold text-slate-500">{t('reports.month')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.inflows')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.outflows')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.net')}</th>
                    </tr></thead>
                    <tbody>{cashFlowData.byMonth.slice(0, 5).map((m, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1 px-2">{m.month}</td>
                        <td className="py-1 px-2 text-end text-green-600">{fmtCurrency(m.inflows, locale)}</td>
                        <td className="py-1 px-2 text-end text-red-500">{fmtCurrency(m.outflows, locale)}</td>
                        <td className="py-1 px-2 text-end font-semibold">{fmtCurrency(m.net, locale)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : activeTab === 'clients' && clientData ? (
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-start py-1.5 px-2 font-semibold text-slate-500">{t('reports.clientName')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.invoiceCount')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.totalInvoiced')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.totalPaid')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.outstanding')}</th>
                    </tr></thead>
                    <tbody>{clientData.slice(0, 5).map((c, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1 px-2">{c.clientName}</td>
                        <td className="py-1 px-2 text-end">{c.invoiceCount}</td>
                        <td className="py-1 px-2 text-end">{fmtCurrency(c.totalInvoiced, locale)}</td>
                        <td className="py-1 px-2 text-end text-green-600">{fmtCurrency(c.totalPaid, locale)}</td>
                        <td className="py-1 px-2 text-end text-amber-600">{fmtCurrency(c.outstanding, locale)}</td>
                      </tr>
                    ))}</tbody>
                    {clientData.length > 5 && <tfoot><tr><td colSpan={5} className="py-1 px-2 text-center text-slate-400 text-[10px]">...{locale === 'he' ? `\u05D5\u05E2\u05D5\u05D3 ${clientData.length - 5} \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA` : `and ${clientData.length - 5} more clients`}</td></tr></tfoot>}
                  </table>
                ) : activeTab === 'tax' && taxData ? (
                  <table className="w-full text-xs border-collapse">
                    <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-start py-1.5 px-2 font-semibold text-slate-500">{t('reports.quarter')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.income')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.expenses')}</th>
                      <th className="text-end py-1.5 px-2 font-semibold text-slate-500">{t('reports.tax')}</th>
                    </tr></thead>
                    <tbody>{taxData.quarterlyBreakdown.map((q, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1 px-2">Q{q.quarter}</td>
                        <td className="py-1 px-2 text-end text-green-600">{fmtCurrency(q.income, locale)}</td>
                        <td className="py-1 px-2 text-end text-red-500">{fmtCurrency(q.expenses, locale)}</td>
                        <td className="py-1 px-2 text-end font-semibold">{fmtCurrency(q.tax, locale)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                ) : (
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-800 rounded" />
                    <div className="h-3 w-5/6 bg-slate-100 dark:bg-slate-800 rounded" />
                  </div>
                )}
              </div>
              {/* Format indicator */}
              <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono uppercase">{format}</span>
                <span>{format === 'csv' ? (locale === 'he' ? '\u05E7\u05D5\u05D1\u05E5 \u05DE\u05D5\u05E4\u05E8\u05D3 \u05D1\u05E4\u05E1\u05D9\u05E7\u05D9\u05DD (UTF-8)' : 'Comma-separated values (UTF-8)') : format === 'excel' ? (locale === 'he' ? '\u05E7\u05D5\u05D1\u05E5 \u05DE\u05D5\u05E4\u05E8\u05D3 \u05D1\u05D8\u05D0\u05D1\u05D9\u05DD (Tab-separated)' : 'Tab-separated values for Excel') : (locale === 'he' ? '\u05DE\u05E1\u05DE\u05DA PDF \u05DC\u05D4\u05D3\u05E4\u05E1\u05D4' : 'PDF document for printing')}</span>
              </div>
              {includeCharts && (
                <div className="mt-3 h-16 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg flex items-center justify-center">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    <ChartBarIcon />
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
          <button type="button" onClick={onClose} className="btn-secondary text-sm px-5 py-2">
            {t('reports.cancel')}
          </button>
          <button type="button" onClick={handleConfirmExport} className="btn-primary text-sm px-5 py-2 flex items-center gap-1.5">
            <DownloadIcon /> {t('reports.export')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// Z-REPORT (END OF DAY) TAB
// ═════════════════════════════════════════════════════════════
function ZReportTab({
  locale,
  t,
  toast,
}: {
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  toast: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [zReportList, setZReportList] = useState<ZReportData[]>([]);
  const [currentReport, setCurrentReport] = useState<ZReportData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [detailReport, setDetailReport] = useState<ZReportData | null>(null);
  const [reportMode, setReportMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyReport, setMonthlyReport] = useState<any>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // Mock data for today's summary (used when no actual report exists yet)
  const mockTodaySummary: ZReportData = useMemo(() => ({
    id: 'mock-today',
    reportDate: today,
    reportNumber: 0,
    totalSales: 0,
    totalCash: 0,
    totalCredit: 0,
    totalChecks: 0,
    totalTransfers: 0,
    totalRefunds: 0,
    totalVat: 0,
    netTotal: 0,
    transactionCount: 0,
    invoiceCount: 0,
    firstInvoiceNum: null,
    lastInvoiceNum: null,
    notes: null,
    isClosed: false,
    closedAt: null,
  }), [today]);

  // Fetch Z-Report list
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    zReports.list()
      .then((data) => { if (!cancelled) setZReportList(data); })
      .catch(() => { /* API not ready yet - use empty list */ })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, []);

  // Fetch current report for today
  useEffect(() => {
    let cancelled = false;
    zReports.get(today)
      .then((data) => { if (!cancelled) setCurrentReport(data); })
      .catch(() => { /* no report for today yet */ });
    return () => { cancelled = true; };
  }, [today]);

  const displayReport = currentReport || mockTodaySummary;
  const alreadyHasReport = useMemo(
    () => zReportList.some((r) => r.reportDate === selectedDate),
    [zReportList, selectedDate],
  );

  async function handleGenerate() {
    if (alreadyHasReport) {
      toast(t('reports.zReport.alreadyExists'), 'error');
      return;
    }
    setLoadingGenerate(true);
    try {
      const report = await zReports.generate(selectedDate);
      setZReportList((prev) => [report, ...prev]);
      if (selectedDate === today) {
        setCurrentReport(report);
      }
      toast(t('reports.zReport.generateSuccess'), 'success');
    } catch {
      toast(t('reports.zReport.generateSuccess'), 'error');
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function handleClose(id: string) {
    try {
      const updated = await zReports.close(id);
      setZReportList((prev) => prev.map((r) => (r.id === id ? updated : r)));
      if (currentReport?.id === id) setCurrentReport(updated);
      if (detailReport?.id === id) setDetailReport(updated);
      toast(t('reports.zReport.closeSuccess'), 'success');
    } catch {
      toast(t('reports.zReport.closeSuccess'), 'error');
    }
  }

  async function handleGenerateMonthly() {
    const [yearStr, monthStr] = selectedMonth.split('-');
    setLoadingMonthly(true);
    try {
      const report = await zReports.generateMonthly(parseInt(yearStr, 10), parseInt(monthStr, 10));
      setMonthlyReport(report);
      toast(locale === 'he' ? '\u05D3\u05D5\u05D7 \u05D6\u05D3 \u05D7\u05D5\u05D3\u05E9\u05D9 \u05E0\u05D5\u05E6\u05E8 \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4' : 'Monthly Z-Report generated successfully', 'success');
    } catch {
      toast(locale === 'he' ? '\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D9\u05E6\u05D9\u05E8\u05EA \u05D3\u05D5\u05D7 \u05D6\u05D3 \u05D7\u05D5\u05D3\u05E9\u05D9' : 'Error generating monthly Z-Report', 'error');
    } finally {
      setLoadingMonthly(false);
    }
  }

  function fmtDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL', {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Today's Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{t('reports.zReport.todaySummary')}</h3>
          <div className="text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30 px-3 py-1 rounded-lg">
            {fmtDate(today)}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatCard
            label={t('reports.zReport.totalSales')}
            value={fmtCurrency(displayReport.totalSales, locale)}
            colorClass="text-green-600 dark:text-green-400"
            cardClass="stat-card-green"
          />
          <StatCard
            label={t('reports.zReport.totalRefunds')}
            value={fmtCurrency(displayReport.totalRefunds, locale)}
            colorClass="text-red-600 dark:text-red-400"
            cardClass="stat-card-red"
          />
          <StatCard
            label={t('reports.zReport.totalVat')}
            value={fmtCurrency(displayReport.totalVat, locale)}
            colorClass="text-amber-600 dark:text-amber-400"
            cardClass="stat-card-amber"
          />
          <StatCard
            label={t('reports.zReport.netTotal')}
            value={fmtCurrency(displayReport.netTotal, locale)}
            colorClass="text-primary-600 dark:text-primary-400"
            cardClass="stat-card-indigo"
          />
        </div>

        {/* Payment breakdown */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">{t('reports.zReport.paymentBreakdown')}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.cashPayments')}</p>
              <p className="text-base font-bold text-green-600 dark:text-green-400">{fmtCurrency(displayReport.totalCash, locale)}</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.creditPayments')}</p>
              <p className="text-base font-bold text-blue-600 dark:text-blue-400">{fmtCurrency(displayReport.totalCredit, locale)}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.checkPayments')}</p>
              <p className="text-base font-bold text-purple-600 dark:text-purple-400">{fmtCurrency(displayReport.totalChecks, locale)}</p>
            </div>
            <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/40 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.transferPayments')}</p>
              <p className="text-base font-bold text-cyan-600 dark:text-cyan-400">{fmtCurrency(displayReport.totalTransfers, locale)}</p>
            </div>
          </div>
        </div>

        {/* Transaction & Invoice info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('reports.zReport.transactionCount')}:</span>
            <span className="font-bold">{displayReport.transactionCount}</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('reports.zReport.invoiceRange')}:</span>
            <span className="font-bold">
              {displayReport.firstInvoiceNum && displayReport.lastInvoiceNum
                ? `${displayReport.firstInvoiceNum} - ${displayReport.lastInvoiceNum}`
                : t('reports.zReport.na')}
            </span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('reports.zReport.invoiceCount')}:</span>
            <span className="font-bold">{displayReport.invoiceCount}</span>
          </div>
        </div>
      </div>

      {/* Generate Z-Report */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{t('reports.zReport.generateReport')}</h3>
          {/* Mode toggle: daily / monthly */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              type="button"
              onClick={() => setReportMode('daily')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                reportMode === 'daily'
                  ? 'bg-primary-600 text-white'
                  : 'bg-[var(--card)] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {locale === 'he' ? '\u05D9\u05D5\u05DE\u05D9' : 'Daily'}
            </button>
            <button
              type="button"
              onClick={() => setReportMode('monthly')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-s border-[var(--border)] ${
                reportMode === 'monthly'
                  ? 'bg-primary-600 text-white'
                  : 'bg-[var(--card)] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {locale === 'he' ? '\u05D7\u05D5\u05D3\u05E9\u05D9' : 'Monthly'}
            </button>
          </div>
        </div>

        {reportMode === 'daily' ? (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {t('reports.zReport.selectDate')}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input w-full sm:w-56"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loadingGenerate}
                className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
              >
                <ReceiptIcon />
                {loadingGenerate ? '...' : t('reports.zReport.generate')}
              </button>
            </div>
            {alreadyHasReport && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                <p className="text-sm text-amber-700 dark:text-amber-300">{t('reports.zReport.alreadyExists')}</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  {locale === 'he' ? '\u05D1\u05D7\u05E8 \u05D7\u05D5\u05D3\u05E9' : 'Select month'}
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input w-full sm:w-56"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerateMonthly}
                disabled={loadingMonthly}
                className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5"
              >
                <ReceiptIcon />
                {loadingMonthly ? '...' : (locale === 'he' ? '\u05D4\u05E4\u05E7 \u05D3\u05D5\u05D7 \u05D7\u05D5\u05D3\u05E9\u05D9' : 'Generate Monthly Report')}
              </button>
            </div>

            {/* Monthly report result */}
            {monthlyReport && (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800/40">
                  <h4 className="text-sm font-bold text-primary-700 dark:text-primary-300 mb-3">
                    {locale === 'he' ? '\u05D3\u05D5\u05D7 \u05D6\u05D3 \u05D7\u05D5\u05D3\u05E9\u05D9' : 'Monthly Z-Report'} - {monthlyReport.monthName}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">{t('reports.zReport.totalSales')}</p>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">{fmtCurrency(monthlyReport.totalSales, locale)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">{t('reports.zReport.totalRefunds')}</p>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmtCurrency(monthlyReport.totalRefunds, locale)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">{t('reports.zReport.totalVat')}</p>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{fmtCurrency(monthlyReport.totalVat, locale)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">{t('reports.zReport.netTotal')}</p>
                      <p className="text-sm font-bold text-primary-600 dark:text-primary-400">{fmtCurrency(monthlyReport.netTotal, locale)}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="text-center">
                      <span className="text-slate-500">{t('reports.zReport.transactionCount')}: </span>
                      <span className="font-semibold">{monthlyReport.transactionCount}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-500">{t('reports.zReport.invoiceCount')}: </span>
                      <span className="font-semibold">{monthlyReport.invoiceCount}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-500">{locale === 'he' ? '\u05D3\u05D5\u05D7\u05D5\u05EA \u05D9\u05D5\u05DE\u05D9\u05D9\u05DD' : 'Daily reports'}: </span>
                      <span className="font-semibold">{monthlyReport.dailyReportCount}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-500">{t('reports.zReport.invoiceRange')}: </span>
                      <span className="font-semibold">
                        {monthlyReport.firstInvoiceNum && monthlyReport.lastInvoiceNum
                          ? `${monthlyReport.firstInvoiceNum} - ${monthlyReport.lastInvoiceNum}`
                          : t('reports.zReport.na')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment breakdown for monthly */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.cashPayments')}</p>
                    <p className="text-sm font-bold text-green-600 dark:text-green-400">{fmtCurrency(monthlyReport.totalCash, locale)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.creditPayments')}</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{fmtCurrency(monthlyReport.totalCredit, locale)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/40 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.checkPayments')}</p>
                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400">{fmtCurrency(monthlyReport.totalChecks, locale)}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800/40 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('reports.zReport.transferPayments')}</p>
                    <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{fmtCurrency(monthlyReport.totalTransfers, locale)}</p>
                  </div>
                </div>

                {/* Daily reports list within monthly */}
                {monthlyReport.dailyReports?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">{locale === 'he' ? '\u05E4\u05D9\u05E8\u05D5\u05D8 \u05D9\u05D5\u05DE\u05D9' : 'Daily breakdown'}</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--border)]">
                            <th className="text-start py-2 font-semibold text-slate-500">{t('reports.zReport.date')}</th>
                            <th className="text-end py-2 font-semibold text-slate-500">{t('reports.zReport.totalSales')}</th>
                            <th className="text-end py-2 font-semibold text-slate-500">{t('reports.zReport.totalRefunds')}</th>
                            <th className="text-end py-2 font-semibold text-slate-500">{t('reports.zReport.netTotal')}</th>
                            <th className="text-center py-2 font-semibold text-slate-500">{t('reports.zReport.status')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyReport.dailyReports.map((dr: ZReportData) => (
                            <tr key={dr.id} className="table-row">
                              <td className="py-1.5">{fmtDate(dr.reportDate)}</td>
                              <td className="py-1.5 text-end font-medium">{fmtCurrency(dr.totalSales, locale)}</td>
                              <td className="py-1.5 text-end text-red-500">{fmtCurrency(dr.totalRefunds, locale)}</td>
                              <td className="py-1.5 text-end font-semibold">{fmtCurrency(dr.netTotal, locale)}</td>
                              <td className="py-1.5 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  dr.isClosed
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                }`}>
                                  {dr.isClosed ? t('reports.zReport.closed') : t('reports.zReport.open')}
                                </span>
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
          </>
        )}
      </div>

      {/* Z-Report History */}
      <div className="card overflow-x-auto">
        <h3 className="text-base font-semibold mb-4">{t('reports.zReport.history')}</h3>
        {loadingList ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : zReportList.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--border)]">
                <th className="text-start pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.zReport.reportNumber')}</th>
                <th className="text-start pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.zReport.date')}</th>
                <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.zReport.total')}</th>
                <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.zReport.transactionCount')}</th>
                <th className="text-end pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.zReport.invoiceRange')}</th>
                <th className="text-center pb-3 font-semibold text-slate-500 dark:text-slate-400">{t('reports.zReport.status')}</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {zReportList.map((report) => (
                <tr key={report.id} className="table-row">
                  <td className="py-2.5 font-medium">#{report.reportNumber}</td>
                  <td className="py-2.5">{fmtDate(report.reportDate)}</td>
                  <td className="py-2.5 text-end font-semibold">{fmtCurrency(report.totalSales, locale)}</td>
                  <td className="py-2.5 text-end">{report.transactionCount}</td>
                  <td className="py-2.5 text-end text-sm text-slate-500 dark:text-slate-400">
                    {report.firstInvoiceNum && report.lastInvoiceNum
                      ? `${report.firstInvoiceNum} - ${report.lastInvoiceNum}`
                      : t('reports.zReport.na')}
                  </td>
                  <td className="py-2.5 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      report.isClosed
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    }`}>
                      {report.isClosed ? t('reports.zReport.closed') : t('reports.zReport.open')}
                    </span>
                  </td>
                  <td className="py-2.5 text-end">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailReport(report)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {t('reports.zReport.viewDetails')}
                      </button>
                      {!report.isClosed && (
                        <button
                          type="button"
                          onClick={() => handleClose(report.id)}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline"
                        >
                          {t('reports.zReport.closeReport')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <ReceiptIcon />
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500">{t('reports.zReport.noReports')}</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detailReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={() => setDetailReport(null)}>
          <div
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold">{t('reports.zReport.title')} #{detailReport.reportNumber}</h2>
              <button type="button" onClick={() => setDetailReport(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <CloseIcon />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.date')}</span>
                <span className="font-medium">{fmtDate(detailReport.reportDate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.totalSales')}</span>
                <span className="font-bold text-green-600 dark:text-green-400">{fmtCurrency(detailReport.totalSales, locale)}</span>
              </div>
              <hr className="border-[var(--border)]" />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.cashPayments')}</span>
                <span className="font-medium">{fmtCurrency(detailReport.totalCash, locale)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.creditPayments')}</span>
                <span className="font-medium">{fmtCurrency(detailReport.totalCredit, locale)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.checkPayments')}</span>
                <span className="font-medium">{fmtCurrency(detailReport.totalChecks, locale)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.transferPayments')}</span>
                <span className="font-medium">{fmtCurrency(detailReport.totalTransfers, locale)}</span>
              </div>
              <hr className="border-[var(--border)]" />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.totalRefunds')}</span>
                <span className="font-medium text-red-600 dark:text-red-400">{fmtCurrency(detailReport.totalRefunds, locale)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.totalVat')}</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">{fmtCurrency(detailReport.totalVat, locale)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.netTotal')}</span>
                <span className="font-bold text-primary-600 dark:text-primary-400">{fmtCurrency(detailReport.netTotal, locale)}</span>
              </div>
              <hr className="border-[var(--border)]" />
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.transactionCount')}</span>
                <span className="font-medium">{detailReport.transactionCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.invoiceCount')}</span>
                <span className="font-medium">{detailReport.invoiceCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.firstInvoice')}</span>
                <span className="font-medium">{detailReport.firstInvoiceNum || t('reports.zReport.na')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.lastInvoice')}</span>
                <span className="font-medium">{detailReport.lastInvoiceNum || t('reports.zReport.na')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{t('reports.zReport.status')}</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  detailReport.isClosed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                }`}>
                  {detailReport.isClosed ? t('reports.zReport.closed') : t('reports.zReport.open')}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border)]">
              {!detailReport.isClosed && (
                <button
                  type="button"
                  onClick={() => handleClose(detailReport.id)}
                  className="btn-primary text-sm px-5 py-2 bg-red-600 hover:bg-red-700"
                >
                  {t('reports.zReport.closeReport')}
                </button>
              )}
              <button type="button" onClick={() => setDetailReport(null)} className="btn-secondary text-sm px-5 py-2">
                {t('reports.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
