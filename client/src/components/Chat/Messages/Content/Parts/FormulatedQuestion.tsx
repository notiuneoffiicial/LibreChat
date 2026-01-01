
import { memo } from 'react';
import { cn } from '~/utils';
import Container from '../Container';

type FormulatedQuestionProps = {
  question: string;
  thought?: string;
};

const FormulatedQuestion = ({ question, thought }: FormulatedQuestionProps) => {
  const hasContent = !!question || !!thought;
  if (!hasContent) {
    return null;
  }

  return (
    <Container>
      <div className="flex flex-col gap-3 my-4">
        {!!thought && (
          <div className="relative group">
            {/* Thought Flow Visualization */}
            <div className={cn(
              'text-sm font-medium leading-relaxed tracking-wide',
              'shimmer', // Applies the silver gradient animation
              'opacity-90'
            )}
            >
              {thought}
            </div>
          </div>
        )}
        {!!question && (
          <div className={cn(
            'text-lg font-medium tracking-tight text-text-primary',
            !thought && 'shimmer' // Only shimmer question if no thought shown, or maybe both? User said "shimmer... to represent thought flow"
            // If thought is the flow, question might be the result.
            // But let's apply a subtle effect to question too if desired, or keep it solid.
            // User asked for "silver highlight... across a thin element... thinking -> response"
            // Let's keep question distinct.
          )}
          >
            {question}
          </div>
        )}
      </div>
    </Container>
  );
};

export default memo(FormulatedQuestion);
