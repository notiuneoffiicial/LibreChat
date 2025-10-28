import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useRecoilState } from 'recoil';
import { Input } from '@librechat/client';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const ensureSession = (value: unknown) =>
  value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};

type SessionState = Record<string, unknown> & {
  type?: string;
  textOutput?: boolean;
  audioOutput?: boolean;
  speechToSpeech?: boolean;
  speech_to_speech?: boolean;
  audio?: {
    output?: Record<string, unknown> & { enabled?: boolean; voice?: string };
  };
};

export default function RealtimeVoiceSelector() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const session = ensureSession(realtimeOptions?.session) as SessionState;
  const currentVoice = session.audio?.output?.voice;
  const voice = typeof currentVoice === 'string' ? currentVoice : '';

  const audioOutputEnabled = useMemo(() => {
    if (typeof session.audioOutput === 'boolean') {
      return session.audioOutput;
    }

    const audioOutput = session.audio?.output;
    if (!audioOutput) {
      return false;
    }

    if (typeof audioOutput.enabled === 'boolean') {
      return audioOutput.enabled;
    }

    return Object.keys(audioOutput).length > 0;
  }, [session.audio?.output, session.audioOutput]);

  const isSpeechMode = useMemo(() => {
    if (session.type === 'transcription') {
      return false;
    }

    if (session.speechToSpeech === true || session.speech_to_speech === true) {
      return true;
    }

    return audioOutputEnabled;
  }, [audioOutputEnabled, session.speechToSpeech, session.speech_to_speech, session.type]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextVoice = event.target.value;
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const nextSession = ensureSession(existing.session);
        const nextAudio = { ...(nextSession.audio ?? {}) } as Record<string, unknown>;
        const nextOutput = { ...((nextAudio.output as Record<string, unknown>) ?? {}) };

        if (nextVoice.length > 0) {
          nextOutput.voice = nextVoice;
        } else {
          delete nextOutput.voice;
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

        return {
          ...existing,
          session: {
            ...nextSession,
          },
        };
      });
    },
    [setRealtimeOptions],
  );

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="realtime-voice-input" className="text-sm font-medium text-text-primary">
        {localize('com_nav_realtime_voice')}
      </label>
      <Input
        id="realtime-voice-input"
        data-testid="realtime-voice-input"
        type="text"
        value={voice}
        onChange={handleChange}
        disabled={!isSpeechMode}
        placeholder={localize('com_nav_realtime_voice_placeholder')}
        className="h-9 w-full disabled:cursor-not-allowed"
      />
      {!isSpeechMode && (
        <p className="text-xs text-text-secondary">{localize('com_nav_realtime_voice_disabled')}</p>
      )}
    </div>
  );
}
