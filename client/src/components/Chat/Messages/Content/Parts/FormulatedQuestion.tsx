import { memo } from 'react';
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
  // Show shimmer when progress < 1, regardless of isSubmitting state
  // This ensures the indicator appears as soon as we receive the first progress event
  const isProcessing = progress < 1;
  const isComplete = progress >= 1;
  const hasQuestion = !!question && question.trim().length > 0;

  // Determine the shimmer text based on mode
  const shimmerText = mode === 'answer' ? 'Formulating answer...' : 'Formulating question...';

  // If nothing to show and not processing, hide component
  // For 'answer' mode, we hide after processing since main response will show
  if (!isProcessing && !hasQuestion) {
    return null;
  }

  return (
    <Container>
      <div className="relative my-2.5 flex flex-col gap-2">
        {/* Processing state: shimmer with streaming thought */}
        {isProcessing && (
          <div className="flex items-start gap-2.5">
            <Spinner className="size-5 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="shimmer text-sm font-medium text-token-text-secondary">
                {shimmerText}
              </span>
              {thought && (
                <span className="shimmer text-xs text-token-text-tertiary leading-relaxed max-w-prose">
                  {thought}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Complete state: show final question (only for 'question' mode) */}
        {isComplete && hasQuestion && mode === 'question' && (
          <div className="flex flex-col gap-1">
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
