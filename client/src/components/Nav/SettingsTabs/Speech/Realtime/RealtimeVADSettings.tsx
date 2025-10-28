import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { Input, Switch } from '@librechat/client';
import { useRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS, type RealtimeSTTTurnDetectionConfig } from '~/store/settings';

const parseNumber = (value: string): number | undefined => {
  if (value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export default function RealtimeVADSettings() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const turnDetection = realtimeOptions?.session?.audio?.input?.turnDetection;
  const mode = useMemo(() => {
    if (!turnDetection || typeof turnDetection !== 'object') {
      return 'disabled';
    }
    return (turnDetection as RealtimeSTTTurnDetectionConfig).type ?? 'disabled';
  }, [turnDetection]);

  const serverConfig = useMemo(() => {
    if (mode !== 'server_vad' || !turnDetection || typeof turnDetection !== 'object') {
      return {} as NonNullable<RealtimeSTTTurnDetectionConfig['serverVad']>;
    }
    return (turnDetection as RealtimeSTTTurnDetectionConfig).serverVad ?? {};
  }, [mode, turnDetection]);

  const semanticConfig = useMemo(() => {
    if (mode !== 'semantic' || !turnDetection || typeof turnDetection !== 'object') {
      return {} as NonNullable<RealtimeSTTTurnDetectionConfig['semantic']>;
    }
    return (turnDetection as RealtimeSTTTurnDetectionConfig).semantic ?? {};
  }, [mode, turnDetection]);

  const updateTurnDetection = useCallback(
    (updater: (current: RealtimeSTTTurnDetectionConfig | undefined) => RealtimeSTTTurnDetectionConfig | undefined) => {
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const nextSession = existing.session ? { ...existing.session } : {};
        const audioConfig = { ...(nextSession.audio ?? {}) };
        const inputConfig = { ...(audioConfig.input ?? {}) };
        const nextTurnDetection = updater(inputConfig.turnDetection as RealtimeSTTTurnDetectionConfig | undefined);

        if (nextTurnDetection === undefined) {
          delete inputConfig.turnDetection;
        } else {
          inputConfig.turnDetection = nextTurnDetection;
        }

        if (Object.keys(inputConfig).length > 0) {
          audioConfig.input = inputConfig;
        } else {
          delete audioConfig.input;
        }

        if (Object.keys(audioConfig).length > 0) {
          nextSession.audio = audioConfig;
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

  const handleModeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextType = event.target.value;
      if (nextType === 'disabled') {
        updateTurnDetection(() => undefined);
        return;
      }

      updateTurnDetection((current) => {
        const existing = current ?? { type: nextType };
        if (nextType === 'server_vad') {
          return {
            type: 'server_vad',
            serverVad: {
              enabled: existing.serverVad?.enabled ?? true,
              threshold: existing.serverVad?.threshold,
              silenceDurationMs: existing.serverVad?.silenceDurationMs,
              minSpeechDurationMs: existing.serverVad?.minSpeechDurationMs,
              prefixPaddingMs: existing.serverVad?.prefixPaddingMs,
              postfixPaddingMs: existing.serverVad?.postfixPaddingMs,
            },
          };
        }

        return {
          type: 'semantic',
          semantic: {
            enabled: existing.semantic?.enabled ?? true,
            minDecisionIntervalMs: existing.semantic?.minDecisionIntervalMs,
            speechProbThreshold: existing.semantic?.speechProbThreshold,
            activationThreshold: existing.semantic?.activationThreshold,
            deactivationThreshold: existing.semantic?.deactivationThreshold,
          },
        };
      });
    },
    [updateTurnDetection],
  );

  const handleServerToggle = useCallback(
    (checked: boolean | string) => {
      updateTurnDetection((current) => {
        if (!current || current.type !== 'server_vad') {
          return current ?? { type: 'server_vad', serverVad: { enabled: checked === true } };
        }
        return {
          ...current,
          serverVad: {
            ...(current.serverVad ?? {}),
            enabled: checked === true,
          },
        };
      });
    },
    [updateTurnDetection],
  );

  const handleServerField = useCallback(
    (field: keyof NonNullable<RealtimeSTTTurnDetectionConfig['serverVad']>) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const parsed = parseNumber(event.target.value);
        updateTurnDetection((current) => {
          if (!current || current.type !== 'server_vad') {
            return current;
          }
          return {
            ...current,
            serverVad: {
              ...(current.serverVad ?? {}),
              [field]: parsed,
            },
          };
        });
      },
    [updateTurnDetection],
  );

  const handleSemanticToggle = useCallback(
    (checked: boolean | string) => {
      updateTurnDetection((current) => {
        if (!current || current.type !== 'semantic') {
          return current ?? { type: 'semantic', semantic: { enabled: checked === true } };
        }
        return {
          ...current,
          semantic: {
            ...(current.semantic ?? {}),
            enabled: checked === true,
          },
        };
      });
    },
    [updateTurnDetection],
  );

  const handleSemanticField = useCallback(
    (field: keyof NonNullable<RealtimeSTTTurnDetectionConfig['semantic']>) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        const parsed = parseNumber(event.target.value);
        updateTurnDetection((current) => {
          if (!current || current.type !== 'semantic') {
            return current;
          }
          return {
            ...current,
            semantic: {
              ...(current.semantic ?? {}),
              [field]: parsed,
            },
          };
        });
      },
    [updateTurnDetection],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="realtime-vad-mode" className="text-sm font-medium text-text-primary">
          {localize('com_nav_realtime_vad_mode')}
        </label>
        <select
          id="realtime-vad-mode"
          data-testid="realtime-vad-mode"
          value={mode}
          onChange={handleModeChange}
          className="rounded-md border border-border-medium bg-transparent px-2 py-1 text-sm text-text-primary"
        >
          <option value="disabled">{localize('com_nav_realtime_vad_disabled')}</option>
          <option value="server_vad">{localize('com_nav_realtime_vad_server')}</option>
          <option value="semantic">{localize('com_nav_realtime_vad_semantic')}</option>
        </select>
      </div>

      {mode === 'server_vad' && (
        <div className="space-y-3 rounded-md border border-border-medium p-3">
          <div className="flex items-center justify-between text-sm text-text-primary">
            <span>{localize('com_nav_realtime_vad_enabled')}</span>
            <Switch
              data-testid="realtime-vad-server-enabled"
              checked={serverConfig.enabled ?? false}
              onCheckedChange={handleServerToggle}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              data-testid="realtime-vad-threshold"
              type="number"
              value={serverConfig.threshold ?? ''}
              onChange={handleServerField('threshold')}
              placeholder={localize('com_nav_realtime_vad_threshold')}
              className="h-9"
            />
            <Input
              data-testid="realtime-vad-silence"
              type="number"
              value={serverConfig.silenceDurationMs ?? ''}
              onChange={handleServerField('silenceDurationMs')}
              placeholder={localize('com_nav_realtime_vad_silence')}
              className="h-9"
            />
            <Input
              data-testid="realtime-vad-min-speech"
              type="number"
              value={serverConfig.minSpeechDurationMs ?? ''}
              onChange={handleServerField('minSpeechDurationMs')}
              placeholder={localize('com_nav_realtime_vad_min_speech')}
              className="h-9"
            />
            <Input
              data-testid="realtime-vad-prefix"
              type="number"
              value={serverConfig.prefixPaddingMs ?? ''}
              onChange={handleServerField('prefixPaddingMs')}
              placeholder={localize('com_nav_realtime_vad_prefix')}
              className="h-9"
            />
            <Input
              data-testid="realtime-vad-postfix"
              type="number"
              value={serverConfig.postfixPaddingMs ?? ''}
              onChange={handleServerField('postfixPaddingMs')}
              placeholder={localize('com_nav_realtime_vad_postfix')}
              className="h-9"
            />
          </div>
        </div>
      )}

      {mode === 'semantic' && (
        <div className="space-y-3 rounded-md border border-border-medium p-3">
          <div className="flex items-center justify-between text-sm text-text-primary">
            <span>{localize('com_nav_realtime_vad_enabled')}</span>
            <Switch
              data-testid="realtime-vad-semantic-enabled"
              checked={semanticConfig.enabled ?? false}
              onCheckedChange={handleSemanticToggle}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              data-testid="realtime-vad-decision"
              type="number"
              value={semanticConfig.minDecisionIntervalMs ?? ''}
              onChange={handleSemanticField('minDecisionIntervalMs')}
              placeholder={localize('com_nav_realtime_vad_min_interval')}
              className="h-9"
            />
            <Input
              data-testid="realtime-vad-prob"
              type="number"
              value={semanticConfig.speechProbThreshold ?? ''}
              onChange={handleSemanticField('speechProbThreshold')}
              placeholder={localize('com_nav_realtime_vad_prob')}
              className="h-9"
            />
            <Input
              data-testid="realtime-vad-activation"
              type="number"
              value={semanticConfig.activationThreshold ?? ''}
              onChange={handleSemanticField('activationThreshold')}
              placeholder={localize('com_nav_realtime_vad_activation')}
              className="h-9"
            />
            <Input
              data-testid="realtime-vad-deactivation"
              type="number"
              value={semanticConfig.deactivationThreshold ?? ''}
              onChange={handleSemanticField('deactivationThreshold')}
              placeholder={localize('com_nav_realtime_vad_deactivation')}
              className="h-9"
            />
          </div>
        </div>
      )}
    </div>
  );
}
