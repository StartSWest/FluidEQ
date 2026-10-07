/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultFilterWithId } from 'common/constants';
import MainContent from 'renderer/MainContent';
import SmartEqEngine from 'renderer/SmartEqEngine';
import {
  measureSource,
  type IMeasurementOptions,
} from 'renderer/audio/smartEqMeasurement';
import type { IBalanceResult } from 'renderer/utils/autoBalanceCapture';
import { setContinuousEq } from 'renderer/utils/continuousEq';
import { setSmartEq as writeSmartEq } from 'renderer/utils/equalizerApi';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import {
  getSmartEqMode,
  setSmartEqMode,
  type TSmartEqMode,
} from 'renderer/utils/smartEqMode';
import { setSmartEqRunning } from 'renderer/utils/smartEqRun';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

jest.mock('renderer/audio/smartEqMeasurement', () => ({
  measureSource: jest.fn(),
}));
jest.mock('renderer/audio/nowPlayingIdentity', () => ({
  useNowPlayingIdentity: () => ({ identity: undefined, isPlaying: true }),
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: () => undefined,
  useLiveAudioFrame: () => ({ graphPoints: [] }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  setSmartEq: jest.fn(() => Promise.resolve()),
}));
// Keep the real toolbar and engine together; other tools have their own suites.
jest.mock('renderer/components/VoicingQuickPick', () => () => null);
jest.mock('renderer/components/CurvesPicker', () => () => null);
jest.mock('renderer/components/FrequencyBand', () => () => null);
jest.mock('renderer/components/EqModeSelect', () => () => null);
// The EQ page's own EQ mode button, pinned beside the graph at first.
jest.mock('renderer/components/eqMode/EqPageModeSelect', () => () => null);
jest.mock('renderer/components/BandLayoutMenu', () => () => null);
jest.mock('renderer/components/OutputRate', () => () => null);

const MENU = 'Choose how Smart EQ measures';
const mockMeasureSource = jest.mocked(measureSource);
const measurements: {
  options: IMeasurementOptions;
  fail: (reason: Error) => void;
}[] = [];

const renderToolbar = (bypassed: 'smart'[] = []) => {
  const band = { ...getDefaultFilterWithId(), gain: -3 };
  return render(
    <FluidEqProviderWrapper
      value={{
        ...defaultFluidEqContext,
        filters: {},
        bypassed,
        smartEq: { filters: { [band.id]: band } },
      }}
    >
      <SmartEqEngine />
      <MainContent />
    </FluidEqProviderWrapper>,
  );
};

const openModes = () => {
  fireEvent.click(screen.getByRole('button', { name: MENU }));
  return screen.getByRole('menu', { name: MENU });
};

const chooseMode = (name: RegExp) =>
  fireEvent.click(within(openModes()).getByRole('menuitemradio', { name }));

beforeEach(() => {
  setSmartEqMode('smart');
  setContinuousEq(false);
  setSmartEqRunning(false);
  jest.clearAllMocks();
  measurements.length = 0;
  mockMeasureSource.mockImplementation((options) => ({
    done: new Promise<IBalanceResult>((_resolve, reject) => {
      measurements.push({ options, fail: reject });
      options.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Stopped', 'AbortError')),
        { once: true },
      );
    }),
    setSilent: jest.fn(),
    restart: jest.fn(),
  }));
});

afterEach(async () => {
  await act(async () => {
    cleanup();
    setContinuousEq(false);
    setSmartEqMode('smart');
    setSmartEqRunning(false);
  });
});

it('opens all four modes from the idle button without starting a measurement', () => {
  renderToolbar();
  const menu = openModes();
  expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(4);
  expect(mockMeasureSource).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: MENU })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('menu', { name: MENU })).not.toBeInTheDocument();
});

it('starts the remembered one-shot from its menu and stops without clearing the curve', async () => {
  renderToolbar();
  chooseMode(/^Smart EQ /);
  expect(mockMeasureSource).toHaveBeenCalledTimes(1);
  expect(measurements[0].options.isContinuous).not.toBe(true);
  expect(screen.queryByRole('button', { name: MENU })).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Stop Smart EQ' }),
  ).toHaveTextContent(/^Smart EQ$/);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Stop Smart EQ' }));
  });
  expect(measurements[0].options.signal?.aborted).toBe(true);
  expect(screen.getByRole('button', { name: MENU })).toHaveTextContent(
    'Smart EQ',
  );
  expect(writeSmartEq).not.toHaveBeenCalled();

  chooseMode(/^Smart EQ /);
  expect(mockMeasureSource).toHaveBeenCalledTimes(2);
  expect(measurements[1].options.signal?.aborted).toBe(false);
});

it.each<[TSmartEqMode, RegExp, string]>([
  ['detail', /^Detail /, 'Detail'],
  ['balance', /^Balance /, 'Balance'],
  ['target', /^Target /, 'Target'],
])(
  'starts, stops, and restarts the remembered %s mode',
  async (mode, name, label) => {
    renderToolbar();
    chooseMode(name);
    expect(getSmartEqMode()).toBe(mode);
    expect(mockMeasureSource).toHaveBeenCalledTimes(1);
    expect(measurements[0].options.isContinuous).toBe(true);
    expect(
      screen.queryByRole('button', { name: MENU }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Stop Smart EQ' }).textContent,
    ).toBe(label);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop Smart EQ' }));
    });
    expect(measurements[0].options.signal?.aborted).toBe(true);
    chooseMode(name);
    expect(mockMeasureSource).toHaveBeenCalledTimes(2);
    expect(measurements[1].options.signal?.aborted).toBe(false);
    expect(writeSmartEq).not.toHaveBeenCalled();
  },
);

it('starts one one-shot when choosing it after stopping a continuous mode', async () => {
  setSmartEqMode('detail');
  setContinuousEq(false);
  renderToolbar();
  chooseMode(/^Smart EQ /);
  expect(getSmartEqMode()).toBe('smart');
  expect(mockMeasureSource).toHaveBeenCalledTimes(1);
  expect(measurements[0].options.signal?.aborted).toBe(false);
  expect(
    screen.getByRole('button', { name: 'Stop Smart EQ' }),
  ).toBeInTheDocument();

  await act(async () => {
    measurements[0].fail(new Error('The source is unavailable'));
  });
  expect(screen.getByRole('button', { name: MENU })).toBeInTheDocument();
});

it('keeps Stop available for a continuous mode whose layer is bypassed', async () => {
  setSmartEqMode('detail');
  renderToolbar(['smart']);
  expect(mockMeasureSource).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Stop Smart EQ' }));
  });
  expect(screen.getByRole('button', { name: MENU })).toBeInTheDocument();
});

it('supports keyboard activation for the chooser, mode, and Stop', async () => {
  const user = userEvent.setup();
  renderToolbar();
  await user.tab();
  expect(screen.getByRole('button', { name: MENU })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(
    within(screen.getByRole('menu', { name: MENU })).getByRole(
      'menuitemradio',
      { name: /^Smart EQ / },
    ),
  ).toHaveFocus();
  await user.keyboard(' ');
  expect(mockMeasureSource).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Stop Smart EQ' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(measurements[0].options.signal?.aborted).toBe(true);
  expect(screen.getByRole('button', { name: MENU })).toHaveFocus();
});

it('focuses the remembered mode, wraps arrow navigation, and returns on Escape', async () => {
  const user = userEvent.setup();
  setSmartEqMode('balance');
  setContinuousEq(false);
  renderToolbar();
  await user.tab();
  await user.keyboard('{ArrowDown}');
  const menu = within(screen.getByRole('menu', { name: MENU }));
  const smart = menu.getByRole('menuitemradio', { name: /^Smart EQ / });
  const balance = menu.getByRole('menuitemradio', { name: /^Balance / });
  const target = menu.getByRole('menuitemradio', { name: /^Target / });
  expect(balance).toHaveFocus();
  expect(balance).toHaveAttribute('aria-checked', 'true');
  await user.keyboard('{ArrowDown}');
  expect(target).toHaveFocus();
  await user.keyboard('{ArrowDown}');
  expect(smart).toHaveFocus();
  await user.keyboard('{ArrowUp}');
  expect(target).toHaveFocus();
  await user.keyboard('{Home}');
  expect(smart).toHaveFocus();
  await user.keyboard('{End}');
  expect(target).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('menu', { name: MENU })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: MENU })).toHaveFocus();
  expect(mockMeasureSource).not.toHaveBeenCalled();
});

it('keeps keyboard focus through a continuous run and a different mode afterward', async () => {
  const user = userEvent.setup();
  renderToolbar();
  await user.tab();
  await user.keyboard('{Enter}{ArrowDown} ');
  expect(getSmartEqMode()).toBe('detail');
  expect(screen.getByRole('button', { name: 'Stop Smart EQ' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: MENU })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getByRole('menuitemradio', { name: /^Detail / })).toHaveFocus();
  await user.keyboard('{ArrowUp}{Enter}');
  expect(getSmartEqMode()).toBe('smart');
  expect(mockMeasureSource).toHaveBeenCalledTimes(2);
  expect(measurements[1].options.signal?.aborted).toBe(false);
  expect(screen.getByRole('button', { name: 'Stop Smart EQ' })).toHaveFocus();
});
