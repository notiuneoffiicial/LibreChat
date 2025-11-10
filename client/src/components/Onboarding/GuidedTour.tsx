import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LocalStorageKeys } from 'librechat-data-provider';

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
    tooltipOffset: { y: -16 },
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

  return position;
};

const computeTooltipPosition = (
  step: TourStep,
  highlight: HighlightPosition | null,
): TooltipPosition => {
  if (!highlight) {
    return {
      top: window.innerHeight / 2 + window.scrollY,
      left: window.innerWidth / 2 + window.scrollX,
      transform: 'translate(-50%, -50%)',
    };
  }

  const placement = step.placement ?? 'bottom';
  const offset = 20;
  const applyOffset = (position: TooltipPosition): TooltipPosition => {
    const offsetX = step.tooltipOffset?.x ?? 0;
    const offsetY = step.tooltipOffset?.y ?? 0;
    return {
      ...position,
      top: position.top + offsetY,
      left: position.left + offsetX,
    };
  };

  switch (placement) {
    case 'top':
      return applyOffset({
        top: highlight.top - offset,
        left: highlight.left + highlight.width / 2,
        transform: 'translate(-50%, -100%)',
      });
    case 'bottom':
      return applyOffset({
        top: highlight.top + highlight.height + offset,
        left: highlight.left + highlight.width / 2,
        transform: 'translate(-50%, 0)',
      });
    case 'left':
      return applyOffset({
        top: highlight.top + highlight.height / 2,
        left: highlight.left - offset,
        transform: 'translate(calc(-100% - 16px), -50%)',
      });
    case 'right':
      return applyOffset({
        top: highlight.top + highlight.height / 2,
        left: highlight.left + highlight.width + offset,
        transform: 'translate(0, -50%)',
      });
    case 'center':
    default:
      return applyOffset({
        top: highlight.top + highlight.height / 2,
        left: highlight.left + highlight.width / 2,
        transform: 'translate(-50%, -50%)',
      });
  }
};

export default function GuidedTour() {
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = useMemo(() => tourSteps[stepIndex], [stepIndex]);
  const currentStepId = currentStep?.id;
  const highlightPosition = useHighlightPosition(currentStep, isActive);

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem(LocalStorageKeys.ONBOARDING_COMPLETED);
    if (hasCompletedTour !== 'true') {
      setIsActive(true);
    }
  }, []);

  useEffect(() => {
    if (!isActive || !currentStepId) {
      return;
    }

    let animationFrame: number | null = null;
    let attempts = 0;
    const maxAttempts = 5;

    if (sidePanelStepIds.has(currentStepId)) {
      const toggle = document.getElementById('toggle-right-nav');
      const isExpanded = toggle?.getAttribute('aria-expanded') === 'true';
      if (toggle && !isExpanded) {
        (toggle as HTMLElement).click();
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
      }
    };

    ensureNavOpen();

    return () => {
      if (animationFrame != null) {
        cancelAnimationFrame(animationFrame);
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
    setIsActive(false);
  }, []);

  const handleNext = useCallback(() => {
    setStepIndex((prev) => {
      const nextIndex = Math.min(prev + 1, tourSteps.length - 1);
      if (nextIndex === tourSteps.length - 1) {
        localStorage.setItem(LocalStorageKeys.ONBOARDING_COMPLETED, 'true');
      }
      return nextIndex;
    });
  }, []);

  const handlePrevious = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

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
  const tooltipPosition = computeTooltipPosition(currentStep, highlightPosition);

  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="OptimismAI guided introduction"
    >
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
      {highlightPosition && (
        <div
          className="pointer-events-none absolute rounded-xl border-2 border-white/80 bg-white/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] backdrop-blur-[1.5px] mix-blend-screen dark:bg-white/10"
          style={{
            top: highlightPosition.top,
            left: highlightPosition.left,
            width: highlightPosition.width,
            height: highlightPosition.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6), 0 0 20px rgba(255,255,255,0.35)',
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
        className="relative max-w-md rounded-2xl bg-white p-6 text-gray-900 shadow-2xl transition dark:bg-surface-primary dark:text-white"
        style={{
          position: 'absolute',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: tooltipPosition.transform,
        }}
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
