import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocalStorageKeys } from 'librechat-data-provider';

const STORAGE_KEY = 'OPTIMISM_ONBOARDING_COMPLETED';

type StatusState = 'unknown' | 'complete' | 'incomplete';

const buildStorageKey = (userId?: string | null) =>
  userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;

type UseOnboardingOptions = {
  enabled?: boolean;
};

export const useOnboardingStatus = (userId?: string | null, options: UseOnboardingOptions = {}) => {
  const { enabled = true } = options;
  const storageKey = useMemo(() => buildStorageKey(userId), [userId]);
  const [status, setStatus] = useState<StatusState>('unknown');

  useEffect(() => {
    if (!enabled) {
      setStatus('unknown');
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      setStatus('unknown');
      const stored = window.localStorage.getItem(storageKey);
      setStatus(stored === 'true' ? 'complete' : 'incomplete');
    } catch (error) {
      console.warn('[onboarding] Unable to read onboarding flag:', error);
      setStatus('incomplete');
    }
  }, [enabled, storageKey]);

  const markComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, 'true');
        // Maintain compatibility with legacy keys that other flows rely on.
        window.localStorage.setItem(STORAGE_KEY, 'true');
        window.localStorage.setItem(LocalStorageKeys.ONBOARDING_COMPLETED, 'true');
      } catch (error) {
        console.warn('[onboarding] Unable to persist onboarding flag:', error);
      }
    }
    setStatus('complete');
  }, [storageKey]);

  const markIncomplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey);
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(LocalStorageKeys.ONBOARDING_COMPLETED);
      } catch (error) {
        console.warn('[onboarding] Unable to reset onboarding flag:', error);
      }
    }
    setStatus('incomplete');
  }, [storageKey]);

  return {
    status,
    isLoaded: status !== 'unknown',
    isComplete: status === 'complete',
    markComplete,
    markIncomplete,
  };
};

export const hasOnboardingCompleted = (userId?: string | null) => {
  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return window.localStorage.getItem(buildStorageKey(userId)) === 'true';
  } catch {
    return true;
  }
};

