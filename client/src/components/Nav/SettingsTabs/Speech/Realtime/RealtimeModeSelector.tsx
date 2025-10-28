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
    const session = realtimeOptions?.session;
    if (!session || typeof session !== 'object') {
      return 'conversation';
    }

    if (session.type === 'transcription') {
      return 'speech_to_text';
    }

    if (session.speechToSpeech === true || session.speech_to_speech === true) {
      return 'speech_to_speech';
    }

    return 'conversation';
  }, [realtimeOptions?.session]);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextMode = event.target.value;

    setRealtimeOptions((current) => {
      const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
      const session = ensureSession(existing.session);
      const include = Array.isArray(existing.include) ? existing.include : [];

      const modalitySet = new Set(
        Array.isArray(session.modalities)
          ? session.modalities.map((entry) => entry.toLowerCase())
          : Array.isArray(session.output_modalities)
            ? session.output_modalities.map((entry) => entry.toLowerCase())
            : [],
      );
      const includeSet = new Set(
        include
          .filter((entry) => typeof entry === 'string')
          .map((entry) => entry.toLowerCase()),
      );

      let nextType: string;
      let enableSpeech = false;

      switch (nextMode) {
        case 'speech_to_text':
          nextType = 'transcription';
          enableSpeech = false;
          modalitySet.delete('audio');
          includeSet.delete('audio');
          break;
        case 'speech_to_speech':
          nextType = 'realtime';
          enableSpeech = true;
          modalitySet.add('audio');
          includeSet.add('text');
          break;
        default:
          nextType = 'realtime';
          enableSpeech = false;
          modalitySet.delete('audio');
          includeSet.delete('audio');
          break;
      }

      modalitySet.add('text');
      includeSet.delete('text');

      const nextSession: Record<string, unknown> = {
        ...session,
        type: nextType,
        modalities: Array.from(modalitySet),
      };

      if (enableSpeech) {
        nextSession.speechToSpeech = true;
      } else {
        delete nextSession.speechToSpeech;
        delete nextSession.speech_to_speech;
      }

      delete nextSession.output_modalities;

      return {
        ...existing,
        session: nextSession,
        include: Array.from(includeSet),
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
