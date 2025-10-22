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

export default function ReasonToggle() {
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

  const handleToggle = useCallback(
    ({ value }: ToggleArgs) => {
      if (typeof value !== 'boolean') {
        return;
      }

      if (!onSelectSpec || !reasonSpec || !chatSpec || isSubmitting) {
        return;
      }

      if ((value && isReasoning) || (!value && !isReasoning)) {
        return;
      }

      const targetSpec = value ? reasonSpec : chatSpec;
      onSelectSpec(targetSpec);
    },
    [onSelectSpec, reasonSpec, chatSpec, isSubmitting, isReasoning],
  );

  if (!reasonSpec || !chatSpec) {
    return null;
  }

  return (
    <CheckboxButton
      className="max-w-fit"
      checked={isReasoning}
      setValue={handleToggle}
      label="Reason"
      isCheckedClassName="border-purple-500/40 bg-purple-500/10 hover:bg-purple-600/10"
      icon={<Brain className="icon-md" />}
    />
  );
}
