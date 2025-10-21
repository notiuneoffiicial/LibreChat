import React from 'react';
import { OGDialog, OGDialogTemplate } from '@librechat/client';
import { useLocalize } from '~/hooks';
import SpotifyIntegrationContent from '~/components/Spotify/SpotifyIntegrationContent';

interface SpotifyIntegrationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string | null;
}

export default function SpotifyIntegrationDialog({
  isOpen,
  onOpenChange,
  conversationId,
}: SpotifyIntegrationDialogProps) {
  const localize = useLocalize();

  return (
    <OGDialog open={isOpen} onOpenChange={onOpenChange}>
      <OGDialogTemplate
        title={localize('com_spotify_integration_title')}
        description={localize('com_spotify_integration_dialog_description')}
        className="max-h-[85vh] w-[min(720px,92vw)] overflow-y-auto"
      >
        <SpotifyIntegrationContent conversationId={conversationId} variant="dialog" />
      </OGDialogTemplate>
    </OGDialog>
  );
}
