import { useMemo } from 'react';
import { Dropdown, InfoHoverCard, ESide } from '@librechat/client';
import { ForkOptions } from 'librechat-data-provider';
import { useRecoilState } from 'recoil';
import ToggleSwitch from '../ToggleSwitch';
import { useLocalize } from '~/hooks';
import store from '~/store';

const forkOptionLabels: Record<ForkOptions, string> = {
  [ForkOptions.DIRECT_PATH]: 'com_ui_fork_visible',
  [ForkOptions.INCLUDE_BRANCHES]: 'com_ui_fork_branches',
  [ForkOptions.TARGET_LEVEL]: 'com_ui_fork_all_target',
  [ForkOptions.DEFAULT]: 'com_ui_fork_from_message',
};

const selectableForkOptions: ForkOptions[] = [
  ForkOptions.DIRECT_PATH,
  ForkOptions.INCLUDE_BRANCHES,
  ForkOptions.TARGET_LEVEL,
];

export default function ForkSettings() {
  const localize = useLocalize();
  const [forkSetting, setForkSetting] = useRecoilState(store.forkSetting);

  const options = useMemo(
    () =>
      selectableForkOptions.map((option) => ({
        value: option,
        label: localize(forkOptionLabels[option]),
      })),
    [localize],
  );

  const normalizedValue = selectableForkOptions.includes(forkSetting as ForkOptions)
    ? (forkSetting as ForkOptions)
    : ForkOptions.DIRECT_PATH;

  return (
    <div className="bg-surface-secondary/40 space-y-4 rounded-xl border border-border-medium p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-semibold text-text-primary">
              {localize('com_ui_fork_change_default')}
            </p>
            <InfoHoverCard side={ESide.Top} text={localize('com_nav_info_fork_change_default')} />
          </div>
          <Dropdown
            value={normalizedValue}
            options={options}
            onChange={(value) => setForkSetting(value as ForkOptions)}
            sizeClasses="w-[210px]"
            className="z-50"
          />
        </div>
        <p className="text-xs text-text-secondary">{localize(forkOptionLabels[normalizedValue])}</p>
      </div>
      <ToggleSwitch
        stateAtom={store.rememberDefaultFork}
        localizationKey={'com_ui_fork_default'}
        switchId="rememberDefaultFork"
        onCheckedChange={(checked) => {
          if (checked && !selectableForkOptions.includes(forkSetting as ForkOptions)) {
            setForkSetting(ForkOptions.DIRECT_PATH);
          }
        }}
      />
      <ToggleSwitch
        stateAtom={store.splitAtTarget}
        localizationKey={'com_ui_fork_split_target_setting'}
        hoverCardText={'com_nav_info_fork_split_target_setting'}
        switchId="splitAtTarget"
      />
    </div>
  );
}
