import debounce from 'lodash/debounce';
import { useEffect, useRef, useCallback } from 'react';
import { useRecoilValue, useRecoilState } from 'recoil';
import { isAssistantsEndpoint } from 'librechat-data-provider';
import type { KeyboardEvent } from 'react';
import { forceResize, insertTextAtCursor, checkIfScrollable } from '~/utils';
import useFileHandling from '~/hooks/Files/useFileHandling';
import { useInteractionHealthCheck } from '~/data-provider';
import { useChatContext } from '~/Providers/ChatContext';
import { globalAudioId } from '~/common';
import store from '~/store';

type KeyEvent = KeyboardEvent<HTMLTextAreaElement>;

export default function useTextarea({
  textAreaRef,
  submitButtonRef,
  setIsScrollable,
}: {
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
  submitButtonRef: React.RefObject<HTMLButtonElement>;
  setIsScrollable: React.Dispatch<React.SetStateAction<boolean>>;
  disabled?: boolean;
}) {
  const isComposing = useRef(false);
  const { handleFiles } = useFileHandling();
  const checkHealth = useInteractionHealthCheck();
  const enterToSend = useRecoilValue(store.enterToSend);

  const { index, conversation, isSubmitting, filesLoading, latestMessage, setFilesLoading } =
    useChatContext();
  const [activePrompt, setActivePrompt] = useRecoilState(store.activePromptByIndex(index));

  const endpoint = conversation?.endpointType ?? conversation?.endpoint ?? '';
  const isAssistant = isAssistantsEndpoint(endpoint);

  const isNotAppendable =
    (((latestMessage?.unfinished ?? false) && !isSubmitting) || (latestMessage?.error ?? false)) &&
    !isAssistant;
  // && (conversationId?.length ?? 0) > 6; // also ensures that we don't show the wrong placeholder

  useEffect(() => {
    const prompt = activePrompt ?? '';
    if (prompt && textAreaRef.current) {
      insertTextAtCursor(textAreaRef.current, prompt);
      forceResize(textAreaRef.current);
      setActivePrompt(undefined);
    }
  }, [activePrompt, setActivePrompt, textAreaRef]);

  useEffect(() => {
    const currentValue = textAreaRef.current?.value ?? '';
    if (currentValue) {
      return;
    }

    const placeholder = 'Ask OptimismAI';

    if (textAreaRef.current?.getAttribute('placeholder') === placeholder) {
      return;
    }

    const setPlaceholder = () => {
      if (textAreaRef.current?.getAttribute('placeholder') !== placeholder) {
        textAreaRef.current?.setAttribute('placeholder', placeholder);
        forceResize(textAreaRef.current);
      }
    };

    const debouncedSetPlaceholder = debounce(setPlaceholder, 80);
    debouncedSetPlaceholder();

    return () => debouncedSetPlaceholder.cancel();
  }, [textAreaRef]);

  const handleKeyDown = useCallback(
    (e: KeyEvent) => {
      if (textAreaRef.current && checkIfScrollable(textAreaRef.current)) {
        const scrollable = checkIfScrollable(textAreaRef.current);
        scrollable && setIsScrollable(scrollable);
      }
      if (e.key === 'Enter' && isSubmitting) {
        return;
      }

      checkHealth();

      const isNonShiftEnter = e.key === 'Enter' && !e.shiftKey;
      const isCtrlEnter = e.key === 'Enter' && (e.ctrlKey || e.metaKey);

      // NOTE: isComposing and e.key behave differently in Safari compared to other browsers, forcing us to use e.keyCode instead
      const isComposingInput = isComposing.current || e.key === 'Process' || e.keyCode === 229;

      if (isNonShiftEnter && filesLoading) {
        e.preventDefault();
      }

      if (isNonShiftEnter) {
        e.preventDefault();
      }

      if (
        e.key === 'Enter' &&
        !enterToSend &&
        !isCtrlEnter &&
        textAreaRef.current &&
        !isComposingInput
      ) {
        e.preventDefault();
        insertTextAtCursor(textAreaRef.current, '\n');
        forceResize(textAreaRef.current);
        return;
      }

      if ((isNonShiftEnter || isCtrlEnter) && !isComposingInput) {
        const globalAudio = document.getElementById(globalAudioId) as HTMLAudioElement | undefined;
        if (globalAudio) {
          console.log('Unmuting global audio');
          globalAudio.muted = false;
        }
        submitButtonRef.current?.click();
      }
    },
    [
      isSubmitting,
      checkHealth,
      filesLoading,
      enterToSend,
      setIsScrollable,
      textAreaRef,
      submitButtonRef,
    ],
  );

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = () => {
    isComposing.current = false;
  };

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const textArea = textAreaRef.current;
      if (!textArea) {
        return;
      }

      const clipboardData = e.clipboardData as DataTransfer | undefined;
      if (!clipboardData) {
        return;
      }

      if (clipboardData.files.length > 0) {
        setFilesLoading(true);
        const timestampedFiles: File[] = [];
        for (const file of clipboardData.files) {
          const newFile = new File([file], `clipboard_${+new Date()}_${file.name}`, {
            type: file.type,
          });
          timestampedFiles.push(newFile);
        }
        handleFiles(timestampedFiles);
      }
    },
    [handleFiles, setFilesLoading, textAreaRef],
  );

  return {
    textAreaRef,
    handlePaste,
    handleKeyDown,
    isNotAppendable,
    handleCompositionEnd,
    handleCompositionStart,
  };
}
