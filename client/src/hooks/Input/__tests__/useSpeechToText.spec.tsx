import '@testing-library/jest-dom';
import type React from 'react';
import { renderHook } from '@testing-library/react';
import { RecoilRoot } from 'recoil';
import useSpeechToText from '../useSpeechToText';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

const mockBrowser = jest.fn(() => ({
  isListening: false,
  isLoading: false,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
}));

const mockExternal = jest.fn(() => ({
  isListening: false,
  isLoading: false,
  externalStartRecording: jest.fn(),
  externalStopRecording: jest.fn(),
}));

const mockRealtime = jest.fn(() => ({
  isListening: false,
  isLoading: false,
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
}));

jest.mock('@librechat/client', () => ({}));

jest.mock('../useSpeechToTextBrowser', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockBrowser(...args),
}));

jest.mock('../useSpeechToTextExternal', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockExternal(...args),
}));

jest.mock('../useSpeechToTextRealtime', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockRealtime(...args),
}));

describe('useSpeechToText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('passes realtime settings from recoil to the realtime hook', () => {
    const realtimeState = {
      ...DEFAULT_REALTIME_STT_OPTIONS,
      model: 'gpt-4o-realtime-preview',
      session: {
        mode: 'speech_to_speech',
        voice: 'verse',
        instructions: 'Keep responses concise',
        speechToSpeech: true,
      },
      include: ['text', 'audio'],
      audio: {
        input: {
          format: DEFAULT_REALTIME_STT_OPTIONS.audio?.input?.format,
          noiseReduction: 'server_light',
          turnDetection: {
            type: 'server_vad',
            serverVad: {
              enabled: true,
              threshold: -45,
            },
          },
        },
      },
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RecoilRoot
        initializeState={({ set }) => {
          set(store.engineSTT, 'realtime');
          set(store.realtimeSTTOptions, realtimeState);
        }}
      >
        {children}
      </RecoilRoot>
    );

    renderHook(() => useSpeechToText(jest.fn(), jest.fn()), { wrapper });

    expect(mockRealtime).toHaveBeenCalledTimes(1);
    const options = mockRealtime.mock.calls[0][2] as Record<string, unknown>;
    expect(options).toMatchObject({
      mode: 'speech_to_speech',
      model: 'gpt-4o-realtime-preview',
      voice: 'verse',
      instructions: 'Keep responses concise',
      include: ['text', 'audio'],
      noiseReduction: 'server_light',
    });
    expect(options.turnDetection).toEqual({
      type: 'server_vad',
      serverVad: { enabled: true, threshold: -45 },
    });
  });
});
