import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import store from '~/store';
import useSpeechToTextRealtime from '../useSpeechToTextRealtime';

jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    useToastContext: () => ({ showToast: jest.fn() }),
  };
});

jest.mock('~/data-provider', () => ({
  useRealtimeSessionMutation: jest.fn(() => ({ mutateAsync: jest.fn() })),
}));

type MockSocketEvent = { data: string };

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  url: string;
  protocols?: string | string[];
  onopen?: () => void;
  onmessage?: (event: MockSocketEvent) => void;
  onclose?: () => void;
  onerror?: () => void;
  sent: string[] = [];

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  open() {
    this.onopen?.();
  }

  emit(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

describe('useSpeechToTextRealtime', () => {
  const originalWebSocket = global.WebSocket;
  const mockSession = {
    url: 'wss://api.openai.com/v1/realtime',
    transport: 'websocket' as const,
    stream: true,
    model: 'gpt-4o-realtime-preview',
    inputAudioFormat: {
      encoding: 'pcm16',
      sampleRate: 24000,
      channels: 1,
    },
    session: {
      id: 'sess_123',
      client_secret: { value: 'secret' },
    },
  };

  beforeAll(() => {
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterAll(() => {
    global.WebSocket = originalWebSocket;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('streams audio and emits transcripts for realtime sessions', async () => {
    const mockStream: MediaStream = {
      getTracks: () => [
        {
          stop: jest.fn(),
        } as unknown as MediaStreamTrack,
      ],
    } as MediaStream;

    const getUserMedia = jest.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    const websocket = new MockWebSocket('', []);
    const sessionFetcher = jest.fn().mockResolvedValue(mockSession);
    const audioContextFactory = jest.fn(() => ({
      createMediaStreamSource: () => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      createScriptProcessor: () => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
        onaudioprocess: null,
      }),
      createGain: () => ({
        gain: { value: 0 },
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      destination: {},
      close: jest.fn().mockResolvedValue(undefined),
      suspend: jest.fn().mockResolvedValue(undefined),
    }));
    const setText = jest.fn();
    const onComplete = jest.fn();

    const { result } = renderHook(
      () =>
        useSpeechToTextRealtime(setText, onComplete, {
          realtimeSessionFetcher: sessionFetcher,
          websocketFactory: () => websocket as unknown as WebSocket,
          autoSendOnSuccess: true,
          audioContextFactory,
        }),
      {
        wrapper: ({ children }) => (
          <RecoilRoot
            initializeState={({ set }) => {
              set(store.autoSendText, 0);
              set(store.speechToText, true);
              set(store.realtimeSTTOptions, mockSession);
            }}
          >
            {children}
          </RecoilRoot>
        ),
      },
    );

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      websocket.open();
    });

    await act(async () => {
      websocket.emit({ type: 'response.output_text.delta', delta: 'hello' });
      websocket.emit({ type: 'response.completed' });
    });

    expect(sessionFetcher).toHaveBeenCalled();
    expect(setText).toHaveBeenCalledWith('hello');
    expect(onComplete).toHaveBeenCalledWith('hello');

    act(() => {
      result.current.stopRecording();
    });
  });
});
