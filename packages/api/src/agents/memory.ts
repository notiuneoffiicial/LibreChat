/** Memories */
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { Tools } from 'librechat-data-provider';
import { logger } from '@librechat/data-schemas';
import { Run, Providers, GraphEvents } from '@librechat/agents';
import type {
  OpenAIClientOptions,
  StreamEventData,
  ToolEndCallback,
  ClientOptions,
  EventHandler,
  ToolEndData,
  LLMConfig,
} from '@librechat/agents';
import type { TAttachment, MemoryArtifact } from 'librechat-data-provider';
import type { ObjectId, MemoryMethods } from '@librechat/data-schemas';
import type { BaseMessage } from '@langchain/core/messages';
import type { Response as ServerResponse } from 'express';
import { Tokenizer } from '~/utils';

type RequiredMemoryMethods = Pick<
  MemoryMethods,
  'setMemory' | 'deleteMemory' | 'getFormattedMemories'
>;

type ToolEndMetadata = Record<string, unknown> & {
  run_id?: string;
  thread_id?: string;
};

export interface MemoryConfig {
  validKeys?: string[];
  instructions?: string;
  llmConfig?: Partial<LLMConfig>;
  tokenLimit?: number;
  notableThreshold?: number;
}

export const memoryInstructions =
  'The system automatically stores important user information and can update or delete memories based on user requests, enabling dynamic memory management.';

const DEFAULT_NOTABLE_THRESHOLD = 0.6;

const REMEMBER_PATTERN = /\b(?:please\s+)?remember\b/i;
const NEGATIVE_REMEMBER_PATTERN = /\b(?:don't|do not)\s+remember\b/i;

const POSITIVE_REQUEST_PATTERNS = [
  /\bdon't forget\b/i,
  /\bstore (?:this|that|it)\b/i,
  /\bsave (?:this|that|it)\b/i,
  /\bnote (?:this|that)\b/i,
  /\bwrite this down\b/i,
  /\bkeep this in mind\b/i,
];

const DELETE_REQUEST_PATTERNS = [
  /\b(?:please\s+)?forget (?:that|about|my|this|it|everything)\b/i,
  /\bdelete the memory\b/i,
  /\bremove the memory\b/i,
  /\bforget the memory\b/i,
];

const MEMORY_OPT_OUT_PATTERNS = [
  /\b(?:please\s+)?don't (?:remember|save|store|keep)\b/i,
  /\bdo not (?:remember|save|store|keep)\b/i,
  /\bno need to remember\b/i,
  /\bplease ignore this\b/i,
];

const NOTABLE_PATTERNS = [
  { regex: /\bmy name is\b/i, weight: 0.9 },
  { regex: /\bcall me\b/i, weight: 0.75 },
  { regex: /\bmy birthday\b/i, weight: 0.85 },
  { regex: /\bi (?:was born|am turning|turn)\b/i, weight: 0.6 },
  { regex: /\bmy (?:phone number|email|address)\b/i, weight: 0.85 },
  { regex: /\bi (?:live|am from|reside|work) in\b/i, weight: 0.55 },
  { regex: /\bmy (?:favorite|favourite)\b/i, weight: 0.55 },
  { regex: /\bi (?:prefer|love|like)\b/i, weight: 0.35 },
  { regex: /\bi (?:have|am) (?:allergic|allergies|diabetic|celiac)\b/i, weight: 0.75 },
  { regex: /\bi have (?:an? )?(?:allergy|condition|diagnosis)\b/i, weight: 0.7 },
  { regex: /\bappointment on\b/i, weight: 0.45 },
  { regex: /\bmeeting on\b/i, weight: 0.45 },
  { regex: /\bi will (?:have|attend|be at) (?:a )?(?:meeting|appointment|call)\b/i, weight: 0.45 },
  { regex: /\bmy (?:partner|spouse|wife|husband|son|daughter|kid|children)\b/i, weight: 0.4 },
  { regex: /\bproject deadline\b/i, weight: 0.35 },
  { regex: /\bi'm planning to\b/i, weight: 0.35 },
];

const clampThreshold = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return DEFAULT_NOTABLE_THRESHOLD;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

type MessageWithRole = BaseMessage & { role?: string; lc_kwargs?: { role?: string } };

const getMessageRole = (message: MessageWithRole): string | undefined => {
  if (typeof message?.role === 'string') {
    return message.role;
  }
  if (typeof message?.lc_kwargs?.role === 'string') {
    return message.lc_kwargs.role;
  }
  const type = (message as Record<string, unknown> & { _getType?: () => string })?._getType?.();
  if (type === 'human') {
    return 'user';
  }
  if (type === 'ai') {
    return 'assistant';
  }
  return undefined;
};

type TextLike = { type?: string; text?: string; content?: string };

const getMessageText = (message: BaseMessage): string => {
  const content = (message as Record<string, unknown>).content;
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (typeof part === 'object' && part !== null) {
          if (typeof (part as TextLike).text === 'string') {
            return (part as TextLike).text as string;
          }
          if (typeof (part as TextLike).content === 'string') {
            return (part as TextLike).content as string;
          }
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  if (typeof content === 'object' && content !== null) {
    const maybeText = content as TextLike;
    if (typeof maybeText.text === 'string') {
      return maybeText.text;
    }
    if (typeof maybeText.content === 'string') {
      return maybeText.content;
    }
  }
  return '';
};

const getLastUserMessageText = (messages: BaseMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as MessageWithRole;
    const role = getMessageRole(message);
    if (role === 'user') {
      return getMessageText(message);
    }
  }
  return '';
};

const computeNotableScore = (text: string): number => {
  let score = 0;
  for (const { regex, weight } of NOTABLE_PATTERNS) {
    if (regex.test(text)) {
      score = Math.min(1, score + weight);
    }
  }

  const pronounMatches = text.match(/\bmy\b/gi)?.length ?? 0;
  if (pronounMatches >= 2) {
    score = Math.min(1, score + 0.1);
  }

  if (
    /\b(?:today|tomorrow|next week|next month)\b/i.test(text) &&
    /\b(meeting|appointment|trip|event)\b/i.test(text)
  ) {
    score = Math.min(1, score + 0.2);
  }

  return Math.min(1, score);
};

export type MemoryClassificationReason =
  | 'explicit_request'
  | 'classifier'
  | 'opt_out'
  | 'noise'
  | 'token_limit';

export interface MemoryClassificationResult {
  shouldProcess: boolean;
  score: number;
  reason: MemoryClassificationReason;
  explicitRequest: boolean;
  explicitOptOut: boolean;
}

export interface MemoryClassifierOptions {
  messages: BaseMessage[];
  threshold?: number;
  tokenLimit?: number;
  totalTokens?: number;
}

export function classifyMemoryWindow({
  messages,
  threshold,
  tokenLimit,
  totalTokens = 0,
}: MemoryClassifierOptions): MemoryClassificationResult {
  const normalizedThreshold = clampThreshold(
    typeof threshold === 'number' ? threshold : DEFAULT_NOTABLE_THRESHOLD,
  );
  const lastUserText = getLastUserMessageText(messages).trim();

  if (!lastUserText) {
    return {
      shouldProcess: false,
      score: 0,
      reason: 'noise',
      explicitRequest: false,
      explicitOptOut: false,
    };
  }

  const normalizedText = lastUserText.toLowerCase();
  const hasRememberRequest =
    REMEMBER_PATTERN.test(normalizedText) && !NEGATIVE_REMEMBER_PATTERN.test(normalizedText);
  const hasPositiveRequest =
    hasRememberRequest || POSITIVE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalizedText));
  const hasDeleteRequest =
    !/don't forget/.test(normalizedText) &&
    DELETE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalizedText));
  const explicitRequest = hasPositiveRequest || hasDeleteRequest;

  const explicitOptOut =
    !explicitRequest && MEMORY_OPT_OUT_PATTERNS.some((pattern) => pattern.test(normalizedText));

  const score = computeNotableScore(lastUserText);

  if (explicitOptOut) {
    return {
      shouldProcess: false,
      score,
      reason: 'opt_out',
      explicitRequest: false,
      explicitOptOut: true,
    };
  }

  if (explicitRequest) {
    return {
      shouldProcess: true,
      score: 1,
      reason: 'explicit_request',
      explicitRequest: true,
      explicitOptOut: false,
    };
  }

  if (tokenLimit != null && Number.isFinite(tokenLimit) && totalTokens >= tokenLimit) {
    return {
      shouldProcess: false,
      score,
      reason: 'token_limit',
      explicitRequest: false,
      explicitOptOut: false,
    };
  }

  if (score >= normalizedThreshold && normalizedThreshold >= 0) {
    return {
      shouldProcess: true,
      score,
      reason: 'classifier',
      explicitRequest: false,
      explicitOptOut: false,
    };
  }

  return {
    shouldProcess: false,
    score,
    reason: 'noise',
    explicitRequest: false,
    explicitOptOut: false,
  };
}

const getDefaultInstructions = (
  validKeys?: string[],
  tokenLimit?: number,
  notableThreshold?: number,
) => {
  const thresholdNote =
    typeof notableThreshold === 'number' && !Number.isNaN(notableThreshold)
      ? `${Math.round(clampThreshold(notableThreshold) * 100)}%`
      : 'the configured threshold';
  const limitSummary =
    tokenLimit != null && Number.isFinite(tokenLimit)
      ? `${tokenLimit} tokens`
      : 'the available memory capacity';

  return `Use the \`set_memory\` tool to save important information about the user. Use the \`delete_memory\` tool when the user explicitly asks you to forget or remove specific information.

Follow these rules carefully:

1. ALWAYS comply when the user explicitly asks you to remember, save, store, forget, or delete information.
2. Respect explicit opt-out language such as "don't remember/save/store this" and do not save anything in those turns.
3. You MAY autonomously save information when the classifier marks the turn as notable (score ≥ ${thresholdNote}) and saving will not exceed ${limitSummary}.
4. NEVER use memory tools when the user asks you to use other tools or invoke tools in general.
5. Memory tools are ONLY for memory actions, not for general tool usage.
6. When in doubt—and the user hasn't asked to remember or forget anything and the classifier score is below the notable threshold—END THE TURN IMMEDIATELY.

${validKeys && validKeys.length > 0 ? `VALID KEYS: ${validKeys.join(', ')}` : ''}

${
    tokenLimit ? `TOKEN LIMIT: Maximum ${tokenLimit} tokens per memory value.` : ''
  }
`;
};

/**
 * Creates a memory tool instance with user context
 */
export const createMemoryTool = ({
  userId,
  setMemory,
  validKeys,
  tokenLimit,
  totalTokens = 0,
}: {
  userId: string | ObjectId;
  setMemory: MemoryMethods['setMemory'];
  validKeys?: string[];
  tokenLimit?: number;
  totalTokens?: number;
}) => {
  const remainingTokens = tokenLimit ? tokenLimit - totalTokens : Infinity;
  const isOverflowing = tokenLimit ? remainingTokens <= 0 : false;

  return tool(
    async ({ key, value }) => {
      try {
        if (validKeys && validKeys.length > 0 && !validKeys.includes(key)) {
          logger.warn(
            `Memory Agent failed to set memory: Invalid key "${key}". Must be one of: ${validKeys.join(
              ', ',
            )}`,
          );
          return [`Invalid key "${key}". Must be one of: ${validKeys.join(', ')}`, undefined];
        }

        const tokenCount = Tokenizer.getTokenCount(value, 'o200k_base');

        if (isOverflowing) {
          const errorArtifact: Record<Tools.memory, MemoryArtifact> = {
            [Tools.memory]: {
              key: 'system',
              type: 'error',
              value: JSON.stringify({
                errorType: 'already_exceeded',
                tokenCount: Math.abs(remainingTokens),
                totalTokens: totalTokens,
                tokenLimit: tokenLimit!,
              }),
              tokenCount: totalTokens,
            },
          };
          return [`Memory storage exceeded. Cannot save new memories.`, errorArtifact];
        }

        if (tokenLimit) {
          const newTotalTokens = totalTokens + tokenCount;
          const newRemainingTokens = tokenLimit - newTotalTokens;

          if (newRemainingTokens < 0) {
            const errorArtifact: Record<Tools.memory, MemoryArtifact> = {
              [Tools.memory]: {
                key: 'system',
                type: 'error',
                value: JSON.stringify({
                  errorType: 'would_exceed',
                  tokenCount: Math.abs(newRemainingTokens),
                  totalTokens: newTotalTokens,
                  tokenLimit,
                }),
                tokenCount: totalTokens,
              },
            };
            return [`Memory storage would exceed limit. Cannot save this memory.`, errorArtifact];
          }
        }

        const artifact: Record<Tools.memory, MemoryArtifact> = {
          [Tools.memory]: {
            key,
            value,
            tokenCount,
            type: 'update',
          },
        };

        const result = await setMemory({ userId, key, value, tokenCount });
        if (result.ok) {
          logger.debug(`Memory set for key "${key}" (${tokenCount} tokens) for user "${userId}"`);
          return [`Memory set for key "${key}" (${tokenCount} tokens)`, artifact];
        }
        logger.warn(`Failed to set memory for key "${key}" for user "${userId}"`);
        return [`Failed to set memory for key "${key}"`, undefined];
      } catch (error) {
        logger.error('Memory Agent failed to set memory', error);
        return [`Error setting memory for key "${key}"`, undefined];
      }
    },
    {
      name: 'set_memory',
      description: 'Saves important information about the user into memory.',
      responseFormat: 'content_and_artifact',
      schema: z.object({
        key: z
          .string()
          .describe(
            validKeys && validKeys.length > 0
              ? `The key of the memory value. Must be one of: ${validKeys.join(', ')}`
              : 'The key identifier for this memory',
          ),
        value: z
          .string()
          .describe(
            'Value MUST be a complete sentence that fully describes relevant user information.',
          ),
      }),
    },
  );
};

/**
 * Creates a delete memory tool instance with user context
 */
const createDeleteMemoryTool = ({
  userId,
  deleteMemory,
  validKeys,
}: {
  userId: string | ObjectId;
  deleteMemory: MemoryMethods['deleteMemory'];
  validKeys?: string[];
}) => {
  return tool(
    async ({ key }) => {
      try {
        if (validKeys && validKeys.length > 0 && !validKeys.includes(key)) {
          logger.warn(
            `Memory Agent failed to delete memory: Invalid key "${key}". Must be one of: ${validKeys.join(
              ', ',
            )}`,
          );
          return [`Invalid key "${key}". Must be one of: ${validKeys.join(', ')}`, undefined];
        }

        const artifact: Record<Tools.memory, MemoryArtifact> = {
          [Tools.memory]: {
            key,
            type: 'delete',
          },
        };

        const result = await deleteMemory({ userId, key });
        if (result.ok) {
          logger.debug(`Memory deleted for key "${key}" for user "${userId}"`);
          return [`Memory deleted for key "${key}"`, artifact];
        }
        logger.warn(`Failed to delete memory for key "${key}" for user "${userId}"`);
        return [`Failed to delete memory for key "${key}"`, undefined];
      } catch (error) {
        logger.error('Memory Agent failed to delete memory', error);
        return [`Error deleting memory for key "${key}"`, undefined];
      }
    },
    {
      name: 'delete_memory',
      description:
        'Deletes specific memory data about the user using the provided key. For updating existing memories, use the `set_memory` tool instead',
      responseFormat: 'content_and_artifact',
      schema: z.object({
        key: z
          .string()
          .describe(
            validKeys && validKeys.length > 0
              ? `The key of the memory to delete. Must be one of: ${validKeys.join(', ')}`
              : 'The key identifier of the memory to delete',
          ),
      }),
    },
  );
};
export class BasicToolEndHandler implements EventHandler {
  private callback?: ToolEndCallback;
  constructor(callback?: ToolEndCallback) {
    this.callback = callback;
  }
  handle(
    event: string,
    data: StreamEventData | undefined,
    metadata?: Record<string, unknown>,
  ): void {
    if (!metadata) {
      console.warn(`Graph or metadata not found in ${event} event`);
      return;
    }
    const toolEndData = data as ToolEndData | undefined;
    if (!toolEndData?.output) {
      console.warn('No output found in tool_end event');
      return;
    }
    this.callback?.(toolEndData, metadata);
  }
}

export async function processMemory({
  res,
  userId,
  setMemory,
  deleteMemory,
  messages,
  memory,
  messageId,
  conversationId,
  validKeys,
  instructions,
  llmConfig,
  tokenLimit,
  totalTokens = 0,
}: {
  res: ServerResponse;
  setMemory: MemoryMethods['setMemory'];
  deleteMemory: MemoryMethods['deleteMemory'];
  userId: string | ObjectId;
  memory: string;
  messageId: string;
  conversationId: string;
  messages: BaseMessage[];
  validKeys?: string[];
  instructions: string;
  tokenLimit?: number;
  totalTokens?: number;
  llmConfig?: Partial<LLMConfig>;
}): Promise<(TAttachment | null)[] | undefined> {
  try {
    const memoryTool = createMemoryTool({
      userId,
      tokenLimit,
      setMemory,
      validKeys,
      totalTokens,
    });
    const deleteMemoryTool = createDeleteMemoryTool({
      userId,
      validKeys,
      deleteMemory,
    });

    const currentMemoryTokens = totalTokens;

    let memoryStatus = `# Existing memory:\n${memory ?? 'No existing memories'}`;

    if (tokenLimit) {
      const remainingTokens = tokenLimit - currentMemoryTokens;
      memoryStatus = `# Memory Status:
Current memory usage: ${currentMemoryTokens} tokens
Token limit: ${tokenLimit} tokens
Remaining capacity: ${remainingTokens} tokens

# Existing memory:
${memory ?? 'No existing memories'}`;
    }

    const defaultLLMConfig: LLMConfig = {
      provider: Providers.OPENAI,
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      streaming: false,
      disableStreaming: true,
    };

    const finalLLMConfig: ClientOptions = {
      ...defaultLLMConfig,
      ...llmConfig,
      /**
       * Ensure streaming is always disabled for memory processing
       */
      streaming: false,
      disableStreaming: true,
    };

    // Handle GPT-5+ models
    if ('model' in finalLLMConfig && /\bgpt-[5-9]\b/i.test(finalLLMConfig.model ?? '')) {
      // Remove temperature for GPT-5+ models
      delete finalLLMConfig.temperature;

      // Move maxTokens to modelKwargs for GPT-5+ models
      if ('maxTokens' in finalLLMConfig && finalLLMConfig.maxTokens != null) {
        const modelKwargs = (finalLLMConfig as OpenAIClientOptions).modelKwargs ?? {};
        const paramName =
          (finalLLMConfig as OpenAIClientOptions).useResponsesApi === true
            ? 'max_output_tokens'
            : 'max_completion_tokens';
        modelKwargs[paramName] = finalLLMConfig.maxTokens;
        delete finalLLMConfig.maxTokens;
        (finalLLMConfig as OpenAIClientOptions).modelKwargs = modelKwargs;
      }
    }

    const artifactPromises: Promise<TAttachment | null>[] = [];
    const memoryCallback = createMemoryCallback({ res, artifactPromises });
    const customHandlers = {
      [GraphEvents.TOOL_END]: new BasicToolEndHandler(memoryCallback),
    };

    const run = await Run.create({
      runId: messageId,
      graphConfig: {
        type: 'standard',
        llmConfig: finalLLMConfig,
        tools: [memoryTool, deleteMemoryTool],
        instructions,
        additional_instructions: memoryStatus,
        toolEnd: true,
      },
      customHandlers,
      returnContent: true,
    });

    const config = {
      configurable: {
        provider: llmConfig?.provider,
        thread_id: `memory-run-${conversationId}`,
      },
      streamMode: 'values',
      recursionLimit: 3,
      version: 'v2',
    } as const;

    const inputs = {
      messages,
    };
    const content = await run.processStream(inputs, config);
    if (content) {
      logger.debug('Memory Agent processed memory successfully', content);
    } else {
      logger.warn('Memory Agent processed memory but returned no content');
    }
    return await Promise.all(artifactPromises);
  } catch (error) {
    logger.error('Memory Agent failed to process memory', error);
  }
}

export async function createMemoryProcessor({
  res,
  userId,
  messageId,
  memoryMethods,
  conversationId,
  config = {},
}: {
  res: ServerResponse;
  messageId: string;
  conversationId: string;
  userId: string | ObjectId;
  memoryMethods: RequiredMemoryMethods;
  config?: MemoryConfig;
}): Promise<
  [
    string,
    (messages: BaseMessage[]) => Promise<(TAttachment | null)[] | undefined>,
    (messages: BaseMessage[]) => MemoryClassificationResult,
  ]
> {
  const { validKeys, instructions, llmConfig, tokenLimit, notableThreshold } = config;
  const finalInstructions =
    instructions || getDefaultInstructions(validKeys, tokenLimit, notableThreshold);

  const { withKeys, withoutKeys, totalTokens } = await memoryMethods.getFormattedMemories({
    userId,
  });

  const totalTokenCount = totalTokens || 0;
  const classifyWindow = (messages: BaseMessage[]) =>
    classifyMemoryWindow({
      messages,
      threshold: notableThreshold,
      tokenLimit,
      totalTokens: totalTokenCount,
    });

  return [
    withoutKeys,
    async function (messages: BaseMessage[]): Promise<(TAttachment | null)[] | undefined> {
      try {
        return await processMemory({
          res,
          userId,
          messages,
          validKeys,
          llmConfig,
          messageId,
          tokenLimit,
          conversationId,
          memory: withKeys,
          totalTokens: totalTokenCount,
          instructions: finalInstructions,
          setMemory: memoryMethods.setMemory,
          deleteMemory: memoryMethods.deleteMemory,
        });
      } catch (error) {
        logger.error('Memory Agent failed to process memory', error);
      }
    },
    classifyWindow,
  ];
}

async function handleMemoryArtifact({
  res,
  data,
  metadata,
}: {
  res: ServerResponse;
  data: ToolEndData;
  metadata?: ToolEndMetadata;
}) {
  const output = data?.output;
  if (!output) {
    return null;
  }

  if (!output.artifact) {
    return null;
  }

  const memoryArtifact = output.artifact[Tools.memory] as MemoryArtifact | undefined;
  if (!memoryArtifact) {
    return null;
  }

  const attachment: Partial<TAttachment> = {
    type: Tools.memory,
    toolCallId: output.tool_call_id,
    messageId: metadata?.run_id ?? '',
    conversationId: metadata?.thread_id ?? '',
    [Tools.memory]: memoryArtifact,
  };
  if (!res.headersSent) {
    return attachment;
  }
  res.write(`event: attachment\ndata: ${JSON.stringify(attachment)}\n\n`);
  return attachment;
}

/**
 * Creates a memory callback for handling memory artifacts
 * @param params - The parameters object
 * @param params.res - The server response object
 * @param params.artifactPromises - Array to collect artifact promises
 * @returns The memory callback function
 */
export function createMemoryCallback({
  res,
  artifactPromises,
}: {
  res: ServerResponse;
  artifactPromises: Promise<Partial<TAttachment> | null>[];
}): ToolEndCallback {
  return async (data: ToolEndData, metadata?: Record<string, unknown>) => {
    const output = data?.output;
    const memoryArtifact = output?.artifact?.[Tools.memory] as MemoryArtifact;
    if (memoryArtifact == null) {
      return;
    }
    artifactPromises.push(
      handleMemoryArtifact({ res, data, metadata }).catch((error) => {
        logger.error('Error processing memory artifact content:', error);
        return null;
      }),
    );
  };
}
