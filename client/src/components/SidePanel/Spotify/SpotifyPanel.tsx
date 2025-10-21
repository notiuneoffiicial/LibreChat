import React from 'react';
import SpotifyIntegrationContent from '~/components/Spotify/SpotifyIntegrationContent';

export default function SpotifyPanel() {
  return (
    <div className="h-auto max-w-full overflow-x-hidden py-2">
      <SpotifyIntegrationContent variant="panel" />
    </div>
  );
}
