import type { RealtimeSessionDescriptor } from 'librechat-data-provider';

export interface SpeechToTextOptions {
  /**
   * Forces the hook to call the completion handler once audio processing
   * finishes, even when the auto-send setting is disabled. This is useful for
   * modal experiences like voice mode where messages should be dispatched as
   * soon as a transcription is available.
   */
  autoSendOnSuccess?: boolean;
  /**
   * Controls whether global microphone hotkeys (Shift+Alt+L) should be
   * registered. Disable this when the consuming UI is not visible so the
   * listener can be removed and avoid unexpected recordings.
   */
  enableHotkeys?: boolean;
  /**
   * Overrides the delay (in seconds) before automatically submitting a
   * completed transcription. When omitted, the user's configured auto-send
   * delay is used. Provide `0` to submit immediately or `-1` to skip the
   * automatic submission delay entirely.
   */
  autoSendDelayOverride?: number | null;
  /**
   * Allows tests or advanced consumers to provide a custom function for
   * creating realtime session descriptors instead of using the default
   * mutation hook.
   */
  realtimeSessionFetcher?: () => Promise<RealtimeSessionDescriptor>;
  /**
   * Factory override for creating WebSocket connections, primarily used for
   * testing environments that lack a native implementation.
   */
  websocketFactory?: (url: string, protocols?: string | string[]) => WebSocket;
  /**
   * Factory override for constructing peer connections when the realtime
   * engine requests WebRTC transport.
   */
  peerConnectionFactory?: () => RTCPeerConnection;
  /**
   * Factory override for creating audio contexts, enabling deterministic
   * testing of audio capture pipelines.
   */
  audioContextFactory?: (options?: AudioContextOptions) => AudioContext;
}
