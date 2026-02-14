'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/i18n/context';
import { accounts, clients as clientsApi, users } from '@/lib/api';
import { useOnboarding } from '@/components/OnboardingProvider';

interface Task {
  key: string;
  labelHe: string;
  labelEn: string;
  href: string;
  done: boolean;
}

/**
 * Embedded dashboard card showing onboarding progress.
 * Replaces the full-screen wizard with a compact, non-intrusive progress bar.
 */
const ONBOARDING_DISMISSED_KEY = 'onboardingProgress_dismissed';

export default function OnboardingProgress() {
  const { locale } = useTranslation();
  const { dismissOnboarding } = useOnboarding();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true';
    return false;
  });
  const isHe = locale === 'he';

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;

    async function checkProgress() {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) { if (!cancelled) setLoading(false); return; }

        const [user, accts, cls] = await Promise.all([
          users.me(),
          accounts.list().catch(() => []),
          clientsApi.list().catch(() => []),
        ]);

        if (cancelled) return;

        const hasBusinessName = !!user.name;
        const hasAccount = Array.isArray(accts) && accts.length > 0;
        const hasClient = Array.isArray(cls) && cls.length > 0;

        setTasks([
          {
            key: 'business',
            labelHe: 'הגדר פרטי עסק',
            labelEn: 'Set up business details',
            href: '/settings',
            done: hasBusinessName,
          },
          {
            key: 'account',
            labelHe: 'הוסף חשבון בנק',
            labelEn: 'Add a bank account',
            href: '/settings',
            done: hasAccount,
          },
          {
            key: 'client',
            labelHe: 'הוסף לקוח ראשון',
            labelEn: 'Add your first client',
            href: '/clients',
            done: hasClient,
          },
          {
            key: 'invoice',
            labelHe: 'צור חשבונית ראשונה',
            labelEn: 'Create your first invoice',
            href: '/invoices?new=1',
            done: false,
          },
          {
            key: 'upload',
            labelHe: 'העלה מסמך או קבלה',
            labelEn: 'Upload a document or receipt',
            href: '/upload',
            done: false,
          },
        ]);
      } catch {
        // fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkProgress();
    return () => { cancelled = true; };
  }, [dismissed]);

  if (dismissed || loading) return null;

  const completed = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="card overflow-hidden animate-fadeIn">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
              <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-sm">
              {isHe ? 'צעדים ראשונים' : 'Getting Started'}
            </h3>
            <p className="text-xs text-slate-500">
              {isHe ? `${completed} מתוך ${total} הושלמו` : `${completed} of ${total} completed`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Percentage badge */}
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            pct >= 100
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
          }`}>
            {pct}%
          </span>
          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => { setDismissed(true); localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true'); dismissOnboarding(); }}
            className="p-1 rounded-lg text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isHe ? 'סגור' : 'Dismiss'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Task list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {tasks.map((task) => (
          <Link
            key={task.key}
            href={task.href}
            className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-sm group ${
              task.done
                ? 'border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-900/10'
                : 'border-[var(--border)] hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm'
            }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              task.done
                ? 'bg-green-500 text-white'
                : 'border-2 border-slate-300 dark:border-slate-600 group-hover:border-indigo-400'
            }`}>
              {task.done && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </div>
            <span className={task.done ? 'text-slate-400 line-through text-xs' : 'text-slate-700 dark:text-slate-300 text-xs font-medium'}>
              {isHe ? task.labelHe : task.labelEn}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
