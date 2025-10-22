import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EModelEndpoint } from 'librechat-data-provider';
import { Mic, MicOff, Volume2, X } from 'lucide-react';
import { Spinner, useToastContext } from '@librechat/client';
import { useRecoilState, useRecoilValue } from 'recoil';
import AnimatedOrb from '../../../../../voice/animated-orb';
import { useChatContext } from '~/Providers';
import { useGetAudioSettings, useLocalize, useSpeechToText } from '~/hooks';
import usePauseGlobalAudio from '~/hooks/Audio/usePauseGlobalAudio';
import VoiceDropdown from '~/components/Nav/SettingsTabs/Speech/TTS/VoiceDropdown';
import store from '~/store';

interface VoiceModeOverlayProps {
  index: number;
}

const ACTIVITY_IDLE = 0.12;
const ACTIVITY_LISTENING = 0.55;
const ACTIVITY_RESPONDING = 0.7;
const ACTIVITY_SPEAKING = 0.95;
const ACTIVITY_PROCESSING = 0.45;

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } },
};

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.25, ease: 'easeIn' } },
};

const contentVariants = {
  initial: { opacity: 0, y: 30, filter: 'blur(16px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.45, ease: 'easeOut', delay: 0.12 },
  },
  exit: {
    opacity: 0,
    y: 20,
    filter: 'blur(12px)',
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

const headerVariants = {
  initial: { opacity: 0, y: -16, filter: 'blur(10px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: 'easeOut', delay: 0.22 },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: 'blur(8px)',
    transition: { duration: 0.25, ease: 'easeIn' },
  },
};

const orbContainerVariants = {
  initial: { opacity: 0, scale: 0.85, filter: 'blur(22px)' },
  animate: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: 'easeOut', delay: 0.3 },
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    filter: 'blur(18px)',
    transition: { duration: 0.28, ease: 'easeIn' },
  },
};

const footerVariants = {
  initial: { opacity: 0, y: 28, filter: 'blur(12px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: 'easeOut', delay: 0.42 },
  },
  exit: {
    opacity: 0,
    y: 24,
    filter: 'blur(12px)',
    transition: { duration: 0.24, ease: 'easeIn' },
  },
};

const textTransitionVariants = {
  initial: { opacity: 0, filter: 'blur(12px)' },
  animate: {
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    filter: 'blur(12px)',
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

const menuVariants = {
  initial: { opacity: 0, y: -12, filter: 'blur(10px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.3, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(10px)',
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

export default function VoiceModeOverlay({ index }: VoiceModeOverlayProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { ask, isSubmitting, conversation, setConversation } = useChatContext();

  const [isOpen, setIsOpen] = useRecoilState(store.voiceModeActive);
  const [speechEnabled, setSpeechEnabled] = useRecoilState(store.speechToText);
  const [ttsEnabled, setTtsEnabled] = useRecoilState(store.textToSpeech);
  const [automaticPlayback, setAutomaticPlayback] = useRecoilState(store.automaticPlayback);
  const autoSendDelay = useRecoilValue(store.autoSendText);
  const globalAudioPlaying = useRecoilValue(store.globalAudioPlayingFamily(index));
  const globalAudioFetching = useRecoilValue(store.globalAudioFetchingFamily(index));

  const { textToSpeechEndpoint } = useGetAudioSettings();
  const { pauseGlobalAudio } = usePauseGlobalAudio(index);

  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [activityLevel, setActivityLevel] = useState(ACTIVITY_IDLE);
  const [micEnabled, setMicEnabled] = useState(false);
  const speakingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRecordingRef = useRef<(() => void | Promise<void>) | null>(null);
  const pauseGlobalAudioRef = useRef(pauseGlobalAudio);
  const respondingAnimationRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);
  const previousOverflow = useRef('');
  const previousSpeechEnabled = useRef(speechEnabled);
  const previousTtsEnabled = useRef(ttsEnabled);
  const previousAutomaticPlayback = useRef(automaticPlayback);
  const transcriptRef = useRef('');
  const lastSubmittedRef = useRef('');
  const responseActiveRef = useRef(false);
  const storedEndpoint = useRef<{ value: string | null; stored: boolean }>({
    value: null,
    stored: false,
  });
  const storedModel = useRef<{ value: string | null; stored: boolean }>({
    value: null,
    stored: false,
  });
  const storedEndpointType = useRef<{ value: string | null; stored: boolean }>({
    value: null,
    stored: false,
  });
  const overlayTitleId = 'voice-mode-overlay-title';
  const voiceMenuId = 'voice-mode-voice-menu';

  const cleanupSpeakingTimeout = useCallback(() => {
    if (speakingTimeout.current) {
      clearTimeout(speakingTimeout.current);
      speakingTimeout.current = null;
    }
  }, []);

  const clearAutoSendTimeout = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  }, []);

  const stopRespondingAnimation = useCallback(() => {
    if (respondingAnimationRef.current !== null) {
      cancelAnimationFrame(respondingAnimationRef.current);
      respondingAnimationRef.current = null;
    }
  }, []);

  const updateActivityLevel = useCallback((value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setActivityLevel((prev) => (Math.abs(prev - clamped) < 0.001 ? prev : clamped));
  }, []);

  const resetActivity = useCallback(() => {
    stopRespondingAnimation();
    updateActivityLevel(ACTIVITY_IDLE);
    setIsUserSpeaking(false);
  }, [stopRespondingAnimation, updateActivityLevel]);

  const submitTranscript = useCallback(
    (text: string) => {
      const trimmed = text.trim();

      if (!trimmed) {
        setInterimTranscript('');
        clearAutoSendTimeout();
        return;
      }

      if (isSubmitting) {
        showToast({
          status: 'warning',
          message: localize('com_ui_voice_overlay_error_submitting'),
        });
        clearAutoSendTimeout();
        return;
      }

      if (lastSubmittedRef.current === trimmed) {
        setLastTranscript(trimmed);
        setInterimTranscript('');
        return;
      }

      lastSubmittedRef.current = trimmed;
      ask({ text: trimmed });
      setLastTranscript(trimmed);
      setInterimTranscript('');
      clearAutoSendTimeout();
      transcriptRef.current = '';
      setIsUserSpeaking(false);
    },
    [ask, clearAutoSendTimeout, isSubmitting, localize, showToast],
  );

  const handleInterim = useCallback(
    (text: string) => {
      setInterimTranscript(text);
      const trimmed = text.trim();
      transcriptRef.current = trimmed;

      setIsUserSpeaking(true);
      clearAutoSendTimeout();
      cleanupSpeakingTimeout();
      speakingTimeout.current = setTimeout(() => {
        setIsUserSpeaking(false);
      }, 320);
    },
    [cleanupSpeakingTimeout, clearAutoSendTimeout],
  );

  const handleComplete = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      transcriptRef.current = trimmed;
      setInterimTranscript('');

      if (!trimmed) {
        return;
      }

      submitTranscript(trimmed);
    },
    [submitTranscript],
  );

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    handleInterim,
    handleComplete,
    { autoSendOnSuccess: true, enableHotkeys: isOpen },
  );

  isListeningRef.current = isListening;
  stopRecordingRef.current = stopRecording;

  useEffect(() => {
    pauseGlobalAudioRef.current = pauseGlobalAudio;
  }, [pauseGlobalAudio]);

  useEffect(() => {
    return () => {
      cleanupSpeakingTimeout();
      clearAutoSendTimeout();
      pauseGlobalAudioRef.current?.();
      const stopFn = stopRecordingRef.current;
      if (stopFn) {
        void stopFn();
      }
      setMicEnabled(false);
    };
  }, [cleanupSpeakingTimeout, clearAutoSendTimeout]);

  const restoreVoiceSelection = useCallback(() => {
    if (!storedEndpoint.current.stored && !storedModel.current.stored) {
      return;
    }

    setConversation((prev) => {
      if (!prev) {
        return prev;
      }

      const nextConversation = { ...prev };

      if (storedEndpoint.current.stored) {
        if (storedEndpoint.current.value === null) {
          nextConversation.endpoint = undefined;
        } else {
          nextConversation.endpoint = storedEndpoint.current.value;
        }
      }

      if (storedEndpointType.current.stored) {
        if (storedEndpointType.current.value === null) {
          nextConversation.endpointType = undefined;
        } else {
          nextConversation.endpointType = storedEndpointType.current.value as EModelEndpoint;
        }
      }

      if (storedModel.current.stored) {
        if (storedModel.current.value === null) {
          nextConversation.model = undefined;
        } else {
          nextConversation.model = storedModel.current.value;
        }
      }

      return nextConversation;
    });

    storedEndpoint.current = { value: null, stored: false };
    storedEndpointType.current = { value: null, stored: false };
    storedModel.current = { value: null, stored: false };
  }, [setConversation]);

  useEffect(() => {
    if (!isOpen || !conversation) {
      return;
    }

    if (!storedEndpoint.current.stored) {
      storedEndpoint.current = {
        value: conversation.endpoint ?? null,
        stored: true,
      };
    }

    if (!storedEndpointType.current.stored) {
      storedEndpointType.current = {
        value: conversation.endpointType ?? null,
        stored: true,
      };
    }

    if (!storedModel.current.stored) {
      storedModel.current = {
        value: conversation.model ?? null,
        stored: true,
      };
    }

    setConversation((prev) => {
      if (!prev) {
        return prev;
      }

      if (
        prev.endpoint === 'Deepseek' &&
        prev.model === 'deepseek-chat' &&
        prev.endpointType === EModelEndpoint.custom
      ) {
        return prev;
      }

      return {
        ...prev,
        endpoint: 'Deepseek',
        endpointType: EModelEndpoint.custom,
        model: 'deepseek-chat',
      };
    });
  }, [conversation, isOpen, setConversation]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    previousSpeechEnabled.current = speechEnabled;
    previousTtsEnabled.current = ttsEnabled;
    previousAutomaticPlayback.current = automaticPlayback;

    if (!speechEnabled) {
      setSpeechEnabled(true);
    }
    if (!ttsEnabled) {
      setTtsEnabled(true);
    }
    if (!automaticPlayback) {
      setAutomaticPlayback(true);
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeOverlay();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow.current;
      window.removeEventListener('keydown', handleKeyDown);
      setSpeechEnabled(previousSpeechEnabled.current);
      setTtsEnabled(previousTtsEnabled.current);
      setAutomaticPlayback(previousAutomaticPlayback.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      cleanupSpeakingTimeout();
      clearAutoSendTimeout();
      setInterimTranscript('');
      setLastTranscript('');
      transcriptRef.current = '';
      lastSubmittedRef.current = '';
      responseActiveRef.current = false;
      resetActivity();
      setShowVoiceMenu(false);
      restoreVoiceSelection();
      pauseGlobalAudio();
      setMicEnabled(false);
      const stopFn = stopRecordingRef.current;
      if (stopFn) {
        void stopFn();
      }
    }
  }, [
    cleanupSpeakingTimeout,
    clearAutoSendTimeout,
    isOpen,
    pauseGlobalAudio,
    resetActivity,
    restoreVoiceSelection,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (!micEnabled) {
      void stopRecordingRef.current?.();
      return;
    }

    if (globalAudioPlaying || globalAudioFetching || isSubmitting) {
      if (isListening) {
        void stopRecording();
      }

      transcriptRef.current = '';
      setInterimTranscript('');
      setIsUserSpeaking(false);
      return;
    }

    if (!isListening && !isLoading && !globalAudioPlaying && !globalAudioFetching) {
      void startRecording();
    }
  }, [
    globalAudioFetching,
    globalAudioPlaying,
    isListening,
    isLoading,
    isOpen,
    isSubmitting,
    micEnabled,
    setInterimTranscript,
    setIsUserSpeaking,
    startRecording,
    stopRecording,
  ]);

  const hasActiveSpeech = useMemo(
    () => Boolean(interimTranscript.trim() || transcriptRef.current),
    [interimTranscript],
  );

  const statusKey = useMemo(() => {
    if (globalAudioPlaying) {
      return 'com_ui_voice_overlay_status_speaking' as const;
    }

    if (isSubmitting || globalAudioFetching || isLoading) {
      return 'com_ui_voice_overlay_status_processing' as const;
    }

    if (!micEnabled) {
      return 'com_ui_voice_overlay_status_muted' as const;
    }

    if (isUserSpeaking || (isListening && hasActiveSpeech)) {
      return 'com_ui_voice_overlay_status_listening' as const;
    }

    if (isListening) {
      return 'com_ui_voice_overlay_status_ready' as const;
    }

    return 'com_ui_voice_overlay_status_ready' as const;
  }, [
    globalAudioFetching,
    globalAudioPlaying,
    hasActiveSpeech,
    isListening,
    isLoading,
    isSubmitting,
    isUserSpeaking,
    micEnabled,
  ]);

  const orbState = useMemo(() => {
    if (globalAudioPlaying) {
      return 'responding';
    }

    if (isSubmitting || globalAudioFetching || isLoading) {
      return 'processing';
    }

    if (!micEnabled) {
      return 'muted';
    }

    if (isUserSpeaking || (isListening && hasActiveSpeech)) {
      return 'listening';
    }

    if (isListening) {
      return 'ready';
    }

    return 'ready';
  }, [
    globalAudioFetching,
    globalAudioPlaying,
    hasActiveSpeech,
    isListening,
    isLoading,
    isSubmitting,
    isUserSpeaking,
    micEnabled,
  ]);

  const orbVisualState = useMemo(() => {
    if (orbState === 'muted') {
      return {
        glow: 0.85,
        hoverIntensity: 0.25,
        animation: { scale: 0.9, opacity: 0.75 },
      };
    }

    switch (orbState) {
      case 'responding':
        return {
          glow: 1.65,
          hoverIntensity: 0.9,
          animation: { scale: 1.08, opacity: 1 },
        };
      case 'processing':
        return {
          glow: 1.4,
          hoverIntensity: 0.65,
          animation: { scale: 0.98, opacity: 0.95 },
        };
      case 'listening':
        return {
          glow: 1.5,
          hoverIntensity: 0.85,
          animation: { scale: 1.05, opacity: 1 },
        };
      default:
        return {
          glow: 1.3,
          hoverIntensity: 0.5,
          animation: { scale: 1, opacity: 1 },
        };
    }
  }, [orbState]);

  const transcriptToDisplay = interimTranscript || lastTranscript;
  const statusText = localize(statusKey);
  const silenceDelay = autoSendDelay >= 0 ? autoSendDelay : null;
  const silenceValueText = useMemo(
    () =>
      silenceDelay != null
        ? localize('com_ui_voice_overlay_silence_value', { seconds: silenceDelay })
        : null,
    [localize, silenceDelay],
  );
  const silenceDescriptionText = useMemo(
    () =>
      silenceDelay != null
        ? localize('com_ui_voice_overlay_silence_description', { seconds: silenceDelay })
        : null,
    [localize, silenceDelay],
  );
  const usingExternalVoices = textToSpeechEndpoint === 'external';

  const microphoneButtonClass = micEnabled
    ? 'bg-[#ff3b30]/90 hover:bg-[#ff3b30] text-white shadow-[0_0_35px_rgba(255,59,48,0.45)] ring-2 ring-red-300/70 scale-105'
    : 'bg-white/10 hover:bg-white/20 text-white/90 shadow-lg ring-2 ring-transparent';

  useEffect(() => {
    if (orbState === 'muted') {
      stopRespondingAnimation();
      updateActivityLevel(ACTIVITY_IDLE);
      return () => {
        stopRespondingAnimation();
      };
    }

    if (isUserSpeaking) {
      updateActivityLevel(ACTIVITY_SPEAKING);
      return () => {
        stopRespondingAnimation();
      };
    }

    if (orbState === 'responding') {
      const animate = (time: number) => {
        const oscillation = (Math.sin(time * 0.004) + 1) / 2;
        const minLevel = Math.max(ACTIVITY_LISTENING, ACTIVITY_RESPONDING - 0.25);
        const maxLevel = ACTIVITY_SPEAKING;
        const nextLevel = minLevel + (maxLevel - minLevel) * oscillation;
        updateActivityLevel(nextLevel);
        respondingAnimationRef.current = requestAnimationFrame(animate);
      };

      respondingAnimationRef.current = requestAnimationFrame(animate);

      return () => {
        stopRespondingAnimation();
      };
    }

    stopRespondingAnimation();

    if (orbState === 'processing') {
      updateActivityLevel(ACTIVITY_PROCESSING);
    } else if (orbState === 'listening') {
      updateActivityLevel(ACTIVITY_LISTENING);
    } else {
      updateActivityLevel(ACTIVITY_IDLE);
    }

    return () => {
      stopRespondingAnimation();
    };
  }, [isUserSpeaking, orbState, stopRespondingAnimation, updateActivityLevel]);

  useEffect(() => {
    const responseActive = isSubmitting || globalAudioPlaying || globalAudioFetching;

    if (responseActive) {
      responseActiveRef.current = true;
      return;
    }

    if (responseActiveRef.current) {
      setInterimTranscript('');
      setLastTranscript('');
      transcriptRef.current = '';
      responseActiveRef.current = false;
    }
  }, [globalAudioFetching, globalAudioPlaying, isSubmitting]);

  const closeOverlay = useCallback(() => {
    cleanupSpeakingTimeout();
    clearAutoSendTimeout();
    setInterimTranscript('');
    setLastTranscript('');
    transcriptRef.current = '';
    lastSubmittedRef.current = '';
    responseActiveRef.current = false;
    resetActivity();
    setShowVoiceMenu(false);
    pauseGlobalAudio();
    setMicEnabled(false);
    void stopRecording();
    void stopRecordingRef.current?.();
    setIsOpen(false);
  }, [
    cleanupSpeakingTimeout,
    clearAutoSendTimeout,
    pauseGlobalAudio,
    resetActivity,
    setIsOpen,
    stopRecording,
  ]);

  const toggleMicrophone = useCallback(() => {
    const nextEnabled = !micEnabled;
    clearAutoSendTimeout();
    setMicEnabled(nextEnabled);

    if (!nextEnabled) {
      cleanupSpeakingTimeout();
      void stopRecording();
      void stopRecordingRef.current?.();
      setIsUserSpeaking(false);
      stopRespondingAnimation();
      updateActivityLevel(ACTIVITY_IDLE);
      return;
    }

    transcriptRef.current = '';
    lastSubmittedRef.current = '';

    if (
      !isListening &&
      !isLoading &&
      !isSubmitting &&
      !globalAudioPlaying &&
      !globalAudioFetching
    ) {
      void startRecording();
    }
  }, [
    cleanupSpeakingTimeout,
    clearAutoSendTimeout,
    globalAudioFetching,
    globalAudioPlaying,
    isListening,
    isLoading,
    isSubmitting,
    micEnabled,
    startRecording,
    stopRecording,
    stopRespondingAnimation,
    updateActivityLevel,
  ]);

  useEffect(() => {
    if (!isOpen || !micEnabled || silenceDelay == null) {
      clearAutoSendTimeout();
      return;
    }

    if (isUserSpeaking || interimTranscript.trim()) {
      clearAutoSendTimeout();
      return;
    }

    if (!transcriptRef.current) {
      clearAutoSendTimeout();
      return;
    }

    if (autoSendTimeoutRef.current) {
      return;
    }

    autoSendTimeoutRef.current = setTimeout(() => {
      autoSendTimeoutRef.current = null;
      if (micEnabled) {
        toggleMicrophone();
      }
    }, silenceDelay * 1000);

    return () => {
      clearAutoSendTimeout();
    };
  }, [
    clearAutoSendTimeout,
    interimTranscript,
    isOpen,
    isUserSpeaking,
    micEnabled,
    silenceDelay,
    toggleMicrophone,
  ]);
  const microphoneIcon = useMemo(() => {
    if (isLoading) {
      return <Spinner className="h-8 w-8 text-white" />;
    }

    if (micEnabled) {
      return <MicOff className="h-10 w-10" />;
    }

    return <Mic className="h-10 w-10" />;
  }, [isLoading, micEnabled]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence initial={false} mode="wait">
      {isOpen && (
        <motion.div
          key="voice-overlay"
          className="fixed inset-0 z-[200]"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-[#03030b] via-[#060316] to-[#0b1426]"
            variants={backdropVariants}
          />
          <motion.div
            className="relative flex h-full flex-col text-white"
            variants={contentVariants}
            role="dialog"
            aria-modal="true"
            aria-labelledby={overlayTitleId}
          >
            <motion.div className="relative flex items-center px-6 py-5" variants={headerVariants}>
              <span id={overlayTitleId} className="sr-only">
                {localize('com_ui_voice_overlay_title')}
              </span>
              <div className="flex flex-1 items-center justify-start">
                <button
                  type="button"
                  onClick={() => setShowVoiceMenu((prev) => !prev)}
                  className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20"
                  aria-haspopup="menu"
                  aria-expanded={showVoiceMenu}
                  aria-controls={voiceMenuId}
                >
                  <Volume2 className="h-4 w-4" />
                  <span>{localize('com_ui_voice_overlay_choose_voice')}</span>
                </button>
              </div>
              <div className="flex flex-1 justify-center" aria-hidden="true" />
              <div className="flex flex-1 items-center justify-end">
                <button
                  type="button"
                  onClick={closeOverlay}
                  className="flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
                  aria-label={localize('com_ui_voice_overlay_close')}
                  title={localize('com_ui_voice_overlay_close')}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <AnimatePresence>
                {showVoiceMenu && (
                  <motion.div
                    key="voice-menu"
                    id={voiceMenuId}
                    role="menu"
                    className="absolute left-6 top-[4.5rem] w-[min(20rem,calc(100vw-3rem))] rounded-3xl border border-white/10 bg-[#0d0d1a]/90 p-5 shadow-2xl backdrop-blur"
                    variants={menuVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
                      {localize('com_ui_voice_overlay_voice_settings')}
                    </p>
                    <VoiceDropdown />
                    <p className="mt-5 text-xs text-white/50">
                      {usingExternalVoices
                        ? localize('com_ui_voice_overlay_using_cloud')
                        : localize('com_ui_voice_overlay_using_browser')}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
              <motion.div
                className="flex flex-col items-center gap-4"
                variants={orbContainerVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <motion.div
                  className="h-64 w-64 max-w-full sm:h-72 sm:w-72"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={orbVisualState.animation}
                  transition={{ type: 'spring', stiffness: 170, damping: 20 }}
                >
                  <AnimatedOrb
                    activityLevel={activityLevel}
                    hoverIntensity={orbVisualState.hoverIntensity}
                    rotateOnHover={false}
                    glow={orbVisualState.glow}
                  />
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={statusKey}
                    className="text-sm uppercase tracking-[0.35em] text-white/60"
                    variants={textTransitionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {statusText}
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={transcriptToDisplay ? 'transcript' : 'prompt'}
                  className="max-w-2xl text-center text-base text-white/80 sm:text-lg"
                  variants={textTransitionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {transcriptToDisplay ? (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                        {localize('com_ui_voice_overlay_transcript_label')}
                      </div>
                      <div className="text-2xl font-semibold text-white sm:text-3xl">
                        “{transcriptToDisplay}”
                      </div>
                    </div>
                  ) : (
                    <p>{localize('com_ui_voice_overlay_prompt')}</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <motion.div
              className="flex flex-col items-center gap-4 px-6 pb-12"
              variants={footerVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {silenceDelay != null && (
                <div className="flex max-w-xs flex-col items-center text-center text-xs text-white/60 sm:max-w-sm">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/50">
                    {localize('com_ui_voice_overlay_silence_label')}
                  </span>
                  <span className="text-base font-semibold text-white sm:text-lg">
                    {silenceValueText ?? ''}
                  </span>
                  <span className="mt-1 text-[0.7rem] leading-relaxed text-white/60 sm:text-xs">
                    {silenceDescriptionText ?? ''}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={toggleMicrophone}
                className={`flex h-20 w-20 items-center justify-center rounded-full backdrop-blur transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 sm:h-24 sm:w-24 ${microphoneButtonClass}`}
                aria-pressed={micEnabled}
              >
                {microphoneIcon}
              </button>
              <AnimatePresence mode="wait">
                <motion.div
                  key={micEnabled ? 'on' : 'off'}
                  className="text-xs text-white/60"
                  variants={textTransitionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {micEnabled
                    ? localize('com_ui_voice_overlay_listening_toggle_on')
                    : localize('com_ui_voice_overlay_listening_toggle_off')}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
