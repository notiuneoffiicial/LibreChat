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

type SessionState = Record<string, unknown> & {
  type?: string;
  textOutput?: boolean;
  audioOutput?: boolean;
  speechToSpeech?: boolean;
  speech_to_speech?: boolean;
  audio?: {
    output?: Record<string, unknown> & { enabled?: boolean };
  };
};

export default function RealtimeModeSelector() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const mode = useMemo(() => {
    const session = realtimeOptions?.session as SessionState | undefined;
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
      const session = ensureSession(existing.session) as SessionState;
      const nextSession: SessionState = { ...session };

      let nextType = 'realtime';
      let enableSpeech = false;
      let enableAudioOutput = false;
      let enableTextOutput = true;

      switch (nextMode) {
        case 'speech_to_text': {
          nextType = 'transcription';
          enableSpeech = false;
          enableAudioOutput = false;
          enableTextOutput = true;
          break;
        }
        case 'speech_to_speech': {
          nextType = 'realtime';
          enableSpeech = true;
          enableAudioOutput = true;
          enableTextOutput = true;
          break;
        }
        default: {
          nextType = 'realtime';
          enableSpeech = false;
          enableAudioOutput = false;
          enableTextOutput = true;
        }
      }

      nextSession.type = nextType;
      nextSession.textOutput = enableTextOutput;
      nextSession.audioOutput = enableAudioOutput;

      const nextAudio = { ...(nextSession.audio ?? {}) } as Record<string, unknown>;
      const nextOutput = { ...((nextAudio.output as Record<string, unknown>) ?? {}) };

      if (enableAudioOutput) {
        nextOutput.enabled = true;
      } else if ('enabled' in nextOutput) {
        nextOutput.enabled = false;
      }

      if (Object.keys(nextOutput).length > 0) {
        nextAudio.output = nextOutput;
      } else {
        delete nextAudio.output;
      }

      if (Object.keys(nextAudio).length > 0) {
        nextSession.audio = nextAudio as SessionState['audio'];
      } else {
        delete nextSession.audio;
      }

      if (enableSpeech) {
        nextSession.speechToSpeech = true;
      } else {
        delete nextSession.speechToSpeech;
        delete nextSession.speech_to_speech;
      }

      const filteredInclude = Array.isArray(existing.include)
        ? existing.include.filter((entry) => {
            if (typeof entry !== 'string') {
              return false;
            }
            const normalized = entry.toLowerCase();
            return normalized !== 'text' && normalized !== 'audio';
          })
        : [];

      return {
        ...existing,
        session: nextSession,
        include: filteredInclude,
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
