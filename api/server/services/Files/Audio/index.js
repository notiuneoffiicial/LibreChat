const getCustomConfigSpeech = require('./getCustomConfigSpeech');
const TTSService = require('./TTSService');
const STTService = require('./STTService');
const getVoices = require('./getVoices');
const {
  RealtimeCallService,
  RealtimeCallError,
  createRealtimeCall,
  REALTIME_CALLS_ENDPOINT,
} = require('./RealtimeCallService');

module.exports = {
  getVoices,
  getCustomConfigSpeech,
  ...STTService,
  ...TTSService,
  RealtimeCallService,
  RealtimeCallError,
  createRealtimeCall,
  REALTIME_CALLS_ENDPOINT,
};
