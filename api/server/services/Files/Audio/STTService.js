const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream } = require('fs');
const { spawn } = require('child_process');
const FormData = require('form-data');
const { Readable } = require('stream');
const OpenAI = require('openai');
const { OpenAIRealtimeWS } = require('openai/beta/realtime/ws');
const { logger } = require('@librechat/data-schemas');
const { genAzureEndpoint } = require('@librechat/api');
const { extractEnvVariable, STTProviders } = require('librechat-data-provider');
const { getAppConfig } = require('~/server/services/Config');
const {
  appendTranscriptSegment,
  extractTextFromEvent,
} = require('./transcriptUtils');
/**
 * Maps MIME types to their corresponding file extensions for audio files.
 * @type {Object}
 */
const MIME_TO_EXTENSION_MAP = {
  // MP4 container formats
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  // Ogg formats
  'audio/ogg': 'ogg',
  'audio/vorbis': 'ogg',
  'application/ogg': 'ogg',
  // Wave formats
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  // MP3 formats
  'audio/mp3': 'mp3',
  'audio/mpeg': 'mp3',
  'audio/mpeg3': 'mp3',
  // WebM formats
  'audio/webm': 'webm',
  // Additional formats
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

const REALTIME_MODEL_PATTERN = /gpt-4o(?:-mini)?-transcribe/i;
const DEFAULT_PCM_ENCODING = 'pcm16';
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_AUDIO_CHANNELS = 1;
const REALTIME_CHUNK_SIZE = 48 * 1024;
const REALTIME_CONNECT_TIMEOUT_MS = 15000;

const TEXT_DELTA_EVENT_TYPES = new Set([
  'transcript.text.delta',
  'transcript.delta',
  'transcript.segment.delta',
  'transcription.delta',
  'transcription.segment.delta',
  'response.output_text.delta',
  'response.audio.transcript.delta',
  'response.transcription.delta',
]);

const TEXT_DONE_EVENT_TYPES = new Set([
  'transcript.text.done',
  'transcript.done',
  'transcription.done',
  'transcription.final',
  'transcription.completed',
  'response.completed',
  'response.output_text.done',
  'response.audio.transcript.done',
  'response.transcription.done',
  'response.transcription.completed',
]);

const TEXT_ERROR_EVENT_TYPES = new Set([
  'response.error',
  'response.failed',
  'transcription.error',
  'transcription.failed',
  'response.transcription.error',
  'response.transcription.failed',
]);

const DELTA_TYPE_PATTERN = /\b(delta|partial|segment|update)\b/i;
const DONE_TYPE_PATTERN = /\b(done|complete|final|finish|stop|completed)\b/i;
const ERROR_TYPE_PATTERN = /\b(error|fail|cancel|abort)\b/i;


/**
 * Gets the file extension from the MIME type.
 * @param {string} mimeType - The MIME type.
 * @returns {string} The file extension.
 */
function getFileExtensionFromMime(mimeType) {
  // Default fallback
  if (!mimeType) {
    return 'webm';
  }

  // Direct lookup (fastest)
  const extension = MIME_TO_EXTENSION_MAP[mimeType];
  if (extension) {
    return extension;
  }

  // Try to extract subtype as fallback
  const subtype = mimeType.split('/')[1]?.toLowerCase();

  // If subtype matches a known extension
  if (['mp3', 'mp4', 'ogg', 'wav', 'webm', 'm4a', 'flac'].includes(subtype)) {
    return subtype === 'mp4' ? 'm4a' : subtype;
  }

  // Generic checks for partial matches
  if (subtype?.includes('mp4') || subtype?.includes('m4a')) {
    return 'm4a';
  }
  if (subtype?.includes('ogg')) {
    return 'ogg';
  }
  if (subtype?.includes('wav')) {
    return 'wav';
  }
  if (subtype?.includes('mp3') || subtype?.includes('mpeg')) {
    return 'mp3';
  }
  if (subtype?.includes('webm')) {
    return 'webm';
  }

  return 'webm'; // Default fallback
}

function normalizeTransport(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function shouldUseRealtimeTransport(sttSchema) {
  if (!sttSchema) {
    return false;
  }

  const transportValue =
    typeof sttSchema.transport === 'string'
      ? extractEnvVariable(sttSchema.transport) || sttSchema.transport
      : sttSchema.transport;
  const transport = normalizeTransport(transportValue);
  if (transport === 'websocket') {
    return true;
  }

  if (transport === 'rest') {
    return false;
  }

  const modelValue =
    typeof sttSchema.model === 'string'
      ? extractEnvVariable(sttSchema.model) || sttSchema.model
      : '';
  const model = modelValue.toLowerCase();
  return REALTIME_MODEL_PATTERN.test(model);
}

function resolveFfmpegPath(sttSchema) {
  const configured = sttSchema?.ffmpegPath ? extractEnvVariable(sttSchema.ffmpegPath) : '';
  return process.env.FFMPEG_PATH || configured || 'ffmpeg';
}

async function convertToPCM16(filePath, { sampleRate, channels, ffmpegPath }) {
  const rate =
    Number.isFinite(sampleRate) && sampleRate > 0 ? Math.floor(sampleRate) : DEFAULT_SAMPLE_RATE;

  const audioChannels = Number.isFinite(channels) && channels > 0 ? Math.floor(channels) : DEFAULT_AUDIO_CHANNELS;
  const binary = ffmpegPath || 'ffmpeg';

  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-f',
      's16le',
      '-acodec',
      'pcm_s16le',
      '-ac',
      String(audioChannels),
      '-ar',
      String(rate),
      '-',
    ];

    const chunks = [];
    let stderr = '';

    const ffmpeg = spawn(binary, args);

    ffmpeg.stdout.on('data', (chunk) => {
      chunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpeg.on('error', (error) => {
      if (error?.code === 'ENOENT') {
        reject(
          new Error(
            'Failed to start ffmpeg process. Install ffmpeg or configure speech.stt.openai.ffmpegPath / FFMPEG_PATH.',
          ),
        );
        return;
      }
      reject(error);
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || 'ffmpeg exited with a non-zero status while converting audio to PCM16.',
          ),
        );
        return;
      }

      resolve(Buffer.concat(chunks));
    });
  });
}

function removeSocketListener(socket, event, listener) {
  if (!socket || typeof listener !== 'function') {
    return;
  }

  if (typeof socket.off === 'function') {
    socket.off(event, listener);
  } else if (typeof socket.removeListener === 'function') {
    socket.removeListener(event, listener);
  }
}

/**
 * Service class for handling Speech-to-Text (STT) operations.
 * @class
 */
class STTService {
  constructor() {
    this.providerStrategies = {
      [STTProviders.OPENAI]: this.openAIProvider,
      [STTProviders.AZURE_OPENAI]: this.azureOpenAIProvider,
    };
  }

  setupStreamResponse(res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  }

  writeStreamEvent(res, event, payload = {}) {
    const data = JSON.stringify({ event, ...payload });
    res.write(`${data}\n`);
    res.flush?.();
  }

  writeStreamError(res, error) {
    const message = error?.message || 'An error occurred while streaming the transcription';
    this.writeStreamEvent(res, 'error', { message });
  }

  /**
   * Creates a singleton instance of STTService.
   * @static
   * @async
   * @returns {Promise<STTService>} The STTService instance.
   * @throws {Error} If the custom config is not found.
   */
  static async getInstance() {
    return new STTService();
  }

  /**
   * Retrieves the configured STT provider and its schema.
   * @param {ServerRequest} req - The request object.
   * @returns {Promise<[string, Object]>} A promise that resolves to an array containing the provider name and its schema.
   * @throws {Error} If no STT schema is set, multiple providers are set, or no provider is set.
   */
  async getProviderSchema(req) {
    const appConfig =
      req.config ??
      (await getAppConfig({
        role: req?.user?.role,
      }));
    const sttSchema = appConfig?.speech?.stt;
    if (!sttSchema) {
      throw new Error(
        'No STT schema is set. Did you configure STT in the custom config (librechat.yaml)?',
      );
    }

    const providers = Object.entries(sttSchema).filter(
      ([, value]) => Object.keys(value).length > 0,
    );

    if (providers.length !== 1) {
      throw new Error(
        providers.length > 1
          ? 'Multiple providers are set. Please set only one provider.'
          : 'No provider is set. Please set a provider.',
      );
    }

    const [provider, schema] = providers[0];
    return [provider, schema];
  }

  /**
   * Recursively removes undefined properties from an object.
   * @param {Object} obj - The object to clean.
   * @returns {void}
   */
  removeUndefined(obj) {
    Object.keys(obj).forEach((key) => {
      if (obj[key] && typeof obj[key] === 'object') {
        this.removeUndefined(obj[key]);
        if (Object.keys(obj[key]).length === 0) {
          delete obj[key];
        }
      } else if (obj[key] === undefined) {
        delete obj[key];
      }
    });
  }

  processStreamingEvent(res, event, state) {
    if (!event) {
      return;
    }

    const descriptors = [];
    const type = typeof event.type === 'string' ? event.type : undefined;
    if (type) {
      descriptors.push(type);
    }

    const eventName = typeof event.event === 'string' ? event.event : undefined;
    if (eventName) {
      descriptors.push(eventName);
    }

    const status = typeof event.status === 'string' ? event.status : undefined;
    if (status) {
      descriptors.push(status);
    }

    const responseType = typeof event.response?.type === 'string' ? event.response.type : undefined;
    if (responseType) {
      descriptors.push(responseType);
    }

    const responseStatus =
      typeof event.response?.status === 'string' ? event.response.status : undefined;
    if (responseStatus) {
      descriptors.push(responseStatus);
    }

    const deltaType = typeof event.delta?.type === 'string' ? event.delta.type : undefined;
    if (deltaType) {
      descriptors.push(deltaType);
    }

    const deltaStatus = typeof event.delta?.status === 'string' ? event.delta.status : undefined;
    if (deltaStatus) {
      descriptors.push(deltaStatus);
    }

    const isErrorEvent =
      descriptors.some((value) => TEXT_ERROR_EVENT_TYPES.has(value) || ERROR_TYPE_PATTERN.test(value)) ||
      Boolean(event?.error) ||
      Boolean(event?.response?.error);

    if (isErrorEvent) {
      const message =
        event?.error?.message ||
        event?.response?.error?.message ||
        'An error occurred while streaming the transcription';

      throw new Error(message);
    }

    const text = extractTextFromEvent(event);
    const hasText = Boolean(text);

    const finalIndicators = [
      event?.is_final,
      event?.isFinal,
      event?.final,
      event?.completed,
      event?.done,
      event?.delta?.is_final,
      event?.delta?.final,
      event?.delta?.done,
      event?.segment?.is_final,
      event?.segment?.final,
      event?.item?.is_final,
      event?.response?.completed,
      event?.response?.done,
    ];

    const isDoneEvent =
      descriptors.some((value) => TEXT_DONE_EVENT_TYPES.has(value) || DONE_TYPE_PATTERN.test(value)) ||
      finalIndicators.some((value) => value === true);

    const isDeltaEvent =
      descriptors.some((value) => TEXT_DELTA_EVENT_TYPES.has(value) || DELTA_TYPE_PATTERN.test(value)) ||
      event?.delta != null ||
      event?.deltas != null ||
      event?.partial === true ||
      event?.is_final === false ||
      event?.segment?.is_final === false ||
      event?.delta?.is_final === false ||
      event?.delta?.final === false ||
      event?.delta?.done === false;

    if (hasText) {
      const { next, delta, rewrite } = appendTranscriptSegment(state.aggregatedText, text, {
        allowRewrite: isDoneEvent,
      });
      state.aggregatedText = next;
      state.finalText = next;

      if (delta && !rewrite && (isDeltaEvent || !isDoneEvent)) {
        this.writeStreamEvent(res, 'delta', { text: delta });
      }
    }

    if (isDoneEvent && !state.doneSent) {
      const trimmed = (state.finalText || state.aggregatedText).trim();
      state.finalText = trimmed;
      this.writeStreamEvent(res, 'done', trimmed ? { text: trimmed } : {});
      state.doneSent = true;
    }
  }

  /**
   * Prepares the request for the OpenAI STT provider.
   * @param {Object} sttSchema - The STT schema for OpenAI.
   * @param {Stream} audioReadStream - The audio data to be transcribed.
   * @param {Object} audioFile - The audio file object (unused in OpenAI provider).
   * @param {string} language - The language code for the transcription.
   * @returns {Array} An array containing the URL, data, and headers for the request.
   */
  openAIProvider(sttSchema, audioReadStream, audioFile, language) {
    const url = sttSchema?.url || 'https://api.openai.com/v1/audio/transcriptions';
    const apiKey = extractEnvVariable(sttSchema.apiKey) || '';

    const data = {
      file: audioReadStream,
      model: sttSchema.model,
    };

    if (language) {
      /** Converted locale code (e.g., "en-US") to ISO-639-1 format (e.g., "en") */
      const isoLanguage = language.split('-')[0];
      data.language = isoLanguage;
    }

    const headers = {
      'Content-Type': 'multipart/form-data',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    };
    [headers].forEach(this.removeUndefined);

    return [url, data, headers];
  }

  async openAIStreamProvider(res, sttSchema, { filePath, language }) {
    const apiKey = extractEnvVariable(sttSchema.apiKey) || '';

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured for STT streaming');
    }

    const clientOptions = { apiKey };

    if (sttSchema?.url) {
      clientOptions.baseURL = sttSchema.url;
    }

    if (sttSchema?.organization) {
      clientOptions.organization = extractEnvVariable(sttSchema.organization);
    }

    const openai = new OpenAI(clientOptions);

    const isoLanguage = language ? language.split('-')[0] : undefined;
    const fileStream = createReadStream(filePath);
    const state = { aggregatedText: '', finalText: '', doneSent: false };

    try {
      const stream = await openai.audio.transcriptions.create({
        file: fileStream,
        model: sttSchema.model,
        stream: true,
        ...(isoLanguage ? { language: isoLanguage } : {}),
      });

      if (typeof stream?.[Symbol.asyncIterator] !== 'function') {
        const fallbackText =
          extractTextFromEvent(stream) || (typeof stream?.text === 'string' ? stream.text : '');
        const trimmedFallback = fallbackText.trim();

        if (trimmedFallback) {
          const { next, delta } = appendTranscriptSegment('', trimmedFallback);
          state.aggregatedText = next;
          state.finalText = trimmedFallback;
          if (delta) {
            this.writeStreamEvent(res, 'delta', { text: delta });
          }
          this.writeStreamEvent(res, 'done', { text: trimmedFallback });
          state.doneSent = true;
        }

        return {
          finalText: (state.finalText || state.aggregatedText).trim(),
          doneSent: state.doneSent,
        };
      }

      for await (const event of stream) {
        this.processStreamingEvent(res, event, state);
      }
    } finally {
      fileStream.close?.();
    }

    const resolvedFinalText = (state.finalText || state.aggregatedText).trim();

    return { finalText: resolvedFinalText, doneSent: state.doneSent };
  }

  async openAIRealtimeStreamProvider(res, sttSchema, { filePath, language }) {
    const apiKey = extractEnvVariable(sttSchema.apiKey) || '';

    if (!apiKey) {
      throw new Error('OpenAI API key is not configured for realtime STT streaming');
    }

    const clientOptions = { apiKey };

    if (sttSchema?.url) {
      clientOptions.baseURL = sttSchema.url;
    }

    if (sttSchema?.organization) {
      clientOptions.organization = extractEnvVariable(sttSchema.organization);
    }

    const openai = new OpenAI(clientOptions);
    const isoLanguage = language ? language.split('-')[0] : undefined;
    const inputFormat = sttSchema?.inputAudioFormat ?? {};
    const encoding =
      typeof inputFormat?.encoding === 'string'
        ? inputFormat.encoding.toLowerCase()
        : DEFAULT_PCM_ENCODING;

    if (encoding !== DEFAULT_PCM_ENCODING) {
      throw new Error(
        `Unsupported realtime input encoding "${encoding}". Only ${DEFAULT_PCM_ENCODING} is supported.`,
      );
    }

    const ffmpegPath = resolveFfmpegPath(sttSchema);
    const pcmBuffer = await convertToPCM16(filePath, {
      sampleRate: inputFormat?.sampleRate,
      channels: inputFormat?.channels,
      ffmpegPath,
    });

    const state = { aggregatedText: '', finalText: '', doneSent: false };

    return new Promise((resolve, reject) => {
      let settled = false;
      const wsClient = new OpenAIRealtimeWS({ model: sttSchema.model }, openai);
      const socket = wsClient.socket;
      let cleanup = () => {};

      const finish = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(result);
      };

      const fail = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      let connectTimeout = setTimeout(() => {
        fail(new Error('Timed out connecting to realtime transcription service'));
      }, REALTIME_CONNECT_TIMEOUT_MS);

      const handleEvent = (event) => {
        try {
          this.processStreamingEvent(res, event, state);
          if (state.doneSent) {
            const resolvedFinalText = (state.finalText || state.aggregatedText).trim();
            finish({ finalText: resolvedFinalText, doneSent: true });
          }
        } catch (error) {
          fail(error);
        }
      };

      const handleError = (error) => {
        fail(error instanceof Error ? error : new Error('Realtime transcription error'));
      };

      const handleClose = () => {
        if (!settled) {
          fail(new Error('Realtime transcription connection closed before completion'));
        }
      };

      const sendAudio = () => {
        if (connectTimeout) {
          clearTimeout(connectTimeout);
          connectTimeout = undefined;
        }

        try {
          wsClient.send({
            type: 'session.update',
            session: {
              modalities: ['text'],
            },
          });

          wsClient.send({
            type: 'transcription_session.update',
            session: {
              modalities: ['text'],
              input_audio_format: encoding,
              input_audio_transcription: {
                model: sttSchema.model,
                ...(isoLanguage ? { language: isoLanguage } : {}),
              },
              turn_detection: null,
            },
          });

          for (let offset = 0; offset < pcmBuffer.length; offset += REALTIME_CHUNK_SIZE) {
            const chunk = pcmBuffer.subarray(offset, offset + REALTIME_CHUNK_SIZE);
            wsClient.send({
              type: 'input_audio_buffer.append',
              audio: chunk.toString('base64'),
            });
          }

          wsClient.send({ type: 'input_audio_buffer.commit' });

          wsClient.send({
            type: 'response.create',
            response: {
              modalities: ['text'],
              instructions: 'Transcribe the provided audio into text.',
            },
          });
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Failed to send audio to realtime service'));
        }
      };

      const handleOpen = () => {
        removeSocketListener(socket, 'open', handleOpen);
        sendAudio();
      };

      cleanup = () => {
        if (connectTimeout) {
          clearTimeout(connectTimeout);
          connectTimeout = undefined;
        }
        wsClient.off('event', handleEvent);
        wsClient.off('error', handleError);
        removeSocketListener(socket, 'open', handleOpen);
        removeSocketListener(socket, 'close', handleClose);
        try {
          wsClient.close();
        } catch (error) {
          logger.debug('Failed to close realtime transcription socket gracefully', error);
        }
      };

      wsClient.on('event', handleEvent);
      wsClient.on('error', handleError);

      if (socket) {
        socket.on('close', handleClose);
        const openState = typeof socket.OPEN === 'number' ? socket.OPEN : 1;
        if (socket.readyState === openState) {
          handleOpen();
        } else {
          socket.on('open', handleOpen);
        }
      } else {
        fail(new Error('Realtime transcription socket unavailable'));
      }
    });
  }

  /**
   * Prepares the request for the Azure OpenAI STT provider.
   * @param {Object} sttSchema - The STT schema for Azure OpenAI.
   * @param {Buffer} audioBuffer - The audio data to be transcribed.
   * @param {Object} audioFile - The audio file object containing originalname, mimetype, and size.
   * @param {string} language - The language code for the transcription.
   * @returns {Array} An array containing the URL, data, and headers for the request.
   * @throws {Error} If the audio file size exceeds 25MB or the audio file format is not accepted.
   */
  azureOpenAIProvider(sttSchema, audioBuffer, audioFile, language) {
    const url = `${genAzureEndpoint({
      azureOpenAIApiInstanceName: extractEnvVariable(sttSchema?.instanceName),
      azureOpenAIApiDeploymentName: extractEnvVariable(sttSchema?.deploymentName),
    })}/audio/transcriptions?api-version=${extractEnvVariable(sttSchema?.apiVersion)}`;

    const apiKey = sttSchema.apiKey ? extractEnvVariable(sttSchema.apiKey) : '';

    if (audioBuffer.byteLength > 25 * 1024 * 1024) {
      throw new Error('The audio file size exceeds the limit of 25MB');
    }

    const acceptedFormats = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'];
    const fileFormat = audioFile.mimetype.split('/')[1];
    if (!acceptedFormats.includes(fileFormat)) {
      throw new Error(`The audio file format ${fileFormat} is not accepted`);
    }

    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: audioFile.originalname,
      contentType: audioFile.mimetype,
    });

    if (language) {
      /** Converted locale code (e.g., "en-US") to ISO-639-1 format (e.g., "en") */
      const isoLanguage = language.split('-')[0];
      formData.append('language', isoLanguage);
    }

    const headers = {
      'Content-Type': 'multipart/form-data',
      ...(apiKey && { 'api-key': apiKey }),
    };

    [headers].forEach(this.removeUndefined);

    return [url, formData, { ...headers, ...formData.getHeaders() }];
  }

  /**
   * Sends an STT request to the specified provider.
   * @async
   * @param {string} provider - The STT provider to use.
   * @param {Object} sttSchema - The STT schema for the provider.
   * @param {Object} requestData - The data required for the STT request.
   * @param {Buffer} requestData.audioBuffer - The audio data to be transcribed.
   * @param {Object} requestData.audioFile - The audio file object containing originalname, mimetype, and size.
   * @param {string} requestData.language - The language code for the transcription.
   * @returns {Promise<string>} A promise that resolves to the transcribed text.
   * @throws {Error} If the provider is invalid, the response status is not 200, or the response data is missing.
   */
  async sttRequest(provider, sttSchema, { audioBuffer, audioFile, language }) {
    const strategy = this.providerStrategies[provider];
    if (!strategy) {
      throw new Error('Invalid provider');
    }

    const fileExtension = getFileExtensionFromMime(audioFile.mimetype);

    const audioReadStream = Readable.from(audioBuffer);
    audioReadStream.path = `audio.${fileExtension}`;

    const [url, data, headers] = strategy.call(
      this,
      sttSchema,
      audioReadStream,
      audioFile,
      language,
    );

    try {
      const response = await axios.post(url, data, { headers });

      if (response.status !== 200) {
        throw new Error('Invalid response from the STT API');
      }

      if (!response.data || !response.data.text) {
        throw new Error('Missing data in response from the STT API');
      }

      return response.data.text.trim();
    } catch (error) {
      logger.error(`STT request failed for provider ${provider}:`, error);
      throw error;
    }
  }

  async streamRequest(res, provider, sttSchema, { filePath, language }) {
    if (provider !== STTProviders.OPENAI) {
      throw new Error(`Streaming STT is not supported for provider ${provider}`);
    }

    if (shouldUseRealtimeTransport(sttSchema)) {
      return this.openAIRealtimeStreamProvider(res, sttSchema, { filePath, language });
    }

    return this.openAIStreamProvider(res, sttSchema, { filePath, language });
  }

  /**
   * Processes a speech-to-text request.
   * @async
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<void>}
   */
  async processSpeechToText(req, res) {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided in the FormData' });
    }

    try {
      const [provider, sttSchema] = await this.getProviderSchema(req);
      const language = req.body?.language || '';
      const streamingRequested = req.query?.stream === 'true' || Boolean(sttSchema.stream);

      if (streamingRequested) {
        this.setupStreamResponse(res);
        try {
          const { finalText, doneSent } = await this.streamRequest(res, provider, sttSchema, {
            filePath: req.file.path,
            language,
          });

          if (!res.writableEnded) {
            if (!doneSent) {
              this.writeStreamEvent(res, 'done', { text: finalText });
            }
            res.end();
          }
        } catch (error) {
          logger.error('An error occurred while streaming the audio:', error);
          if (!res.writableEnded) {
            this.writeStreamError(res, error);
            res.end();
          }
        }

        return;
      }

      const audioBuffer = await fs.readFile(req.file.path);
      const audioFile = {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };

      const text = await this.sttRequest(provider, sttSchema, { audioBuffer, audioFile, language });
      res.json({ text });
    } catch (error) {
      logger.error('An error occurred while processing the audio:', error);
      res.sendStatus(500);
    } finally {
      try {
        await fs.unlink(req.file.path);
        logger.debug('[/speech/stt] Temp. audio upload file deleted');
      } catch {
        logger.debug('[/speech/stt] Temp. audio upload file already deleted');
      }
    }
  }
}

/**
 * Factory function to create an STTService instance.
 * @async
 * @returns {Promise<STTService>} A promise that resolves to an STTService instance.
 */
async function createSTTService() {
  return STTService.getInstance();
}

/**
 * Wrapper function for speech-to-text processing.
 * @async
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Promise<void>}
 */
async function speechToText(req, res) {
  const sttService = await createSTTService();
  await sttService.processSpeechToText(req, res);
}

module.exports = { STTService, speechToText };
