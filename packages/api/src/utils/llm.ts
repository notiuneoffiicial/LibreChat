import { librechat } from 'librechat-data-provider';
import type { DynamicSettingProps } from 'librechat-data-provider';
import type {
  PromptComposerDiagnostics,
  PromptGuardrailVerdict,
} from '@librechat/data-schemas';
import type {
  MetaPromptComposerInput,
  MetaPromptComposerOptions,
} from '~/flow/metaPromptComposer';
import { composeMetaPrompt } from '~/flow/metaPromptComposer';

type LibreChatKeys = keyof typeof librechat;

export interface PromptInjectorContext {
  composerInput?: MetaPromptComposerInput;
  composerOptions?: MetaPromptComposerOptions;
  skipMetaPrompt?: boolean;
}

type LibreChatParams = {
  modelOptions: Omit<NonNullable<DynamicSettingProps['conversation']>, LibreChatKeys>;
  resendFiles: boolean;
  promptPrefix?: string | null;
  promptDiagnostics?: PromptComposerDiagnostics;
  guardrailStatus?: PromptGuardrailVerdict;
  maxContextTokens?: number;
  fileTokenLimit?: number;
  modelLabel?: string | null;
};

/**
 * Separates LibreChat-specific parameters from model options
 * @param options - The combined options object
 */
export function extractLibreChatParams(
  options?: DynamicSettingProps['conversation'],
  injectorContext?: PromptInjectorContext,
): LibreChatParams {
  if (!options) {
    return {
      modelOptions: {} as Omit<NonNullable<DynamicSettingProps['conversation']>, LibreChatKeys>,
      resendFiles: librechat.resendFiles.default as boolean,
    };
  }

  const modelOptions = { ...options };

  const resendFiles =
    (delete modelOptions.resendFiles, options.resendFiles) ??
    (librechat.resendFiles.default as boolean);
  let promptPrefix = (delete modelOptions.promptPrefix, options.promptPrefix);
  const maxContextTokens = (delete modelOptions.maxContextTokens, options.maxContextTokens);
  const fileTokenLimit = (delete modelOptions.fileTokenLimit, options.fileTokenLimit);
  const modelLabel = (delete modelOptions.modelLabel, options.modelLabel);

  let promptDiagnostics: PromptComposerDiagnostics | undefined;
  let guardrailStatus: PromptGuardrailVerdict | undefined;

  if (
    injectorContext?.skipMetaPrompt !== true &&
    injectorContext?.composerInput &&
    (injectorContext.composerInput.messages?.length ?? 0) > 0
  ) {
    const composerInput: MetaPromptComposerInput = {
      ...injectorContext.composerInput,
      conversation: {
        ...injectorContext.composerInput.conversation,
        currentPrefix:
          injectorContext.composerInput.conversation.currentPrefix ?? promptPrefix ?? undefined,
      },
      options: {
        ...injectorContext.composerInput.options,
        ...injectorContext.composerOptions,
      },
    };

    const result = composeMetaPrompt(composerInput);
    promptPrefix = result.promptPrefix;
    promptDiagnostics = result.diagnostics;
    guardrailStatus = result.guardrailStatus;
  }

  return {
    modelOptions: modelOptions as Omit<
      NonNullable<DynamicSettingProps['conversation']>,
      LibreChatKeys
    >,
    maxContextTokens,
    fileTokenLimit,
    promptPrefix,
    promptDiagnostics,
    guardrailStatus,
    resendFiles,
    modelLabel,
  };
}
