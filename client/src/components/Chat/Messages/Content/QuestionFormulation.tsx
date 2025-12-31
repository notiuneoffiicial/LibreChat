import { useMemo } from 'react';
import type { QuestionFormulationOutput } from 'librechat-data-provider';
import MarkdownLite from './MarkdownLite';

const formatValue = (value: string) => {
  return value.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim();
};

const parseFormulationOutput = (
  output?: string | null,
): QuestionFormulationOutput & { hasContent: boolean } => {
  if (!output) {
    return { hasContent: false };
  }

  try {
    const parsed = JSON.parse(output);
    if (parsed && typeof parsed === 'object') {
      const reasoning = parsed.reasoning ?? parsed.formulation_reasoning ?? parsed.thoughts;
      const question = parsed.question ?? parsed.query ?? parsed.formulated_question;
      if (typeof reasoning === 'string' || typeof question === 'string') {
        return {
          reasoning: typeof reasoning === 'string' ? formatValue(reasoning) : undefined,
          question: typeof question === 'string' ? formatValue(question) : undefined,
          hasContent: true,
        };
      }
    }
  } catch {
    // Fall back to regex parsing for streaming/partial payloads.
  }

  const reasoningMatch = output.match(
    /reasoning\s*[:=-]\s*([\s\S]*?)(?=\n\s*(question|query)\s*[:=-]|$)/i,
  );
  const questionMatch = output.match(/(question|query)\s*[:=-]\s*([\s\S]*?)$/i);
  const reasoning = reasoningMatch?.[1] ? formatValue(reasoningMatch[1]) : undefined;
  const question = questionMatch?.[2] ? formatValue(questionMatch[2]) : undefined;

  if (reasoning || question) {
    return {
      reasoning,
      question,
      hasContent: true,
    };
  }

  return {
    question: formatValue(output),
    hasContent: true,
  };
};

export default function QuestionFormulation({
  output,
  data,
}: {
  output?: string | null;
  data?: QuestionFormulationOutput;
}) {
  const parsed = useMemo(() => parseFormulationOutput(output), [output]);
  const reasoning = data?.reasoning ?? parsed.reasoning;
  const question = data?.question ?? parsed.question;
  const hasContent = Boolean(
    parsed.hasContent || (reasoning && reasoning.trim()) || (question && question.trim()),
  );

  if (!hasContent) {
    return null;
  }

  return (
    <div className="my-2 rounded-xl border border-border-light bg-surface-secondary p-3">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Question formulation
      </div>
      {reasoning && (
        <div className="mb-3">
          <div className="mb-1 text-xs font-semibold uppercase text-text-secondary">Reasoning</div>
          <div className="rounded-lg border border-border-medium bg-surface-primary-contrast p-2 text-sm text-text-primary">
            <MarkdownLite content={reasoning} />
          </div>
        </div>
      )}
      {question && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-text-secondary">Question</div>
          <div className="rounded-lg border border-border-medium bg-surface-primary-contrast p-2 text-sm text-text-primary">
            <MarkdownLite content={question} />
          </div>
        </div>
      )}
    </div>
  );
}
