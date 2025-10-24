import { useCallback, useMemo } from 'react';
import { LocalStorageKeys } from 'librechat-data-provider';
import useLocalStorage from '~/hooks/useLocalStorageAlt';
import { useChatContext, useAssistantsMapContext } from '~/Providers';
import { useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import useSelectMention from '~/hooks/Input/useSelectMention';

type ToggleArgs = {
  value: boolean | string;
};

const REASONER_MODEL = 'deepseek-reasoner';
const CHAT_MODEL = 'deepseek-chat';

export type ReasonToggleState = {
  toggleState: boolean;
  handleChange: ({ value }: ToggleArgs) => void;
  debouncedChange: ({ value }: ToggleArgs) => void;
  isPinned: boolean;
  setIsPinned: (value: boolean) => void;
  isAvailable: boolean;
};

export default function useReasonToggle(): ReasonToggleState {
  const { conversation, newConversation, isSubmitting } = useChatContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig = {} } = useGetEndpointsQuery();

  const modelSpecs = useMemo(() => startupConfig?.modelSpecs?.list ?? [], [startupConfig]);

  const reasonSpec = useMemo(
    () => modelSpecs.find((spec) => spec.preset?.model === REASONER_MODEL),
    [modelSpecs],
  );

  const chatSpec = useMemo(
    () => modelSpecs.find((spec) => spec.preset?.model === CHAT_MODEL),
    [modelSpecs],
  );

  const { onSelectSpec } = useSelectMention({
    modelSpecs,
    assistantsMap,
    endpointsConfig,
    newConversation,
    returnHandlers: true,
  });

  const isReasoning = useMemo(() => {
    const currentModel = conversation?.model ?? '';
    if (currentModel) {
      return currentModel === REASONER_MODEL;
    }

    return conversation?.spec != null && conversation.spec === reasonSpec?.name;
  }, [conversation?.model, conversation?.spec, reasonSpec?.name]);

  const isAvailable = useMemo(
    () => Boolean(reasonSpec && chatSpec && onSelectSpec),
    [reasonSpec, chatSpec, onSelectSpec],
  );

  const handleChange = useCallback(
    ({ value }: ToggleArgs) => {
      if (typeof value !== 'boolean') {
        return;
      }

      if (!isAvailable || isSubmitting) {
        return;
      }

      if ((value && isReasoning) || (!value && !isReasoning)) {
        return;
      }

      const targetSpec = value ? reasonSpec : chatSpec;
      if (!targetSpec) {
        return;
      }

      onSelectSpec?.(targetSpec);
    },
    [isAvailable, isSubmitting, isReasoning, reasonSpec, chatSpec, onSelectSpec],
  );

  const debouncedChange = useMemo(() => handleChange, [handleChange]);

  const [isPinned, setIsPinned] = useLocalStorage<boolean>(
    LocalStorageKeys.REASON_TOGGLE_PINNED,
    false,
  );

  return {
    toggleState: isReasoning,
    handleChange,
    debouncedChange,
    isPinned,
    setIsPinned,
    isAvailable,
  };
}
