import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { dspPresetSettings } from 'common/dsp/presets';
import GameModeSwitch from 'renderer/components/GameModeSwitch';
import {
  applyDspSettings,
  readDspSettings,
  setGameMode,
} from 'renderer/dsp/store';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest
    .requireActual('__tests__/utils/fluidEqHookMocks')
    .eqHooksFrom(() => ({ isEnabled: true, isBlockingError: false })),
}));

beforeEach(() => {
  localStorage.clear();
  applyDspSettings(DSP_DEFAULTS);
});

it('shares the switch state across tabs and preserves the selected sound', () => {
  const gaming = dspPresetSettings('gaming', DSP_DEFAULTS);
  if (!gaming) {
    throw new Error('Gaming preset missing');
  }
  applyDspSettings(gaming);
  render(
    <>
      <GameModeSwitch installedVersion="1.10.0.0" />
      <GameModeSwitch installedVersion="1.10.0.0" />
    </>,
  );
  const switches = screen.getAllByRole('checkbox');
  expect(switches[0]).toBeChecked();
  expect(switches[1]).toBeChecked();
  fireEvent.click(switches[0]);
  expect(switches[0]).not.toBeChecked();
  expect(switches[1]).not.toBeChecked();
  expect(readDspSettings()).toEqual({ ...gaming, gameMode: false });
  expect(
    JSON.parse(localStorage.getItem('fluideq.dsp.v1') ?? '{}').gameMode,
  ).toBe(false);
  act(() => setGameMode(true));
  expect(switches[1]).toBeChecked();
});

it('enables Game mode for Gaming and turns it off for other presets', () => {
  const on = { ...DSP_DEFAULTS, gameMode: true };
  expect(dspPresetSettings('gaming', DSP_DEFAULTS)?.gameMode).toBe(true);
  expect(dspPresetSettings('gaming-room', DSP_DEFAULTS)?.gameMode).toBe(true);
  expect(dspPresetSettings('reference', on)?.gameMode).toBe(false);
  expect(dspPresetSettings('reference', DSP_DEFAULTS)?.gameMode).toBe(false);
});

it('offers an update instead of claiming Game mode works on an older engine', () => {
  applyDspSettings({ ...DSP_DEFAULTS, gameMode: true });
  const { rerender } = render(<GameModeSwitch installedVersion="1.9.0.0" />);
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(screen.getByTitle('dsp.gameMode.update')).toBeInTheDocument();
  rerender(<GameModeSwitch installedVersion="1.10.0.0" />);
  expect(screen.getByRole('checkbox')).toBeEnabled();
  expect(screen.getByRole('checkbox')).toBeChecked();
});

it('accepts capability telemetry from an installed development engine', () => {
  render(
    <GameModeSwitch installedVersion="1.9.0.0" reportedGameMode={false} />,
  );
  const toggle = screen.getByRole('checkbox');
  expect(toggle).toBeEnabled();
  fireEvent.click(toggle);
  expect(toggle).toBeChecked();
  expect(readDspSettings().gameMode).toBe(true);
});
