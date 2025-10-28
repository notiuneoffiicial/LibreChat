import '@testing-library/jest-dom';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { RecoilRoot } from 'recoil';
import useSpeechToTextRealtime from '../useSpeechToTextRealtime';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

type MockPeerConnectionOptions = {
  onMessage?: (event: MessageEvent<string>) => void;
};

class MockPeerConnection {
  public connectionState: RTCPeerConnectionState = 'new';

  public onconnectionstatechange: ((this: RTCPeerConnection, ev: Event) => any) | null = null;

  public ontrack: ((this: RTCPeerConnection, ev: RTCTrackEvent) => any) | null = null;

  private channel: {
    readyState: RTCDataChannelState;
    onmessage: ((event: MessageEvent<string>) => void) | null;
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    close: () => void;
  } | null = null;

  private readonly options: MockPeerConnectionOptions;

  constructor(options: MockPeerConnectionOptions = {}) {
    this.options = options;
  }

  createDataChannel() {
    this.channel = {
      readyState: 'open',
      onmessage: this.options.onMessage ?? null,
      onopen: null,
      onclose: null,
      close: () => {
        this.channel = null;
      },
    };
    return this.channel;
  }

  addTrack() {
    return {};
  }

  async createOffer() {
    return { sdp: 'mock-offer-sdp' };
  }

  async setLocalDescription() {
    return undefined;
  }

  async setRemoteDescription() {
    return undefined;
  }

  close() {
    this.channel = null;
  }
}

jest.mock('@librechat/client', () => ({
  useToastContext: () => ({ showToast: jest.fn() }),
}));

const mockMutateAsync = jest.fn();

jest.mock('~/data-provider', () => ({
  useRealtimeSessionMutation: () => ({ mutateAsync: mockMutateAsync }),
}));

describe('useSpeechToTextRealtime', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalGetUserMedia = navigator.mediaDevices?.getUserMedia;

  beforeEach(() => {
    mockMutateAsync.mockReset();
    const mediaDevices = navigator.mediaDevices ?? {};
    Object.defineProperty(navigator, 'mediaDevices', {
      value: mediaDevices,
      configurable: true,
      writable: true,
    });
    (navigator.mediaDevices.getUserMedia as jest.Mock | undefined)?.mockReset?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator.mediaDevices as any).getUserMedia = jest.fn(async () => ({
      getTracks: () => [
        {
          stop: jest.fn(),
          kind: 'audio',
        },
      ],
    }));
  });

  afterAll(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: originalMediaDevices,
        configurable: true,
        writable: true,
      });
      if (originalGetUserMedia) {
        navigator.mediaDevices.getUserMedia = originalGetUserMedia;
      } else {
        delete (navigator.mediaDevices as any).getUserMedia;
      }
    } else {
      delete (navigator as any).mediaDevices;
    }
  });

  it('builds realtime call payload without deprecated modalities', async () => {
    const callSpy = jest.fn(async (payload) => {
      return { sdpAnswer: 'mock-answer' };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot
        initializeState={({ set }) => {
          set(store.realtimeSTTOptions, {
            ...DEFAULT_REALTIME_STT_OPTIONS,
            session: {
              ...DEFAULT_REALTIME_STT_OPTIONS.session,
              type: 'realtime',
              speechToSpeech: true,
              textOutput: true,
              audioOutput: true,
              audio: {
                ...(DEFAULT_REALTIME_STT_OPTIONS.session?.audio ?? {}),
                output: {
                  ...(DEFAULT_REALTIME_STT_OPTIONS.session?.audio?.output ?? {}),
                  enabled: true,
                },
              },
            },
          });
          set(store.speechToText, true);
        }}
      >
        {children}
      </RecoilRoot>
    );

    const { result } = renderHook(
      () =>
        useSpeechToTextRealtime(jest.fn(), jest.fn(), {
          realtimeCallInvoker: callSpy,
          peerConnectionFactory: () => new MockPeerConnection(),
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(callSpy).toHaveBeenCalledTimes(1);
    const payload = callSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toHaveProperty('session');
    const session = payload.session as Record<string, unknown>;
    expect(session).not.toHaveProperty('modalities');
    expect(session).not.toHaveProperty('output_modalities');
    expect(session.audioOutput).toBe(true);
  });
});
