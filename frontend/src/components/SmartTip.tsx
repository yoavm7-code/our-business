'use client';

import { useCallback, useEffect, useState } from 'react';
import { insights, type InsightSection } from '@/lib/api';
import { useTranslation } from '@/i18n/context';

/** Lines that look like schema/field labels rather than actual tips */
const JUNK_PATTERNS = [
  /^\{/,
  /^\[/,
  /^```/,
];

/**
 * Aggressively strip any leading `someWord:` or `some_word:` prefix
 * (e.g. "description:", "message:", "title:", "content:", etc.)
 * Repeats to handle chained prefixes like "message: description: actual text"
 */
function cleanTipText(text: string): string {
  let prev = '';
  let cleaned = text;
  while (cleaned !== prev) {
    prev = cleaned;
    cleaned = cleaned.replace(/^[a-zA-Z_][a-zA-Z0-9_]*\s*:\s*/, '').trim();
  }
  return cleaned;
}

/** Return true if the line is nothing but a label/key (no real content) */
function isJunkLine(line: string): boolean {
  // Matches lines like "description:", "message:", "key:", etc.
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*:\s*$/.test(line)) return true;
  if (JUNK_PATTERNS.some((p) => p.test(line))) return true;
  return false;
}

/** Storage key — bump version to bust old cached tips that contained junk */
const TIPS_STORAGE_KEY = 'smartTips_v4';

function extractMultipleTips(content: string, max: number = 5): string[] {
  const lines = content.split('\n').map((l: string) => l.trim()).filter(Boolean);
  const results: string[] = [];

  for (const line of lines) {
    if (results.length >= max) break;
    if (line.startsWith('#')) continue;
    if (line.endsWith(':')) continue;
    if (isJunkLine(line)) continue;
    if (line.replace(/[*•\-\d.)#]/g, '').trim().length < 15) continue;
    if (/^[a-zA-Z][a-zA-Z0-9]*([A-Z][a-zA-Z0-9]*)+$/.test(line.trim())) continue;
    if (/^[a-zA-Z_][a-zA-Z0-9_.]+$/.test(line.trim()) && !line.includes(' ')) continue;

    // Remove bullet/numbering/bold markers
    let cleaned = line
      .replace(/^[•\-*]\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

    // Strip leading label prefixes like "message:", "description:", etc.
    cleaned = cleanTipText(cleaned);

    if (cleaned.length < 15) continue;
    if (/^[a-zA-Z][a-zA-Z0-9]*([A-Z][a-zA-Z0-9]*)+$/.test(cleaned)) continue;
    if (isJunkLine(cleaned)) continue;
    if (cleaned.length > 200) cleaned = cleaned.slice(0, 197) + '...';

    results.push(cleaned);
  }

  return results;
}

const TIP_SECTIONS: InsightSection[] = ['savingsRecommendation', 'spendingInsights', 'monthlySummary'];

interface StoredTip {
  id: string;
  text: string;
  section: string;
  read: boolean;
}

const SECTION_LABELS: Record<string, { he: string; en: string }> = {
  savingsRecommendation: { he: 'חיסכון', en: 'Savings' },
  spendingInsights: { he: 'הוצאות', en: 'Spending' },
  monthlySummary: { he: 'סיכום חודשי', en: 'Monthly' },
};

export default function SmartTip() {
  const { t, locale } = useTranslation();
  const [tips, setTips] = useState<StoredTip[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load tips
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(TIPS_STORAGE_KEY) : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredTip[];
        setTips(parsed);
        setLoaded(true);
        return;
      } catch { /* parse error, refetch */ }
    }

    // Fetch new tips after a delay
    const timer = setTimeout(async () => {
      const allTips: StoredTip[] = [];
      for (const section of TIP_SECTIONS) {
        try {
          const res = await insights.getSection(section, locale);
          if (res.content) {
            const extracted = extractMultipleTips(res.content, 3);
            extracted.forEach((text: string, i: number) => {
              allTips.push({ id: `${section}-${i}`, text, section, read: false });
            });
          }
        } catch {
          // continue
        }
      }
      if (allTips.length > 0) {
        setTips(allTips);
        localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(allTips));
      }
      setLoaded(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [locale]);

  const markAsRead = useCallback((tipId: string) => {
    setTips((prev: StoredTip[]) => {
      const updated = prev.map((tip: StoredTip) => tip.id === tipId ? { ...tip, read: true } : tip);
      localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setTips((prev: StoredTip[]) => {
      const updated = prev.map((tip: StoredTip) => ({ ...tip, read: true }));
      localStorage.setItem(TIPS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const unreadCount = tips.filter((tip: StoredTip) => !tip.read).length;

  if (!loaded || tips.length === 0) return null;

  const isHe = locale === 'he';

  return (
    <div className="relative">
      {/* Small icon button — same style as voice button */}
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative shrink-0 p-1.5 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200"
        title={isHe ? 'טיפים חכמים' : 'Smart Tips'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPanelOpen(false)} />
          <div className="absolute end-0 top-full mt-2 w-80 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 animate-fadeIn overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {isHe ? 'טיפים חכמים' : 'Smart Tips'}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                    {isHe ? 'סמן הכל כנקרא' : 'Mark all read'}
                  </button>
                )}
                <button type="button" onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            {/* Tips list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
              {tips.map((tip: StoredTip) => {
                const sectionLabel = SECTION_LABELS[tip.section]
                  ? (isHe ? SECTION_LABELS[tip.section].he : SECTION_LABELS[tip.section].en)
                  : tip.section;
                return (
                  <div
                    key={tip.id}
                    className={`px-4 py-3 text-xs transition-colors ${tip.read ? 'opacity-60' : 'bg-amber-50/50 dark:bg-amber-900/5'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="shrink-0 w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mt-0.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{tip.text}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">{sectionLabel}</span>
                          {!tip.read && (
                            <button type="button" onClick={() => markAsRead(tip.id)} className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                              {isHe ? 'סמן כנקרא' : 'Mark as read'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
