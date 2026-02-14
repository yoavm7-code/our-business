'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/context';

interface TourStep {
  titleHe: string;
  titleEn: string;
  descHe: string;
  descEn: string;
  targetSelector?: string; // optional CSS selector to highlight
}

const TOUR_STEPS: TourStep[] = [
  {
    titleHe: '\u05D1\u05E8\u05D5\u05DA \u05D4\u05D1\u05D0 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA!',
    titleEn: 'Welcome!',
    descHe: '\u05D1\u05D5\u05D0 \u05E0\u05E2\u05E9\u05D4 \u05E1\u05D9\u05D5\u05E8 \u05E7\u05E6\u05E8 \u05D1\u05DE\u05E2\u05E8\u05DB\u05EA \u05DB\u05D3\u05D9 \u05E9\u05EA\u05DB\u05D9\u05E8 \u05D0\u05D5\u05EA\u05D4. \u05D4\u05E1\u05D9\u05D5\u05E8 \u05E0\u05E9\u05D0\u05E8 \u05DB\u05D0\u05DF \u05D1\u05E8\u05D0\u05E9 \u05D4\u05DE\u05E1\u05DA \u05DC\u05E0\u05D5\u05D7\u05D9\u05D5\u05EA\u05DA.',
    descEn: "Let's take a quick tour to familiarize you with the system. This tour stays right here at the top.",
  },
  {
    titleHe: '\u05DC\u05D5\u05D7 \u05D1\u05E7\u05E8\u05D4',
    titleEn: 'Dashboard',
    descHe: '\u05D4\u05DC\u05D5\u05D7 \u05D4\u05E8\u05D0\u05E9\u05D9 \u05DE\u05E8\u05DB\u05D6 \u05D0\u05EA \u05DB\u05DC \u05D4\u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D4\u05D7\u05E9\u05D5\u05D1\u05D9\u05DD - \u05D4\u05DB\u05E0\u05E1\u05D5\u05EA, \u05D4\u05D5\u05E6\u05D0\u05D5\u05EA, \u05D5\u05D9\u05EA\u05E8\u05D5\u05EA \u05E4\u05EA\u05D5\u05D7\u05D9\u05DD.',
    descEn: 'The dashboard centralizes all your important data - income, expenses, and open balances.',
    targetSelector: '[href="/dashboard"]',
  },
  {
    titleHe: '\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA',
    titleEn: 'Clients',
    descHe: '\u05E0\u05D4\u05DC \u05D0\u05EA \u05D4\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05E9\u05DC\u05DA - \u05E4\u05E8\u05D8\u05D9 \u05E7\u05E9\u05E8, \u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D9\u05EA \u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05D5\u05EA \u05D5\u05E2\u05D5\u05D3.',
    descEn: 'Manage your clients - contact details, invoice history and more.',
    targetSelector: '[href="/clients"]',
  },
  {
    titleHe: '\u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05D5\u05EA',
    titleEn: 'Invoices',
    descHe: '\u05E6\u05D5\u05E8 \u05D7\u05E9\u05D1\u05D5\u05E0\u05D9\u05D5\u05EA, \u05E7\u05D1\u05DC\u05D5\u05EA \u05D5\u05D4\u05E6\u05E2\u05D5\u05EA \u05DE\u05D7\u05D9\u05E8. \u05E9\u05DC\u05D7 \u05DC\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA \u05D1\u05DC\u05D7\u05D9\u05E6\u05EA \u05DB\u05E4\u05EA\u05D5\u05E8.',
    descEn: 'Create invoices, receipts and quotes. Send to clients with one click.',
    targetSelector: '[href="/invoices"]',
  },
  {
    titleHe: '\u05D4\u05E2\u05DC\u05D0\u05EA \u05DE\u05E1\u05DE\u05DB\u05D9\u05DD',
    titleEn: 'Upload Documents',
    descHe: '\u05D4\u05E2\u05DC\u05D4 \u05E7\u05D1\u05DC\u05D5\u05EA \u05D5\u05DE\u05E1\u05DE\u05DB\u05D9\u05DD - \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA \u05EA\u05E7\u05E8\u05D0 \u05D0\u05D5\u05EA\u05DD \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D5\u05EA\u05D9\u05D9\u05E7 \u05D0\u05D5\u05EA\u05DD.',
    descEn: 'Upload receipts and documents - the system reads them automatically and files them.',
    targetSelector: '[href="/upload"]',
  },
  {
    titleHe: '\u05D3\u05D5\u05D7\u05D5\u05EA \u05D5\u05EA\u05D5\u05D1\u05E0\u05D5\u05EA',
    titleEn: 'Reports & Insights',
    descHe: '\u05D3\u05D5\u05D7\u05D5\u05EA \u05DB\u05E1\u05E4\u05D9\u05D9\u05DD, \u05EA\u05D5\u05D1\u05E0\u05D5\u05EA AI \u05D5\u05D3\u05D5\u05D7\u05D5\u05EA \u05D6\u05D3 - \u05D4\u05DB\u05DC \u05D1\u05DE\u05E7\u05D5\u05DD \u05D0\u05D7\u05D3.',
    descEn: 'Financial reports, AI insights and Z-reports - all in one place.',
    targetSelector: '[href="/reports"]',
  },
  {
    titleHe: '\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA',
    titleEn: 'Settings',
    descHe: '\u05D4\u05D2\u05D3\u05E8 \u05D0\u05EA \u05D4\u05E2\u05E1\u05E7, \u05D7\u05D1\u05E8 \u05D0\u05D9\u05E0\u05D8\u05D2\u05E8\u05E6\u05D9\u05D5\u05EA (\u05DE\u05D5\u05E8\u05E0\u05D9\u05E0\u05D2, \u05D1\u05E0\u05E7) \u05D5\u05D4\u05EA\u05D0\u05DD \u05D0\u05D9\u05E9\u05D9\u05EA.',
    descEn: 'Configure your business, connect integrations (Morning, bank) and personalize.',
    targetSelector: '[href="/settings"]',
  },
  {
    titleHe: '\u05D4\u05DB\u05DC \u05DE\u05D5\u05DB\u05DF!',
    titleEn: "You're all set!",
    descHe: '\u05E2\u05DB\u05E9\u05D9\u05D5 \u05D0\u05EA\u05D4 \u05DE\u05DB\u05D9\u05E8 \u05D0\u05EA \u05D4\u05DE\u05E2\u05E8\u05DB\u05EA. \u05D0\u05E4\u05E9\u05E8 \u05EA\u05DE\u05D9\u05D3 \u05DC\u05D4\u05E4\u05E2\u05D9\u05DC \u05D0\u05EA \u05D4\u05E1\u05D9\u05D5\u05E8 \u05DE\u05D7\u05D3\u05E9 \u05DE\u05D4\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA.',
    descEn: 'Now you know the system. You can always restart this tour from Settings.',
  },
];

interface SiteTourProps {
  onComplete: () => void;
}

export default function SiteTour({ onComplete }: SiteTourProps) {
  const { locale } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightEl, setHighlightEl] = useState<HTMLElement | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isHe = locale === 'he';
  const title = isHe ? step.titleHe : step.titleEn;
  const desc = isHe ? step.descHe : step.descEn;

  // Highlight the target element
  useEffect(() => {
    if (step.targetSelector) {
      const el = document.querySelector(step.targetSelector) as HTMLElement | null;
      if (el) {
        setHighlightEl(el);
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        el.classList.add('tour-highlight');
        return () => {
          el.classList.remove('tour-highlight');
        };
      }
    }
    setHighlightEl(null);
  }, [currentStep, step.targetSelector]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s: number) => s + 1);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s: number) => s - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[70] bg-black/30 pointer-events-none" />

      {/* Tour card - pinned to top center, never jumps */}
      <div className="fixed top-4 start-1/2 -translate-x-1/2 z-[75] w-full max-w-md px-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
          {/* Progress bar */}
          <div className="h-1 bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
              style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
            />
          </div>

          <div className="px-5 py-4">
            {/* Step indicator */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-slate-400 font-medium">
                {currentStep + 1} / {TOUR_STEPS.length}
              </span>
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {isHe ? '\u05D3\u05DC\u05D2' : 'Skip'}
              </button>
            </div>

            {/* Title with pointer icon */}
            <div className="flex items-center gap-2 mb-2">
              {step.targetSelector && (
                <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <h3 className="text-base font-bold text-slate-800 dark:text-white">{title}</h3>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{desc}</p>

            {/* Navigation buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1 px-3 py-2 text-xs rounded-xl border border-[var(--border)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors font-medium"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
                  </svg>
                  {isHe ? '\u05D4\u05E7\u05D5\u05D3\u05DD' : 'Back'}
                </button>
              )}
              <div className="flex-1" />
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1 px-4 py-2 text-xs rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                {currentStep < TOUR_STEPS.length - 1
                  ? (isHe ? '\u05D4\u05D1\u05D0' : 'Next')
                  : (isHe ? '\u05E1\u05D9\u05D5\u05DD' : 'Done')
                }
                {currentStep < TOUR_STEPS.length - 1 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? 'w-4 bg-indigo-500' : i < currentStep ? 'w-1.5 bg-indigo-300' : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CSS for highlighting */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 72;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.4), 0 0 20px rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          transition: box-shadow 0.3s ease;
        }
      `}</style>
    </>
  );
}
