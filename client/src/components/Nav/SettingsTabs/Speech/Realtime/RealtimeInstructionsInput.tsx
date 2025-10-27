import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { TextareaAutosize } from '@librechat/client';
import { useRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const ensureSession = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

export default function RealtimeInstructionsInput() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const session = ensureSession(realtimeOptions?.session);
  const value = (session.instructions as string | undefined) ?? '';

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const nextInstructions = event.target.value;
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const nextSession = ensureSession(existing.session);
        return {
          ...existing,
          session: {
            ...nextSession,
            instructions: nextInstructions,
          },
        };
      });
    },
    [setRealtimeOptions],
  );

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="realtime-instructions" className="text-sm font-medium text-text-primary">
        {localize('com_nav_realtime_instructions')}
      </label>
      <TextareaAutosize
        id="realtime-instructions"
        data-testid="realtime-instructions"
        minRows={2}
        value={value}
        onChange={handleChange}
        placeholder={localize('com_nav_realtime_instructions_placeholder')}
        className="w-full rounded-md border border-border-medium bg-transparent px-2 py-2 text-sm text-text-primary"
      />
    </div>
  );
}
