import ToggleSwitch from '../ToggleSwitch';
import store from '~/store';
import { useLocalize } from '~/hooks';

export default function ConversationSettings() {
  const localize = useLocalize();

  return (
    <div className="bg-surface-secondary/40 space-y-4 rounded-xl border border-border-medium p-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
          {localize('com_nav_conversation_mode')}
        </p>
        <ToggleSwitch
          stateAtom={store.modularChat}
          localizationKey={'com_nav_modular_chat'}
          switchId="modularChat"
        />
      </div>
      <ToggleSwitch
        stateAtom={store.saveDrafts}
        localizationKey={'com_nav_save_drafts'}
        hoverCardText={'com_nav_info_save_draft'}
        switchId="saveDrafts"
      />
      <ToggleSwitch
        stateAtom={store.showScrollButton}
        localizationKey={'com_nav_scroll_button'}
        switchId="showScrollButton"
      />
      <ToggleSwitch
        stateAtom={store.showCode}
        localizationKey={'com_nav_show_code'}
        switchId="showCode"
      />
      <ToggleSwitch
        stateAtom={store.latexParsing}
        localizationKey={'com_nav_latex_parsing'}
        hoverCardText={'com_nav_info_latex_parsing'}
        switchId="latexParsing"
      />
    </div>
  );
}
