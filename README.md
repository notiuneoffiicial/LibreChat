<p align="center">
  <a href="https://chat.optimismai.app">
    <img src="client/public/assets/logo.svg" height="256">
  </a>
  <h1 align="center">
    <a href="https://chat.optimismai.app">OptimismAI</a>
  </h1>
</p>

## Spotify MCP Integration

This workspace now ships with a managed Spotify Model Context Protocol (MCP) server that lets the assistant surface playlists when music could help a user. To enable it:

1. Provide Spotify credentials in `.env`:
   ```bash
   SPOTIFY_MCP_URL=https://your-spotify-mcp-endpoint/sse
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   SPOTIFY_OAUTH_SCOPE="user-read-private playlist-read-private user-modify-playback-state"
   ```
2. Mirror the same values inside `librechat.yaml` (see the `mcpServers.spotify` section) so the server knows how to authenticate.
3. Users can open the new **Spotify Playlists** entry from the chat Tools menu or the side panel to connect their account, review playlists, and assign them to “Comfort picks” or “Energy & focus”.

Once connected, the assistant can call Spotify MCP tools (`list_user_playlists`, `suggest_playlist`, `queue_playlist`) and will reference the saved categories before recommending music.
