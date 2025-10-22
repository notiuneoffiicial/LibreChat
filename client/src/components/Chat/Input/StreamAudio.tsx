import { useParams } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import type { TMessage } from 'librechat-data-provider';
import { useCustomAudioRef, MediaSourceAppender, usePauseGlobalAudio } from '~/hooks/Audio';
import { getLatestText, logger } from '~/utils';
import { useAuthContext } from '~/hooks';
import { globalAudioId } from '~/common';
import store from '~/store';

function timeoutPromise(ms: number, message?: string) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message ?? 'Promise timed out')), ms),
  );
}

const promiseTimeoutMessage = 'Reader promise timed out';
const maxPromiseTime = 15000;

export default function StreamAudio({ index = 0 }) {
  const { token } = useAuthContext();

  const cacheTTS = useRecoilValue(store.cacheTTS);
  const playbackRate = useRecoilValue(store.playbackRate);

  const voice = useRecoilValue(store.voice);
  const activeRunId = useRecoilValue(store.activeRunFamily(index));
  const automaticPlayback = useRecoilValue(store.automaticPlayback);
  const isSubmitting = useRecoilValue(store.isSubmittingFamily(index));
  const latestMessage = useRecoilValue(store.latestMessageFamily(index));
  const setIsPlaying = useSetRecoilState(store.globalAudioPlayingFamily(index));
  const [audioRunId, setAudioRunId] = useRecoilState(store.audioRunFamily(index));
  const [isFetching, setIsFetching] = useRecoilState(store.globalAudioFetchingFamily(index));
  const [globalAudioURL, setGlobalAudioURL] = useRecoilState(store.globalAudioURLFamily(index));

  const { audioRef } = useCustomAudioRef({ setIsPlaying });
  const { pauseGlobalAudio } = usePauseGlobalAudio();

  const { conversationId: paramId } = useParams();
  const queryParam = paramId === 'new' ? paramId : latestMessage?.conversationId ?? paramId ?? '';

  const queryClient = useQueryClient();
  const getMessages = useCallback(
    () => queryClient.getQueryData<TMessage[]>([QueryKeys.messages, queryParam]),
    [queryParam, queryClient],
  );

  useEffect(() => {
    const latestText = getLatestText(latestMessage);

    const shouldFetch = !!(
      token != null &&
      automaticPlayback &&
      !isSubmitting &&
      latestMessage &&
      !latestMessage.isCreatedByUser &&
      latestText &&
      latestMessage.messageId &&
      !latestMessage.messageId.includes('_') &&
      !isFetching &&
      activeRunId != null &&
      activeRunId !== audioRunId
    );

    if (!shouldFetch) {
      return;
    }

    async function fetchAudio() {
      setIsFetching(true);

      try {
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
          setGlobalAudioURL(null);
        }

        let cacheKey = latestMessage?.text ?? '';
        const canUseCache = typeof caches !== 'undefined';
        let cache: Cache | null = null;
        let cachedResponse: Response | undefined;

        if (cacheTTS && canUseCache) {
          try {
            cache = await caches.open('tts-responses');
            if (cacheKey) {
              cachedResponse = await cache.match(cacheKey);
            }
          } catch (error) {
            logger.warn('StreamAudio', 'Cache API unavailable for TTS responses', error);
            cache = null;
          }
        } else if (cacheTTS && !canUseCache) {
          logger.warn('StreamAudio', 'Cache API is not available; skipping TTS caching');
        }

        setAudioRunId(activeRunId);
        if (cachedResponse) {
          logger.log('Audio found in cache');
          const audioBlob = await cachedResponse.blob();
          const blobUrl = URL.createObjectURL(audioBlob);
          setGlobalAudioURL(blobUrl);
          setIsFetching(false);
          return;
        }

        logger.log('Fetching audio...', navigator.userAgent);
        const response = await fetch('/api/files/speech/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messageId: latestMessage?.messageId, runId: activeRunId, voice }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch audio');
        }
        if (!response.body) {
          throw new Error('Null Response body');
        }

        const reader = response.body.getReader();

        const type = 'audio/mpeg';
        const browserSupportsType =
          typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(type);
        let mediaSource: MediaSourceAppender | undefined;
        if (browserSupportsType) {
          mediaSource = new MediaSourceAppender(type);
          setGlobalAudioURL(mediaSource.mediaSourceUrl);
        }

        let done = false;
        const chunks: ArrayBuffer[] = [];

        while (!done) {
          const readPromise = reader.read();
          const { value, done: readerDone } = (await Promise.race([
            readPromise,
            timeoutPromise(maxPromiseTime, promiseTimeoutMessage),
          ])) as ReadableStreamReadResult<ArrayBuffer>;

          if (cacheTTS && value) {
            chunks.push(value);
          }
          if (value && mediaSource) {
            mediaSource.addData(value);
          }
          done = readerDone;
        }

        if (chunks.length) {
          const audioBlob = new Blob(chunks, { type });

          if (cacheTTS && canUseCache && !cache) {
            try {
              cache = await caches.open('tts-responses');
            } catch (error) {
              logger.warn('StreamAudio', 'Cache API unavailable when storing TTS response', error);
              cache = null;
            }
          }

          if (cacheTTS && cache) {
            logger.log('Adding audio to cache');
            const latestMessages = getMessages() ?? [];
            const targetMessage = latestMessages.find(
              (msg) => msg.messageId === latestMessage?.messageId,
            );

            const resolvedCacheKey = targetMessage?.text ?? cacheKey;

            if (resolvedCacheKey) {
              const cachedResponse = new Response(audioBlob);
              await cache.put(resolvedCacheKey, cachedResponse);

              if (!browserSupportsType) {
                const unconsumedResponse = await cache.match(resolvedCacheKey);
                if (!unconsumedResponse) {
                  throw new Error('Failed to fetch audio from cache');
                }
                const cachedBlob = await unconsumedResponse.blob();
                const blobUrl = URL.createObjectURL(cachedBlob);
                setGlobalAudioURL(blobUrl);
              }
            } else if (!browserSupportsType) {
              const blobUrl = URL.createObjectURL(audioBlob);
              setGlobalAudioURL(blobUrl);
            }
          } else if (!browserSupportsType) {
            const blobUrl = URL.createObjectURL(audioBlob);
            setGlobalAudioURL(blobUrl);
          }
        }

        logger.log('Audio stream reading ended');
      } catch (error) {
        if (error?.['message'] === promiseTimeoutMessage) {
          logger.log(promiseTimeoutMessage);
        } else {
          logger.error('Error fetching audio:', error);
        }
        setAudioRunId(null);
        setGlobalAudioURL(null);
      } finally {
        setIsFetching(false);
      }
    }

    fetchAudio();
  }, [
    automaticPlayback,
    setGlobalAudioURL,
    setAudioRunId,
    setIsFetching,
    latestMessage,
    isSubmitting,
    activeRunId,
    getMessages,
    isFetching,
    audioRunId,
    cacheTTS,
    audioRef,
    voice,
    token,
  ]);

  useEffect(() => {
    if (
      playbackRate != null &&
      globalAudioURL != null &&
      playbackRate > 0 &&
      audioRef.current &&
      audioRef.current.playbackRate !== playbackRate
    ) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [audioRef, globalAudioURL, playbackRate]);

  useEffect(() => {
    pauseGlobalAudio();
    // We only want the effect to run when the paramId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramId]);

  logger.log('StreamAudio.tsx - globalAudioURL:', globalAudioURL);
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio
      ref={audioRef}
      controls
      controlsList="nodownload nofullscreen noremoteplayback"
      style={{
        position: 'absolute',
        overflow: 'hidden',
        display: 'none',
        height: '0px',
        width: '0px',
      }}
      src={globalAudioURL ?? undefined}
      id={globalAudioId}
      autoPlay
    />
  );
}
