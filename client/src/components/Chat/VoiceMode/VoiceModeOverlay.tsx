import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X } from 'lucide-react';
import { Spinner, useToastContext } from '@librechat/client';
import { useRecoilState, useRecoilValue } from 'recoil';
import AnimatedOrb from '../../../../voice/animated-orb';
import { useChatContext } from '~/Providers';
import { useGetAudioSettings, useLocalize, useSpeechToText } from '~/hooks';
import { usePauseGlobalAudio } from '~/hooks/Audio';
import VoiceDropdown from '~/components/Nav/SettingsTabs/Speech/TTS/VoiceDropdown';
import store from '~/store';
import { cn } from '~/utils';

const VOICE_MODE_MODEL = 'deepseek-chat';
const VOICE_MODE_MODEL_LABEL = 'DeepSeek Chat';

interface VoiceModeOverlayProps {
  index: number;
}

const ACTIVITY_IDLE = 0.08;
const ACTIVITY_LISTENING = 0.45;
const ACTIVITY_RESPONDING = 0.82;
const ACTIVITY_SPEAKING = 1;
const USER_SPEAKING_DECAY_MS = 320;

export default function VoiceModeOverlay({ index }: VoiceModeOverlayProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { ask, isSubmitting, conversation, setConversation } = useChatContext();

  const [isOpen, setIsOpen] = useRecoilState(store.voiceModeActive);
  const [speechEnabled, setSpeechEnabled] = useRecoilState(store.speechToText);
  const [ttsEnabled, setTtsEnabled] = useRecoilState(store.textToSpeech);
  const [automaticPlayback, setAutomaticPlayback] = useRecoilState(store.automaticPlayback);
  const globalAudioPlaying = useRecoilValue(store.globalAudioPlayingFamily(index));
  const globalAudioFetching = useRecoilValue(store.globalAudioFetchingFamily(index));

  const { speechToTextEndpoint, textToSpeechEndpoint } = useGetAudioSettings();
  const { pauseGlobalAudio } = usePauseGlobalAudio(index);

  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastTranscript, setLastTranscript] = useState('');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [activityLevel, setActivityLevel] = useState(ACTIVITY_IDLE);

  const speakingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousOverflow = useRef('');
  const previousSpeechEnabled = useRef(speechEnabled);
  const previousTtsEnabled = useRef(ttsEnabled);
  const previousAutomaticPlayback = useRef(automaticPlayback);
  const previousModelRef = useRef<{
    conversationId?: string | null;
    model?: string | null;
    modelLabel?: string | null;
    chatGptLabel?: string | null;
  } | null>(null);

  const cleanupSpeakingTimeout = useCallback(() => {
    if (speakingTimeout.current) {
      clearTimeout(speakingTimeout.current);
      speakingTimeout.current = null;
    }
  }, []);

  const resetActivity = useCallback(() => {
    setActivityLevel(ACTIVITY_IDLE);
    setIsUserSpeaking(false);
  }, []);

  const handleInterim = useCallback(
    (text: string) => {
      setInterimTranscript(text);
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setIsUserSpeaking(true);
      setActivityLevel(ACTIVITY_SPEAKING);
      cleanupSpeakingTimeout();
      speakingTimeout.current = setTimeout(() => {
        setIsUserSpeaking(false);
        setActivityLevel(ACTIVITY_LISTENING);
      }, USER_SPEAKING_DECAY_MS);
    },
    [cleanupSpeakingTimeout],
  );

  const handleComplete = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setInterimTranscript('');
        return;
      }

      if (isSubmitting) {
        showToast({
          status: 'warning',
          message: localize('com_ui_voice_overlay_error_submitting'),
        });
        return;
      }

      ask({ text: trimmed });
      setInterimTranscript('');
      setLastTranscript(trimmed);
      resetActivity();
    },
    [ask, isSubmitting, localize, resetActivity, showToast],
  );

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    handleInterim,
    handleComplete,
  );

  useEffect(() => cleanupSpeakingTimeout, [cleanupSpeakingTimeout]);

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
    if (!isOpen || !conversation) {
      return;
    }

    const alreadySelected =
      conversation.model === VOICE_MODE_MODEL &&
      conversation.modelLabel === VOICE_MODE_MODEL_LABEL &&
      conversation.chatGptLabel === VOICE_MODE_MODEL_LABEL;

    if (!previousModelRef.current) {
      previousModelRef.current = {
        conversationId: conversation.conversationId,
        model: conversation.model ?? null,
        modelLabel: conversation.modelLabel ?? null,
        chatGptLabel: conversation.chatGptLabel ?? null,
      };
    }

    if (alreadySelected) {
      return;
    }

    setConversation((prev) => {
      if (!prev) {
        return prev;
      }

      if (
        prev.model === VOICE_MODE_MODEL &&
        prev.modelLabel === VOICE_MODE_MODEL_LABEL &&
        prev.chatGptLabel === VOICE_MODE_MODEL_LABEL
      ) {
        return prev;
      }

      return {
        ...prev,
        model: VOICE_MODE_MODEL,
        modelLabel: VOICE_MODE_MODEL_LABEL,
        chatGptLabel: VOICE_MODE_MODEL_LABEL,
      };
    });
  }, [conversation, isOpen, setConversation]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    if (previousModelRef.current) {
      const cached = previousModelRef.current;
      previousModelRef.current = null;
      setConversation((prev) => {
        if (!prev) {
          return prev;
        }

        if (cached.conversationId && prev.conversationId !== cached.conversationId) {
          return prev;
        }

        const nextConversation = { ...prev };

        if (typeof cached.model === 'string') {
          nextConversation.model = cached.model;
        }
        if (cached.modelLabel !== undefined) {
          nextConversation.modelLabel = cached.modelLabel ?? undefined;
        }
        if (cached.chatGptLabel !== undefined) {
          nextConversation.chatGptLabel = cached.chatGptLabel ?? undefined;
        }

        return nextConversation;
      });
    }
  }, [isOpen, setConversation]);

  useEffect(() => {
    if (!isOpen) {
      cleanupSpeakingTimeout();
      setInterimTranscript('');
      resetActivity();
      setShowVoiceMenu(false);
      if (isListening) {
        stopRecording();
      }
      pauseGlobalAudio();
    }
  }, [
    cleanupSpeakingTimeout,
    isListening,
    isOpen,
    pauseGlobalAudio,
    resetActivity,
    stopRecording,
  ]);

  useEffect(() => {
    if (isUserSpeaking) {
      return;
    }

    if (globalAudioPlaying) {
      setActivityLevel(ACTIVITY_RESPONDING);
    } else if (isListening) {
      setActivityLevel(ACTIVITY_LISTENING);
    } else {
      setActivityLevel(ACTIVITY_IDLE);
    }
  }, [globalAudioPlaying, isListening, isUserSpeaking]);

  const closeOverlay = useCallback(() => {
    cleanupSpeakingTimeout();
    setInterimTranscript('');
    setLastTranscript('');
    resetActivity();
    setShowVoiceMenu(false);
    setIsOpen(false);
    pauseGlobalAudio();
  }, [cleanupSpeakingTimeout, pauseGlobalAudio, resetActivity, setIsOpen]);

  const toggleListening = useCallback(() => {
    cleanupSpeakingTimeout();
    if (isListening) {
      stopRecording();
      resetActivity();
      setInterimTranscript('');
      return;
    }

    void startRecording();
    setActivityLevel(ACTIVITY_LISTENING);
  }, [cleanupSpeakingTimeout, isListening, resetActivity, startRecording, stopRecording]);

  const statusKey = useMemo(() => {
    if (isUserSpeaking) {
      return 'com_ui_voice_overlay_status_listening' as const;
    }

    if (globalAudioPlaying) {
      return 'com_ui_voice_overlay_status_speaking' as const;
    }

    if (isSubmitting || globalAudioFetching) {
      return 'com_ui_voice_overlay_status_processing' as const;
    }

    if (isListening) {
      return 'com_ui_voice_overlay_status_ready' as const;
    }

    return 'com_ui_voice_overlay_status_muted' as const;
  }, [globalAudioFetching, globalAudioPlaying, isListening, isSubmitting, isUserSpeaking]);

  const transcriptToDisplay = interimTranscript || lastTranscript;
  const statusText = localize(statusKey);
  const usingExternalVoices = textToSpeechEndpoint === 'external';
  const orbHoverIntensity = useMemo(() => 0.35 + activityLevel * 0.4, [activityLevel]);
  const orbGlow = useMemo(() => 1.15 + activityLevel * 0.5, [activityLevel]);
  const micButtonClass = useMemo(
    () =>
      cn(
        'flex h-20 w-20 transform-gpu items-center justify-center rounded-full text-white shadow-lg backdrop-blur transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:h-24 sm:w-24',
        isListening
          ? 'bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 hover:from-rose-400 hover:via-rose-500 hover:to-rose-600 shadow-[0_0_35px_rgba(244,63,94,0.55)] scale-105'
          : 'bg-white/10 hover:bg-white/20 hover:shadow-[0_0_25px_rgba(255,255,255,0.15)]',
      ),
    [isListening],
  );

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-br from-[#03030b] via-[#060316] to-[#0b1426] text-white">
      <div className="relative flex items-center justify-between px-6 py-5">
        <button
          type="button"
          onClick={() => setShowVoiceMenu((prev) => !prev)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20"
        >
          <Volume2 className="h-4 w-4" />
          <span>{localize('com_ui_voice_overlay_choose_voice')}</span>
        </button>
        <button
          type="button"
          onClick={closeOverlay}
          className="flex size-10 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
          aria-label={localize('com_ui_voice_overlay_close')}
          title={localize('com_ui_voice_overlay_close')}
        >
          <X className="h-5 w-5" />
        </button>
        {showVoiceMenu && (
          <div className="absolute left-6 top-[4.5rem] w-[min(20rem,calc(100vw-3rem))] rounded-3xl border border-white/10 bg-[#0d0d1a]/90 p-5 shadow-2xl backdrop-blur">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
              {localize('com_ui_voice_overlay_voice_settings')}
            </p>
            <VoiceDropdown />
            <p className="mt-3 text-xs text-white/50">
              {usingExternalVoices
                ? localize('com_ui_voice_overlay_using_cloud')
                : localize('com_ui_voice_overlay_using_browser')}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="h-64 w-64 max-w-full sm:h-72 sm:w-72">
            <AnimatedOrb
              activityLevel={activityLevel}
              hoverIntensity={orbHoverIntensity}
              rotateOnHover
              glow={orbGlow}
            />
          </div>
          <div className="text-sm uppercase tracking-[0.35em] text-white/60">{statusText}</div>
        </div>

        <div className="max-w-2xl text-center text-base text-white/80 sm:text-lg">
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
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-12">
        <button
          type="button"
          onClick={toggleListening}
          className={micButtonClass}
          aria-pressed={isListening}
        >
          {isLoading ? (
            <Spinner className="h-8 w-8 text-white" />
          ) : isListening ? (
            <MicOff className="h-10 w-10" />
          ) : (
            <Mic className="h-10 w-10" />
          )}
        </button>
        <div className="text-xs text-white/60">
          {isListening
            ? localize('com_ui_voice_overlay_listening_toggle_on')
            : localize('com_ui_voice_overlay_listening_toggle_off')}
        </div>
      </div>
    </div>,
    document.body,
  );
}
