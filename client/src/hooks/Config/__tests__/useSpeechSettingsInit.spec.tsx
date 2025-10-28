import '@testing-library/jest-dom';
import { renderHook, waitFor } from '@testing-library/react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import { useGetCustomConfigSpeechQuery } from 'librechat-data-provider/react-query';
import useSpeechSettingsInit from '../useSpeechSettingsInit';
import store from '~/store';

jest.mock('librechat-data-provider/react-query', () => ({
  useGetCustomConfigSpeechQuery: jest.fn(),
}));

jest.mock('~/utils', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('useSpeechSettingsInit', () => {
  beforeEach(() => {
    localStorage.clear();
    (useGetCustomConfigSpeechQuery as jest.Mock).mockReturnValue({ data: null });
  });

  it('stores realtime defaults when provided by the server', async () => {
    const realtimeConfig = {
      model: 'gpt-4o-realtime-preview',
      transport: 'webrtc',
      stream: false,
      inputAudioFormat: {
        encoding: 'pcm16',
        rate: 16000,
        channels: 1,
      },
    };

    (useGetCustomConfigSpeechQuery as jest.Mock).mockReturnValue({
      data: {
        realtime: realtimeConfig,
        engineSTT: 'realtime',
      },
    });

    const { result } = renderHook(
      () => {
        useSpeechSettingsInit(true);
        return useRecoilValue(store.realtimeSTTOptions);
      },
      {
        wrapper: ({ children }) => <RecoilRoot>{children}</RecoilRoot>,
      },
    );

    await waitFor(() => {
      expect(result.current.transport).toBe('webrtc');
    });

    expect(result.current.model).toBe('gpt-4o-realtime-preview');
    expect(result.current.stream).toBe(false);
    expect(result.current.inputAudioFormat.rate).toBe(16000);
  });

  it('persists extended realtime metadata', async () => {
    const realtimeConfig = {
      model: 'gpt-4o-realtime-preview',
      session: {
        type: 'realtime',
        instructions: 'Keep responses brief.',
        textOutput: true,
        audioOutput: false,
        audio: {
          input: {
            noiseReduction: 'server_light',
            transcriptionDefaults: {
              language: 'en',
            },
          },
          output: {
            voice: 'alloy',
            enabled: false,
          },
        },
      },
    };

    (useGetCustomConfigSpeechQuery as jest.Mock).mockReturnValue({
      data: {
        realtime: realtimeConfig,
      },
    });

    const { result } = renderHook(
      () => {
        useSpeechSettingsInit(true);
        return useRecoilValue(store.realtimeSTTOptions);
      },
      {
        wrapper: ({ children }) => <RecoilRoot>{children}</RecoilRoot>,
      },
    );

    await waitFor(() => {
      expect(result.current.session?.audio?.output?.voice).toBe('alloy');
    });

    expect(result.current.session?.instructions).toBe('Keep responses brief.');
    expect(result.current.session?.audio?.input?.noiseReduction).toBe('server_light');
    expect(result.current.session?.audio?.input?.transcriptionDefaults).toMatchObject({
      language: 'en',
    });
    expect(result.current.session?.textOutput).toBe(true);
    expect(result.current.session?.audioOutput).toBe(false);
  });
});
