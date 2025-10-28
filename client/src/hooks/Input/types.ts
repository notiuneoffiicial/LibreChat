import type {
  RealtimeCallOverrides,
  RealtimeCallRequest,
  RealtimeCallResponse,
} from 'librechat-data-provider';
import type {
  RealtimeSTTNoiseReduction,
  RealtimeSTTTurnDetectionConfig,
} from '~/store/settings';

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
   * Allows tests or advanced consumers to override the default realtime call
   * initiation logic. When provided, this function is invoked with the
   * payload that would normally be sent to the server and must return the
   * realtime call response.
   */
  realtimeCallInvoker?: (payload: RealtimeCallRequest) => Promise<RealtimeCallResponse>;
  /**
   * Factory override for constructing peer connections when the realtime
   * engine requests WebRTC transport.
   */
  peerConnectionFactory?: () => RTCPeerConnection;
  /**
   * Override the realtime session mode that will be requested from the
   * provider. Falls back to the persisted realtime session defaults when
   * omitted.
   */
  mode?: string;
  /**
   * Override the realtime model that should power the transcription session.
   */
  model?: string;
  /**
   * Override the realtime voice to request when speech responses are enabled.
   */
  voice?: string;
  /**
   * Override the default instructions used when creating the realtime
   * session.
   */
  instructions?: string;
  /**
   * Explicitly control which modalities should be requested from the
   * realtime provider.
   */
  include?: string[];
  /**
   * Override the voice activity detection configuration forwarded to the
   * realtime provider.
   */
  turnDetection?: RealtimeSTTTurnDetectionConfig;
  /**
   * Override the noise reduction configuration forwarded to the realtime
   * provider.
   */
  noiseReduction?: RealtimeSTTNoiseReduction;
  /**
   * Provide ad-hoc overrides for the realtime call payload. Properties defined
   * here win over all other derived defaults with the exception of the
   * required `sdpOffer` field.
   */
  callOverrides?: Partial<RealtimeCallOverrides>;
  /**
   * Observe realtime recorder status changes. The hook invokes this callback
   * whenever the internal status changes.
   */
  onStatusChange?: (status: RealtimeRecorderStatus) => void;
  /**
   * Observe realtime recorder error state changes. Passing `null` clears the
   * current error.
   */
  onError?: (error: string | null) => void;
  /**
   * Receive streaming speech synthesis events from the realtime session when
   * speech responses are enabled.
   */
  onSpeechOutputDelta?: (event: unknown) => void;
  /**
   * Receive the completion event for streamed speech synthesis responses.
   */
  onSpeechOutputCompleted?: (event: unknown) => void;
}

export type RealtimeRecorderStatus =
  | 'idle'
  | 'acquiring_media'
  | 'negotiating'
  | 'connected'
  | 'processing'
  | 'completed'
  | 'error';
