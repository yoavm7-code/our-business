'use client';

import { useCallback, useEffect, useState } from 'react';
import { insights, type InsightSection } from '@/lib/api';
import { useTranslation } from '@/i18n/context';

/** Extract a meaningful tip line from AI-generated insight content */
function extractTip(content: string): string | null {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    if (line.endsWith(':')) continue;
    if (line.replace(/[*•\-\d.)#]/g, '').trim().length < 15) continue;
    if (/^[a-zA-Z][a-zA-Z0-9]*([A-Z][a-zA-Z0-9]*)+$/.test(line.trim())) continue;
    if (/^[a-zA-Z_][a-zA-Z0-9_.]+$/.test(line.trim()) && !line.includes(' ')) continue;

    let cleaned = line
      .replace(/^[•\-*]\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

    if (cleaned.length < 15) continue;
    if (/^[a-zA-Z][a-zA-Z0-9]*([A-Z][a-zA-Z0-9]*)+$/.test(cleaned)) continue;

    if (cleaned.length > 150) {
      const sentenceEnd = cleaned.slice(0, 150).lastIndexOf('.');
      if (sentenceEnd > 60) {
        cleaned = cleaned.slice(0, sentenceEnd + 1);
      } else {
        cleaned = cleaned.slice(0, 147) + '...';
      }
    }

    return cleaned;
  }

  return null;
}

function extractMultipleTips(content: string, max: number = 5): string[] {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: string[] = [];

  for (const line of lines) {
    if (results.length >= max) break;
    if (line.startsWith('#')) continue;
    if (line.endsWith(':')) continue;
    if (line.replace(/[*•\-\d.)#]/g, '').trim().length < 15) continue;
    if (/^[a-zA-Z][a-zA-Z0-9]*([A-Z][a-zA-Z0-9]*)+$/.test(line.trim())) continue;
    if (/^[a-zA-Z_][a-zA-Z0-9_.]+$/.test(line.trim()) && !line.includes(' ')) continue;

    let cleaned = line
      .replace(/^[•\-*]\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/\*\*/g, '')
      .trim();

    if (cleaned.length < 15) continue;
    if (/^[a-zA-Z][a-zA-Z0-9]*([A-Z][a-zA-Z0-9]*)+$/.test(cleaned)) continue;
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

export default function SmartTip() {
  const { t, locale } = useTranslation();
  const [tips, setTips] = useState<StoredTip[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load tips
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('smartTips_v2') : null;
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredTip[];
        setTips(parsed);
        setLoaded(true);
        return;
      } catch { /* parse error, refetch */ }
    }

    // Fetch new tips
    const timer = setTimeout(async () => {
      const allTips: StoredTip[] = [];
      for (const section of TIP_SECTIONS) {
        try {
          const res = await insights.getSection(section, locale);
          if (res.content) {
            const extracted = extractMultipleTips(res.content, 3);
            extracted.forEach((text, i) => {
              allTips.push({
                id: `${section}-${i}`,
                text,
                section,
                read: false,
              });
            });
          }
        } catch {
          // continue
        }
      }
      if (allTips.length > 0) {
        setTips(allTips);
        localStorage.setItem('smartTips_v2', JSON.stringify(allTips));
      }
      setLoaded(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [locale]);

  // Persist minimized state
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('smartTip_minimized') : null;
    if (stored === 'true') setMinimized(true);
  }, []);

  const handleMinimize = useCallback((v: boolean) => {
    setMinimized(v);
    localStorage.setItem('smartTip_minimized', String(v));
    if (v) setPanelOpen(false);
  }, []);

  const markAsRead = useCallback((tipId: string) => {
    setTips((prev: StoredTip[]) => {
      const updated = prev.map((tip: StoredTip) => tip.id === tipId ? { ...tip, read: true } : tip);
      localStorage.setItem('smartTips_v2', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setTips((prev: StoredTip[]) => {
      const updated = prev.map((tip: StoredTip) => ({ ...tip, read: true }));
      localStorage.setItem('smartTips_v2', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const unreadCount = tips.filter((tip: StoredTip) => !tip.read).length;

  if (!loaded || tips.length === 0) return null;

  // Minimized state: just a small icon
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => handleMinimize(false)}
        className="relative p-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-all shadow-sm"
        title={t('smartTip.title')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -end-0.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] rounded-full flex items-center justify-center font-bold animate-pulse">{unreadCount}</span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Button */}
      <button
        type="button"
        onClick={() => setPanelOpen(!panelOpen)}
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300 hover:shadow-md transition-all text-xs font-medium"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {t('smartTip.title')}
        {unreadCount > 0 && (
          <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{unreadCount}</span>
        )}
      </button>

      {/* Minimize button */}
      <button
        type="button"
        onClick={() => handleMinimize(true)}
        className="absolute -top-1.5 -end-1.5 w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors z-10"
        title={locale === 'he' ? '\u05DE\u05D6\u05E2\u05E8' : 'Minimize'}
      >
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>

      {/* Tips panel */}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPanelOpen(false)} />
          <div className="absolute end-0 top-full mt-2 w-80 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 animate-fadeIn overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {locale === 'he' ? '\u05D8\u05D9\u05E4\u05D9\u05DD \u05D7\u05DB\u05DE\u05D9\u05DD' : 'Smart Tips'}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    {locale === 'he' ? '\u05E1\u05DE\u05DF \u05D4\u05DB\u05DC \u05DB\u05E0\u05E7\u05E8\u05D0' : 'Mark all read'}
                  </button>
                )}
                <button type="button" onClick={() => setPanelOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-[var(--border)]">
              {tips.map((tip: StoredTip) => (
                <div
                  key={tip.id}
                  className={`px-4 py-3 text-xs transition-colors ${tip.read ? 'opacity-60' : 'bg-amber-50/50 dark:bg-amber-900/5'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 w-6 h-6 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{tip.text}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-slate-400 capitalize">{tip.section.replace(/([A-Z])/g, ' $1').trim()}</span>
                        {!tip.read && (
                          <button
                            type="button"
                            onClick={() => markAsRead(tip.id)}
                            className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
                          >
                            {locale === 'he' ? '\u05E1\u05DE\u05DF \u05DB\u05E0\u05E7\u05E8\u05D0' : 'Mark as read'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
