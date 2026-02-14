'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { users } from '@/lib/api';
import OnboardingWizard from '@/components/OnboardingWizard';
import SiteTour from '@/components/SiteTour';

/* ---------- Types & Context ---------- */

export type OnboardingPhase = 'loading' | 'wizard' | 'tour' | 'ready';

interface OnboardingContextValue {
  /** Current onboarding phase — downstream components can gate features on 'ready' */
  phase: OnboardingPhase;
  /** Manually trigger the site tour (e.g. from Settings) */
  startTour: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  phase: 'loading',
  startTour: () => {},
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

/* ---------- localStorage keys ---------- */

const KEY_WIZARD_DONE = 'onboarding_wizard_done';
const KEY_TOUR_DONE   = 'onboarding_tour_done';

/* ---------- Provider ---------- */

/**
 * Phased onboarding flow:
 *  1. Wizard  — business setup + first-steps checklist  (new users only)
 *  2. Tour    — guided walkthrough of the sidebar pages  (after wizard)
 *  3. Ready   — all features visible (smart tips, etc.)
 *
 * Existing users (onboardingCompleted === true) skip straight to 'ready'.
 * Each phase stores progress in localStorage so a page refresh resumes correctly.
 */
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
      .then((user) => {
        if (cancelled) return;

        // Existing user who already completed onboarding — skip everything
        if (user.onboardingCompleted !== false) {
          setPhase('ready');
          return;
        }

        // New user — figure out which phase they're in
        const wizardDone = localStorage.getItem(KEY_WIZARD_DONE) === 'true';
        const tourDone = localStorage.getItem(KEY_TOUR_DONE) === 'true';

        if (!wizardDone) {
          // Give the page a moment to settle before showing the wizard
          setTimeout(() => { if (!cancelled) setPhase('wizard'); }, 800);
        } else if (!tourDone) {
          // Wizard was finished (maybe on a previous session) — pick up with tour
          setTimeout(() => { if (!cancelled) setPhase('tour'); }, 1200);
        } else {
          // Both done but API wasn't marked yet — mark now
          users.completeOnboarding().catch(() => {});
          setPhase('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('ready');
      });

    return () => { cancelled = true; };
  }, []);

  /* ---- Phase transitions ---- */

  const handleWizardComplete = useCallback(() => {
    localStorage.setItem(KEY_WIZARD_DONE, 'true');
    // Brief breathing room before starting the tour
    setPhase('loading');
    setTimeout(() => setPhase('tour'), 2000);
  }, []);

  const handleTourComplete = useCallback(() => {
    localStorage.setItem(KEY_TOUR_DONE, 'true');
    setPhase('ready');
    // Mark onboarding as fully completed on the backend
    users.completeOnboarding().catch(() => {});
  }, []);

  /** Allow manually starting the tour (e.g. from a "Restart tour" button in Settings) */
  const startTour = useCallback(() => {
    setPhase('tour');
  }, []);

  /* ---- Context ---- */

  const contextValue = useMemo(
    () => ({ phase, startTour }),
    [phase, startTour],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}

      {/* Phase 1 — Onboarding wizard */}
      {phase === 'wizard' && (
        <OnboardingWizard onComplete={handleWizardComplete} />
      )}

      {/* Phase 2 — Guided site tour */}
      {phase === 'tour' && (
        <SiteTour onComplete={handleTourComplete} />
      )}
    </OnboardingContext.Provider>
  );
}
