import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import type { RealtimeCallRequest } from 'librechat-data-provider';
import store from '~/store';
import useSpeechToTextRealtime from '../useSpeechToTextRealtime';

const mockMutateAsync = jest.fn();

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
}));

jest.mock('~/data-provider', () => ({
  useRealtimeSessionMutation: jest.fn(() => ({ mutateAsync: mockMutateAsync })),
}));

describe('useSpeechToTextRealtime', () => {

  class MockRTCDataChannel {
    label: string;

    readyState: RTCDataChannelState = 'connecting';

    onopen?: () => void;

    onmessage?: (event: MessageEvent<string>) => void;

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

    emit(data: unknown) {
      this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
    }
  }

  class MockRTCPeerConnection {
    readonly dataChannel: MockRTCDataChannel;

    readonly addTrack = jest.fn();

    readonly setLocalDescription = jest.fn().mockResolvedValue(undefined);

    readonly setRemoteDescription = jest.fn().mockResolvedValue(undefined);

    readonly createOffer = jest
      .fn()
      .mockResolvedValue({ type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1' });

    readonly close = jest.fn();

    readonly createDataChannel = jest.fn(() => this.dataChannel);

    connectionState: RTCPeerConnectionState = 'connected';

    onconnectionstatechange?: () => void;

    constructor(channel: MockRTCDataChannel) {
      this.dataChannel = channel;
    }
  }

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
      speechToSpeech: false,
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

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <RecoilRoot
      initializeState={({ set }) => {
        set(store.realtimeSTTOptions, webrtcDefaults);
        set(store.autoSendText, 0);
        set(store.speechToText, true);
      }}
    >
      {children}
    </RecoilRoot>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockMutateAsync.mockReset();
  });

  it('negotiates a WebRTC session and handles transcription events', async () => {
    const mockChannel = new MockRTCDataChannel('oai-events');
    const mockPeerConnection = new MockRTCPeerConnection(mockChannel);
    const peerConnectionFactory = jest.fn(() => mockPeerConnection);

    mockMutateAsync.mockImplementation(async (_payload: RealtimeCallRequest) => ({
      sdpAnswer: 'answer-sdp',
    }));

    const trackStop = jest.fn();
    const mockStream: MediaStream = {
      getTracks: () => [
        {
          stop: trackStop,
        } as unknown as MediaStreamTrack,
      ],
    } as MediaStream;

    const getUserMedia = jest.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const setText = jest.fn();
    const onComplete = jest.fn();

    const { result } = renderHook(
      () =>
        useSpeechToTextRealtime(setText, onComplete, {
          peerConnectionFactory,
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(peerConnectionFactory).toHaveBeenCalled();
    expect(mockPeerConnection.addTrack).toHaveBeenCalled();
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload.sdpOffer).toContain('v=0');
    expect(payload).toMatchObject({
      mode: 'conversation',
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
      instructions: 'Be brief',
      include: ['text'],
    });
    expect(payload.turnDetection).toEqual({
      type: 'server_vad',
      serverVad: { enabled: true },
    });
    expect(payload.noiseReduction).toEqual('server_light');

    act(() => {
      mockChannel.open();
    });

    expect(result.current.isListening).toBe(true);
    expect(result.current.isLoading).toBe(false);

    act(() => {
      mockChannel.emit({
        type: 'conversation.item.input_audio_transcription.delta',
        delta: { text: 'Hello ' },
      });
    });

    expect(setText).toHaveBeenCalledWith('Hello ');
    expect(result.current.status).toBe('processing');

    await act(async () => {
      mockChannel.emit({
        type: 'conversation.item.input_audio_transcription.completed',
        transcription: { text: 'Hello world' },
      });
    });

    expect(setText).toHaveBeenLastCalledWith('Hello world');
    expect(onComplete).toHaveBeenCalledWith('Hello world');
    expect(result.current.status).toBe('completed');
    expect(trackStop).toHaveBeenCalled();
  });

  it('applies realtime option overrides in the SDP payload', async () => {
    const mockChannel = new MockRTCDataChannel('oai-events');
    const mockPeerConnection = new MockRTCPeerConnection(mockChannel);
    const peerConnectionFactory = jest.fn(() => mockPeerConnection);

    mockMutateAsync.mockResolvedValue({ sdpAnswer: 'answer-sdp' });

    const mockStream: MediaStream = {
      getTracks: () => [
        {
          stop: jest.fn(),
        } as unknown as MediaStreamTrack,
      ],
    } as MediaStream;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockResolvedValue(mockStream) },
    });

    const { result } = renderHook(
      () =>
        useSpeechToTextRealtime(jest.fn(), jest.fn(), {
          peerConnectionFactory,
          mode: 'speech_to_text',
          model: 'gpt-4o-mini',
          voice: 'verse',
          instructions: 'Keep it short',
          include: ['text', 'audio'],
          turnDetection: { type: 'semantic', semantic: { enabled: true } },
          noiseReduction: { type: 'server', preset: 'medium' },
          callOverrides: { include: ['audio'], voice: 'nova' },
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.startRecording();
    });

    const payload = mockMutateAsync.mock.calls[0][0];
    expect(payload.mode).toBe('speech_to_text');
    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.voice).toBe('nova');
    expect(payload.instructions).toBe('Keep it short');
    expect(payload.include).toEqual(['audio']);
    expect(payload.turnDetection).toEqual({ type: 'semantic', semantic: { enabled: true } });
    expect(payload.noiseReduction).toEqual({ type: 'server', preset: 'medium' });
  });

  it('surfaces microphone errors via status and error callbacks', async () => {
    const errorSpy = jest.fn();
    const statusSpy = jest.fn();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: jest.fn().mockRejectedValue(new Error('denied')) },
    });

    const { result } = renderHook(
      () =>
        useSpeechToTextRealtime(jest.fn(), jest.fn(), {
          onError: errorSpy,
          onStatusChange: statusSpy,
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Microphone permission denied');
    expect(errorSpy).toHaveBeenCalledWith('Microphone permission denied');
    expect(statusSpy).toHaveBeenCalledWith('acquiring_media');
    expect(statusSpy).toHaveBeenLastCalledWith('error');
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
