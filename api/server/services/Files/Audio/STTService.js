const axios = require('axios');
const fs = require('fs').promises;
const { createReadStream } = require('fs');
const FormData = require('form-data');
const { Readable } = require('stream');
const OpenAI = require('openai');
const { logger } = require('@librechat/data-schemas');
const { genAzureEndpoint } = require('@librechat/api');
const { extractEnvVariable, STTProviders } = require('librechat-data-provider');
const { getAppConfig } = require('~/server/services/Config');

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

const TEXT_DELTA_EVENT_TYPES = new Set([
  'transcript.text.delta',
  'transcript.delta',
  'transcript.segment.delta',
  'response.output_text.delta',
  'response.audio.transcript.delta',
]);

const TEXT_DONE_EVENT_TYPES = new Set([
  'transcript.text.done',
  'transcript.done',
  'response.completed',
  'response.output_text.done',
  'response.audio.transcript.done',
]);

const TEXT_ERROR_EVENT_TYPES = new Set(['response.error', 'response.failed']);


const TEXT_KEY_PATTERN = /(?:text|transcript|content|value|word|caption|utterance|delta|string|display|normalized)/i;

function collectTextFromStructure(value, visited = new Set(), context = false) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return context && trimmed ? value : '';
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => collectTextFromStructure(item, visited, context))
      .filter(Boolean);

    if (parts.length === 0) {
      return '';
    }

    return context ? parts.join('') : parts.join(' ');
  }

  if (typeof value !== 'object') {
    return '';
  }

  if (visited.has(value)) {
    return '';
  }

  visited.add(value);

  const parts = Object.entries(value)
    .map(([key, item]) => {
      if (item == null) {
        return '';
      }

      const lowerKey = key.toLowerCase();
      const nextContext = context || TEXT_KEY_PATTERN.test(lowerKey);
      return collectTextFromStructure(item, visited, nextContext);
    })
    .filter(Boolean);

  visited.delete(value);

  if (parts.length === 0) {
    return '';
  }

  const joined = parts.join(' ');
  return context ? joined : joined.trim();
}

function extractTextFromTranscript(transcript) {
  if (!transcript) {
    return '';
  }

  if (typeof transcript === 'string') {
    return transcript;
  }

  if (Array.isArray(transcript)) {
    const combined = transcript
      .map((item) => extractTextFromTranscript(item))
      .filter(Boolean)
      .join(' ');

    const trimmed = combined.trim();
    return trimmed ? combined : '';
  }

  if (typeof transcript !== 'object') {
    return '';
  }

  if (typeof transcript.text === 'string' && transcript.text.trim()) {
    return transcript.text;
  }

  if (Array.isArray(transcript.text)) {
    const combined = transcript.text
      .map((item) => (typeof item === 'string' ? item : extractTextFromTranscript(item)))
      .filter(Boolean)
      .join('');

    if (combined.trim()) {
      return combined;
    }
  }

  if (Array.isArray(transcript.items)) {
    const combined = transcript.items
      .map((item) => {
        if (!item) {
          return '';
        }

        if (typeof item === 'string') {
          return item;
        }

        if (typeof item.text === 'string' && item.text.trim()) {
          return item.text;
        }

        if (Array.isArray(item.text)) {
          return item.text
            .map((entry) => (typeof entry === 'string' ? entry : extractTextFromTranscript(entry)))
            .filter(Boolean)
            .join('');
        }

        if (typeof item.content === 'string' && item.content.trim()) {
          return item.content;
        }

        if (Array.isArray(item.content)) {
          return item.content
            .map((entry) => (typeof entry === 'string' ? entry : extractTextFromTranscript(entry)))
            .filter(Boolean)
            .join('');
        }

        if (Array.isArray(item.alternatives)) {
          for (const alt of item.alternatives) {
            if (!alt) {
              continue;
            }

            if (typeof alt === 'string' && alt.trim()) {
              return alt;
            }

            if (typeof alt.text === 'string' && alt.text.trim()) {
              return alt.text;
            }
          }
        }

        if (typeof item.value === 'string' && item.value.trim()) {
          return item.value;
        }

        if (Array.isArray(item.value)) {
          return item.value
            .map((entry) => (typeof entry === 'string' ? entry : extractTextFromTranscript(entry)))
            .filter(Boolean)
            .join('');
        }

        return extractTextFromTranscript(item);
      })
      .filter(Boolean)
      .join(' ');

    if (combined.trim()) {
      return combined;
    }
  }

  if (transcript.transcript) {
    const text = extractTextFromTranscript(transcript.transcript);
    if (text) {
      return text;
    }
  }

  if (transcript.delta) {
    const text = extractTextFromDelta(transcript.delta);
    if (text) {
      return text;
    }
  }

  const fallback = collectTextFromStructure(transcript, new Set(), true);
  return fallback.trim() ? fallback : '';
}

function extractTextFromContent(content) {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (!item) {
        return '';
      }

      if (typeof item === 'string') {
        return item;
      }

      if (typeof item.text === 'string') {
        return item.text;
      }

      return '';
    })
    .join('');
}

function extractTextFromResponse(response) {
  if (!response || typeof response !== 'object') {
    return '';
  }

  if (Array.isArray(response.output_text) && response.output_text.length > 0) {
    const text = response.output_text.filter((part) => typeof part === 'string').join('');
    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(response.output)) {
    const text = response.output
      .map((item) => extractTextFromContent(item?.content))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(response.content)) {
    const text = extractTextFromContent(response.content);
    if (text.trim()) {
      return text;
    }
  }

  return '';
}

function extractTextFromDelta(delta) {
  if (!delta) {
    return '';
  }

  if (typeof delta === 'string') {
    return delta;
  }

  if (Array.isArray(delta)) {
    return delta
      .map((item) => extractTextFromDelta(item))
      .filter(Boolean)
      .join('');
  }

  if (typeof delta !== 'object') {
    return '';
  }

  if (typeof delta.text === 'string' && delta.text.trim()) {
    return delta.text;
  }

  if (Array.isArray(delta.text) && delta.text.length > 0) {
    const text = delta.text
      .map((item) => (typeof item === 'string' ? item : extractTextFromDelta(item)))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (typeof delta.output_text === 'string' && delta.output_text.trim()) {
    return delta.output_text;
  }

  if (Array.isArray(delta.output_text) && delta.output_text.length > 0) {
    const text = delta.output_text
      .map((item) => (typeof item === 'string' ? item : extractTextFromDelta(item)))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (delta.transcript) {
    const text = extractTextFromTranscript(delta.transcript);
    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.transcripts) && delta.transcripts.length > 0) {
    const text = delta.transcripts
      .map((entry) => extractTextFromTranscript(entry))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.items) && delta.items.length > 0) {
    const text = extractTextFromTranscript({ items: delta.items });
    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.alternatives) && delta.alternatives.length > 0) {
    const text = delta.alternatives
      .map((alternative) => {
        if (!alternative) {
          return '';
        }

        if (typeof alternative === 'string' && alternative.trim()) {
          return alternative;
        }

        if (typeof alternative.text === 'string' && alternative.text.trim()) {
          return alternative.text;
        }

        return extractTextFromTranscript(alternative);
      })
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  if (Array.isArray(delta.content) && delta.content.length > 0) {
    const text = extractTextFromContent(delta.content);
    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(delta.output) && delta.output.length > 0) {
    const text = delta.output
      .map((item) => extractTextFromContent(item?.content))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (delta.segment) {
    const text = extractTextFromDelta(delta.segment);
    if (text.trim()) {
      return text;
    }
  }

  if (Array.isArray(delta.segments) && delta.segments.length > 0) {
    const text = delta.segments
      .map((segment) => {
        if (!segment) {
          return '';
        }

        if (typeof segment === 'string') {
          return segment;
        }

        if (typeof segment.text === 'string' && segment.text.trim()) {
          return segment.text;
        }

        return extractTextFromTranscript(segment);
      })
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  const responseText = extractTextFromResponse(delta.response || delta.result);
  if (responseText.trim()) {
    return responseText;
  }

  const fallback = collectTextFromStructure(delta, new Set(), false);
  const trimmed = fallback.trim();
  return trimmed ? fallback : '';
}

function extractTextFromEvent(event) {
  if (!event || typeof event !== 'object') {
    return '';
  }

  if (typeof event.text === 'string' && event.text.trim()) {
    return event.text;
  }

  if (Array.isArray(event.text) && event.text.length > 0) {
    const text = event.text
      .map((item) => (typeof item === 'string' ? item : extractTextFromDelta(item)))
      .filter(Boolean)
      .join('');

    if (text.trim()) {
      return text;
    }
  }

  if (typeof event.delta === 'string' && event.delta.trim()) {
    return event.delta;
  }

  const deltaText = extractTextFromDelta(event.delta);
  if (deltaText.trim()) {
    return deltaText;
  }

  if (typeof event.output_text === 'string' && event.output_text.trim()) {
    return event.output_text;
  }

  if (Array.isArray(event.output_text) && event.output_text.length > 0) {
    const text = event.output_text.filter((part) => typeof part === 'string').join('');
    if (text.trim()) {
      return text;
    }
  }

  if (event.segment && typeof event.segment.text === 'string' && event.segment.text.trim()) {
    return event.segment.text;
  }

  if (Array.isArray(event.segments)) {
    const text = event.segments
      .map((segment) => (segment && typeof segment.text === 'string' ? segment.text : ''))
      .filter(Boolean)
      .join(' ');

    if (text.trim()) {
      return text;
    }
  }

  if (event.transcript) {
    const text = extractTextFromTranscript(event.transcript);
    if (text) {
      return text;
    }
  }

  if (Array.isArray(event.transcripts) && event.transcripts.length > 0) {
    const text = event.transcripts
      .map((entry) => extractTextFromTranscript(entry))
      .filter(Boolean)
      .join(' ')
      .trim();

    if (text) {
      return text;
    }
  }

  if (event.item) {
    const text = extractTextFromTranscript(event.item);
    if (text) {
      return text;
    }
  }

  if (Array.isArray(event.items) && event.items.length > 0) {
    const text = extractTextFromTranscript({ items: event.items });
    if (text) {
      return text;
    }
  }

  const responseText = extractTextFromResponse(event.response || event.result);
  if (responseText.trim()) {
    return responseText;
  }

  if (Array.isArray(event.content)) {
    const text = extractTextFromContent(event.content);
    if (text.trim()) {
      return text;
    }
  }

  const fallback = collectTextFromStructure(event, new Set(), false);
  const trimmed = fallback.trim();
  return trimmed ? fallback : '';
}

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

    let finalText = '';
    let doneSent = false;

    try {
      const stream = await openai.audio.transcriptions.create({
        file: fileStream,
        model: sttSchema.model,
        stream: true,
        ...(isoLanguage ? { language: isoLanguage } : {}),
      });

      for await (const event of stream) {
        const type = event?.type;

        if (!type) {
          continue;
        }

        if (TEXT_DELTA_EVENT_TYPES.has(type)) {
          const deltaText = extractTextFromEvent(event);

          if (deltaText) {
            finalText += deltaText;
            this.writeStreamEvent(res, 'delta', { text: deltaText });
          }

          continue;
        }

        if (TEXT_DONE_EVENT_TYPES.has(type)) {
          const resolvedText = extractTextFromEvent(event);

          if (resolvedText) {
            finalText = resolvedText;
          }

          this.writeStreamEvent(res, 'done', { text: finalText });
          doneSent = true;
          continue;
        }

        if (TEXT_ERROR_EVENT_TYPES.has(type)) {
          const message =
            event?.error?.message ||
            event?.response?.error?.message ||
            'An error occurred while streaming the transcription';

          throw new Error(message);
        }
      }
    } finally {
      fileStream.close?.();
    }

    return { finalText: finalText.trim(), doneSent };
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
