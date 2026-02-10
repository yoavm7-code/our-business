'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { users } from '@/lib/api';
import OnboardingWizard from '@/components/OnboardingWizard';

/* ---------- Context ---------- */

interface OnboardingContextValue {
  startTour: () => void;
  isTouring: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  startTour: () => {},
  isTouring: false,
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

/* ---------- Provider ---------- */

export default function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [isTouring, setIsTouring] = useState(false);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);

  // Check if the user has completed onboarding on mount
  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      setCheckedOnboarding(true);
      return;
    }

    users
      .me()
      .then((user) => {
        if (cancelled) return;
        setCheckedOnboarding(true);
        if (user.onboardingCompleted === false) {
          // Small delay so the page has time to load
          setTimeout(() => {
            if (!cancelled) setIsTouring(true);
          }, 800);
        }
      })
      .catch(() => {
        if (!cancelled) setCheckedOnboarding(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const startTour = useCallback(() => {
    setIsTouring(true);
  }, []);

  const handleComplete = useCallback(() => {
    setIsTouring(false);
    // Mark onboarding as completed on the backend (fire and forget)
    users.completeOnboarding().catch(() => {
      // Silently ignore errors - user can still use the app
    });
  }, []);

  const contextValue = useMemo(
    () => ({ startTour, isTouring }),
    [startTour, isTouring],
  );

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      {checkedOnboarding && isTouring && (
        <OnboardingWizard onComplete={handleComplete} />
      )}
    </OnboardingContext.Provider>
  );
}
