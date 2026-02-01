'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/context';

type QuickRange =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'thisYear'
  | 'lastYear'
  | 'last2Years';

export function getQuickRangeDates(range: QuickRange): { from: string; to: string };
export function getQuickRangeDates(range: 'yearRange', yearFrom: number, yearTo: number): { from: string; to: string };
export function getQuickRangeDates(range: QuickRange | 'yearRange', yearFrom?: number, yearTo?: number): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const y = now.getFullYear();

  if (range === 'yearRange' && yearFrom != null && yearTo != null) {
    const start = new Date(yearFrom, 0, 1);
    const end = new Date(yearTo, 11, 31);
    return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
  }

  switch (range) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yd = new Date(now);
      yd.setDate(yd.getDate() - 1);
      const ys = yd.toISOString().slice(0, 10);
      return { from: ys, to: ys };
    }
    case 'last7': {
      const d7 = new Date(now);
      d7.setDate(d7.getDate() - 6);
      return { from: d7.toISOString().slice(0, 10), to: today };
    }
    case 'last30': {
      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 29);
      return { from: d30.toISOString().slice(0, 10), to: today };
    }
    case 'thisMonth': {
      const start = new Date(y, now.getMonth(), 1);
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    case 'lastMonth': {
      const lmStart = new Date(y, now.getMonth() - 1, 1);
      const lmEnd = new Date(y, now.getMonth(), 0);
      return { from: lmStart.toISOString().slice(0, 10), to: lmEnd.toISOString().slice(0, 10) };
    }
    case 'last3Months': {
      const start = new Date(y, now.getMonth() - 2, 1);
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    case 'thisYear': {
      const start = new Date(y, 0, 1);
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    case 'lastYear': {
      const start = new Date(y - 1, 0, 1);
      const end = new Date(y - 1, 11, 31);
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    }
    case 'last2Years': {
      const start = new Date(y - 2, 0, 1);
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    default:
      return { from: today, to: today };
  }
}

type Props = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
};

export default function DateRangePicker({ from, to, onChange, className = '' }: Props) {
  const { t } = useTranslation();
  const [yearFrom, setYearFrom] = useState<string>('');
  const [yearTo, setYearTo] = useState<string>('');
  const currentYear = new Date().getFullYear();

  const applyQuick = (range: QuickRange | 'yearRange', yFrom?: number, yTo?: number) => {
    const { from: f, to: t2 } = range === 'yearRange' && yFrom != null && yTo != null
      ? getQuickRangeDates('yearRange', yFrom, yTo)
      : getQuickRangeDates(range as QuickRange);
    onChange(f, t2);
  };

  const applyYearRange = () => {
    const yF = yearFrom ? parseInt(yearFrom, 10) : null;
    const yT = yearTo ? parseInt(yearTo, 10) : null;
    if (yF != null && yT != null) {
      applyQuick('yearRange', Math.min(yF, yT), Math.max(yF, yT));
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <input
        type="date"
        className="input w-auto"
        value={from}
        onChange={(e) => onChange(e.target.value, to)}
      />
      <span className="text-slate-400">–</span>
      <input
        type="date"
        className="input w-auto"
        value={to}
        onChange={(e) => onChange(from, e.target.value)}
      />
      <div className="flex flex-wrap gap-1 ms-2">
        {(['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'last3Months', 'thisYear', 'lastYear', 'last2Years'] as QuickRange[]).map(
          (r) => (
            <button
              key={r}
              type="button"
              className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800"
              onClick={() => applyQuick(r)}
            >
              {t('dateRange.' + r)}
            </button>
          )
        )}
        <span className="text-slate-400 text-xs mx-1">|</span>
        <input
          type="number"
          className="input text-xs w-20 py-1"
          value={yearFrom}
          onChange={(e) => setYearFrom(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder={t('dateRange.yearFrom')}
          min={1990}
          max={currentYear + 5}
        />
        <span className="text-slate-400 text-xs">–</span>
        <input
          type="number"
          className="input text-xs w-20 py-1"
          value={yearTo}
          onChange={(e) => setYearTo(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder={t('dateRange.yearTo')}
          min={1990}
          max={currentYear + 5}
        />
        <button
          type="button"
          className="text-xs px-2 py-1 rounded border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
          onClick={applyYearRange}
          disabled={!yearFrom || !yearTo}
        >
          {t('dateRange.apply')}
        </button>
      </div>
    </div>
  );
}
