import { memo } from 'react';
import { ThinkingContent } from '~/components/Artifacts/Thinking';
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
      <div className="flex flex-col gap-2 my-2">
        {!!thought && (
          <div className="text-text-secondary">
            <ThinkingContent isPart={true}>{thought}</ThinkingContent>
          </div>
        )}
        {!!question && (
          <div className={cn('text-lg font-medium tracking-tight shimmer')}>
            {question}
          </div>
        )}
      </div>
    </Container>
  );
};

export default memo(FormulatedQuestion);
