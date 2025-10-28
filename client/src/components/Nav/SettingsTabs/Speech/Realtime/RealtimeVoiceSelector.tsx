import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useRecoilState } from 'recoil';
import { Input } from '@librechat/client';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const ensureSession = (value: unknown) =>
  value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};

export default function RealtimeVoiceSelector() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const session = ensureSession(realtimeOptions?.session);
  const currentVoice = session.audio?.output?.voice;
  const voice = typeof currentVoice === 'string' ? currentVoice : '';

  const isSpeechMode = useMemo(() => {
    return session.mode === 'speech_to_speech' || session.speechToSpeech === true;
  }, [session.mode, session.speechToSpeech]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextVoice = event.target.value;
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const nextSession = ensureSession(existing.session);
        const nextAudio = { ...(nextSession.audio ?? {}) };
        const nextOutput = { ...(nextAudio.output ?? {}) };

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
          nextSession.audio = nextAudio;
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
