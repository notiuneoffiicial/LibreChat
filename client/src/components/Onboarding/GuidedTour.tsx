import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LocalStorageKeys, dataService } from 'librechat-data-provider';
import { GUIDED_TOUR_REFRESH_EVENT, RESTART_GUIDED_TOUR_EVENT } from '~/common/events';
import { useGetUserQuery } from '~/data-provider';
import { useMutation, useQueryClient, QueryKeys } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';

type Placement = 'center' | 'left' | 'right' | 'bottom' | 'top';

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string | null;
  placement?: Placement;
  padding?: number;
  tooltipOffset?: {
    x?: number;
    y?: number;
  };
}

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  transform?: string;
}

interface TooltipSize {
  width: number;
  height: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to OptimismAI',
    description:
      'This quick tour will guide you through the essentials so you can start chatting with confidence.',
    target: null,
    placement: 'center',
  },
  {
    id: 'conversation-history',
    title: 'Conversation History',
    description:
      'Every conversation lives in the history panel on the left. Jump back in, search past threads, or start a brand new chat from here.',
    target: '[data-tour="conversation-history"]',
    placement: 'right',
    padding: 12,
  },
  {
    id: 'chat-messages',
    title: 'Chat Window',
    description:
      'Your messages and AI responses appear in the main window. Scroll back through the conversation, copy answers, give feedback all from here!.',
    target: '[data-tour="chat-messages"]',
    placement: 'center',
    padding: 20,
  },
  {
    id: 'chat-input',
    title: 'Compose Your Message',
    description:
      'Use the message box to ask questions, use tools, or enable voice mode. Press Enter to send or use the send button when you are ready.',
    target: '[data-tour="chat-input"]',
    placement: 'top',
    padding: 12,
    tooltipOffset: { y: -12 },
  },
  {
    id: 'chat-toggles',
    title: 'Quick Toggles',
    description:
      'Manage features like advanced reasoning, web search, and file lookups from this row of toggles. Pin your favorites so they are always ready for your next message, and attach files from here in a snap.',
    target: '[data-tour="chat-quick-actions"]',
    placement: 'top',
    padding: 20,
  },
  {
    id: 'web-search-toggle',
    title: 'Web Search',
    description:
      'Enable Web Search to let the assistant reach out for up-to-date information and cite results when the built-in knowledge needs a refresh.',
    target: '[data-tour="web-search-toggle"]',
    placement: 'top',
    padding: 16,
  },
  {
    id: 'file-search-toggle',
    title: 'File Search',
    description:
      'Activate File Search to pull answers from the documents you have shared. OptimismAI will reference those sources while crafting personalized replies.',
    target: '[data-tour="file-search-toggle"]',
    placement: 'top',
    padding: 16,
  },
  {
    id: 'multi-conversation-toggle',
    title: 'Dual Responses',
    description:
      'Add a second model to reply to the same prompt. Compare approaches side-by-side to uncover deeper insights.',
    target: '[data-tour="multi-conversation-toggle"]',
    placement: 'bottom',
    padding: 16,
    tooltipOffset: { y: 12 },
  },
  {
    id: 'temporary-chat-toggle',
    title: 'Temporary Chat',
    description:
      'Toggle Temporary Chat to keep this discussion off the record. Nothing is saved once you close the window.',
    target: '[data-tour="temporary-chat-toggle"]',
    placement: 'bottom',
    padding: 16,
    tooltipOffset: { y: 12 },
  },
  {
    id: 'voice-dictation',
    title: 'Voice & Dictation',
    description:
      'Use these controls to dictate messages hands-free or launch immersive voice mode for a live back-and-forth conversation.',
    target: '[data-tour="voice-dictation-controls"]',
    placement: 'top',
    padding: 16,
  },
  {
    id: 'side-panel-overview',
    title: 'Tools & Memories',
    description:
      'The side panel on the right houses memories, files, and more. configuring and adding to these gives OptimismAI a layer of personalization.',
    target: '[data-tour="side-panel"]',
    placement: 'left',
    padding: 16,
  },
  {
    id: 'side-panel-memories',
    title: 'Memories',
    description:
      'Review what OptimismAI remembers about you, add, clear or edit those memories at any time for a fresh start.',
    target: '[data-tour="side-panel-memories"]',
    placement: 'left',
    padding: 16,
    tooltipOffset: { y: -4 },
  },
  {
    id: 'side-panel-files',
    title: 'Conversation Files',
    description:
      'Browse everything you have uploaded to this thread. You can preview, remove, or reuse files to keep context organized.',
    target: '[data-tour="side-panel-files"]',
    placement: 'left',
    padding: 16,
    tooltipOffset: { y: -4 },
  },
  {
    id: 'side-panel-bookmarks',
    title: 'Bookmarks & Tags',
    description:
      'Group important conversations with bookmarks or custom tags so you can return to key insights instantly.',
    target: '[data-tour="side-panel-bookmarks"]',
    placement: 'left',
    padding: 16,
    tooltipOffset: { y: -4 },
  },
  {
    id: 'account-options',
    title: 'Profile & Settings',
    description:
      'Access advanced settings, manage your profile, review files, or sign out using the menu in the lower left corner of the sidebar.',
    target: '[data-tour="account-options"]',
    placement: 'top',
    tooltipOffset: { x: 12, y: -16 },
  },
  {
    id: 'finish',
    title: 'You are Ready!',
    description:
      'That is it. Dive in and start your first conversation—the entire workspace is ready for you.',
    target: null,
    placement: 'center',
  },
];

const sidePanelStepIds = new Set<string>([
  'side-panel-overview',
  'side-panel-memories',
  'side-panel-files',
  'side-panel-bookmarks',
]);

const navStepSelectors: Record<string, string> = {
  'side-panel-memories': '[data-tour="side-panel-memories-nav"]',
  'side-panel-files': '[data-tour="side-panel-files-nav"]',
  'side-panel-bookmarks': '[data-tour="side-panel-bookmarks-nav"]',
};

const overlayRoot = typeof window !== 'undefined' ? document.body : null;

const useHighlightPosition = (step: TourStep | undefined, isActive: boolean) => {
  const [position, setPosition] = useState<HighlightPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (!isActive || !step) {
      setPosition(null);
      return;
    }

    if (!step.target) {
      setPosition(null);
      return;
    }

    const element = document.querySelector(step.target) as HTMLElement | null;
    if (!element) {
      setPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const padding = step.padding ?? 8;
    setPosition({
      top: rect.top + window.scrollY - padding,
      left: rect.left + window.scrollX - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });
  }, [isActive, step]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    if (!isActive || !step?.target) {
      return undefined;
    }

    let animationFrame: number | null = null;
    let attempts = 0;
    const maxAttempts = 120;

    const ensureTarget = () => {
      if (attempts >= maxAttempts) {
        return;
      }

      const element = document.querySelector(step.target as string);
      if (element) {
        updatePosition();
        return;
      }

      attempts += 1;
      animationFrame = window.requestAnimationFrame(ensureTarget);
    };

    ensureTarget();

    return () => {
      if (animationFrame != null) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isActive, step, updatePosition]);

  useEffect(() => {
    if (!isActive || !step?.target) {
      return undefined;
    }

    const element = document.querySelector(step.target) as HTMLElement | null;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      updatePosition();
    });

    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isActive, step, updatePosition]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isActive, updatePosition]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const handleRefresh = () => updatePosition();
    window.addEventListener(GUIDED_TOUR_REFRESH_EVENT, handleRefresh);

    return () => {
      window.removeEventListener(GUIDED_TOUR_REFRESH_EVENT, handleRefresh);
    };
  }, [isActive, updatePosition]);

  return position;
};

const computeTooltipPosition = (
  step: TourStep,
  highlight: HighlightPosition | null,
  tooltipSize: TooltipSize,
): TooltipPosition => {
  const offset = 20;
  const offsetX = step.tooltipOffset?.x ?? 0;
  const offsetY = step.tooltipOffset?.y ?? 0;
  const placement = step.placement ?? 'bottom';
  const viewportPadding = 16;

  const scrollTop = window.scrollY;
  const scrollLeft = window.scrollX;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = tooltipSize.width || 0;
  const height = tooltipSize.height || 0;

  if (!highlight) {
    let top = scrollTop + viewportHeight / 2;
    let left = scrollLeft + viewportWidth / 2;

    if (width > 0 && height > 0) {
      const minTop = scrollTop + viewportPadding + height / 2;
      const maxTop = scrollTop + viewportHeight - viewportPadding - height / 2;
      const minLeft = scrollLeft + viewportPadding + width / 2;
      const maxLeft = scrollLeft + viewportWidth - viewportPadding - width / 2;

      top = clamp(top, minTop, maxTop);
      left = clamp(left, minLeft, maxLeft);
    }

    return {
      top,
      left,
      transform: 'translate(-50%, -50%)',
    };
  }

  let top = scrollTop + Math.max((viewportHeight - height) / 2, viewportPadding);
  let left = scrollLeft + Math.max((viewportWidth - width) / 2, viewportPadding);

  switch (placement) {
    case 'top':
      top = highlight.top - height - offset;
      left = highlight.left + highlight.width / 2 - width / 2;
      break;
    case 'bottom':
      top = highlight.top + highlight.height + offset;
      left = highlight.left + highlight.width / 2 - width / 2;
      break;
    case 'left':
      top = highlight.top + highlight.height / 2 - height / 2;
      left = highlight.left - width - offset;
      break;
    case 'right':
      top = highlight.top + highlight.height / 2 - height / 2;
      left = highlight.left + highlight.width + offset;
      break;
    case 'center':
    default:
      top = highlight.top + highlight.height / 2 - height / 2;
      left = highlight.left + highlight.width / 2 - width / 2;
      break;
  }

  top += offsetY;
  left += offsetX;

  if (width > 0 && height > 0) {
    const minTop = scrollTop + viewportPadding;
    const maxTop = scrollTop + viewportHeight - height - viewportPadding;
    const minLeft = scrollLeft + viewportPadding;
    const maxLeft = scrollLeft + viewportWidth - width - viewportPadding;

    top = clamp(top, minTop, maxTop);
    left = clamp(left, minLeft, maxLeft);
  }

  return { top, left };
};

export default function GuidedTour() {
  const { user } = useAuthContext();
  const { data: userData } = useGetUserQuery({ enabled: !!user?.id });
  const queryClient = useQueryClient();
  const updateGuidedTourMutation = useMutation(
    (guidedTourCompleted: boolean) => dataService.updateGuidedTourStatus(guidedTourCompleted),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.user]);
      },
    },
  );

  const [isActive, setIsActive] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    // Initial state will be updated by useEffect when userData loads
    return localStorage.getItem(LocalStorageKeys.ONBOARDING_COMPLETED) !== 'true';
  });
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = useMemo(() => tourSteps[stepIndex], [stepIndex]);
  const currentStepId = currentStep?.id;
  const highlightPosition = useHighlightPosition(currentStep, isActive);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltipSize, setTooltipSize] = useState<TooltipSize>({ width: 0, height: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<number | null>(null);

  const triggerTransition = useCallback(() => {
    if (transitionTimeoutRef.current != null) {
      window.clearTimeout(transitionTimeoutRef.current);
    }
    setIsTransitioning(true);
    transitionTimeoutRef.current = window.setTimeout(() => {
      setIsTransitioning(false);
      transitionTimeoutRef.current = null;
    }, 180);
  }, []);

  useLayoutEffect(() => {
    const updateSize = () => {
      if (!tooltipRef.current) {
        return;
      }
      const rect = tooltipRef.current.getBoundingClientRect();
      setTooltipSize((prev) => {
        const width = rect.width;
        const height = rect.height;
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    let resizeObserver: ResizeObserver | null = null;
    if (tooltipRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(tooltipRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver?.disconnect();
    };
  }, [currentStepId]);

  useEffect(() => {
    // Check backend status first
    if (userData?.personalization?.guidedTourCompleted === true) {
      setIsActive(false);
      return;
    }
    // Fallback to localStorage
    const hasCompletedTour = localStorage.getItem(LocalStorageKeys.ONBOARDING_COMPLETED);
    if (hasCompletedTour !== 'true') {
      setIsActive(true);
    } else {
      setIsActive(false);
    }
    return () => {
      if (transitionTimeoutRef.current != null) {
        window.clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [userData?.personalization?.guidedTourCompleted]);

  useEffect(() => {
    const handleRestart = () => {
      localStorage.removeItem(LocalStorageKeys.ONBOARDING_COMPLETED);
      if (user?.id) {
        updateGuidedTourMutation.mutate(false);
      }
      setStepIndex(0);
      setIsActive(true);
    };

    window.addEventListener(RESTART_GUIDED_TOUR_EVENT, handleRestart);
    return () => {
      window.removeEventListener(RESTART_GUIDED_TOUR_EVENT, handleRestart);
    };
  }, [user?.id, updateGuidedTourMutation]);

  useEffect(() => {
    if (!isActive || !currentStepId) {
      return;
    }

    let animationFrame: number | null = null;
    let attempts = 0;
    const maxAttempts = 5;
    let resizeTimeout: number | null = null;

    const scheduleReposition = () => {
      if (resizeTimeout != null) {
        window.clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        window.dispatchEvent(new Event(GUIDED_TOUR_REFRESH_EVENT));
      }, 200);
    };

    if (sidePanelStepIds.has(currentStepId)) {
      const toggle = document.getElementById('toggle-right-nav');
      const isExpanded = toggle?.getAttribute('aria-expanded') === 'true';
      if (toggle && !isExpanded) {
        (toggle as HTMLElement).click();
        scheduleReposition();
      }
    }

    const ensureNavOpen = () => {
      const navSelector = navStepSelectors[currentStepId];
      if (!navSelector) {
        return;
      }

      const navTrigger = document.querySelector(navSelector) as HTMLElement | null;
      if (!navTrigger && attempts < maxAttempts) {
        attempts += 1;
        animationFrame = window.requestAnimationFrame(ensureNavOpen);
        return;
      }

      if (navTrigger) {
        const isOpen = navTrigger.getAttribute('data-state') === 'open';
        if (!isOpen) {
          navTrigger.click();
        }
        scheduleReposition();
      }
    };

    ensureNavOpen();

    return () => {
      if (animationFrame != null) {
        cancelAnimationFrame(animationFrame);
      }
      if (resizeTimeout != null) {
        window.clearTimeout(resizeTimeout);
      }
    };
  }, [currentStepId, isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = 'hidden';

    return () => {
      style.overflow = previousOverflow;
    };
  }, [isActive]);

  const endTour = useCallback(() => {
    localStorage.setItem(LocalStorageKeys.ONBOARDING_COMPLETED, 'true');
    if (user?.id) {
      updateGuidedTourMutation.mutate(true);
    }
    setIsActive(false);
  }, [user?.id, updateGuidedTourMutation]);

  const handleNext = useCallback(() => {
    triggerTransition();
    setStepIndex((prev) => {
      const nextIndex = Math.min(prev + 1, tourSteps.length - 1);
      if (nextIndex === tourSteps.length - 1) {
        localStorage.setItem(LocalStorageKeys.ONBOARDING_COMPLETED, 'true');
        if (user?.id) {
          updateGuidedTourMutation.mutate(true);
        }
      }
      return nextIndex;
    });
  }, [triggerTransition, user?.id, updateGuidedTourMutation]);

  const handlePrevious = useCallback(() => {
    triggerTransition();
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [triggerTransition]);

  useEffect(() => {
    if (!isActive) {
      setStepIndex(0);
    }
  }, [isActive]);

  if (!isActive || !overlayRoot) {
    return null;
  }

  const isLastStep = stepIndex === tourSteps.length - 1;
  const isFirstStep = stepIndex === 0;
  const tooltipPosition = computeTooltipPosition(currentStep, highlightPosition, tooltipSize);

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center transition-opacity duration-200 ease-in-out"
      role="dialog"
      aria-modal="true"
      aria-label="OptimismAI guided introduction"
      style={{ opacity: isTransitioning ? 0.9 : 1 }}
    >
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-200 ease-in-out"
        aria-hidden="true"
        style={{ opacity: isTransitioning ? 0.95 : 1 }}
      />
      {highlightPosition && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-white/80 bg-white/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] backdrop-blur-[1.5px] mix-blend-screen transition-all duration-200 ease-in-out dark:bg-white/10"
          style={{
            top: highlightPosition.top,
            left: highlightPosition.left,
            width: highlightPosition.width,
            height: highlightPosition.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 20px rgba(255,255,255,0.35)',
            opacity: isTransitioning ? 0.65 : 1,
          }}
        />
      )}
      <button
        type="button"
        onClick={endTour}
        className="absolute right-6 top-6 rounded-full border border-white/60 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Skip tour
      </button>
      <div
        className="relative max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-2xl transition-all duration-200 ease-in-out dark:bg-surface-primary dark:text-white"
        style={{
          position: 'absolute',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: tooltipPosition.transform,
          opacity: isTransitioning ? 0 : 1,
        }}
        ref={tooltipRef}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/80">
          Step {stepIndex + 1} of {tourSteps.length}
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{currentStep.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
          {currentStep.description}
        </p>
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={isFirstStep}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/10"
          >
            Back
          </button>
          <button
            type="button"
            onClick={isLastStep ? endTour : handleNext}
            className="rounded-full border border-transparent bg-primary px-5 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-black dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:focus-visible:outline-white"
          >
            {isLastStep ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>,
    overlayRoot,
  );
}
