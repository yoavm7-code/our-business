'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/context';
const navKeys: { href: string; key: string }[] = [
  { href: '/dashboard', key: 'nav.dashboard' },
  { href: '/transactions', key: 'nav.transactions' },
  { href: '/upload', key: 'nav.uploadDocuments' },
  { href: '/income', key: 'nav.income' },
  { href: '/expenses', key: 'nav.expenses' },
  { href: '/insurance-funds', key: 'nav.insuranceFunds' },
  { href: '/insights', key: 'nav.insights' },
  { href: '/settings', key: 'nav.settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) router.replace('/login');
  }, [router]);

  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      router.push('/login');
    }
  }

  const toggleLocale = () => setLocale(locale === 'he' ? 'en' : 'he');

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-56 border-b md:border-b-0 md:border-r border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="text-lg font-semibold">
            {t('common.appName')}
          </Link>
          <button
            type="button"
            onClick={toggleLocale}
            className="text-xs font-medium px-2 py-1 rounded border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800"
            title={locale === 'he' ? 'English' : 'עברית'}
          >
            {locale === 'he' ? 'EN' : 'HE'}
          </button>
        </div>
        <nav className="space-y-1">
          {navKeys.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm ${
                pathname === item.href
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-6 w-full text-left rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {t('common.signOut')}
        </button>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
