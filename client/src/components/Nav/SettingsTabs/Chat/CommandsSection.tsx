import ToggleSwitch from '../ToggleSwitch';
import { useLocalize } from '~/hooks';
import store from '~/store';

export default function CommandsSection() {
  const localize = useLocalize();

  return (
    <div className="bg-surface-secondary/40 space-y-4 rounded-xl border border-border-medium p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-text-primary">{localize('com_nav_commands')}</h3>
        <p className="text-xs text-text-secondary">{localize('com_nav_chat_commands_info')}</p>
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-text-primary">
          {localize('com_nav_at_command')}
        </div>
        <p className="text-xs text-text-secondary">{localize('com_nav_at_command_description')}</p>
      </div>
      <div className="space-y-1">
        <ToggleSwitch
          stateAtom={store.plusCommand}
          localizationKey={'com_nav_plus_command'}
          switchId="plusCommand"
        />
        <p className="text-xs text-text-secondary">
          {localize('com_nav_plus_command_description')}
        </p>
      </div>
      <div className="space-y-1">
        <ToggleSwitch
          stateAtom={store.slashCommand}
          localizationKey={'com_nav_slash_command'}
          switchId="slashCommand"
        />
        <p className="text-xs text-text-secondary">
          {localize('com_nav_slash_command_description')}
        </p>
      </div>
    </div>
  );
}
