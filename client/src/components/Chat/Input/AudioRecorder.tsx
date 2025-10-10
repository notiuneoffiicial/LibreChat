import { useCallback, useRef } from 'react';
import { useToastContext, TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { cn } from '~/utils';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';
export default function AudioRecorder({
  disabled,
  ask,
  methods,
  textAreaRef,
  isSubmitting,
}: {
  disabled: boolean;
  ask: (data: { text: string }) => void;
  methods: ReturnType<typeof useChatFormContext>;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  isSubmitting: boolean;
}) {
  const { setValue, reset, getValues } = methods;
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const { speechToTextEndpoint } = useGetAudioSettings();

  const existingTextRef = useRef<string>('');
  const aggregatedTranscriptRef = useRef<string>('');

  const buildAggregatedTranscript = useCallback((incoming: string, isExternal: boolean) => {
    const trimmedIncoming = incoming.trim();

    if (!trimmedIncoming) {
      return aggregatedTranscriptRef.current;
    }

    if (isExternal) {
      const base = aggregatedTranscriptRef.current;
      aggregatedTranscriptRef.current = base
        ? `${base} ${trimmedIncoming}`.replace(/\s+/g, ' ').trim()
        : trimmedIncoming;
      return aggregatedTranscriptRef.current;
    }

    const current = aggregatedTranscriptRef.current.trim();
    if (!current) {
      aggregatedTranscriptRef.current = trimmedIncoming;
      return aggregatedTranscriptRef.current;
    }

    if (trimmedIncoming.length >= current.length && trimmedIncoming.startsWith(current)) {
      aggregatedTranscriptRef.current = trimmedIncoming;
      return aggregatedTranscriptRef.current;
    }

    if (current.endsWith(trimmedIncoming)) {
      return aggregatedTranscriptRef.current;
    }

    if (trimmedIncoming.endsWith(current)) {
      aggregatedTranscriptRef.current = trimmedIncoming;
      return aggregatedTranscriptRef.current;
    }

    aggregatedTranscriptRef.current = `${current} ${trimmedIncoming}`.replace(/\s+/g, ' ').trim();

    return aggregatedTranscriptRef.current;
  }, []);

  const onTranscriptionComplete = useCallback(
    (text: string) => {
      if (isSubmitting) {
        showToast({
          message: localize('com_ui_speech_while_submitting'),
          status: 'error',
        });
        return;
      }
      if (text) {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | null;
        if (globalAudio) {
          console.log('Unmuting global audio');
          globalAudio.muted = false;
        }
        /** For external STT, append existing text to the transcription */
        const aggregated = buildAggregatedTranscript(text, isExternalSTT(speechToTextEndpoint));
        const prefix = existingTextRef.current ? `${existingTextRef.current} ` : '';
        const finalText = `${prefix}${aggregated ?? ''}`.replace(/\s+/g, ' ').trim();
        ask({ text: finalText });
        reset({ text: '' });
        existingTextRef.current = '';
        aggregatedTranscriptRef.current = '';
      }
    },
    [
      ask,
      reset,
      showToast,
      localize,
      isSubmitting,
      speechToTextEndpoint,
      buildAggregatedTranscript,
    ],
  );

  const setText = useCallback(
    (text: string) => {
      if (!text?.trim()) {
        return;
      }

      const aggregated = buildAggregatedTranscript(text, isExternalSTT(speechToTextEndpoint));
      const prefix = existingTextRef.current ? `${existingTextRef.current} ` : '';
      const combinedText = `${prefix}${aggregated ?? ''}`.replace(/\s+/g, ' ').trim();

      setValue('text', combinedText, {
        shouldValidate: true,
      });
    },
    [setValue, speechToTextEndpoint, buildAggregatedTranscript],
  );

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
  );

  if (!textAreaRef.current) {
    return null;
  }

  const handleStartRecording = async () => {
    existingTextRef.current = getValues('text') || '';
    aggregatedTranscriptRef.current = '';
    startRecording();
  };

  const handleStopRecording = async () => {
    stopRecording();
    /** For browser STT, clear the reference since text was already being updated */
    if (!isExternalSTT(speechToTextEndpoint)) {
      existingTextRef.current = '';
    }
  };

  const renderIcon = () => {
    if (isListening === true) {
      return <ListeningIcon className="stroke-red-500" />;
    }
    if (isLoading === true) {
      return <Spinner className="stroke-text-secondary" />;
    }
    return <ListeningIcon className="stroke-text-secondary" />;
  };

  return (
    <TooltipAnchor
      description={localize('com_ui_use_micrphone')}
      render={
        <button
          id="audio-recorder"
          type="button"
          aria-label={localize('com_ui_use_micrphone')}
          onClick={isListening === true ? handleStopRecording : handleStartRecording}
          disabled={disabled}
          className={cn(
            'flex size-9 items-center justify-center rounded-full p-1 transition-colors hover:bg-surface-hover',
          )}
          title={localize('com_ui_use_micrphone')}
          aria-pressed={isListening}
        >
          {renderIcon()}
        </button>
      }
    />
  );
}
