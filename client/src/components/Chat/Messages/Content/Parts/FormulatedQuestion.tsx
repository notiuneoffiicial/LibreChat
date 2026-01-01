import { memo } from 'react';
import { Spinner } from '@librechat/client';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '~/utils';
import Container from '../Container';

type FormulatedQuestionProps = {
  question: string;
  thought?: string;
  progress?: number; // 0 to 1, where 1 means complete
  isSubmitting?: boolean;
};

/**
 * FormulatedQuestion: ChatGPT-style "Formulating question..." indicator.
 * Shows a shimmer animation while processing, then reveals the final question.
 */
const FormulatedQuestion = ({
  question,
  thought,
  progress = 1,
  isSubmitting = false,
}: FormulatedQuestionProps) => {
  // Show shimmer when progress < 1, regardless of isSubmitting state
  // This ensures the indicator appears as soon as we receive the first progress event
  const isProcessing = progress < 1;
  const isComplete = progress >= 1;
  const hasQuestion = !!question && question.trim().length > 0;

  // If nothing to show and not processing, hide component
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
                Formulating question...
              </span>
              {thought && (
                <span className="shimmer text-xs text-token-text-tertiary leading-relaxed max-w-prose">
                  {thought}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Complete state: show final question */}
        {isComplete && hasQuestion && (
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
