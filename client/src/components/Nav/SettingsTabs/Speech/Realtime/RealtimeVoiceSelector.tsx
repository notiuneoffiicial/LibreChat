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

  const sessionModalities = useMemo(() => {
    const base = Array.isArray(session.modalities)
      ? session.modalities
      : Array.isArray(session.output_modalities)
        ? session.output_modalities
        : [];
    return base.map((entry) => entry.toLowerCase());
  }, [session.modalities, session.output_modalities]);

  const includeValues = useMemo(() => {
    const fromInclude = Array.isArray(realtimeOptions?.include) ? realtimeOptions.include : [];
    const sessionInclude = Array.isArray(session.include) ? session.include : [];
    return [...fromInclude, ...sessionInclude].map((entry) =>
      typeof entry === 'string' ? entry.toLowerCase() : '',
    );
  }, [realtimeOptions?.include, session.include]);

  const isSpeechMode = useMemo(() => {
    if (session.type === 'transcription') {
      return false;
    }

    if (session.speechToSpeech === true || session.speech_to_speech === true) {
      return true;
    }

    if (sessionModalities.some((entry) => entry === 'audio')) {
      return true;
    }

    return includeValues.some((entry) => entry === 'audio');
  }, [includeValues, session.speechToSpeech, session.speech_to_speech, session.type, sessionModalities]);

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
