import '@testing-library/jest-dom';
import type React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { RecoilRoot, useRecoilValue } from 'recoil';
import {
  RealtimeModeSelector,
  RealtimeVoiceSelector,
  RealtimeIncludeToggles,
  RealtimeInstructionsInput,
  RealtimeNoiseReductionSelector,
  RealtimeVADSettings,
} from '..';
import store from '~/store';
import { DEFAULT_REALTIME_STT_OPTIONS } from '~/store/settings';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

jest.mock('@librechat/client', () => ({
  Checkbox: ({ onCheckedChange, checked, ...props }: any) => (
    <input
      type="checkbox"
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      checked={Boolean(checked)}
      {...props}
    />
  ),
  Input: (props: any) => <input {...props} />,
  TextareaAutosize: ({ minRows: _minRows, ...props }: any) => <textarea {...props} />,
  Switch: ({ onCheckedChange, checked, ...props }: any) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked === true}
      onClick={() => onCheckedChange?.(!(checked === true))}
      {...props}
    />
  ),
}));

const RecoilObserver = ({
  node,
  onChange,
}: {
  node: Parameters<typeof useRecoilValue>[0];
  onChange: (value: unknown) => void;
}) => {
  const value = useRecoilValue(node);
  useEffect(() => {
    onChange(value);
  }, [onChange, value]);
  return null;
};

describe('Realtime audio settings components', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updates realtime configuration state when controls are changed', async () => {
    const stateSpy = jest.fn();

    render(
      <RecoilRoot
        initializeState={({ set }) => {
          set(store.realtimeSTTOptions, DEFAULT_REALTIME_STT_OPTIONS);
        }}
      >
        <RecoilObserver node={store.realtimeSTTOptions} onChange={stateSpy} />
        <div className="space-y-4">
          <RealtimeModeSelector />
          <RealtimeVoiceSelector />
          <RealtimeIncludeToggles />
          <RealtimeInstructionsInput />
          <RealtimeNoiseReductionSelector />
          <RealtimeVADSettings />
        </div>
      </RecoilRoot>,
    );

    fireEvent.change(screen.getByTestId('realtime-mode-select'), { target: { value: 'speech_to_speech' } });
    const voiceInput = screen.getByTestId('realtime-voice-input') as HTMLInputElement;
    expect(voiceInput).not.toBeDisabled();
    fireEvent.change(voiceInput, { target: { value: 'alloy' } });

    fireEvent.click(screen.getByTestId('realtime-include-audio'));
    fireEvent.click(screen.getByTestId('realtime-include-audio'));

    fireEvent.change(screen.getByTestId('realtime-instructions'), {
      target: { value: 'Follow my prompts precisely.' },
    });

    fireEvent.change(screen.getByTestId('realtime-noise-reduction'), { target: { value: 'server_standard' } });

    fireEvent.change(screen.getByTestId('realtime-vad-mode'), { target: { value: 'semantic' } });
    fireEvent.change(screen.getByTestId('realtime-vad-decision'), { target: { value: '250' } });
    fireEvent.change(screen.getByTestId('realtime-vad-prob'), { target: { value: '0.65' } });
    fireEvent.change(screen.getByTestId('realtime-vad-activation'), { target: { value: '0.7' } });
    fireEvent.change(screen.getByTestId('realtime-vad-deactivation'), { target: { value: '0.45' } });

    await waitFor(() => {
      expect(stateSpy).toHaveBeenCalled();
    });

    const latestState = stateSpy.mock.calls[stateSpy.mock.calls.length - 1][0] as Record<string, any>;
    expect(latestState.session.mode).toBe('speech_to_speech');
    expect(latestState.session.speechToSpeech).toBe(true);
    expect(latestState.session.voice).toBe('alloy');
    expect(latestState.session.instructions).toContain('Follow my prompts');
    expect(latestState.include).toContain('audio');
    expect(latestState.include).toContain('text');
    expect(latestState.audio.input.noiseReduction).toBe('server_standard');
    expect(latestState.audio.input.turnDetection).toMatchObject({
      type: 'semantic',
      semantic: {
        enabled: true,
        minDecisionIntervalMs: 250,
        speechProbThreshold: 0.65,
        activationThreshold: 0.7,
        deactivationThreshold: 0.45,
      },
    });

    const stored = localStorage.getItem('realtimeSTTOptions');
    expect(stored).toBeTruthy();
    expect(stored).toContain('alloy');
    expect(stored).toContain('speech_to_speech');
  });
});
