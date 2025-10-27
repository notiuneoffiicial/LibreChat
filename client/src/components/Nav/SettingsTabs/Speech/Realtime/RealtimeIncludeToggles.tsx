import { useCallback, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import { Checkbox } from '@librechat/client';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const ensureSession = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {});

export default function RealtimeIncludeToggles() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const include = useMemo(() => (Array.isArray(realtimeOptions?.include) ? realtimeOptions?.include : []), [
    realtimeOptions?.include,
  ]);
  const session = ensureSession(realtimeOptions?.session);
  const isSpeechMode = session.mode === 'speech_to_speech' || session.speechToSpeech === true;

  const toggleValue = useCallback(
    (value: string, enabled: boolean) => {
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const currentInclude = Array.isArray(existing.include) ? existing.include : [];
        const next = new Set(currentInclude);
        if (enabled) {
          next.add(value);
        } else {
          next.delete(value);
        }
        return {
          ...existing,
          include: Array.from(next),
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
          checked={include.includes('text')}
          onCheckedChange={handleText}
        />
        {localize('com_nav_realtime_include_text')}
      </label>
      <label className="flex items-center gap-2 text-sm text-text-primary" htmlFor="realtime-include-audio">
        <Checkbox
          id="realtime-include-audio"
          data-testid="realtime-include-audio"
          checked={include.includes('audio')}
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
