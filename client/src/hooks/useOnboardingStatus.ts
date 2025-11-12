import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'OPTIMISM_ONBOARDING_COMPLETED';

type StatusState = 'unknown' | 'complete' | 'incomplete';

export const useOnboardingStatus = () => {
  const [status, setStatus] = useState<StatusState>('unknown');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) === 'true';
      setStatus(stored ? 'complete' : 'incomplete');
    } catch (error) {
      console.warn('[onboarding] Unable to read onboarding flag:', error);
      setStatus('complete');
    }
  }, []);

  const markComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, 'true');
      } catch (error) {
        console.warn('[onboarding] Unable to persist onboarding flag:', error);
      }
    }
    setStatus('complete');
  }, []);

  return {
    status,
    isLoaded: status !== 'unknown',
    isComplete: status === 'complete',
    markComplete,
  };
};

export const hasOnboardingCompleted = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true;
  }
};

