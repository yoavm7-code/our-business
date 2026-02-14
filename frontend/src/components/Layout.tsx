'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/context';
import { users } from '@/lib/api';
import AvatarCropper from '@/components/AvatarCropper';
import CommandPalette from '@/components/CommandPalette';
import AlertsBell from '@/components/AlertsBell';
import QuickAdd from '@/components/QuickAdd';
import VoiceTransaction from '@/components/VoiceTransaction';
import SmartTip from '@/components/SmartTip';
import { useOnboarding } from '@/components/OnboardingProvider';

/* ────────────────────────────────────────────── */
/* Navigation data                                 */
/* ────────────────────────────────────────────── */

type NavItem = { href: string; key: string; icon: string; descKey?: string };

const mainItems: NavItem[] = [
  { href: '/dashboard', key: 'nav.dashboard', icon: 'grid', descKey: 'nav.dashboardDesc' },
];

const businessItems: NavItem[] = [
  { href: '/clients', key: 'nav.clients', icon: 'users', descKey: 'nav.clientsDesc' },
  { href: '/projects', key: 'nav.projects', icon: 'folder', descKey: 'nav.projectsDesc' },
  { href: '/invoices', key: 'nav.invoices', icon: 'file-invoice', descKey: 'nav.invoicesDesc' },
];

const financeItems: NavItem[] = [
  { href: '/transactions', key: 'nav.transactions', icon: 'list', descKey: 'nav.transactionsDesc' },
  { href: '/upload', key: 'nav.uploadDocuments', icon: 'upload', descKey: 'nav.uploadDesc' },
  { href: '/income', key: 'nav.income', icon: 'trending-up', descKey: 'nav.incomeDesc' },
  { href: '/budgets', key: 'nav.budgets', icon: 'wallet', descKey: 'nav.budgetsDesc' },
];

const reportsItems: NavItem[] = [
  { href: '/reports', key: 'nav.reports', icon: 'file-text', descKey: 'nav.reportsDesc' },
  { href: '/insights', key: 'nav.insights', icon: 'sparkles', descKey: 'nav.insightsDesc' },
  { href: '/tax', key: 'nav.tax', icon: 'percent', descKey: 'nav.taxDesc' },
];

const navGroups = [
  { id: 'main', labelKey: 'nav.main', items: mainItems },
  { id: 'business', labelKey: 'nav.business', items: businessItems },
  { id: 'finance', labelKey: 'nav.finance', items: financeItems },
  { id: 'reports', labelKey: 'nav.reportsSection', items: reportsItems },
];

/* ────────────────────────────────────────────── */
/* SVG Icon component                              */
/* ────────────────────────────────────────────── */

function NavIcon({ name, className }: { name: string; className?: string }) {
  const cn = className || 'w-5 h-5';
  switch (name) {
    case 'grid':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'users':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
    case 'folder':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>;
    case 'file-invoice':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>;
    case 'list':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
    case 'upload':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
    case 'trending-up':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case 'wallet':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 14h.01"/><path d="M2 10h20"/></svg>;
    case 'file-text':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    case 'sparkles':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z"/></svg>;
    case 'percent':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>;
    case 'target':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
    case 'repeat':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>;
    case 'currency':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
    case 'bar-chart':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>;
    case 'banknotes':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>;
    case 'settings':
      return <svg className={cn} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
    default:
      return null;
  }
}

/* ────────────────────────────────────────────── */
/* Main Layout Component                           */
/* ────────────────────────────────────────────── */

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { phase: onboardingPhase, startTour } = useOnboarding();

  /* --- State --- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sidebar_collapsed');
      return stored === null ? true : stored === 'true'; // default collapsed on desktop
    }
    return true;
  });
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['main', 'business', 'finance', 'reports', 'more']));
  const [userInfo, setUserInfo] = useState<{ name: string | null; email: string; avatarUrl?: string | null } | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [avatarCropFile, setAvatarCropFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [voiceMinimized, setVoiceMinimized] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('voiceIcon_minimized') === 'true';
    return false;
  });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const toggleGroup = (g: string) => setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    return next;
  });

  /* --- Fetch user info --- */
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;
    users.me()
      .then((u) => setUserInfo({ name: u.name, email: u.email, avatarUrl: (u as { avatarUrl?: string }).avatarUrl }))
      .catch(() => {});
  }, []);

  /* --- Dark mode --- */
  useEffect(() => {
    const stored = localStorage.getItem('freelanceros-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('freelanceros-theme', next ? 'dark' : 'light');
  };

  /* --- Close drawer on route change --- */
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  /* --- Escape closes drawer --- */
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  /* --- Lock body scroll when drawer open --- */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  /* --- Avatar events from settings page --- */
  useEffect(() => {
    function onAvatarChanged(e: Event) {
      const detail = (e as CustomEvent).detail as { avatarUrl: string | null };
      setUserInfo((prev) => prev ? { ...prev, avatarUrl: detail.avatarUrl } : prev);
    }
    window.addEventListener('avatar-changed', onAvatarChanged);
    return () => window.removeEventListener('avatar-changed', onAvatarChanged);
  }, []);

  /* --- Avatar crop --- */
  const handleAvatarFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarCropFile(file);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  }, []);

  const handleAvatarCrop = useCallback(async (blob: Blob) => {
    setAvatarCropFile(null);
    setAvatarUploading(true);
    try {
      const file = new File([blob], 'avatar.png', { type: 'image/png' });
      const result = await users.uploadAvatar(file);
      setUserInfo((prev) => prev ? { ...prev, avatarUrl: result.avatarUrl } : prev);
      setProfileMenuOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAvatarUploading(false);
    }
  }, []);

  /* --- Voice button (top bar) opens command palette in voice mode --- */
  const handleVoiceClick = useCallback(() => {
    document.dispatchEvent(new CustomEvent('voice-search'));
  }, []);

  /* --- Logout --- */
  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      router.push('/');
    }
  }

  const toggleLocale = () => setLocale(locale === 'he' ? 'en' : 'he');
  const userInitial = userInfo?.name?.charAt(0)?.toUpperCase() || userInfo?.email?.charAt(0)?.toUpperCase() || '?';
  const userDisplayName = userInfo?.name || userInfo?.email?.split('@')[0] || '';

  /* ─────────────── Sidebar content ─────────────── */
  const sidebarContent = (
    <>
      {/* Logo / brand */}
      <div className={`flex items-center justify-between py-4 border-b border-white/10 ${sidebarCollapsed ? 'px-2' : 'px-5'}`}>
        <Link href="/dashboard" className={`font-bold text-white tracking-tight ${sidebarCollapsed ? 'text-sm mx-auto' : 'text-lg'}`}>
          {sidebarCollapsed ? 'F' : t('app.name')}
        </Link>
        <div className="flex items-center gap-2">
          {/* Collapse toggle - desktop only */}
          <button
            type="button"
            onClick={() => { setSidebarCollapsed((c) => { const next = !c; localStorage.setItem('sidebar_collapsed', String(next)); return next; }); }}
            className="p-1.5 rounded-lg text-[#a0a3bd] hover:text-white hover:bg-white/10 transition-colors hidden md:inline-flex"
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: sidebarCollapsed ? (locale === 'he' ? 'scaleX(1)' : 'scaleX(-1)') : (locale === 'he' ? 'scaleX(-1)' : 'scaleX(1)') }}>
              <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
            </svg>
          </button>
          {/* Close button - mobile only */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-lg text-[#a0a3bd] hover:text-white hover:bg-white/10 transition-colors md:hidden"
            aria-label="Close menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* User profile section */}
      {userInfo && (
        <div className={`relative pt-4 pb-2 ${sidebarCollapsed ? 'px-1.5' : 'px-3'}`}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm hover:bg-white/8 transition-colors"
          >
            {userInfo.avatarUrl ? (
              <img src={userInfo.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/50" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold ring-2 ring-indigo-500/50">
                {userInitial}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0 text-start">
                <p className="font-medium truncate text-sm text-white">{userDisplayName}</p>
                <p className="text-xs text-[#a0a3bd] truncate">{userInfo.email}</p>
              </div>
            )}
            {!sidebarCollapsed && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 text-[#a0a3bd] transition-transform ${profileMenuOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
            )}
          </button>
          {profileMenuOpen && !sidebarCollapsed && (
            <div className="mt-1 rounded-xl bg-[#252540] border border-white/10 shadow-lg overflow-hidden animate-fadeIn">
              <Link
                href="/settings"
                onClick={() => setProfileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a0a3bd] hover:text-white hover:bg-white/8 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>{t('profile.editProfile')}</span>
              </Link>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#a0a3bd] hover:text-white hover:bg-white/8 transition-colors w-full text-start"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                <span>{avatarUploading ? '...' : t('profile.uploadAvatar')}</span>
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarFileSelect}
              />
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {navGroups.map((group) => {
          const isHovered = hoveredGroup === group.id;
          return (
            <div
              key={group.id}
              className="relative"
              onMouseEnter={() => {
                if (sidebarCollapsed) {
                  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                  setHoveredGroup(group.id);
                }
              }}
              onMouseLeave={() => {
                if (sidebarCollapsed) {
                  hoverTimeoutRef.current = setTimeout(() => setHoveredGroup(null), 200);
                }
              }}
            >
              {/* Group header - expanded mode */}
              {!sidebarCollapsed && (
                <div
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-300 mt-3 first:mt-0"
                >
                  <span>{t(group.labelKey)}</span>
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${openGroups.has(group.id) ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              )}

              {/* Collapsed mode: show first item icon as group representative */}
              {sidebarCollapsed && (
                <div className="flex flex-col items-center gap-0.5 py-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${
                          isActive
                            ? 'bg-indigo-500/15 text-indigo-400'
                            : 'text-[#a0a3bd] hover:bg-white/8 hover:text-white'
                        }`}
                        title={t(item.key)}
                      >
                        <NavIcon name={item.icon} />
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Collapsed hover flyout */}
              {sidebarCollapsed && isHovered && (
                <div
                  className="fixed z-[9999] animate-fadeIn"
                  style={{
                    [locale === 'he' ? 'right' : 'left']: '64px',
                    top: 'var(--flyout-top)',
                  }}
                  ref={(el) => {
                    if (el) {
                      const parent = el.parentElement;
                      if (parent) {
                        const rect = parent.getBoundingClientRect();
                        el.style.setProperty('top', `${rect.top}px`);
                        el.style.removeProperty('--flyout-top');
                      }
                    }
                  }}
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                    setHoveredGroup(group.id);
                  }}
                  onMouseLeave={() => {
                    hoverTimeoutRef.current = setTimeout(() => setHoveredGroup(null), 200);
                  }}
                >
                  <div className="bg-[#252540] border border-white/10 rounded-xl shadow-2xl py-2 px-1 min-w-[200px]">
                    <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-white/10 mb-1">{t(group.labelKey)}</p>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setHoveredGroup(null)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all ${
                            isActive
                              ? 'bg-indigo-500/15 text-indigo-400'
                              : 'text-[#a0a3bd] hover:bg-white/8 hover:text-white'
                          }`}
                        >
                          <NavIcon name={item.icon} className="w-4 h-4" />
                          <span>{t(item.key)}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expanded mode: full item list */}
              {!sidebarCollapsed && openGroups.has(group.id) && group.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.descKey ? t(item.descKey) : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 group/nav ${
                      isActive
                        ? 'bg-indigo-500/15 text-indigo-400'
                        : 'text-[#a0a3bd] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <NavIcon name={item.icon} />
                    <div className="flex-1 min-w-0">
                      <span>{t(item.key)}</span>
                      {item.descKey && (
                        <p className="text-[10px] text-slate-500 font-normal truncate mt-0.5 opacity-0 group-hover/nav:opacity-100 transition-opacity">{t(item.descKey)}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}

        {/* Quick Add in sidebar */}
        <button
          type="button"
          onClick={() => setShowQuickAdd(true)}
          className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-indigo-400 hover:bg-indigo-500/15 transition-all duration-150 mt-4 ${sidebarCollapsed ? 'justify-center' : ''}`}
          title={sidebarCollapsed ? t('quickAdd.title') : undefined}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          {!sidebarCollapsed && <span>{t('quickAdd.title')}</span>}
        </button>

        {/* Site tour button */}
        <button
          type="button"
          onClick={startTour}
          className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-[#a0a3bd] hover:bg-white/5 hover:text-white transition-all duration-150 ${sidebarCollapsed ? 'justify-center' : ''}`}
          title={sidebarCollapsed ? (locale === 'he' ? 'סיור באתר' : 'Site Tour') : undefined}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
          {!sidebarCollapsed && <span>{locale === 'he' ? 'סיור באתר' : 'Site Tour'}</span>}
        </button>

        {/* Settings - at bottom of nav */}
        <div className="pt-3 mt-3 border-t border-white/10">
          {(() => {
            const isActive = pathname === '/settings';
            return (
              <Link
                href="/settings"
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : 'text-[#a0a3bd] hover:bg-white/5 hover:text-white'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
                title={sidebarCollapsed ? t('nav.settings') : undefined}
              >
                <NavIcon name="settings" />
                {!sidebarCollapsed && <span>{t('nav.settings')}</span>}
              </Link>
            );
          })()}
        </div>
      </nav>

      {/* Footer actions */}
      <div className={`border-t border-white/10 space-y-0.5 ${sidebarCollapsed ? 'p-1.5' : 'p-3'}`}>
        {/* Search shortcut */}
        <button
          type="button"
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className={`flex items-center gap-3 w-full rounded-xl text-sm text-[#a0a3bd] hover:bg-white/5 hover:text-white transition-all duration-150 ${sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
          title={sidebarCollapsed ? (t('search.placeholder').split(',')[0]) : undefined}
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          {!sidebarCollapsed && (
            <>
              <span>{t('search.placeholder').split(',')[0]}</span>
              <kbd className="ms-auto text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-[#6b6d85] font-mono">K+</kbd>
            </>
          )}
        </button>
        {/* Dark mode */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`flex items-center gap-3 w-full rounded-xl text-sm text-[#a0a3bd] hover:bg-white/5 hover:text-white transition-all duration-150 ${sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
          title={sidebarCollapsed ? (darkMode ? t('darkMode.dark') : t('darkMode.light')) : undefined}
        >
          {darkMode ? (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
          ) : (
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          )}
          {!sidebarCollapsed && <span>{darkMode ? t('darkMode.dark') : t('darkMode.light')}</span>}
        </button>
        {/* Language toggle */}
        <button
          type="button"
          onClick={toggleLocale}
          className={`flex items-center gap-3 w-full rounded-xl text-sm text-[#a0a3bd] hover:bg-white/5 hover:text-white transition-all duration-150 ${sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
          title={sidebarCollapsed ? (locale === 'he' ? 'English' : 'עברית') : undefined}
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          {!sidebarCollapsed && <span>{locale === 'he' ? 'English' : 'עברית'}</span>}
        </button>
        {/* Sign out */}
        <button
          type="button"
          onClick={logout}
          className={`flex items-center gap-3 w-full rounded-xl text-sm text-[#a0a3bd] hover:bg-white/5 hover:text-red-400 transition-all duration-150 ${sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2.5'}`}
          title={sidebarCollapsed ? t('common.signOut') : undefined}
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          {!sidebarCollapsed && <span>{t('common.signOut')}</span>}
        </button>
      </div>
    </>
  );

  /* ─────────────── Render ─────────────── */
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-30">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 -m-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
        </button>
        <Link href="/dashboard" className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-blue-500 bg-clip-text text-transparent">
          {t('app.name')}
        </Link>
        <div className="flex items-center gap-1">
          <AlertsBell />
          <button
            type="button"
            onClick={toggleLocale}
            className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-[var(--border)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {locale === 'he' ? 'EN' : 'HE'}
          </button>
        </div>
      </div>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 start-0 z-50 w-72 bg-[#1a1a2e]
          transform transition-transform duration-300 ease-out
          ${drawerOpen ? 'translate-x-0 rtl:-translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full'}
          md:sticky md:top-0 md:z-auto md:h-screen md:!translate-x-0
          ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'}
          flex flex-col shadow-xl md:shadow-none transition-all
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop top bar */}
        <div className="hidden md:flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--card)] sticky top-0 z-20">
          {/* Search bar placeholder */}
          <button
            type="button"
            onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-sm hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors w-64"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>{t('search.placeholder').split(',')[0]}</span>
            <kbd className="ms-auto text-[10px] px-1.5 py-0.5 rounded border border-[var(--border)] font-mono">K+</kbd>
          </button>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Smart AI Tips */}
            <SmartTip />
            {/* Voice button with minimize toggle */}
            {voiceMinimized ? (
              <button
                type="button"
                onClick={() => { setVoiceMinimized(false); localStorage.setItem('voiceIcon_minimized', 'false'); }}
                className="relative shrink-0 p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200"
                title={locale === 'he' ? 'הצג זיהוי קולי' : 'Show voice'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleVoiceClick}
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all duration-200"
                  title={t('voice.start')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                {/* Minimize button — always visible, clickable */}
                <button
                  type="button"
                  onClick={() => { setVoiceMinimized(true); localStorage.setItem('voiceIcon_minimized', 'true'); }}
                  className="shrink-0 p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                  title={locale === 'he' ? 'מזער' : 'Minimize'}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowQuickAdd(true)}
              className="p-2 rounded-xl text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              title={t('quickAdd.title')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            </button>
            <AlertsBell />
            {/* User avatar */}
            {userInfo && (
              <Link href="/settings" className="ms-1">
                {userInfo.avatarUrl ? (
                  <img src={userInfo.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/30 hover:ring-indigo-500/60 transition-all" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-indigo-500/30 hover:ring-indigo-500/60 transition-all">
                    {userInitial}
                  </div>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden min-h-0">
          {children}
        </main>
      </div>

      {/* Modals & overlays */}
      <CommandPalette />
      <QuickAdd open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
      <VoiceTransaction />

      {avatarCropFile && (
        <AvatarCropper
          file={avatarCropFile}
          onCrop={handleAvatarCrop}
          onCancel={() => setAvatarCropFile(null)}
        />
      )}
    </div>
  );
}
