'use client';

import { useCallback, useEffect, useState } from 'react';
import { insights } from '@/lib/api';
import { useTranslation } from '@/i18n/context';

type InsightData = {
  balanceForecast: string;
  savingsRecommendation: string;
  investmentRecommendations: string;
  taxTips?: string;
  spendingInsights?: string;
};

// Icons for each section
const BalanceIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

const SavingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/>
  </svg>
);

const InvestIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
);

const TaxIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 15h0M2 9.5h20"/>
  </svg>
);

const SpendingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

export default function InsightsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInsights = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('insights');
        if (cached) {
          const parsed = JSON.parse(cached) as InsightData;
          if (parsed?.balanceForecast || parsed?.savingsRecommendation || parsed?.investmentRecommendations) {
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {
        /* ignore */
      }
    }
    setLoading(true);
    setError('');
    try {
      const res = await insights.get();
      setData(res);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('insights', JSON.stringify(res));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failedToLoad'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchInsights(false);
  }, [fetchInsights]);

  const handleRefresh = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('insights');
    }
    fetchInsights(true);
  }, [fetchInsights]);

  const InsightCard = ({ 
    icon, 
    title, 
    content, 
    accentColor 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    content: string;
    accentColor: string;
  }) => (
    <div className={`card border-s-4 ${accentColor}`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1">{icon}</div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-lg mb-3">{title}</h2>
          <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('insightsPage.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            {t('insightsPage.subtitle')}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              {t('insightsPage.loading')}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>
              </svg>
              {t('insightsPage.refresh')}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary-500 border-t-transparent" />
          <p className="text-slate-500">{t('insightsPage.analyzingData')}</p>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Main insights grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <InsightCard
              icon={<BalanceIcon />}
              title={t('insightsPage.balanceForecast')}
              content={data.balanceForecast || ''}
              accentColor="border-blue-500"
            />
            <InsightCard
              icon={<SavingsIcon />}
              title={t('insightsPage.savingsRecommendation')}
              content={data.savingsRecommendation || ''}
              accentColor="border-green-500"
            />
          </div>
          
          {/* Investment recommendations - full width */}
          <InsightCard
            icon={<InvestIcon />}
            title={t('insightsPage.investmentRecommendations')}
            content={data.investmentRecommendations || ''}
            accentColor="border-purple-500"
          />
          
          {/* Optional sections */}
          {(data.taxTips || data.spendingInsights) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.taxTips && (
                <InsightCard
                  icon={<TaxIcon />}
                  title={t('insightsPage.taxTips')}
                  content={data.taxTips}
                  accentColor="border-amber-500"
                />
              )}
              {data.spendingInsights && (
                <InsightCard
                  icon={<SpendingIcon />}
                  title={t('insightsPage.spendingInsights')}
                  content={data.spendingInsights}
                  accentColor="border-rose-500"
                />
              )}
            </div>
          )}
          
          {/* Disclaimer */}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-8">
            {t('insightsPage.disclaimer')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
