import { useCallback } from 'react';
import type { ChangeEvent } from 'react';
import { useRecoilState } from 'recoil';
import { Input } from '@librechat/client';
import { useLocalize } from '~/hooks';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

export default function RealtimeModelInput() {
  const localize = useLocalize();
  const [realtimeOptions, setRealtimeOptions] = useRecoilState(store.realtimeSTTOptions);

  const value = realtimeOptions?.model ?? '';

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextModel = event.target.value;
      setRealtimeOptions((current) => ({
        ...(current ?? DEFAULT_REALTIME_STT_OPTIONS),
        model: nextModel,
      }));
    },
    [setRealtimeOptions],
  );

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="realtime-model-input" className="text-sm font-medium text-text-primary">
        {localize('com_nav_realtime_model')}
      </label>
      <Input
        id="realtime-model-input"
        data-testid="realtime-model-input"
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={localize('com_nav_realtime_model_placeholder')}
        className="h-9 w-full"
      />
    </div>
  );
}
