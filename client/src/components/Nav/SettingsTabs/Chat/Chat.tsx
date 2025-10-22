import { memo } from 'react';
import FontSizeSelector from './FontSizeSelector';
import ChatDirection from './ChatDirection';
import ConversationSettings from './ConversationSettings';
import CommandsSection from './CommandsSection';
import ForkSettings from './ForkSettings';
import ToggleSwitch from '../ToggleSwitch';
import store from '~/store';

const toggleSwitchConfigs = [
  {
    stateAtom: store.enterToSend,
    localizationKey: 'com_nav_enter_to_send',
    switchId: 'enterToSend',
    hoverCardText: 'com_nav_info_enter_to_send',
    key: 'enterToSend',
  },
  {
    stateAtom: store.maximizeChatSpace,
    localizationKey: 'com_nav_maximize_chat_space',
    switchId: 'maximizeChatSpace',
    hoverCardText: undefined,
    key: 'maximizeChatSpace',
  },
  {
    stateAtom: store.centerFormOnLanding,
    localizationKey: 'com_nav_center_chat_input',
    switchId: 'centerFormOnLanding',
    hoverCardText: undefined,
    key: 'centerFormOnLanding',
  },
];

function Chat() {
  return (
    <div className="flex flex-col gap-3 p-1 text-sm text-text-primary">
      <div className="space-y-3 pb-3">
        <FontSizeSelector />
        <ChatDirection />
      </div>
      <div className="flex flex-col gap-3">
        <ConversationSettings />
        <CommandsSection />
        <ForkSettings />
        <div className="bg-surface-secondary/40 space-y-3 rounded-xl border border-border-medium p-4">
          {toggleSwitchConfigs.map((config) => (
            <ToggleSwitch
              key={config.key}
              stateAtom={config.stateAtom}
              localizationKey={config.localizationKey}
              hoverCardText={config.hoverCardText}
              switchId={config.switchId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(Chat);
