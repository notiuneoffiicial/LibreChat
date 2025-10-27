import type {
  PromptComposerDiagnostics,
  PromptDiffStats,
  PromptGuardrailState,
  PromptGuardrailVerdict,
} from '@librechat/data-schemas';

export type MetaPromptConversationPhase = 'onboarding' | 'deep_dive' | 'wrap_up';

export interface MetaPromptComposerMessage {
  role: string;
  text?: string | null;
  summary?: string | null;
  content?: Array<Record<string, unknown>> | null;
  createdAt?: string | Date | null;
  metadata?: Record<string, unknown> | null;
}

export interface MetaPromptConversationSnapshot {
  conversationId: string;
  defaultPrefix?: string | null;
  currentPrefix?: string | null;
  tags?: string[] | null;
  tools?: string[] | null;
  reasoningSummary?: string | null;
  guardrailState?: PromptGuardrailState | null;
}

export interface MetaPromptComposerOptions {
  featureEnabled?: boolean;
  maxDiffRatio?: number;
  maxLength?: number;
  minUserMessagesForOverride?: number;
  forbiddenPhrases?: string[];
  crisisKeywords?: string[];
  frustrationThreshold?: number;
  wrapUpKeywords?: string[];
  domainTags?: string[];
  codeKeywords?: string[];
  empathyAppendix?: string;
  engineeringAppendix?: string;
  wrapUpAppendix?: string;
  crisisOverridePrefix?: string;
}

export interface MetaPromptComposerInput {
  conversation: MetaPromptConversationSnapshot;
  messages?: MetaPromptComposerMessage[];
  options?: MetaPromptComposerOptions;
  now?: Date;
}

export interface MetaPromptComposerResult {
  promptPrefix: string;
  diagnostics: PromptComposerDiagnostics;
  guardrailStatus: PromptGuardrailVerdict;
}

const DEFAULT_CRISIS_KEYWORDS = [
  'self-harm',
  'self harm',
  'suicide',
  'kill myself',
  'hurt myself',
  'end my life',
  'die',
  'end it all',
  'cut myself',
  'overdose',
];

const DEFAULT_NEGATIVE_KEYWORDS = [
  'frustrated',
  'angry',
  'annoyed',
  'upset',
  'irritated',
  'hate',
  'broken',
  'problem',
  'issue',
  "doesn't work",
  'error',
  'bug',
  'failing',
  'stuck',
];

const DEFAULT_POSITIVE_KEYWORDS = [
  'thanks',
  'thank you',
  'great',
  'awesome',
  'fantastic',
  'appreciate',
  'love',
  'perfect',
  'excellent',
];

const DEFAULT_URGENT_KEYWORDS = ['urgent', 'asap', 'immediately', 'right away', 'now'];

const DEFAULT_WRAP_UP_KEYWORDS = [
  'thanks',
  'thank you',
  "that's all",
  'that is all',
  'bye',
  'goodbye',
  'talk soon',
  'no further questions',
  'got it',
  'understood',
  'done here',
];

const DEFAULT_CODE_KEYWORDS = [
  'function',
  'bug',
  'stack trace',
  'code',
  'compile',
  'program',
  'script',
  'exception',
  'unit test',
  'refactor',
];

const DEFAULT_DOMAIN_TAGS = ['engineering', 'developer', 'coding', 'software'];

const DEFAULT_OPTIONS: Required<
  Pick<
    MetaPromptComposerOptions,
    | 'featureEnabled'
    | 'maxDiffRatio'
    | 'maxLength'
    | 'minUserMessagesForOverride'
    | 'forbiddenPhrases'
    | 'crisisKeywords'
    | 'frustrationThreshold'
    | 'wrapUpKeywords'
    | 'domainTags'
    | 'codeKeywords'
    | 'empathyAppendix'
    | 'engineeringAppendix'
    | 'wrapUpAppendix'
    | 'crisisOverridePrefix'
  >
> = {
  featureEnabled: true,
  maxDiffRatio: 12,
  maxLength: 1800,
  minUserMessagesForOverride: 2,
  forbiddenPhrases: ['ignore all previous instructions', 'override safety protocols'],
  crisisKeywords: DEFAULT_CRISIS_KEYWORDS,
  frustrationThreshold: -0.6,
  wrapUpKeywords: DEFAULT_WRAP_UP_KEYWORDS,
  domainTags: DEFAULT_DOMAIN_TAGS,
  codeKeywords: DEFAULT_CODE_KEYWORDS,
  empathyAppendix:
    'Before proposing solutions, acknowledge the user\'s frustration in one sentence and confirm you understand the goal.',
  engineeringAppendix:
    'You are partnering with the user as a senior software engineer. Ask for relevant repo context, suggest tests when proposing changes, and reason explicitly about trade-offs.',
  wrapUpAppendix:
    'Provide a brief closing summary with next steps and ask if any additional help is needed before ending the conversation.',
  crisisOverridePrefix:
    'You are a crisis support assistant. Respond with empathy, ensure the user feels heard, and encourage contacting local emergency services or trusted individuals. Do not provide policy-violating instructions.',
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

function safeLower(value?: string | null): string {
  return (value ?? '').toLowerCase();
}

function matchKeywords(text: string, keywords: string[]): string[] {
  if (!text) {
    return [];
  }
  const lowered = text.toLowerCase();
  const matches = new Set<string>();
  for (const keyword of keywords) {
    const term = keyword.toLowerCase();
    if (term && lowered.includes(term)) {
      matches.add(term);
    }
  }
  return Array.from(matches);
}

function extractText(message?: MetaPromptComposerMessage): string {
  if (!message) {
    return '';
  }

  if (typeof message.text === 'string' && message.text.trim()) {
    return message.text;
  }

  if (typeof message.summary === 'string' && message.summary.trim()) {
    return message.summary;
  }

  if (Array.isArray(message.content)) {
    const fragments: string[] = [];
    for (const part of message.content) {
      if (!part) {
        continue;
      }
      if (typeof part === 'string') {
        fragments.push(part);
        continue;
      }
      const candidate =
        (typeof part.text === 'string' && part.text) ||
        (typeof part.value === 'string' && part.value) ||
        (typeof (part as Record<string, unknown>).message === 'string'
          ? ((part as Record<string, unknown>).message as string)
          : undefined);
      if (typeof candidate === 'string') {
        fragments.push(candidate);
      }
    }
    if (fragments.length) {
      return fragments.join(' ');
    }
  }

  return '';
}

function computeSentimentScore(text: string): { score: number; keywords: string[] } {
  if (!text) {
    return { score: 0, keywords: [] };
  }

  const lower = text.toLowerCase();
  const hits: string[] = [];
  let rawScore = 0;

  for (const term of DEFAULT_POSITIVE_KEYWORDS) {
    const lowered = term.toLowerCase();
    if (lower.includes(lowered)) {
      rawScore += 1;
      hits.push(lowered);
    }
  }

  for (const term of DEFAULT_NEGATIVE_KEYWORDS) {
    const lowered = term.toLowerCase();
    if (lower.includes(lowered)) {
      rawScore -= 1;
      hits.push(lowered);
    }
  }

  for (const term of DEFAULT_URGENT_KEYWORDS) {
    const lowered = term.toLowerCase();
    if (lower.includes(lowered)) {
      rawScore -= 0.5;
      hits.push(lowered);
    }
  }

  const normalized = clamp(rawScore / Math.max(hits.length || 1, 1), -1, 1);
  return { score: Number(normalized.toFixed(3)), keywords: hits };
}

function determineSentimentLabel(score: number): 'positive' | 'neutral' | 'negative' {
  if (score > 0.25) {
    return 'positive';
  }
  if (score < -0.25) {
    return 'negative';
  }
  return 'neutral';
}

function determinePhase(
  userMessageCount: number,
  reasoningSummary: string | null | undefined,
  lastUserText: string,
  wrapUpKeywords: string[],
): MetaPromptConversationPhase {
  if (matchKeywords(lastUserText, wrapUpKeywords).length) {
    return 'wrap_up';
  }
  if (userMessageCount > 2 || (reasoningSummary && reasoningSummary.length > 160)) {
    return 'deep_dive';
  }
  return 'onboarding';
}

function detectDomain(
  conversation: MetaPromptConversationSnapshot,
  lastUserText: string,
  domainTags: string[],
  codeKeywords: string[],
): { triggered: boolean; reason?: string } {
  const loweredTags = new Set((conversation.tags ?? []).map((tag) => tag.toLowerCase()));
  for (const tag of domainTags) {
    if (loweredTags.has(tag.toLowerCase())) {
      return { triggered: true, reason: `tag:${tag.toLowerCase()}` };
    }
  }

  const loweredTools = new Set((conversation.tools ?? []).map((tool) => tool.toLowerCase()));
  if (loweredTools.has('code_interpreter') || loweredTools.has('python')) {
    return { triggered: true, reason: 'tool:code' };
  }

  const loweredText = lastUserText.toLowerCase();
  for (const keyword of codeKeywords) {
    const term = keyword.toLowerCase();
    if (term && loweredText.includes(term)) {
      return { triggered: true, reason: `keyword:${term}` };
    }
  }

  return { triggered: false };
}

function detectFrustration(sentiments: number[], threshold: number): boolean {
  if (sentiments.length < 2) {
    return false;
  }
  const lastTwo = sentiments.slice(-2);
  const average =
    lastTwo.reduce((accumulator, value) => accumulator + value, 0) / Math.max(lastTwo.length, 1);
  return average <= threshold;
}

function appendBlock(base: string, block: string): string {
  const trimmedBlock = block.trim();
  if (!trimmedBlock) {
    return base?.trim() ?? '';
  }
  const normalizedBase = base?.trim() ?? '';
  if (!normalizedBase) {
    return trimmedBlock;
  }
  if (normalizedBase.includes(trimmedBlock)) {
    return normalizedBase;
  }
  return `${normalizedBase}\n\n${trimmedBlock}`;
}

function createDiffStats(previous: string, candidate: string): PromptDiffStats {
  const prevLength = previous.trim().length;
  const candidateLength = candidate.trim().length;
  const added = Math.max(candidateLength - prevLength, 0);
  const removed = Math.max(prevLength - candidateLength, 0);
  const ratio = prevLength === 0 ? (candidateLength > 0 ? 1 : 0) : Math.abs(candidateLength - prevLength) / prevLength;
  return {
    added,
    removed,
    diffRatio: Number(ratio.toFixed(3)),
  };
}

function countApproxTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function evaluateGuardrails(
  previous: string,
  candidate: string,
  options: Pick<
    Required<MetaPromptComposerOptions>,
    'maxDiffRatio' | 'maxLength' | 'forbiddenPhrases'
  >,
): { accepted: boolean; reasons: string[]; diff: PromptDiffStats; tokens: number } {
  const diff = createDiffStats(previous, candidate);
  const tokens = countApproxTokens(candidate);
  const reasons: string[] = [];

  if (candidate.length > options.maxLength) {
    reasons.push('length_exceeded');
  }

  if (diff.diffRatio > options.maxDiffRatio) {
    reasons.push('diff_ratio_exceeded');
  }

  const loweredCandidate = candidate.toLowerCase();
  for (const phrase of options.forbiddenPhrases) {
    const lowered = phrase.toLowerCase();
    if (lowered && loweredCandidate.includes(lowered)) {
      reasons.push(`forbidden:${lowered}`);
    }
  }

  return {
    accepted: reasons.length === 0,
    reasons,
    diff,
    tokens,
  };
}

export function composeMetaPrompt(
  input: MetaPromptComposerInput,
): MetaPromptComposerResult {
  const mergedOptions: Required<MetaPromptComposerOptions> = {
    ...DEFAULT_OPTIONS,
    ...(input.options ?? {}),
  } as Required<MetaPromptComposerOptions>;

  const now = input.now ?? new Date();
  const basePrefix = input.conversation.currentPrefix ?? input.conversation.defaultPrefix ?? '';
  let candidatePrefix = basePrefix;

  const messages = [...(input.messages ?? [])];
  messages.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });

  const userMessages = messages.filter((message) => safeLower(message.role) === 'user');
  const sentimentResults = userMessages.map((message) => computeSentimentScore(extractText(message)));
  const sentimentScores = sentimentResults.map((result) => result.score);

  const sentimentKeywords = sentimentResults.flatMap((result) => result.keywords);

  const lastUserText = userMessages.length ? extractText(userMessages[userMessages.length - 1]) : '';
  const crisisMatches = matchKeywords(lastUserText, mergedOptions.crisisKeywords);

  const conversationPhase = determinePhase(
    userMessages.length,
    input.conversation.reasoningSummary,
    lastUserText,
    mergedOptions.wrapUpKeywords,
  );

  const appliedRules: string[] = [];
  const triggeredKeywords = new Set<string>([...sentimentKeywords, ...crisisMatches]);
  let notes: string | undefined;
  let guardrailStatus: PromptGuardrailVerdict = 'accepted';

  const averageSentiment =
    sentimentScores.length > 0
      ? Number(
          (
            sentimentScores.reduce((accumulator, value) => accumulator + value, 0) /
            sentimentScores.length
          ).toFixed(3),
        )
      : 0;

  const sentimentLabel = determineSentimentLabel(averageSentiment);

  const guardrailState = input.conversation.guardrailState;
  const safetyEscalation =
    crisisMatches.length > 0 ||
    guardrailState?.blocked === true ||
    (guardrailState?.lastStatus === 'rejected' &&
      (guardrailState.reasons ?? []).some((reason) => reason.toLowerCase().includes('safety')));

  const eligibleForOverride =
    mergedOptions.featureEnabled !== false &&
    userMessages.length >= mergedOptions.minUserMessagesForOverride;

  if (mergedOptions.featureEnabled !== false) {
    if (safetyEscalation) {
      candidatePrefix = mergedOptions.crisisOverridePrefix;
      appliedRules.push('safety-escalation');
      notes = 'Applied crisis override based on safety signals.';
    } else if (eligibleForOverride) {
      if (detectFrustration(sentimentScores, mergedOptions.frustrationThreshold)) {
        candidatePrefix = appendBlock(candidatePrefix, mergedOptions.empathyAppendix);
        appliedRules.push('frustration-empathy');
        notes = 'Elevated empathy instructions after sustained frustration.';
      }

      const domainResult = detectDomain(
        input.conversation,
        lastUserText,
        mergedOptions.domainTags,
        mergedOptions.codeKeywords,
      );

      if (domainResult.triggered) {
        candidatePrefix = appendBlock(candidatePrefix, mergedOptions.engineeringAppendix);
        appliedRules.push('domain-engineering');
        if (domainResult.reason) {
          triggeredKeywords.add(domainResult.reason);
        }
      }

      if (conversationPhase === 'wrap_up') {
        candidatePrefix = input.conversation.defaultPrefix ?? '';
        if (mergedOptions.wrapUpAppendix) {
          candidatePrefix = appendBlock(candidatePrefix, mergedOptions.wrapUpAppendix);
        }
        appliedRules.push('wrap-up-reset');
        notes = 'Reverted to default framing for wrap-up.';
      }
    }
  }

  const guardrailEvaluation = evaluateGuardrails(basePrefix, candidatePrefix, {
    maxDiffRatio: mergedOptions.maxDiffRatio,
    maxLength: mergedOptions.maxLength,
    forbiddenPhrases: mergedOptions.forbiddenPhrases,
  });

  if (!guardrailEvaluation.accepted && candidatePrefix !== basePrefix) {
    guardrailStatus = 'rolled_back';
    candidatePrefix = basePrefix;
    guardrailEvaluation.reasons.forEach((reason) => triggeredKeywords.add(reason));
    notes = notes
      ? `${notes} Guardrails reverted the proposed change.`
      : 'Guardrails reverted the proposed change.';
  }

  const diagnostics: PromptComposerDiagnostics = {
    revision: 0,
    appliedRules,
    conversationPhase,
    sentimentScore: averageSentiment,
    sentimentLabel,
    guardrailReasons: guardrailEvaluation.reasons,
    diff: guardrailEvaluation.diff,
    tokens: guardrailEvaluation.tokens,
    sourcePrefix: input.conversation.currentPrefix ? 'current' : 'default',
    timestamp: now.toISOString(),
    notes,
    triggeredKeywords: triggeredKeywords.size ? Array.from(triggeredKeywords) : undefined,
  };

  if (guardrailStatus === 'rolled_back' && guardrailEvaluation.reasons.length) {
    const reasonSummary = guardrailEvaluation.reasons.join(', ');
    diagnostics.notes = diagnostics.notes
      ? `${diagnostics.notes} Reasons: ${reasonSummary}.`
      : `Guardrails reverted the change. Reasons: ${reasonSummary}.`;
  }

  return {
    promptPrefix: candidatePrefix,
    diagnostics,
    guardrailStatus,
  };
}

export const DEFAULT_META_PROMPT_OPTIONS = DEFAULT_OPTIONS;
