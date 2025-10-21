import React, { useEffect, useMemo, useState } from 'react';
import { Button, Spinner, useToastContext } from '@librechat/client';
import { Constants } from 'librechat-data-provider';
import type { SpotifyPlaylist } from 'librechat-data-provider';
import { useUpdateUserPluginsMutation } from 'librechat-data-provider/react-query';
import { useLocalize, useMCPConnectionStatus } from '~/hooks';
import { useGetStartupConfig, useSpotifyPlaylistsQuery, useSpotifyPreferencesQuery } from '~/data-provider';
import ServerInitializationSection from '~/components/MCP/ServerInitializationSection';

const SPOTIFY_SERVER_NAME = 'spotify';
const PREFERRED_KEY = 'preferred_playlists';
const VIBE_KEY = 'vibe_playlists';

const normalizeList = (values: string[]) => Array.from(new Set(values)).sort();

const areArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false;
  }
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  return aSorted.every((value, index) => value === bSorted[index]);
};

interface SpotifyIntegrationContentProps {
  conversationId?: string | null;
  variant?: 'panel' | 'dialog';
}

export default function SpotifyIntegrationContent({
  conversationId,
  variant = 'panel',
}: SpotifyIntegrationContentProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { data: startupConfig } = useGetStartupConfig();
  const spotifyConfig = startupConfig?.mcpServers?.[SPOTIFY_SERVER_NAME];
  const { connectionStatus } = useMCPConnectionStatus({
    enabled: !!startupConfig?.mcpServers && Object.keys(startupConfig.mcpServers).length > 0,
  });

  const serverStatus = connectionStatus?.[SPOTIFY_SERVER_NAME];
  const isConnected = serverStatus?.connectionState === 'connected';
  const playlistsQuery = useSpotifyPlaylistsQuery(isConnected && !!spotifyConfig);
  const preferencesQuery = useSpotifyPreferencesQuery(isConnected && !!spotifyConfig);

  const baselinePreferred = useMemo(
    () => normalizeList(preferencesQuery.data?.preferredPlaylists ?? []),
    [preferencesQuery.data?.preferredPlaylists],
  );
  const baselineVibe = useMemo(
    () => normalizeList(preferencesQuery.data?.vibePlaylists ?? []),
    [preferencesQuery.data?.vibePlaylists],
  );

  const [preferredSelections, setPreferredSelections] = useState<string[]>(baselinePreferred);
  const [vibeSelections, setVibeSelections] = useState<string[]>(baselineVibe);
  const [hasInitializedFromServer, setHasInitializedFromServer] = useState(false);

  useEffect(() => {
    if (!preferencesQuery.data) {
      if (!preferencesQuery.isLoading && !preferencesQuery.isFetching && !hasInitializedFromServer) {
        setPreferredSelections([]);
        setVibeSelections([]);
      }
      return;
    }

    if (!hasInitializedFromServer || (!preferencesQuery.isFetching && !preferencesQuery.isLoading)) {
      setPreferredSelections((prev) => {
        if (!hasInitializedFromServer || areArraysEqual(prev, baselinePreferred)) {
          return baselinePreferred;
        }
        return prev;
      });
      setVibeSelections((prev) => {
        if (!hasInitializedFromServer || areArraysEqual(prev, baselineVibe)) {
          return baselineVibe;
        }
        return prev;
      });
      setHasInitializedFromServer(true);
    }
  }, [
    baselinePreferred,
    baselineVibe,
    preferencesQuery.data,
    preferencesQuery.isFetching,
    preferencesQuery.isLoading,
    hasInitializedFromServer,
  ]);

  const toggleSelection = (category: 'preferred' | 'vibe', playlistId: string) => {
    if (category === 'preferred') {
      setPreferredSelections((prev) => {
        const hasId = prev.includes(playlistId);
        const next = hasId ? prev.filter((id) => id !== playlistId) : [...prev, playlistId];
        return normalizeList(next);
      });
      return;
    }

    setVibeSelections((prev) => {
      const hasId = prev.includes(playlistId);
      const next = hasId ? prev.filter((id) => id !== playlistId) : [...prev, playlistId];
      return normalizeList(next);
    });
  };

  const isDirty = useMemo(() => {
    return (
      !areArraysEqual(preferredSelections, baselinePreferred) ||
      !areArraysEqual(vibeSelections, baselineVibe)
    );
  }, [preferredSelections, baselinePreferred, vibeSelections, baselineVibe]);

  const updateUserPlugins = useUpdateUserPluginsMutation({
    onSuccess: async () => {
      showToast({ message: localize('com_spotify_integration_saved'), status: 'success' });
      await preferencesQuery.refetch();
    },
    onError: () => {
      showToast({ message: localize('com_spotify_integration_save_error'), status: 'error' });
    },
  });

  const handleSave = () => {
    updateUserPlugins.mutate({
      pluginKey: `${Constants.mcp_prefix}${SPOTIFY_SERVER_NAME}`,
      action: 'install',
      auth: {
        [PREFERRED_KEY]: JSON.stringify(preferredSelections),
        [VIBE_KEY]: JSON.stringify(vibeSelections),
      },
    });
  };

  const handleReset = () => {
    setPreferredSelections(baselinePreferred);
    setVibeSelections(baselineVibe);
  };

  const playlists: SpotifyPlaylist[] = useMemo(() => {
    if (!playlistsQuery.data?.playlists) {
      return [];
    }

    const seen = new Set<string>();
    return playlistsQuery.data.playlists.filter((playlist) => {
      if (!playlist.id) {
        return false;
      }
      if (seen.has(playlist.id)) {
        return false;
      }
      seen.add(playlist.id);
      return true;
    });
  }, [playlistsQuery.data?.playlists]);

  const sortedPlaylists = useMemo(() => {
    return [...playlists].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  }, [playlists]);

  if (!spotifyConfig) {
    return (
      <div className="space-y-2 text-sm text-text-secondary">
        <h2 className="text-base font-semibold text-text-primary">
          {localize('com_spotify_integration_title')}
        </h2>
        <p>{localize('com_spotify_integration_not_configured')}</p>
      </div>
    );
  }

  const containerPadding = variant === 'panel' ? 'space-y-4' : 'space-y-5';
  const requiresOAuth = !!serverStatus?.requiresOAuth;

  return (
    <div className={`flex flex-col ${containerPadding}`}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-text-primary">
          {localize('com_spotify_integration_title')}
        </h2>
        <p className="text-sm text-text-secondary">
          {localize('com_spotify_integration_description')}
        </p>
      </div>

      {!isConnected && (
        <div className="space-y-3 rounded border border-dashed border-border-medium bg-surface-secondary/40 p-4 text-sm text-text-secondary">
          <p>{localize('com_spotify_integration_connect_cta')}</p>
          <ServerInitializationSection
            serverName={SPOTIFY_SERVER_NAME}
            requiresOAuth={requiresOAuth}
            conversationId={conversationId}
            hasCustomUserVars={false}
            sidePanel={variant === 'panel'}
          />
        </div>
      )}

      {isConnected && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">
                {localize('com_spotify_integration_playlist_section')}
              </span>
              <span className="text-xs text-text-secondary">
                {localize('com_spotify_integration_hint')}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => playlistsQuery.refetch()}
              disabled={playlistsQuery.isFetching}
            >
              {playlistsQuery.isFetching ? (
                <span className="flex items-center gap-2">
                  <Spinner className="h-4 w-4" />
                  {localize('com_spotify_integration_refresh')}
                </span>
              ) : (
                localize('com_spotify_integration_refresh')
              )}
            </Button>
          </div>

          {playlistsQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner className="h-6 w-6" />
            </div>
          ) : playlistsQuery.error ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {localize('com_spotify_integration_error_loading')}
            </div>
          ) : sortedPlaylists.length === 0 ? (
            <div className="rounded border border-dashed border-border-medium p-4 text-sm text-text-secondary">
              {localize('com_spotify_integration_no_playlists')}
            </div>
          ) : (
            <div className="space-y-3">
              {sortedPlaylists.map((playlist) => {
                const preferredSelected = preferredSelections.includes(playlist.id);
                const vibeSelected = vibeSelections.includes(playlist.id);
                return (
                  <div
                    key={playlist.id}
                    className="rounded-lg border border-border-medium bg-surface-secondary/40 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-text-primary">{playlist.name}</p>
                        {playlist.description ? (
                          <p className="max-w-xl text-xs text-text-secondary">{playlist.description}</p>
                        ) : null}
                        {playlist.url ? (
                          <a
                            href={playlist.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {localize('com_spotify_integration_open_playlist')}
                          </a>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          type="button"
                          variant={preferredSelected ? 'default' : 'outline'}
                          onClick={() => toggleSelection('preferred', playlist.id)}
                        >
                          {localize('com_spotify_integration_category_preferred')}
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant={vibeSelected ? 'default' : 'outline'}
                          onClick={() => toggleSelection('vibe', playlist.id)}
                        >
                          {localize('com_spotify_integration_category_vibe')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!isDirty || updateUserPlugins.isLoading}
            >
              {localize('com_ui_reset')}
            </Button>
            <Button
              type="button"
              variant="submit"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || updateUserPlugins.isLoading}
            >
              {updateUserPlugins.isLoading
                ? localize('com_spotify_integration_saving')
                : localize('com_spotify_integration_save')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
