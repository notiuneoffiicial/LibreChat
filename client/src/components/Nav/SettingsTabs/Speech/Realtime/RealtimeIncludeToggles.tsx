import { useCallback, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { Checkbox } from '@librechat/client';
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
    output?: Record<string, unknown> & { enabled?: boolean };
  };
};

export default function RealtimeIncludeToggles() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const session = ensureSession(realtimeOptions?.session) as SessionState;
  const include = useMemo(() => (Array.isArray(realtimeOptions?.include) ? realtimeOptions?.include : []), [
    realtimeOptions?.include,
  ]);
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

  const toggledModalities = useMemo(() => {
    const selections = new Set<string>();

    if (session.textOutput !== false) {
      selections.add('text');
    }

    if (audioOutputEnabled || session.speechToSpeech === true || session.speech_to_speech === true) {
      selections.add('audio');
    }

    include.forEach((entry) => {
      if (typeof entry !== 'string') {
        return;
      }
      const normalized = entry.toLowerCase();
      if (normalized === 'text' || normalized === 'audio') {
        selections.add(normalized);
      }
    });

    return selections;
  }, [audioOutputEnabled, include, session.speechToSpeech, session.speech_to_speech, session.textOutput]);
  const isSpeechMode = useMemo(() => {
    if (session.type === 'transcription') {
      return false;
    }

    if (session.speechToSpeech === true || session.speech_to_speech === true) {
      return true;
    }

    return audioOutputEnabled;
  }, [audioOutputEnabled, session.speechToSpeech, session.speech_to_speech, session.type]);

  const toggleValue = useCallback(
    (value: string, enabled: boolean) => {
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const baseSession = ensureSession(existing.session) as SessionState;
        const nextSession: SessionState = { ...baseSession };

        if (value === 'text') {
          if (enabled) {
            nextSession.textOutput = true;
          } else {
            nextSession.textOutput = false;
          }
        }

        if (value === 'audio') {
          const nextAudio = { ...(baseSession.audio ?? {}) } as Record<string, unknown>;
          const nextOutput = { ...((nextAudio.output as Record<string, unknown>) ?? {}) };

          if (enabled) {
            nextSession.audioOutput = true;
            nextOutput.enabled = true;
          } else {
            nextSession.audioOutput = false;
            if ('enabled' in nextOutput) {
              nextOutput.enabled = false;
            }
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
    },
    [setRealtimeOptions],
  );

  const handleText = useCallback(
    (checked: boolean | string) => {
      toggleValue('text', checked === true);
    },
    [toggleValue],
  );

  const handleAudio = useCallback(
    (checked: boolean | string) => {
      toggleValue('audio', checked === true);
    },
    [toggleValue],
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-text-primary">{localize('com_nav_realtime_include')}</span>
      <label className="flex items-center gap-2 text-sm text-text-primary" htmlFor="realtime-include-text">
        <Checkbox
          id="realtime-include-text"
          data-testid="realtime-include-text"
          checked={toggledModalities.has('text')}
          onCheckedChange={handleText}
        />
        {localize('com_nav_realtime_include_text')}
      </label>
      <label className="flex items-center gap-2 text-sm text-text-primary" htmlFor="realtime-include-audio">
        <Checkbox
          id="realtime-include-audio"
          data-testid="realtime-include-audio"
          checked={toggledModalities.has('audio')}
          onCheckedChange={handleAudio}
          disabled={!isSpeechMode}
        />
        <span className={!isSpeechMode ? 'text-text-secondary' : undefined}>
          {localize('com_nav_realtime_include_audio')}
        </span>
      </label>
      {!isSpeechMode && (
        <p className="text-xs text-text-secondary">{localize('com_nav_realtime_include_audio_disabled')}</p>
      )}
    </div>
  );
}
