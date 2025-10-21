import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type {
  SpotifyPlaylistsResponse,
  SpotifyPreferencesResponse,
} from 'librechat-data-provider';

export const useSpotifyPlaylistsQuery = (enabled: boolean) => {
  return useQuery<SpotifyPlaylistsResponse>(
    [QueryKeys.spotifyPlaylists],
    () => dataService.getSpotifyPlaylists(),
    {
      enabled,
      staleTime: 1000 * 60 * 5,
    },
  );
};

export const useSpotifyPreferencesQuery = (enabled: boolean) => {
  return useQuery<SpotifyPreferencesResponse>(
    [QueryKeys.spotifyPreferences],
    () => dataService.getSpotifyPreferences(),
    {
      enabled,
      staleTime: 1000 * 60 * 5,
    },
  );
};
