import '@testing-library/jest-dom';
import type React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import AudioRecorder from '../AudioRecorder';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const mockUseSpeechToText = jest.fn();

jest.mock('~/hooks/useLocalize', () => ({
  __esModule: true,
  default: () => (key: string) => key,
}));

jest.mock('~/hooks/Input/useSpeechToText', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockUseSpeechToText(...args),
}));

jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    useToastContext: () => ({ showToast: jest.fn() }),
    TooltipAnchor: ({ render }: { render: React.ReactNode }) => <>{render}</>,
    ListeningIcon: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="listening-icon" {...props} />
    ),
    Spinner: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="spinner" {...props} />,
  };
});

describe('AudioRecorder', () => {
  const originalCreateObjectURL = global.URL.createObjectURL;
  const originalRevokeObjectURL = global.URL.revokeObjectURL;

  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    global.URL.createObjectURL = originalCreateObjectURL;
    global.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('binds realtime speech options and renders playback when audio is streamed', async () => {
    const textArea = document.createElement('textarea');
    const textAreaRef = { current: textArea } as React.RefObject<HTMLTextAreaElement>;

    const setValue = jest.fn();
    const reset = jest.fn();
    const getValues = jest.fn(() => '');

    const realtimeState = {
      ...DEFAULT_REALTIME_STT_OPTIONS,
      session: {
        mode: 'speech_to_speech',
        speechToSpeech: true,
      },
      include: ['text', 'audio'],
    };

    let capturedSetText: ((text: string) => void) | undefined;
    let capturedOptions: Record<string, any> | undefined;

    mockUseSpeechToText.mockImplementation((setText, _onComplete, options) => {
      capturedSetText = setText;
      capturedOptions = options as Record<string, any> | undefined;
      return {
        isListening: false,
        isLoading: false,
        startRecording: jest.fn(),
        stopRecording: jest.fn(),
      };
    });

    render(
      <RecoilRoot
        initializeState={({ set }) => {
          set(store.engineSTT, 'realtime');
          set(store.realtimeSTTOptions, realtimeState);
        }}
      >
        <AudioRecorder
          disabled={false}
          ask={jest.fn()}
          methods={{ setValue, reset, getValues } as unknown as Record<string, unknown>}
          textAreaRef={textAreaRef}
          isSubmitting={false}
        />
      </RecoilRoot>,
    );

    expect(mockUseSpeechToText).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toBeDefined();
    expect(capturedOptions?.onSpeechOutputDelta).toBeInstanceOf(Function);
    expect(capturedOptions?.onSpeechOutputCompleted).toBeInstanceOf(Function);

    capturedSetText?.('Hello realtime');
    expect(setValue).toHaveBeenCalledWith('text', 'Hello realtime', { shouldValidate: true });

    const createPcmBase64 = (values: number[]) => {
      const buffer = new ArrayBuffer(values.length * 2);
      const view = new DataView(buffer);
      values.forEach((value, index) => {
        view.setInt16(index * 2, value, true);
      });
      return Buffer.from(buffer).toString('base64');
    };

    act(() => {
      capturedOptions?.onSpeechOutputDelta?.({ delta: { audio: createPcmBase64([0, 500, -500, 0]) } });
      capturedOptions?.onSpeechOutputCompleted?.({});
    });

    await waitFor(() => {
      expect(screen.getByTestId('realtime-speech-playback')).toHaveAttribute('src', 'blob:mock-url');
    });
  });
});
