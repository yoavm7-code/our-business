'use client';

import { useEffect } from 'react';
import { LanguageProvider as I18nProvider, useTranslation } from '@/i18n/context';

function DirSetter({ children }: { children: React.ReactNode }) {
  const { locale, dir } = useTranslation();
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute('lang', locale === 'he' ? 'he' : 'en');
    html.setAttribute('dir', dir);
  }, [locale, dir]);
  return <>{children}</>;
}

export default function LanguageProvider({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <DirSetter>{children}</DirSetter>
    </I18nProvider>
  );
}
