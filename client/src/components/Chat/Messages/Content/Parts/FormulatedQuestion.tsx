import { memo } from 'react';
import Container from '../Container';
import MarkdownLite from '../MarkdownLite';

type FormulatedQuestionProps = {
  question: string;
};

const FormulatedQuestion = ({ question }: FormulatedQuestionProps) => {
  if (!question) {
    return null;
  }

  return (
    <Container>
      <div className="rounded-xl border border-border-medium bg-surface-secondary px-3 py-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Formulated question
        </div>
        <div className="mt-1 text-sm text-text-primary">
          <MarkdownLite content={question} />
        </div>
      </div>
    </Container>
  );
};

export default memo(FormulatedQuestion);
