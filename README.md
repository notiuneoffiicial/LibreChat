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
      inputAudioFormat:              # optional – overrides fallback defaults
        encoding: pcm16
        sampleRate: 24000
        channels: 1
      ffmpegPath: /usr/local/bin/ffmpeg # optional – set if ffmpeg is not on PATH
```

The backend exposes `POST /api/files/speech/stt/realtime/session`, which creates
an ephemeral session descriptor against the configured realtime endpoint. The
client calls this route whenever the "Realtime" engine is selected: it merges the
server defaults into the `realtimeSTTOptions` store, creates the session, and
streams microphone audio over the requested transport.

- When `speech.stt.realtime` is present the Speech settings tab automatically
  shows the "Realtime" option. Users can opt in via **Settings → Speech →
  Speech-to-Text Engine**.
- To pre-select the realtime engine for everyone, set
  `speech.speechTab.speechToText.engineSTT: realtime` in the same configuration
  block.
- The API key can either be a literal value or an environment reference such as
  `${OPENAI_API_KEY}`; it is dereferenced at request time before the session is
  created.

After updating the YAML, restart the server so the new speech configuration is
picked up.
