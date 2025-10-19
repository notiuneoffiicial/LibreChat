import { useCallback, useMemo } from 'react';
import { Brain } from 'lucide-react';
import { CheckboxButton } from '@librechat/client';
import { useChatContext, useAssistantsMapContext } from '~/Providers';
import { useGetStartupConfig, useGetEndpointsQuery } from '~/data-provider';
import useSelectMention from '~/hooks/Input/useSelectMention';

type ToggleArgs = {
  value: boolean | string;
};

const REASONER_MODEL = 'deepseek-reasoner';
const CHAT_MODEL = 'deepseek-chat';

export default function ThinkingToggle() {
  const { conversation, newConversation, isSubmitting } = useChatContext();
  const assistantsMap = useAssistantsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig = {} } = useGetEndpointsQuery();

  const modelSpecs = useMemo(() => startupConfig?.modelSpecs?.list ?? [], [startupConfig]);

  const thinkingSpec = useMemo(
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

  const isThinking = useMemo(() => {
    const currentModel = conversation?.model ?? '';
    if (currentModel) {
      return currentModel === REASONER_MODEL;
    }

    return conversation?.spec != null && conversation.spec === thinkingSpec?.name;
  }, [conversation?.model, conversation?.spec, thinkingSpec?.name]);

  const handleToggle = useCallback(
    ({ value }: ToggleArgs) => {
      if (typeof value !== 'boolean') {
        return;
      }

      if (!onSelectSpec || !thinkingSpec || !chatSpec || isSubmitting) {
        return;
      }

      if ((value && isThinking) || (!value && !isThinking)) {
        return;
      }

      const targetSpec = value ? thinkingSpec : chatSpec;
      onSelectSpec(targetSpec);
    },
    [onSelectSpec, thinkingSpec, chatSpec, isSubmitting, isThinking],
  );

  if (!thinkingSpec || !chatSpec) {
    return null;
  }

  return (
    <CheckboxButton
      className="max-w-fit"
      checked={isThinking}
      setValue={handleToggle}
      label="Thinking"
      isCheckedClassName="border-purple-500/40 bg-purple-500/10 hover:bg-purple-600/10"
      icon={<Brain className="icon-md" />}
    />
  );
}
