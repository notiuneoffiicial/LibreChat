import React from 'react';
import { useRecoilState } from 'recoil';
import { Dropdown } from '@librechat/client';
import { useLocalize } from '~/hooks';
import store from '~/store';

interface EngineSTTDropdownProps {
  external: boolean;
  realtimeAvailable?: boolean;
}

const EngineSTTDropdown: React.FC<EngineSTTDropdownProps> = ({ external, realtimeAvailable }) => {
  const localize = useLocalize();
  const [engineSTT, setEngineSTT] = useRecoilState<string>(store.engineSTT);

  const realtimeLabel = localize('com_nav_realtime');
  const normalizedRealtimeLabel =
    realtimeLabel && realtimeLabel !== 'com_nav_realtime' ? realtimeLabel : 'Realtime';

  const endpointOptions = [
    { value: 'browser', label: localize('com_nav_browser') },
    ...(realtimeAvailable ? [{ value: 'realtime', label: normalizedRealtimeLabel }] : []),
    ...(external ? [{ value: 'external', label: localize('com_nav_external') }] : []),
  ];

  const handleSelect = (value: string) => {
    setEngineSTT(value);
  };

  const labelId = 'engine-stt-dropdown-label';

  return (
    <div className="flex items-center justify-between">
      <div id={labelId}>{localize('com_nav_engine')}</div>
      <Dropdown
        value={engineSTT}
        onChange={handleSelect}
        options={endpointOptions}
        sizeClasses="w-[180px]"
        testId="EngineSTTDropdown"
        className="z-50"
        aria-labelledby={labelId}
      />
    </div>
  );
};

export default EngineSTTDropdown;
