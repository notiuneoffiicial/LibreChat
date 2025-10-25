import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { render, screen } from 'test/layout-test-utils';
import { RecoilRoot } from 'recoil';
import EngineSTTDropdown from '../EngineSTTDropdown';
import store from '~/store';

jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    Dropdown: ({ options, value, onChange }: any) => (
      <select
        data-testid="engine-stt-select"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {options.map((option: { value: string; label: string }) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

const renderDropdown = (props: React.ComponentProps<typeof EngineSTTDropdown>) =>
  render(
    <RecoilRoot initializeState={({ set }) => set(store.engineSTT, 'browser')}>
      <EngineSTTDropdown {...props} />
    </RecoilRoot>,
  );

describe('EngineSTTDropdown', () => {
  it('shows realtime option when available', () => {
    renderDropdown({ external: true, realtimeAvailable: true });

    const select = screen.getByTestId('engine-stt-select');
    expect(select).toBeInTheDocument();
    expect(screen.getByText(/Realtime/i)).toBeInTheDocument();
  });

  it('hides realtime option when not available', () => {
    renderDropdown({ external: true, realtimeAvailable: false });

    const options = screen.getAllByRole('option');
    expect(options.find((option) => option.textContent === 'Realtime')).toBeUndefined();
  });
});
