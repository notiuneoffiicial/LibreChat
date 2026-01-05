import { memo, useState, useEffect, useMemo } from 'react';
import { Spinner } from '@librechat/client';
import { cn } from '~/utils';
import Container from '../Container';

type FormulatedQuestionProps = {
  question: string;
  thought?: string;
  progress?: number; // 0 to 1, where 1 means complete
  isSubmitting?: boolean;
  mode?: 'question' | 'answer'; // 'question' (formulating question) or 'answer' (generating answer)
};

/**
 * FormulatedQuestion: ChatGPT-style "Formulating question/answer..." indicator.
 * Shows a shimmer animation while processing, then reveals the final question.
 * If mode is 'answer', shows "Formulating answer..." instead.
 */
const FormulatedQuestion = ({
  question,
  thought,
  progress = 1,
  isSubmitting = false,
  mode = 'question',
}: FormulatedQuestionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Show shimmer when progress < 1, regardless of isSubmitting state
  const isProcessing = progress < 1;
  const isComplete = progress >= 1;
  const hasQuestion = !!question && question.trim().length > 0;

  // Pseudo-activity steps
  const steps = useMemo(() => [
    "Grounding question in optimism",
    "Looking through different perspectives",
    "Reframing the core inquiry",
    "Consulting with Aristotle",
    "Consulting with Socrates",
    "Synthesizing insights",
    "Finalizing formulation"
  ], []);

  // Cycle through steps while processing
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      setCurrentStepIndex(prev => (prev + 1) % steps.length);
    }, 2000); // Change step every 2 seconds

    return () => clearInterval(interval);
  }, [isProcessing, steps.length]);

  // Determine the shimmer text based on mode
  const shimmerText = mode === 'answer' ? 'Formulating answer...' : 'Formulating question...';
  const currentActivity = isProcessing ? steps[currentStepIndex] : steps[steps.length - 1];

  // If nothing to show and not processing, hide component
  if (!isProcessing && !hasQuestion) {
    return null;
  }

  return (
    <Container>
      <div className="relative my-2.5 flex flex-col gap-2">
        {/* Processing state: shimmer with streaming thought */}
        {isProcessing && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <Spinner className="size-5 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="shimmer text-sm font-medium text-token-text-secondary">
                  {shimmerText}
                </span>
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="text-token-text-tertiary hover:text-token-text-primary transition-colors focus:outline-none"
                  aria-label="Toggle activity details"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transform transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            {/* Activity Log Dropdown */}
            {isOpen && (
              <div className="ml-8 flex flex-col gap-1 overflow-hidden transition-all duration-300 ease-in-out">
                {steps.slice(0, currentStepIndex + 1).map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-token-text-tertiary animate-in fade-in slide-in-from-top-1 duration-300">
                    <span className="size-1.5 rounded-full bg-token-text-tertiary/50 shrink-0" />
                    <span>{step}...</span>
                  </div>
                ))}
              </div>
            )}

            {/* Current Step (Subtle preview if closed) */}
            {!isOpen && (
              <div className="ml-8 text-xs text-token-text-tertiary animate-pulse transition-all duration-500">
                {currentActivity}...
              </div>
            )}
          </div>
        )}

        {/* Complete state: show final question (only for 'question' mode) */}
        {isComplete && hasQuestion && mode === 'question' && (
          <div className="flex flex-col gap-1 animate-in fade-in duration-500">
            <span className="text-xs font-medium text-token-text-tertiary uppercase tracking-wide">
              Question
            </span>
            <span className="text-base font-medium text-text-primary">
              {question}
            </span>
          </div>
        )}
      </div>
    </Container>
  );
};

export default memo(FormulatedQuestion);
