import { useCallback, useEffect, useMemo, useState } from 'react';
import { LocalStorageKeys, dataService, QueryKeys } from 'librechat-data-provider';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGetUserQuery } from '~/data-provider';

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
  const { data: user } = useGetUserQuery({ enabled: enabled && !!userId });
  const queryClient = useQueryClient();

  const updateOnboardingMutation = useMutation(
    (onboardingCompleted: boolean) => dataService.updateOnboardingStatus(onboardingCompleted),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.user]);
      },
    },
  );

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
      let nextStatus: StatusState = 'incomplete';

      // First, check backend (user.personalization.onboardingCompleted)
      if (user?.personalization?.onboardingCompleted === true) {
        nextStatus = 'complete';
        // Sync to localStorage as backup
        try {
          window.localStorage.setItem(storageKey, 'true');
          window.localStorage.setItem(STORAGE_KEY, 'true');
        } catch (error) {
          console.warn('[onboarding] Failed to sync to localStorage:', error);
        }
      } else if (user?.personalization?.onboardingCompleted === false) {
        nextStatus = 'incomplete';
      } else {
        // Fallback to localStorage if backend doesn't have the value
        const stored = window.localStorage.getItem(storageKey);
        if (stored === 'true') {
          nextStatus = 'complete';
          // Migrate to backend if we have localStorage but not backend
          if (userId) {
            updateOnboardingMutation.mutate(true);
          }
        } else {
          const legacyGlobal = window.localStorage.getItem(STORAGE_KEY);
          if (legacyGlobal === 'true') {
            try {
              window.localStorage.setItem(storageKey, 'true');
              if (userId) {
                updateOnboardingMutation.mutate(true);
              }
            } catch (error) {
              console.warn('[onboarding] Failed to migrate onboarding flag:', error);
            }
            nextStatus = 'complete';
          }
        }
      }

      setStatus(nextStatus);
    } catch (error) {
      console.warn('[onboarding] Unable to read onboarding flag:', error);
      setStatus('incomplete');
    }
  }, [enabled, storageKey, user?.personalization?.onboardingCompleted, userId, updateOnboardingMutation]);

  const markComplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, 'true');
        window.localStorage.setItem(STORAGE_KEY, 'true');
        window.localStorage.removeItem(LocalStorageKeys.ONBOARDING_COMPLETED);
      } catch (error) {
        console.warn('[onboarding] Unable to persist onboarding flag:', error);
      }
    }
    if (userId) {
      updateOnboardingMutation.mutate(true);
    }
    setStatus('complete');
  }, [storageKey, userId, updateOnboardingMutation]);

  const markIncomplete = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(storageKey);
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.warn('[onboarding] Unable to reset onboarding flag:', error);
      }
    }
    if (userId) {
      updateOnboardingMutation.mutate(false);
    }
    setStatus('incomplete');
  }, [storageKey, userId, updateOnboardingMutation]);

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
