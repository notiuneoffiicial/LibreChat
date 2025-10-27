import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToastContext, TooltipAnchor, ListeningIcon, Spinner } from '@librechat/client';
import { useLocalize, useSpeechToText, useGetAudioSettings } from '~/hooks';
import type { SpeechToTextOptions } from '~/hooks/Input/types';
import { useChatFormContext } from '~/Providers';
import { globalAudioId } from '~/common';
import { cn } from '~/utils';

const isExternalSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'external';
const isRealtimeSTT = (speechToTextEndpoint: string) => speechToTextEndpoint === 'realtime';
const shouldAppendExistingText = (speechToTextEndpoint: string) =>
  isExternalSTT(speechToTextEndpoint) || isRealtimeSTT(speechToTextEndpoint);
const concatInt16 = (chunks: Int16Array[]) => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Int16Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  return result;
};

const writeString = (view: DataView, offset: number, text: string) => {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
};

const encodeWav = (samples: Int16Array, sampleRate: number) => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    view.setInt16(offset, samples[i], true);
    offset += bytesPerSample;
  }

  return buffer;
};

const decodeBase64ToInt16 = (data: string): Int16Array | null => {
  try {
    const binary = (() => {
      if (typeof globalThis.atob === 'function') {
        return globalThis.atob(data);
      }

      const bufferCtor = (globalThis as Record<string, unknown>)['Buffer'] as
        | undefined
        | {
            from: (input: string, encoding: string) => { toString: (encoding: string) => string };
          };

      if (bufferCtor) {
        return bufferCtor.from(data, 'base64').toString('binary');
      }

      throw new Error('Base64 decoding not supported');
    })();
    const length = binary.length;
    if (length % 2 !== 0) {
      return null;
    }
    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < length; i += 1) {
      view[i] = binary.charCodeAt(i);
    }
    const samples = new Int16Array(buffer.byteLength / 2);
    const dataView = new DataView(buffer);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = dataView.getInt16(i * 2, true);
    }
    return samples;
  } catch (error) {
    console.error('Failed to decode realtime speech audio chunk', error);
    return null;
  }
};

const extractAudioChunk = (event: unknown): string | null => {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const record = event as Record<string, unknown>;

  const candidates = ['audio', 'chunk', 'data'];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      const nested = extractAudioChunk(value);
      if (nested) {
        return nested;
      }
    }
  }

  if (record.delta) {
    const nested = extractAudioChunk(record.delta);
    if (nested) {
      return nested;
    }
  }

  return null;
};

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
  const { speechToTextEndpoint, realtime } = useGetAudioSettings();

  const existingTextRef = useRef<string>('');
  const speechSamplesRef = useRef<Int16Array[]>([]);
  const [speechPlaybackUrl, setSpeechPlaybackUrl] = useState<string | null>(null);

  const sampleRate = useMemo(() => {
    const audioFormat = realtime?.audio?.input?.format;
    if (audioFormat?.sampleRate) {
      return audioFormat.sampleRate;
    }
    if (realtime?.inputAudioFormat?.sampleRate) {
      return realtime.inputAudioFormat.sampleRate;
    }
    return 24000;
  }, [realtime]);

  const realtimeSession = realtime?.session ?? {};
  const realtimeInclude = Array.isArray(realtime?.include) ? realtime.include : [];

  const speechToSpeechActive = useMemo(() => {
    if (realtimeSession.mode === 'speech_to_speech') {
      return true;
    }
    if (realtimeSession.speechToSpeech) {
      return true;
    }
    return realtimeInclude.includes('audio');
  }, [realtimeInclude, realtimeSession.mode, realtimeSession.speechToSpeech]);

  const resetSpeechPlayback = useCallback(() => {
    speechSamplesRef.current = [];
    setSpeechPlaybackUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!speechToSpeechActive) {
      resetSpeechPlayback();
    }
  }, [resetSpeechPlayback, speechToSpeechActive]);

  useEffect(
    () => () => {
      resetSpeechPlayback();
    },
    [resetSpeechPlayback],
  );

  const handleSpeechOutputDelta = useCallback((event: unknown) => {
    const chunk = extractAudioChunk(event);
    if (!chunk) {
      return;
    }
    const samples = decodeBase64ToInt16(chunk);
    if (!samples) {
      return;
    }
    speechSamplesRef.current = [...speechSamplesRef.current, samples];
  }, []);

  const handleSpeechOutputCompleted = useCallback(() => {
    if (!speechSamplesRef.current.length) {
      return;
    }

    const combined = concatInt16(speechSamplesRef.current);
    const wavBuffer = encodeWav(combined, sampleRate);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    speechSamplesRef.current = [];
    setSpeechPlaybackUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return url;
    });
  }, [sampleRate]);

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
        const finalText =
          shouldAppendExistingText(speechToTextEndpoint) && existingTextRef.current
            ? `${existingTextRef.current} ${text}`
            : text;
        ask({ text: finalText });
        reset({ text: '' });
        existingTextRef.current = '';
      }
    },
    [ask, reset, showToast, localize, isSubmitting, speechToTextEndpoint],
  );

  const setText = useCallback(
    (text: string) => {
      let newText = text;
      if (shouldAppendExistingText(speechToTextEndpoint)) {
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      } else {
        newText = existingTextRef.current ? `${existingTextRef.current} ${text}` : text;
      }
      setValue('text', newText, {
        shouldValidate: true,
      });
    },
    [setValue, speechToTextEndpoint],
  );

  const speechOptions = useMemo<SpeechToTextOptions | undefined>(() => {
    if (!speechToSpeechActive) {
      return undefined;
    }

    return {
      onSpeechOutputDelta: handleSpeechOutputDelta,
      onSpeechOutputCompleted: handleSpeechOutputCompleted,
    };
  }, [handleSpeechOutputCompleted, handleSpeechOutputDelta, speechToSpeechActive]);

  const { isListening, isLoading, startRecording, stopRecording } = useSpeechToText(
    setText,
    onTranscriptionComplete,
    speechOptions,
  );

  if (!textAreaRef.current) {
    return null;
  }

  const handleStartRecording = async () => {
    existingTextRef.current = getValues('text') || '';
    if (speechToSpeechActive) {
      resetSpeechPlayback();
    }
    startRecording();
  };

  const handleStopRecording = async () => {
    stopRecording();
    /** For browser STT, clear the reference since text was already being updated */
    if (!shouldAppendExistingText(speechToTextEndpoint)) {
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
        <div className="flex flex-col gap-2">
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
          {speechToSpeechActive && speechPlaybackUrl && (
            <audio
              data-testid="realtime-speech-playback"
              className="mt-1 w-40"
              controls
              autoPlay
              src={speechPlaybackUrl}
            >
              {localize('com_ui_speech_playback')}
            </audio>
          )}
        </div>
      }
    />
  );
}
