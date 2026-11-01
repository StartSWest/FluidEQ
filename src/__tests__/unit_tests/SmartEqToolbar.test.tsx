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
import type { TranslationKey } from 'common/i18n';
import {
  DEFAULT_SMART_EQ_SETTINGS,
  SMART_EQ_CHANNEL,
  parseSmartEqCoreSettings,
} from 'common/smartEqCore';
import { createSmartEqRunner } from 'main/smartEq/smartEqRunner';
import MainContent from 'renderer/MainContent';
import SmartEqEngine from 'renderer/SmartEqEngine';
import { setContinuousEq } from 'renderer/utils/continuousEq';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import {
  getSmartEqMode,
  setSmartEqMode,
  type TSmartEqMode,
} from 'renderer/utils/smartEqMode';
import { setSmartEqRunning } from 'renderer/utils/smartEqRun';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

/**
 * The EQ page's Smart EQ button and the window's Smart EQ host, against the
 * core's real runner (`main/smartEq/smartEqRunner.ts`) behind a bridge that
 * carries each message at once, as Electron's would a moment later. What the
 * core hears is a tap per measurement that a case can fail, and what it
 * writes is recorded.
 */

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

/** Every tap the core opened, in order. */
interface ITap {
  isOneShot: boolean;
  isClosed: boolean;
  lose: (reason: TranslationKey) => void;
}
const taps: ITap[] = [];
const write = jest.fn(() => Promise.resolve(true));

/** The core's runner behind a bridge, as `main.ts` wires it. */
const startCore = (isBypassed: boolean) => {
  let settings = DEFAULT_SMART_EQ_SETTINGS;
  const windowListeners = new Map<string, Set<(payload: unknown) => void>>();
  const tell = (channel: string) => (payload: unknown) =>
    windowListeners.get(channel)?.forEach((listener) => listener(payload));
  const runner = createSmartEqRunner({
    settings: () => settings,
    layer: () => undefined,
    isBypassed: () => isBypassed,
    write,
    openSource: (_kind, _onFrame, onLost) => {
      const tap: ITap = {
        isOneShot: runner.state().isRunning,
        isClosed: false,
        lose: onLost,
      };
      taps.push(tap);
      return Promise.resolve(() => {
        tap.isClosed = true;
      });
    },
    text: (key) => key,
    now: () => 0,
    tellState: tell(SMART_EQ_CHANNEL.state),
    tellRemark: tell(SMART_EQ_CHANNEL.remark),
    tellView: tell(SMART_EQ_CHANNEL.view),
    tellWrote: tell(SMART_EQ_CHANNEL.wrote),
  });
  const ipcRenderer = {
    sendMessage: (channel: string, args: unknown[]) => {
      if (channel === SMART_EQ_CHANNEL.settings) {
        settings = parseSmartEqCoreSettings(args[0]);
        runner.follow();
      } else if (channel === SMART_EQ_CHANNEL.run) {
        runner.run();
      } else if (channel === SMART_EQ_CHANNEL.cancel) {
        runner.cancel();
      } else if (channel === SMART_EQ_CHANNEL.ask) {
        tell(SMART_EQ_CHANNEL.state)(runner.state());
      }
    },
    on: (channel: string, listener: (payload: unknown) => void) => {
      const listeners = windowListeners.get(channel) ?? new Set();
      listeners.add(listener);
      windowListeners.set(channel, listeners);
      return () => listeners.delete(listener);
    },
  };
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer },
  });
  return runner;
};

const renderToolbar = (bypassed: 'smart'[] = []) => {
  const runner = startCore(bypassed.includes('smart'));
  const band = { ...getDefaultFilterWithId(), gain: -3 };
  const view = render(
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
  return { ...view, runner };
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
  taps.length = 0;
});

afterEach(async () => {
  await act(async () => {
    cleanup();
    setContinuousEq(false);
    setSmartEqMode('smart');
    setSmartEqRunning(false);
  });
  Reflect.deleteProperty(window, 'electron');
});

it('opens all four modes from the idle button without starting a measurement', () => {
  renderToolbar();
  const menu = openModes();
  expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(4);
  expect(taps).toHaveLength(0);
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
  expect(taps).toHaveLength(1);
  expect(taps[0].isOneShot).toBe(true);
  expect(screen.queryByRole('button', { name: MENU })).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Stop Smart EQ' }),
  ).toHaveTextContent(/^Smart EQ$/);

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Stop Smart EQ' }));
  });
  expect(taps[0].isClosed).toBe(true);
  expect(screen.getByRole('button', { name: MENU })).toHaveTextContent(
    'Smart EQ',
  );
  expect(write).not.toHaveBeenCalled();

  chooseMode(/^Smart EQ /);
  expect(taps).toHaveLength(2);
  expect(taps[1].isClosed).toBe(false);
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
    expect(taps).toHaveLength(1);
    expect(taps[0].isOneShot).toBe(false);
    expect(
      screen.queryByRole('button', { name: MENU }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Stop Smart EQ' }).textContent,
    ).toBe(label);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop Smart EQ' }));
    });
    expect(taps[0].isClosed).toBe(true);
    chooseMode(name);
    expect(taps).toHaveLength(2);
    expect(taps[1].isClosed).toBe(false);
    expect(write).not.toHaveBeenCalled();
  },
);

it('starts one one-shot when choosing it after stopping a continuous mode', async () => {
  setSmartEqMode('detail');
  setContinuousEq(false);
  renderToolbar();
  chooseMode(/^Smart EQ /);
  expect(getSmartEqMode()).toBe('smart');
  expect(taps).toHaveLength(1);
  expect(taps[0].isOneShot).toBe(true);
  expect(
    screen.getByRole('button', { name: 'Stop Smart EQ' }),
  ).toBeInTheDocument();

  await act(async () => {
    taps[0].lose('eq.smart.error.noSource');
  });
  expect(screen.getByRole('button', { name: MENU })).toBeInTheDocument();
});

it('keeps Stop available for a continuous mode whose layer is bypassed', async () => {
  setSmartEqMode('detail');
  renderToolbar(['smart']);
  expect(taps).toHaveLength(0);
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
  expect(taps).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Stop Smart EQ' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(taps[0].isClosed).toBe(true);
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
  expect(taps).toHaveLength(0);
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
  expect(taps).toHaveLength(2);
  expect(taps[1].isOneShot).toBe(true);
  expect(taps[1].isClosed).toBe(false);
  expect(screen.getByRole('button', { name: 'Stop Smart EQ' })).toHaveFocus();
});
