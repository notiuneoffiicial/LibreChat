import { useCallback, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { Checkbox } from '@librechat/client';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const ensureSession = (value: unknown) =>
  value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};

export default function RealtimeIncludeToggles() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const include = useMemo(() => (Array.isArray(realtimeOptions?.include) ? realtimeOptions?.include : []), [
    realtimeOptions?.include,
  ]);
  const session = ensureSession(realtimeOptions?.session);
  const sessionModalities = useMemo(() => {
    const base = Array.isArray(session.modalities)
      ? session.modalities
      : Array.isArray(session.output_modalities)
        ? session.output_modalities
        : [];
    return base.map((entry) => entry.toLowerCase());
  }, [session.modalities, session.output_modalities]);
  const toggledModalities = useMemo(() => {
    const selections = new Set<string>();
    sessionModalities.forEach((entry) => {
      if (typeof entry === 'string') {
        selections.add(entry.toLowerCase());
      }
    });
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
  }, [include, sessionModalities]);
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

    return include.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'audio');
  }, [include, session.modalities, session.output_modalities, session.speechToSpeech, session.speech_to_speech, session.type, sessionModalities]);

  const toggleValue = useCallback(
    (value: string, enabled: boolean) => {
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const baseSession = ensureSession(existing.session);
        const currentModalities = Array.isArray(baseSession.modalities)
          ? baseSession.modalities.map((entry) => entry.toLowerCase())
          : Array.isArray(baseSession.output_modalities)
            ? baseSession.output_modalities.map((entry) => entry.toLowerCase())
            : [];
        const nextModalities = new Set(currentModalities);

        if (enabled) {
          nextModalities.add(value);
        } else {
          nextModalities.delete(value);
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

        const nextSession: Record<string, unknown> = { ...baseSession };
        if (nextModalities.size > 0) {
          nextSession.modalities = Array.from(nextModalities);
        } else {
          delete nextSession.modalities;
        }
        delete nextSession.output_modalities;

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
