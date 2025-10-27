import type { Document, Types } from 'mongoose';

export type PromptGuardrailVerdict = 'accepted' | 'rejected' | 'rolled_back';

export interface PromptDiffStats {
  added: number;
  removed: number;
  diffRatio: number;
}

export interface PromptComposerDiagnostics {
  revision: number;
  appliedRules: string[];
  conversationPhase: 'onboarding' | 'deep_dive' | 'wrap_up';
  sentimentScore: number;
  sentimentLabel: 'positive' | 'neutral' | 'negative';
  guardrailReasons?: string[];
  diff?: PromptDiffStats;
  tokens?: number;
  sourcePrefix?: 'default' | 'current';
  timestamp: string;
  notes?: string;
  triggeredKeywords?: string[];
}

export interface PromptPrefixHistoryEntry {
  revision: number;
  promptPrefix: string;
  updatedAt: Date;
  source: string;
  diagnostics?: PromptComposerDiagnostics;
  guardrailStatus?: PromptGuardrailVerdict;
}

export interface PromptGuardrailState {
  lastStatus?: PromptGuardrailVerdict;
  lastStatusAt?: Date;
  blocked?: boolean;
  reasons?: string[];
  blockedPhrases?: string[];
  failureCount?: number;
}

// @ts-ignore
export interface IConversation extends Document {
  conversationId: string;
  title?: string;
  user?: string;
  messages?: Types.ObjectId[];
  agentOptions?: unknown;
  // Fields provided by conversationPreset (adjust types as needed)
  endpoint?: string;
  endpointType?: string;
  model?: string;
  region?: string;
  chatGptLabel?: string;
  examples?: unknown[];
  modelLabel?: string;
  promptPrefix?: string;
  promptPrefixDefault?: string;
  promptPrefixCurrent?: string;
  promptPrefixHistory?: PromptPrefixHistoryEntry[];
  promptGuardrailState?: PromptGuardrailState;
  temperature?: number;
  top_p?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  maxTokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  file_ids?: string[];
  resendImages?: boolean;
  promptCache?: boolean;
  thinking?: boolean;
  thinkingBudget?: number;
  system?: string;
  resendFiles?: boolean;
  imageDetail?: string;
  agent_id?: string;
  assistant_id?: string;
  instructions?: string;
  stop?: string[];
  isArchived?: boolean;
  iconURL?: string;
  greeting?: string;
  spec?: string;
  tags?: string[];
  tools?: string[];
  maxContextTokens?: number;
  max_tokens?: number;
  reasoning_effort?: string;
  reasoning_summary?: string;
  verbosity?: string;
  useResponsesApi?: boolean;
  web_search?: boolean;
  disableStreaming?: boolean;
  fileTokenLimit?: number;
  // Additional fields
  files?: string[];
  expiredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
