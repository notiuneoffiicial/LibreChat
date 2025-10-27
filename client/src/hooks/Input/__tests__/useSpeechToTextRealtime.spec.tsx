import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import store from '~/store';
import useSpeechToTextRealtime from '../useSpeechToTextRealtime';

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
}));

const mockMutateAsync = jest.fn();

jest.mock('~/data-provider', () => ({
  useRealtimeCallMutation: jest.fn(() => ({ mutateAsync: mockMutateAsync })),
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

class MockRTCDataChannel {
  label: string;
  readyState: 'connecting' | 'open' | 'closing' | 'closed' = 'connecting';
  onopen?: () => void;
  onmessage?: (event: MockSocketEvent) => void;
  onclose?: () => void;
  sent: string[] = [];

  constructor(label: string) {
    this.label = label;
  }

  send(payload: string) {
    this.sent.push(payload);
  }

  close() {
    this.readyState = 'closed';
    this.onclose?.();
  }

  open() {
    this.readyState = 'open';
    this.onopen?.();
  }

  emit(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

describe('useSpeechToTextRealtime', () => {
  const originalWebSocket = global.WebSocket;
  const originalFetch = global.fetch;
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
    audio: {
      input: {
        format: {
          encoding: 'pcm16',
          sampleRate: 24000,
          channels: 1,
        },
      },
    },
  };

  const webrtcDefaults = {
    model: 'gpt-4o-realtime-preview',
    transport: 'webrtc' as const,
    stream: true,
    inputAudioFormat: {
      encoding: 'pcm16',
      sampleRate: 24000,
      channels: 1,
    },
    session: {
      mode: 'conversation',
      instructions: 'Be brief',
      voice: 'alloy',
    },
    audio: {
      input: {
        noiseReduction: 'server_light',
        turnDetection: {
          type: 'server_vad',
          serverVad: { enabled: true },
        },
      },
    },
    include: ['text'],
  } as const;

  beforeAll(() => {
    global.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterAll(() => {
    global.WebSocket = originalWebSocket;
    if (originalFetch) {
      global.fetch = originalFetch;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as unknown as { fetch?: typeof fetch }).fetch;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockMutateAsync.mockReset();
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
    const processor = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: undefined as ((event: any) => void) | undefined,
    };

    const audioContextFactory = jest.fn(() => ({
      createMediaStreamSource: () => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      createScriptProcessor: () => processor,
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
      processor.onaudioprocess?.({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.1, -0.1]),
        },
      });
    });

    expect(websocket.sent).toHaveLength(3);
    expect(JSON.parse(websocket.sent[0])).toMatchObject({ type: 'input_audio_buffer.append' });
    expect(JSON.parse(websocket.sent[1])).toMatchObject({ type: 'input_audio_buffer.commit' });
    expect(JSON.parse(websocket.sent[2])).toMatchObject({ type: 'response.create' });

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

  it('initiates a realtime call for WebRTC transport and applies the SDP answer', async () => {
    const callInvoker = jest.fn().mockResolvedValue({ sdpAnswer: 'answer-sdp' });

    const track: any = { stop: jest.fn() };
    const mockStream: MediaStream = {
      getTracks: () => [track as MediaStreamTrack],
      getAudioTracks: () => [track as MediaStreamTrack],
    } as MediaStream;

    const getUserMedia = jest.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    const processor = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: undefined as ((event: any) => void) | undefined,
    };

    const audioContextFactory = jest.fn(() => ({
      createMediaStreamSource: () => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      createScriptProcessor: () => processor,
      createGain: () => ({
        gain: { value: 0 },
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      destination: {},
      close: jest.fn().mockResolvedValue(undefined),
      suspend: jest.fn().mockResolvedValue(undefined),
    }));

    const dataChannel = new MockRTCDataChannel('oai-events');

    class MockPeerConnection {
      connectionState: RTCPeerConnectionState = 'new';
      onconnectionstatechange?: () => void;
      localDescription: RTCSessionDescriptionInit | null = null;
      remoteDescription: RTCSessionDescriptionInit | null = null;
      addTrack = jest.fn();
      createOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' });
      setLocalDescription = jest.fn(async (desc: RTCSessionDescriptionInit) => {
        this.localDescription = desc;
      });
      setRemoteDescription = jest.fn(async (desc: RTCSessionDescriptionInit) => {
        this.remoteDescription = desc;
      });
      createDataChannel = jest.fn(() => dataChannel as unknown as RTCDataChannel);
      close = jest.fn();
    }

    const peerConnection = new MockPeerConnection();
    const peerConnectionFactory = jest
      .fn()
      .mockImplementation(() => peerConnection as unknown as RTCPeerConnection);

    const setText = jest.fn();
    const onComplete = jest.fn();

    const { result } = renderHook(
      () =>
        useSpeechToTextRealtime(setText, onComplete, {
          peerConnectionFactory,
          audioContextFactory,
          realtimeCallInvoker: callInvoker,
        }),
      {
        wrapper: ({ children }) => (
          <RecoilRoot
            initializeState={({ set }) => {
              set(store.autoSendText, 0);
              set(store.speechToText, true);
              set(store.realtimeSTTOptions, webrtcDefaults);
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

    expect(getUserMedia).toHaveBeenCalled();
    expect(callInvoker).toHaveBeenCalledWith(
      expect.objectContaining({
        sdpOffer: 'offer-sdp',
        model: webrtcDefaults.model,
        voice: webrtcDefaults.session?.voice,
        instructions: webrtcDefaults.session?.instructions,
        vad: expect.any(Object),
      }),
    );

    expect(peerConnection.setRemoteDescription).toHaveBeenCalledWith({
      type: 'answer',
      sdp: 'answer-sdp',
    });

    act(() => {
      track.onunmute?.();
      dataChannel.open();
    });

    await act(async () => {
      processor.onaudioprocess?.({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.25, -0.25]),
        },
      });
    });

    await act(async () => {
      dataChannel.emit({ type: 'response.output_text.delta', delta: 'hello' });
      dataChannel.emit({ type: 'response.completed' });
    });

    expect(setText).toHaveBeenCalledWith('hello');
    expect(onComplete).toHaveBeenCalledWith('hello');
  });

  it('uses configured include modalities when requesting realtime responses', async () => {
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
    const sessionWithInclude = { ...mockSession, include: ['text', 'audio'] };
    const sessionFetcher = jest.fn().mockResolvedValue(sessionWithInclude);
    const processor = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: undefined as ((event: any) => void) | undefined,
    };

    const audioContextFactory = jest.fn(() => ({
      createMediaStreamSource: () => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      createScriptProcessor: () => processor,
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
          audioContextFactory,
        }),
      {
        wrapper: ({ children }) => (
          <RecoilRoot
            initializeState={({ set }) => {
              set(store.autoSendText, 0);
              set(store.speechToText, true);
              set(store.realtimeSTTOptions, sessionWithInclude);
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
      processor.onaudioprocess?.({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.1, -0.1]),
        },
      });
    });

    expect(websocket.sent).toHaveLength(3);
    const responsePayload = JSON.parse(websocket.sent[2]);
    expect(responsePayload).toMatchObject({
      type: 'response.create',
      response: { modalities: ['text', 'audio'] },
    });

    act(() => {
      result.current.stopRecording();
    });
  });

  it('requests audio modality when speech-to-speech defaults are enabled', async () => {
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
    const sessionWithSpeechToSpeech = {
      ...mockSession,
      sessionDefaults: { speechToSpeech: true },
    };
    const sessionFetcher = jest.fn().mockResolvedValue(sessionWithSpeechToSpeech);
    const processor = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      onaudioprocess: undefined as ((event: any) => void) | undefined,
    };

    const audioContextFactory = jest.fn(() => ({
      createMediaStreamSource: () => ({
        connect: jest.fn(),
        disconnect: jest.fn(),
      }),
      createScriptProcessor: () => processor,
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
          audioContextFactory,
        }),
      {
        wrapper: ({ children }) => (
          <RecoilRoot
            initializeState={({ set }) => {
              set(store.autoSendText, 0);
              set(store.speechToText, true);
              set(store.realtimeSTTOptions, sessionWithSpeechToSpeech);
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
      processor.onaudioprocess?.({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.1, -0.1]),
        },
      });
    });

    expect(websocket.sent).toHaveLength(3);
    const responsePayload = JSON.parse(websocket.sent[2]);
    expect(responsePayload).toMatchObject({
      type: 'response.create',
      response: { modalities: ['text', 'audio'] },
    });

    act(() => {
      result.current.stopRecording();
    });
  });

  it('defers realtime responses for WebRTC until audio is detected', async () => {
    const rawTrack = {
      stop: jest.fn(),
      onunmute: null as ((event: Event) => void) | null,
      onmute: null as ((event: Event) => void) | null,
    };
    const mockTrack = rawTrack as unknown as MediaStreamTrack;
    const mockStream: MediaStream = {
      getTracks: () => [mockTrack],
      getAudioTracks: () => [mockTrack],
    } as MediaStream;

    const getUserMedia = jest.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia },
      configurable: true,
    });

    const mockDataChannel = new MockRTCDataChannel('oai-events');

    class MockPeerConnection {
      connectionState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed' = 'connected';
      onconnectionstatechange?: () => void;

      createDataChannel = jest.fn(() => mockDataChannel as unknown as RTCDataChannel);
      createOffer = jest.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' });
      setLocalDescription = jest.fn().mockResolvedValue(undefined);
      setRemoteDescription = jest.fn().mockResolvedValue(undefined);
      addTrack = jest.fn();
      close = jest.fn();
    }

    const mockPeerConnection = new MockPeerConnection();
    const peerConnectionFactory = jest.fn(() => mockPeerConnection as unknown as RTCPeerConnection);

    const callInvoker = jest.fn().mockResolvedValue({ sdpAnswer: 'answer-sdp' });

    const webrtcSession = {
      ...mockSession,
      url: 'https://api.openai.com/v1/realtime',
      transport: 'webrtc' as const,
    };

    const sessionFetcher = jest.fn().mockResolvedValue(webrtcSession);
    const setText = jest.fn();
    const onComplete = jest.fn();

    const { result } = renderHook(
      () =>
        useSpeechToTextRealtime(setText, onComplete, {
          realtimeSessionFetcher: sessionFetcher,
          peerConnectionFactory,
          autoSendOnSuccess: true,
          realtimeCallInvoker: callInvoker,
        }),
      {
        wrapper: ({ children }) => (
          <RecoilRoot
            initializeState={({ set }) => {
              set(store.autoSendText, -1);
              set(store.speechToText, true);
              set(store.realtimeSTTOptions, webrtcSession);
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

    expect(sessionFetcher).toHaveBeenCalled();
    expect(peerConnectionFactory).toHaveBeenCalled();
    expect(mockPeerConnection.createOffer).toHaveBeenCalled();
    expect(callInvoker).toHaveBeenCalled();
    expect(mockPeerConnection.addTrack).toHaveBeenCalled();

    await act(async () => {
      mockDataChannel.open();
    });

    expect(mockDataChannel.sent).toHaveLength(0);

    await act(async () => {
      mockDataChannel.emit({ type: 'response.completed' });
    });

    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => {
      rawTrack.onunmute?.(new Event('unmute'));
    });

    expect(mockDataChannel.sent).toHaveLength(1);
    expect(JSON.parse(mockDataChannel.sent[0])).toMatchObject({ type: 'response.create' });

    await act(async () => {
      mockDataChannel.emit({ type: 'response.output_text.delta', delta: 'hi' });
      mockDataChannel.emit({ type: 'response.completed' });
    });

    expect(setText).toHaveBeenLastCalledWith('hi');
    expect(onComplete).toHaveBeenCalledWith('hi');

    act(() => {
      result.current.stopRecording();
    });
  });
});
