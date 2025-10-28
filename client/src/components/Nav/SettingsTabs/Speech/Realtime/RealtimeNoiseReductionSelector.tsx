import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

export default function RealtimeNoiseReductionSelector() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const value = (() => {
    const noise = realtimeOptions?.session?.audio?.input?.noiseReduction;
    if (typeof noise === 'string') {
      return noise;
    }
    if (noise && typeof noise === 'object' && typeof noise['preset'] === 'string') {
      return noise['preset'];
    }
    return '';
  })();

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const nextValue = event.target.value;
      setRealtimeOptions((current) => {
        const existing = current ?? DEFAULT_REALTIME_STT_OPTIONS;
        const nextSession = existing.session ? { ...existing.session } : {};
        const audioConfig = { ...(nextSession.audio ?? {}) };
        const inputConfig = { ...(audioConfig.input ?? {}) };
        return {
          ...existing,
          session: {
            ...nextSession,
            audio: {
              ...audioConfig,
              input: {
                ...inputConfig,
                noiseReduction: nextValue === '' ? undefined : nextValue,
              },
            },
          },
        };
      });
    },
    [setRealtimeOptions],
  );

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="realtime-noise-reduction" className="text-sm font-medium text-text-primary">
        {localize('com_nav_realtime_noise_reduction')}
      </label>
      <select
        id="realtime-noise-reduction"
        data-testid="realtime-noise-reduction"
        value={value}
        onChange={handleChange}
        className="rounded-md border border-border-medium bg-transparent px-2 py-1 text-sm text-text-primary"
      >
        <option value="">{localize('com_nav_realtime_noise_none')}</option>
        <option value="server_light">{localize('com_nav_realtime_noise_light')}</option>
        <option value="server_standard">{localize('com_nav_realtime_noise_standard')}</option>
        <option value="server_strong">{localize('com_nav_realtime_noise_high')}</option>
      </select>
    </div>
  );
}
