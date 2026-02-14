'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/context';

export interface GuideStep {
  labelHe: string;
  labelEn: string;
  done?: boolean;
}

interface PageGuideProps {
  /** Unique key for localStorage persistence */
  pageKey: string;
  steps: GuideStep[];
}

/**
 * A compact horizontal action-guide bar that sits at the top of each page.
 * Shows the flow of actions available on the page (e.g. Add client → Create invoice → Send).
 * Dismissible per-page via localStorage.
 */
export default function PageGuide({ pageKey, steps }: PageGuideProps) {
  const { locale } = useTranslation();
  const isHe = locale === 'he';
  const storageKey = `pageGuide_${pageKey}_dismissed`;

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(storageKey) === 'true';
    return false;
  });

  if (dismissed || steps.length === 0) return null;

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 mb-4 animate-fadeIn">
      {/* Steps flow */}
      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center shrink-0">
            {/* Step indicator */}
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                step.done
                  ? 'bg-green-500 text-white'
                  : 'bg-indigo-100 dark:bg-indigo-800/30 text-indigo-600 dark:text-indigo-400'
              }`}>
                {step.done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-xs whitespace-nowrap ${
                step.done
                  ? 'text-green-600 dark:text-green-400 line-through'
                  : 'text-slate-700 dark:text-slate-300 font-medium'
              }`}>
                {isHe ? step.labelHe : step.labelEn}
              </span>
            </div>
            {/* Arrow between steps */}
            {i < steps.length - 1 && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-1.5 text-slate-300 dark:text-slate-600 shrink-0" style={{ transform: isHe ? 'scaleX(-1)' : undefined }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Progress + dismiss */}
      <div className="flex items-center gap-2 shrink-0">
        {completed > 0 && (
          <span className="text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">{pct}%</span>
        )}
        <button
          type="button"
          onClick={() => { setDismissed(true); localStorage.setItem(storageKey, 'true'); }}
          className="p-0.5 rounded text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
          title={isHe ? 'סגור' : 'Dismiss'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}
