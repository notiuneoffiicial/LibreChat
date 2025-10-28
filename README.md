<p align="center">
  <a href="https://chat.optimismai.app">
    <img src="client/public/assets/logo.svg" height="256">
  </a>
  <h1 align="center">
    <a href="https://chat.optimismai.app">OptimismAI</a>
  </h1>
</p>

## Realtime speech-to-text (STT)

LibreChat can stream microphone audio directly to OpenAI's realtime models. To
make the option appear in the client, configure `speech.stt.realtime` in your
`librechat.yaml` (or workspace override):

```yaml
speech:
  stt:
    realtime:
      apiKey: "${OPENAI_API_KEY}"   # required – can reference an env var
      model: gpt-4o-realtime-preview # required – realtime-capable OpenAI model
      transport: websocket           # optional – `websocket` (default) or `webrtc`
      stream: true                   # optional – whether to request server-side streaming
      url: wss://api.openai.com/v1/realtime # optional – override the realtime base URL
      session:                       # optional – defaults for the realtime session envelope
        mode: conversation           # e.g. `conversation`, `speech_to_text`, `speech_to_speech`
        speechToSpeech: false        # enable to request spoken responses from the model
        model: gpt-4o-realtime-preview # override the session model when it differs from `model`
        voice: alloy                 # pre-select the realtime voice
        voices: [alloy, nova, verse] # optional – surface allowed voices in the UI
        instructions: |
          You are LibreChat's realtime assistant. Respond briefly and confirm
          important details back to the user.
        instructionTemplates:        # optional named snippets surfaced to the UI
          default: |
            Keep replies concise and finish with a follow-up question.
          handsfree: |
            Provide spoken-friendly responses with no markdown formatting.
      audio:
        input:
          format:                    # optional – overrides fallback audio format defaults
            encoding: pcm16
            sampleRate: 24000
            channels: 1
          noiseReduction: server_light   # optional – choose preset or custom object
          transcriptionDefaults:         # optional – baseline Whisper/ASR preferences
            language: en
            temperature: 0
            diarization: true
          turnDetection:                 # optional – configure server / semantic VAD
            type: server_vad
            serverVad:
              enabled: true
              silenceDurationMs: 500
              threshold: 0.5
            semantic:
              enabled: false
              minDecisionIntervalMs: 750
      include: [text, audio]        # optional – mapped to session.modalities (others go to session.include)
      ffmpegPath: /usr/local/bin/ffmpeg # optional – set if ffmpeg is not on PATH
```

The backend exposes `POST /api/files/speech/stt/realtime/call`, which accepts an
SDP offer and returns the SDP answer from the configured realtime provider. The
client calls this route whenever the "Realtime" engine is selected: it merges the
server defaults into the `realtimeSTTOptions` store, forwards the call request,
and streams microphone audio over the negotiated WebRTC connection.

- When `speech.stt.realtime` is present the Speech settings tab automatically
  shows the "Realtime" option. Users can opt in via **Settings → Speech →
  Speech-to-Text Engine**.
- To pre-select the realtime engine for everyone, set
  `speech.speechTab.speechToText.engineSTT: realtime` in the same configuration
  block.
- The API key can either be a literal value or an environment reference such as
  `${OPENAI_API_KEY}`; it is dereferenced at request time before the call is
  created.

After updating the YAML, restart the server so the new speech configuration is
picked up.

### Migration notes

- Existing configurations that only specify the legacy `inputAudioFormat`
  continue to work. When you're ready, move those settings under
  `audio.input.format` and optionally populate the new
  `noiseReduction`, `transcriptionDefaults`, and `turnDetection` blocks.
- New `session` defaults (mode, model, voice, instructions, templates, and the
  speech-to-speech toggle) are persisted for authenticated users without exposing
  your API key. The UI falls back to legacy behaviour if the block is omitted.
- The optional `include` list narrows which modalities are requested when the
  realtime session is created (for example, `['text']` to disable audio
  responses). Entries that match `text`/`audio` become the session's
  `modalities` array, while values such as
  `item.input_audio_transcription.logprobs` are forwarded to the API's
  `include` list.
