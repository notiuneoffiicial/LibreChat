export interface SpeechToTextOptions {
  /**
   * Forces the hook to call the completion handler once audio processing
   * finishes, even when the auto-send setting is disabled. This is useful for
   * modal experiences like voice mode where messages should be dispatched as
   * soon as a transcription is available.
   */
  autoSendOnSuccess?: boolean;
}
