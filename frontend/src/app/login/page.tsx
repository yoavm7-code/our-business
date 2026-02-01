'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/api';
import { useTranslation } from '@/i18n/context';
export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = isRegister
        ? await auth.register(email, password, name || undefined)
        : await auth.login(email, password);
      if (typeof window !== 'undefined' && res.accessToken) {
        localStorage.setItem('accessToken', res.accessToken);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="card w-full max-w-md relative">
        <button
          type="button"
          onClick={() => setLocale(locale === 'he' ? 'en' : 'he')}
          className="absolute top-4 end-4 text-xs font-medium px-2 py-1 rounded border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {locale === 'he' ? 'EN' : 'HE'}
        </button>
        <h1 className="text-2xl font-semibold text-center mb-6">{t('login.title')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium mb-1">{t('login.yourName')}</label>
              <input
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('login.yourName')}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">{t('login.email')}</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder={t('login.emailPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('login.password')}</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? t('login.pleaseWait') : isRegister ? t('login.createAccount') : t('login.signIn')}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          {isRegister ? t('login.alreadyHaveAccount') : t('login.dontHaveAccount')}{' '}
          <button
            type="button"
            className="text-primary-600 hover:underline"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
          >
            {isRegister ? t('login.signIn') : t('login.register')}
          </button>
        </p>
      </div>
    </div>
  );
}
