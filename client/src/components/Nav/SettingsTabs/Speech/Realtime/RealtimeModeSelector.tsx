import { useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const REALTIME_MODES: { value: string; labelKey: string }[] = [
  { value: 'conversation', labelKey: 'com_nav_realtime_mode_conversation' },
  { value: 'speech_to_text', labelKey: 'com_nav_realtime_mode_transcription' },
  { value: 'speech_to_speech', labelKey: 'com_nav_realtime_mode_speech' },
];

const ensureSession = (value: unknown) =>
  value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};

export default function RealtimeModeSelector() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const mode = useMemo(() => {
    return realtimeOptions?.session?.mode ?? 'conversation';
  }, [realtimeOptions?.session?.mode]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextMode = event.target.value;

    setRealtimeOptions((current) => {
      const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
      const session = ensureSession(existing.session);
      const include = Array.isArray(existing.include) ? existing.include : [];
      const shouldEnableSpeech = nextMode === 'speech_to_speech';
      const nextInclude = shouldEnableSpeech
        ? Array.from(new Set([...include, 'audio', 'text']))
        : include.filter((entry) => entry !== 'audio');

      return {
        ...existing,
        session: {
          ...session,
          mode: nextMode,
          speechToSpeech: shouldEnableSpeech,
        },
        include: nextInclude,
      };
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="realtime-mode-select" className="text-sm font-medium text-text-primary">
        {localize('com_nav_realtime_mode')}
      </label>
      <select
        id="realtime-mode-select"
        data-testid="realtime-mode-select"
        value={mode}
        onChange={handleChange}
        className="rounded-md border border-border-medium bg-transparent px-2 py-1 text-sm text-text-primary"
      >
        {REALTIME_MODES.map((option) => (
          <option key={option.value} value={option.value}>
            {localize(option.labelKey as never)}
          </option>
        ))}
      </select>
    </div>
  );
}
