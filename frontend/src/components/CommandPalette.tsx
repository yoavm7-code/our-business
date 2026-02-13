'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/context';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { api } from '@/lib/api';

type SearchResults = {
  transactions: Array<{ id: string; date: string; description: string; amount: number; categoryName: string | null; categorySlug?: string | null }>;
  accounts: Array<{ id: string; name: string; type: string; balance: string }>;
  categories: Array<{ id: string; name: string; slug: string; isIncome: boolean }>;
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  invoices: Array<{ id: string; invoiceNumber: string; clientName: string }>;
};

const PAGES = [
  { href: '/dashboard', key: 'nav.dashboard', icon: 'grid' },
  { href: '/clients', key: 'nav.clients', icon: 'users' },
  { href: '/projects', key: 'nav.projects', icon: 'folder' },
  { href: '/invoices', key: 'nav.invoices', icon: 'invoice' },
  { href: '/transactions', key: 'nav.transactions', icon: 'list' },
  { href: '/upload', key: 'nav.uploadDocuments', icon: 'upload' },
  { href: '/income', key: 'nav.income', icon: 'trending-up' },
  { href: '/budgets', key: 'nav.budgets', icon: 'wallet' },
  { href: '/reports', key: 'nav.reports', icon: 'file-text' },
  { href: '/insights', key: 'nav.insights', icon: 'sparkles' },
  { href: '/tax', key: 'nav.tax', icon: 'percent' },
  { href: '/settings', key: 'nav.settings', icon: 'settings' },
];

type QuickAction = {
  id: string;
  labelKey: string;
  icon: string;
  action: 'navigate' | 'event';
  href?: string;
  eventName?: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-client', labelKey: 'search.newClient', icon: 'user-plus', action: 'navigate', href: '/clients?new=1' },
  { id: 'new-invoice', labelKey: 'search.newInvoice', icon: 'file-plus', action: 'navigate', href: '/invoices?new=1' },
  { id: 'new-transaction', labelKey: 'search.newTransaction', icon: 'plus-circle', action: 'event', eventName: 'open-quick-add' },
  { id: 'new-project', labelKey: 'search.newProject', icon: 'folder-plus', action: 'navigate', href: '/projects?new=1' },
];

function formatCurrency(n: number, locale: string) {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', {
    style: 'currency', currency: 'ILS', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function ActionIcon({ name }: { name: string }) {
  const cn = 'w-4 h-4 shrink-0 text-slate-400';
  switch (name) {
    case 'user-plus':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
    case 'file-plus':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
    case 'plus-circle':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case 'folder-plus':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>;
    default:
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>;
  }
}

function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export default function CommandPalette() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [voiceMode, setVoiceMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const shouldStartVoiceRef = useRef(false);

  // Voice recognition integration
  const handleVoiceResult = useCallback((text: string) => {
    if (text.trim()) {
      setQuery(text.trim());
      setSelectedIndex(0);
      setVoiceMode(false);
      // Trigger search with the voice result
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.trim().length >= 2) {
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
          try {
            const data = await api<SearchResults>('/api/dashboard/search', { params: { q: text.trim() } });
            setResults(data);
          } catch {
            setResults(null);
          } finally {
            setLoading(false);
          }
        }, 150);
      }
    }
  }, []);

  const {
    isListening,
    interimTranscript,
    transcript: voiceTranscript,
    isSupported: voiceSupported,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useVoiceRecorder({
    lang: locale === 'he' ? 'he-IL' : 'en-US',
    onResult: handleVoiceResult,
    continuous: true,
  });

  // Cmd+K / Ctrl+K to open, and listen for voice-search event
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') {
        if (isListening) stopVoice();
        setOpen(false);
      }
    }

    function onVoiceSearch(e: Event) {
      const detail = (e as CustomEvent).detail;
      // Open in voice mode - start listening immediately
      shouldStartVoiceRef.current = true;
      setVoiceMode(true);
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
      setOpen(true);
      // If text was already provided (from VoiceInputButton), use it directly
      if (detail?.text) {
        handleVoiceResult(detail.text);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('voice-search', onVoiceSearch);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('voice-search', onVoiceSearch);
    };
  }, [isListening, stopVoice, handleVoiceResult]);

  // Focus on open, and start voice if in voice mode
  useEffect(() => {
    if (open) {
      if (shouldStartVoiceRef.current && voiceSupported) {
        shouldStartVoiceRef.current = false;
        // Small delay to let the dialog mount
        setTimeout(() => startVoice(), 100);
      } else {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      // Clean up when closing
      if (isListening) stopVoice();
      setVoiceMode(false);
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [open, voiceSupported, startVoice, isListening, stopVoice]);

  // Debounced search
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api<SearchResults>('/api/dashboard/search', { params: { q } });
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedIndex(0);
    search(value);
  }

  function toggleVoice() {
    if (isListening) {
      stopVoice();
      setVoiceMode(false);
    } else {
      setVoiceMode(true);
      startVoice();
    }
  }

  // Build flat list of all navigable items
  const filteredPages = query.length > 0
    ? PAGES.filter((p) => t(p.key).toLowerCase().includes(query.toLowerCase()))
    : [];

  const filteredActions = query.length === 0
    ? QUICK_ACTIONS
    : QUICK_ACTIONS.filter((a) => t(a.labelKey).toLowerCase().includes(query.toLowerCase()));

  const allItems: Array<{ type: string; label: string; sublabel?: string; href?: string; action?: QuickAction }> = [];

  // Quick actions first when no query
  for (const a of filteredActions) {
    allItems.push({ type: 'action', label: t(a.labelKey), action: a });
  }

  // Pages
  for (const p of filteredPages) {
    allItems.push({ type: 'page', label: t(p.key), href: p.href });
  }

  // Search results
  if (results) {
    for (const cl of (results.clients || [])) {
      allItems.push({ type: 'client', label: cl.name, href: `/clients/${cl.id}` });
    }
    for (const pr of (results.projects || [])) {
      allItems.push({ type: 'project', label: pr.name, href: `/projects/${pr.id}` });
    }
    for (const inv of (results.invoices || [])) {
      allItems.push({ type: 'invoice', label: `#${inv.invoiceNumber}`, sublabel: inv.clientName, href: `/invoices/${inv.id}` });
    }
    for (const tx of results.transactions) {
      const amount = formatCurrency(tx.amount, locale);
      const date = new Date(tx.date).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-IL', { day: 'numeric', month: 'short' });
      allItems.push({
        type: 'transaction',
        label: tx.description,
        sublabel: `${amount} -- ${date}${tx.categoryName ? ` -- ${tx.categorySlug ? (t('categories.' + tx.categorySlug) !== 'categories.' + tx.categorySlug ? t('categories.' + tx.categorySlug) : tx.categoryName) : tx.categoryName}` : ''}`,
        href: `/transactions?search=${encodeURIComponent(tx.description)}`,
      });
    }
    for (const acc of results.accounts) {
      allItems.push({ type: 'account', label: acc.name, sublabel: t(`accountType.${acc.type}`), href: '/settings' });
    }
    for (const cat of results.categories) {
      const catName = t(`categories.${cat.slug}`) !== `categories.${cat.slug}` ? t(`categories.${cat.slug}`) : cat.name;
      allItems.push({
        type: 'category',
        label: catName,
        sublabel: cat.isIncome ? t('settings.income') : t('transactionsPage.expense'),
        href: `/transactions?categoryId=${cat.id}`,
      });
    }
  }

  function navigate(href: string) {
    if (isListening) stopVoice();
    setOpen(false);
    router.push(href);
  }

  function executeAction(action: QuickAction) {
    if (isListening) stopVoice();
    setOpen(false);
    if (action.action === 'navigate' && action.href) {
      router.push(action.href);
    } else if (action.action === 'event' && action.eventName) {
      document.dispatchEvent(new CustomEvent(action.eventName));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault();
      const item = allItems[selectedIndex];
      if (item.action) {
        executeAction(item.action);
      } else if (item.href) {
        navigate(item.href);
      }
    }
  }

  // The live text to show while voice is active
  const liveVoiceText = isListening ? (interimTranscript || voiceTranscript || '') : '';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh]" onClick={() => { if (isListening) stopVoice(); setOpen(false); }}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-[var(--card)] rounded-2xl shadow-2xl border border-[var(--border)] overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? t('voice.listening') : t('search.placeholder')}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-slate-400"
          />
          {/* Voice toggle button */}
          {voiceSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              className={`shrink-0 p-1.5 rounded-lg transition-all duration-200 relative ${
                isListening
                  ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
              }`}
              title={isListening ? t('voice.stop') : t('voice.start')}
            >
              {isListening && (
                <span className="absolute inset-0 rounded-lg animate-ping bg-red-400/20" />
              )}
              <MicIcon size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex px-2 py-0.5 rounded border border-[var(--border)] text-[10px] text-slate-400 font-mono">
            ESC
          </kbd>
        </div>

        {/* Voice listening indicator with live transcription */}
        {isListening && (
          <div className="px-4 py-3 border-b border-[var(--border)] bg-red-50/50 dark:bg-red-900/10">
            <div className="flex items-center gap-3">
              {/* Animated sound wave */}
              <div className="flex items-center gap-0.5 h-5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-1 bg-red-500 rounded-full animate-pulse"
                    style={{
                      height: `${8 + Math.random() * 12}px`,
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: '0.6s',
                    }}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-red-600 dark:text-red-400">
                  {t('voice.listening')}
                </div>
                {liveVoiceText ? (
                  <div className="text-sm text-[var(--foreground)] mt-0.5 truncate" dir="auto">
                    {liveVoiceText}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 mt-0.5">
                    {t('voice.hint')}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { stopVoice(); setVoiceMode(false); }}
                className="shrink-0 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                {t('voice.stop')}
              </button>
            </div>
          </div>
        )}

        {/* Voice error */}
        {voiceError && !isListening && (
          <div className="px-4 py-2 border-b border-[var(--border)] bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{voiceError === 'no-speech' ? t('voice.noSpeechDetected') : t('voice.notSupported')}</span>
              <button
                type="button"
                onClick={() => { setVoiceMode(true); startVoice(); }}
                className="ms-auto text-indigo-500 hover:underline"
              >
                {t('voice.tryAgain')}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto py-2">
          {query.length < 2 && filteredActions.length > 0 ? (
            <>
              {/* Quick actions when no query */}
              <div className="px-4 py-1 text-xs font-medium text-slate-400 uppercase">{t('search.quickActions')}</div>
              {allItems.filter((i) => i.type === 'action').map((item, idx) => {
                const globalIdx = allItems.indexOf(item);
                return (
                  <button
                    key={`action-${idx}`}
                    type="button"
                    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-start transition-colors ${
                      globalIdx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => item.action && executeAction(item.action)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                  >
                    {item.action && <ActionIcon name={item.action.icon} />}
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <div className="px-4 py-4 text-center text-sm text-slate-400">
                {t('search.hint')}
              </div>
            </>
          ) : loading && !results ? (
            <div className="px-4 py-6 text-center">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : allItems.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              {t('search.noResults')}
            </div>
          ) : (
            <>
              {/* Quick actions */}
              {filteredActions.length > 0 && (
                <>
                  <div className="px-4 py-1 text-xs font-medium text-slate-400 uppercase">{t('search.quickActions')}</div>
                  {allItems.filter((i) => i.type === 'action').map((item, idx) => {
                    const globalIdx = allItems.indexOf(item);
                    return (
                      <button
                        key={`qa-${idx}`}
                        type="button"
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-start transition-colors ${
                          globalIdx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => item.action && executeAction(item.action)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        {item.action && <ActionIcon name={item.action.icon} />}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Pages */}
              {filteredPages.length > 0 && (
                <>
                  <div className="px-4 py-1 mt-1 text-xs font-medium text-slate-400 uppercase">{t('search.pages')}</div>
                  {allItems.filter((i) => i.type === 'page').map((item, idx) => {
                    const globalIdx = allItems.indexOf(item);
                    return (
                      <button
                        key={`page-${idx}`}
                        type="button"
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-start transition-colors ${
                          globalIdx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => item.href && navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                        </svg>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Clients */}
              {results && (results.clients || []).length > 0 && (
                <>
                  <div className="px-4 py-1 mt-1 text-xs font-medium text-slate-400 uppercase">{t('search.clients')}</div>
                  {allItems.filter((i) => i.type === 'client').map((item, idx) => {
                    const globalIdx = allItems.indexOf(item);
                    return (
                      <button
                        key={`cl-${idx}`}
                        type="button"
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-start transition-colors ${
                          globalIdx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => item.href && navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Invoices */}
              {results && (results.invoices || []).length > 0 && (
                <>
                  <div className="px-4 py-1 mt-1 text-xs font-medium text-slate-400 uppercase">{t('search.invoices')}</div>
                  {allItems.filter((i) => i.type === 'invoice').map((item, idx) => {
                    const globalIdx = allItems.indexOf(item);
                    return (
                      <button
                        key={`inv-${idx}`}
                        type="button"
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-start transition-colors ${
                          globalIdx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => item.href && navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <div className="flex-1 min-w-0">
                          <span className="block truncate">{item.label}</span>
                          {item.sublabel && <span className="block text-xs text-slate-400 truncate">{item.sublabel}</span>}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Transactions */}
              {results && results.transactions.length > 0 && (
                <>
                  <div className="px-4 py-1 mt-1 text-xs font-medium text-slate-400 uppercase">{t('search.transactions')}</div>
                  {allItems.filter((i) => i.type === 'transaction').map((item, idx) => {
                    const globalIdx = allItems.indexOf(item);
                    return (
                      <button
                        key={`tx-${idx}`}
                        type="button"
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-start transition-colors ${
                          globalIdx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => item.href && navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                          <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <span className="block truncate">{item.label}</span>
                          <span className="block text-xs text-slate-400 truncate">{item.sublabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* Accounts */}
              {results && results.accounts.length > 0 && (
                <>
                  <div className="px-4 py-1 mt-1 text-xs font-medium text-slate-400 uppercase">{t('search.accounts')}</div>
                  {allItems.filter((i) => i.type === 'account').map((item, idx) => {
                    const globalIdx = allItems.indexOf(item);
                    return (
                      <button
                        key={`acc-${idx}`}
                        type="button"
                        className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-start transition-colors ${
                          globalIdx === selectedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => item.href && navigate(item.href)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-slate-400">
                          <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <span className="block truncate">{item.label}</span>
                          <span className="block text-xs text-slate-400 truncate">{item.sublabel}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-[var(--border)] text-[10px] text-slate-400">
          <span><kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">up/down</kbd> {t('search.navigate')}</span>
          <span><kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">enter</kbd> {t('search.select')}</span>
          <span><kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">esc</kbd> {t('search.close')}</span>
        </div>
      </div>
    </div>
  );
}
