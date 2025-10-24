const getCustomConfigSpeech = require('./getCustomConfigSpeech');
const TTSService = require('./TTSService');
const STTService = require('./STTService');
const getVoices = require('./getVoices');
const {
  RealtimeSTTService,
  RealtimeSTTError,
  issueRealtimeSession,
} = require('./RealtimeSTTService');

module.exports = {
  getVoices,
  getCustomConfigSpeech,
  ...STTService,
  ...TTSService,
  RealtimeSTTService,
  RealtimeSTTError,
  issueRealtimeSession,
};
