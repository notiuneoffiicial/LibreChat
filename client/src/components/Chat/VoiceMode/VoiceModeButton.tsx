import { useCallback } from 'react';
import { TooltipAnchor } from '@librechat/client';
import { useRecoilState } from 'recoil';
import { useLocalize } from '~/hooks';
import store from '~/store';

interface VoiceModeButtonProps {
  disabled?: boolean;
}

export default function VoiceModeButton({ disabled = false }: VoiceModeButtonProps) {
  const localize = useLocalize();
  const [isOpen, setIsOpen] = useRecoilState(store.voiceModeActive);

  const rawBaseUrl = import.meta.env.BASE_URL ?? '/';
  const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl : `${rawBaseUrl}/`;
  const iconSrc = `${baseUrl}voice/icon.svg`;

  const handleClick = useCallback(() => {
    if (disabled) {
      return;
    }

    setIsOpen(true);
  }, [disabled, setIsOpen]);

  return (
    <TooltipAnchor
      description={localize('com_ui_voice_mode')}
      render={
        <button
          type="button"
          aria-label={localize('com_ui_voice_mode')}
          title={localize('com_ui_voice_mode')}
          onClick={handleClick}
          disabled={disabled}
          aria-pressed={isOpen}
          className="flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover disabled:cursor-not-allowed"
        >
          <img src={iconSrc} alt="" className="h-5 w-5" />
        </button>
      }
    />
  );
}
