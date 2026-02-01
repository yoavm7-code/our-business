'use client';

import { useCallback, useEffect, useState } from 'react';
import { insights } from '@/lib/api';
import { useTranslation } from '@/i18n/context';

type InsightData = {
  balanceForecast: string;
  savingsRecommendation: string;
  investmentRecommendations: string;
};

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
    fetchInsights(true);
  }, [fetchInsights]);

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
          className="btn-primary"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? t('insightsPage.loading') : t('insightsPage.refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <div className="card">
            <h2 className="font-medium mb-3 text-lg">{t('insightsPage.balanceForecast')}</h2>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {typeof data.balanceForecast === 'string' ? data.balanceForecast : String(data.balanceForecast ?? '')}
            </p>
          </div>
          <div className="card">
            <h2 className="font-medium mb-3 text-lg">{t('insightsPage.savingsRecommendation')}</h2>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {typeof data.savingsRecommendation === 'string' ? data.savingsRecommendation : String(data.savingsRecommendation ?? '')}
            </p>
          </div>
          <div className="card">
            <h2 className="font-medium mb-3 text-lg">{t('insightsPage.investmentRecommendations')}</h2>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {typeof data.investmentRecommendations === 'string' ? data.investmentRecommendations : String(data.investmentRecommendations ?? '')}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
