const { logger } = require('@librechat/data-schemas');
const { getAppConfig } = require('~/server/services/Config');

/**
 * This function retrieves the speechTab settings from the custom configuration
 * It first fetches the custom configuration
 * Then, it checks if the custom configuration and the speechTab schema exist
 * If they do, it sends the speechTab settings as a JSON response
 * If they don't, it throws an error
 *
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>}
 * @throws {Error} - If the custom configuration or the speechTab schema is missing, an error is thrown
 */
const DEFAULT_INPUT_FORMAT = {
  encoding: 'pcm16',
  rate: 24000,
  sampleRate: 24000,
  channels: 1,
};

const normalizeInputFormat = (inputFormat) => {
  const resolvedRate = (() => {
    if (typeof inputFormat?.rate === 'number') {
      return inputFormat.rate;
    }
    if (typeof inputFormat?.sampleRate === 'number') {
      return inputFormat.sampleRate;
    }
    if (typeof inputFormat?.sample_rate === 'number') {
      return inputFormat.sample_rate;
    }
    return DEFAULT_INPUT_FORMAT.rate;
  })();

  return {
    encoding: inputFormat?.encoding ?? DEFAULT_INPUT_FORMAT.encoding,
    rate: resolvedRate,
    sampleRate: resolvedRate,
    channels: inputFormat?.channels ?? DEFAULT_INPUT_FORMAT.channels,
    ...Object.fromEntries(
      Object.entries(inputFormat ?? {})
        .filter(([key]) => !['encoding', 'rate', 'sampleRate', 'sample_rate', 'channels'].includes(key))
        .map(([key, value]) => [key, value]),
    ),
  };
};

const buildRealtimeSettings = (realtimeConfig) => {
  if (!realtimeConfig) {
    return null;
  }

  const formatSource =
    realtimeConfig.session?.audio?.input?.format ??
    realtimeConfig.audio?.input?.format ??
    realtimeConfig.inputAudioFormat;

  const normalizedFormat = normalizeInputFormat(formatSource);

  const realtimeSettings = {
    model: realtimeConfig.model,
    transport: realtimeConfig.transport ?? 'websocket',
    stream: typeof realtimeConfig.stream === 'boolean' ? realtimeConfig.stream : true,
    inputAudioFormat: normalizedFormat,
    ...(realtimeConfig.ffmpegPath ? { ffmpegPath: realtimeConfig.ffmpegPath } : {}),
  };

  const sessionConfig = { ...(realtimeConfig.session ?? {}) };
  const sessionAudio = { ...(sessionConfig.audio ?? {}) };
  const sessionAudioInput = {
    ...(sessionAudio.input ?? {}),
    ...(realtimeConfig.audio?.input ?? {}),
  };
  const sessionAudioOutput = {
    ...(sessionAudio.output ?? {}),
    ...(realtimeConfig.audio?.output ?? {}),
  };

  if (Object.keys(sessionAudioInput).length > 0 || normalizedFormat) {
    sessionAudioInput.format = normalizedFormat;
    sessionAudio.input = sessionAudioInput;
  }

  if (Object.keys(sessionAudioOutput).length > 0) {
    sessionAudio.output = sessionAudioOutput;
  }

  if (Object.keys(sessionAudio).length > 0) {
    sessionConfig.audio = sessionAudio;
  }

  if (Object.keys(sessionConfig).length > 0) {
    realtimeSettings.session = sessionConfig;
  }

  const topLevelAudio = { ...(realtimeConfig.audio ?? {}) };
  if (Object.keys(sessionAudioInput).length > 0 || normalizedFormat) {
    topLevelAudio.input = {
      ...(topLevelAudio.input ?? {}),
      ...sessionAudioInput,
      format: normalizedFormat,
    };
  }

  if (Object.keys(sessionAudioOutput).length > 0) {
    topLevelAudio.output = {
      ...(topLevelAudio.output ?? {}),
      ...sessionAudioOutput,
    };
  }

  if (Object.keys(topLevelAudio).length > 0) {
    realtimeSettings.audio = topLevelAudio;
  }

  if (Array.isArray(realtimeConfig.include)) {
    realtimeSettings.include = [...realtimeConfig.include];
  }

  return realtimeSettings;
};

async function getCustomConfigSpeech(req, res) {
  try {
    const appConfig = await getAppConfig({
      role: req.user?.role,
    });

    if (!appConfig) {
      return res.status(200).send({
        message: 'not_found',
      });
    }

    const sttExternal = !!appConfig.speech?.stt;
    const ttsExternal = !!appConfig.speech?.tts;
    let settings = {
      sttExternal,
      ttsExternal,
    };

    if (!appConfig.speech?.speechTab) {
      const realtimeConfig = buildRealtimeSettings(appConfig.speech?.stt?.realtime);

      if (realtimeConfig) {
        settings = {
          ...settings,
          realtime: realtimeConfig,
        };
      }

      return res.status(200).send(settings);
    }

    const speechTab = appConfig.speech.speechTab;

    if (speechTab.conversationMode !== undefined) {
      settings.conversationMode = speechTab.conversationMode;
    }

    if (speechTab.advancedMode !== undefined) {
      settings.advancedMode = speechTab.advancedMode;
    }

    if (speechTab.speechToText) {
      for (const key in speechTab.speechToText) {
        if (speechTab.speechToText[key] !== undefined) {
          settings[key] = speechTab.speechToText[key];
        }
      }
    }

    const realtimeConfig = buildRealtimeSettings(appConfig.speech?.stt?.realtime);

    if (realtimeConfig) {
      settings.realtime = realtimeConfig;
    }

    if (speechTab.textToSpeech) {
      for (const key in speechTab.textToSpeech) {
        if (speechTab.textToSpeech[key] !== undefined) {
          settings[key] = speechTab.textToSpeech[key];
        }
      }
    }

    return res.status(200).send(settings);
  } catch (error) {
    logger.error('Failed to get custom config speech settings:', error);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = getCustomConfigSpeech;
