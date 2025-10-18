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
}
