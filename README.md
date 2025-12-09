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
        type: realtime               # required by GA – set to `transcription` for STT-only sessions
        speechToSpeech: false        # set true to request spoken responses from the model
        model: gpt-4o-realtime-preview # override the session model when it differs from `model`
        instructions: |              # GA-compliant realtime session prompt
          You are LibreChat's realtime assistant. Respond briefly and confirm
          important details back to the user.
      audio:
        output:
          voice: alloy               # required when speechToSpeech is true – selects the TTS voice
          voices: [alloy, nova, verse] # optional – surface allowed voices in the UI
        input:
          format:                    # optional – overrides fallback audio format defaults
            encoding: pcm16
            sampleRate: 24000
            channels: 1
          noiseReduction:               # optional – choose preset or provide custom settings
            preset: server_light
          transcription:                 # optional – GA transcription payload defaults
            model: gpt-4o-mini-transcribe
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
      include:
        - item.input_audio_transcription.logprobs # GA-supported telemetry fields forwarded to the API
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
- Noise reduction presets now use an object syntax (for example,
  `noiseReduction: { preset: server_light }`). String values are wrapped for
  compatibility, but update your configuration to avoid future migrations.
- New `session` defaults (type, model, voice, instructions, and the
  speech-to-speech toggle) are persisted for authenticated users without
  exposing your API key. The UI falls back to legacy behaviour if the block is
  omitted.
- Audio responses are now driven by the GA contract: keep `session.type`
  set to `realtime`, enable `session.speechToSpeech`, and choose a voice under
  `session.audio.output.voice`. LibreChat automatically requests the audio
  modality when these settings are active.
- The optional `include` list should be reserved for GA-supported telemetry
  fields (for example, `item.input_audio_transcription.logprobs`). Do not send
  legacy modality names; the server will inject the correct audio modality when
  speech-to-speech is enabled.
- OpenAI's GA endpoint for SDP negotiation is now `/v1/realtime/calls`. Ensure
  your outbound firewall allows this host and remove references to the
  deprecated session endpoints.

## Meta prompt logging in production

Meta prompt updates are logged at the `info` level. Production builds default to
`warn`, so these entries are normally suppressed. Set the
`META_PROMPT_LOGS=true` environment variable (or `1`/`yes`) to raise the base
logger level to `info` and capture meta prompt diagnostics when needed.

## Positive news feed

The news tab in Chat is backed by a cached feed generated from your configured news APIs. See [docs/news-feed.md](docs/news-feed.md) for configuration, refresh, and endpoint details.
