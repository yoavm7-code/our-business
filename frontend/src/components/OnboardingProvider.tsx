'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { users } from '@/lib/api';
import SiteTour from '@/components/SiteTour';

/* ---------- Types & Context ---------- */

/**
 * Onboarding phases:
 *  - loading:     determining the user's state
 *  - onboarding:  new user — show progress card on dashboard
 *  - tour:        guided walkthrough (after user dismisses progress card)
 *  - ready:       everything complete — smart tips etc. visible
 */
export type OnboardingPhase = 'loading' | 'onboarding' | 'tour' | 'ready';

interface OnboardingContextValue {
  phase: OnboardingPhase;
  /** Manually trigger the site tour (e.g. from Settings) */
  startTour: () => void;
  /** Dismiss the onboarding card and transition to tour */
  dismissOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  phase: 'loading',
  startTour: () => {},
  dismissOnboarding: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

/* ---------- localStorage keys ---------- */

const KEY_ONBOARDING_DISMISSED = 'onboarding_dismissed';
const KEY_TOUR_DONE = 'onboarding_tour_done';

/* ---------- Provider ---------- */

export default function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<OnboardingPhase>('loading');

  /* ---- Determine initial phase on mount ---- */
  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    if (!token) {
      setPhase('ready');
      return;
    }

    users
      .me()
      .then(() => {
        if (cancelled) return;

        // Determine phase from localStorage (works for all users)
        const onboardingDismissed = localStorage.getItem(KEY_ONBOARDING_DISMISSED) === 'true';
        const tourDone = localStorage.getItem(KEY_TOUR_DONE) === 'true';

        if (tourDone && onboardingDismissed) {
          setPhase('ready');
        } else if (onboardingDismissed) {
          // User dismissed the progress card — show tour
          setTimeout(() => { if (!cancelled) setPhase('tour'); }, 1000);
        } else {
          // Show onboarding progress on dashboard
          setTimeout(() => { if (!cancelled) setPhase('onboarding'); }, 500);
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('ready');
      });

    return () => { cancelled = true; };
  }, []);

  /* ---- Phase transitions ---- */

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(KEY_ONBOARDING_DISMISSED, 'true');
    // Small pause before starting tour
    setPhase('loading');
    setTimeout(() => setPhase('tour'), 1500);
  }, []);

  const handleTourComplete = useCallback(() => {
    localStorage.setItem(KEY_TOUR_DONE, 'true');
    setPhase('ready');
    users.completeOnboarding().catch(() => {});
  }, []);

  const startTour = useCallback(() => {
    setPhase('tour');
  }, []);

  /* ---- Context ---- */

  const contextValue = useMemo(
    () => ({ phase, startTour, dismissOnboarding }),
    [phase, startTour, dismissOnboarding],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}

      {/* Guided site tour */}
      {phase === 'tour' && (
        <SiteTour onComplete={handleTourComplete} />
      )}
    </OnboardingContext.Provider>
  );
}
