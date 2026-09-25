/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  DISCLAIMER_ACCEPTED_KEY,
  buildAcceptance,
} from '../../common/disclaimer';
import App from '../../renderer/App';
import {
  claimPlayback,
  resetPlaybackOwner,
} from '../../renderer/audio/playbackOwner';
import { preloadTab } from '../../renderer/workspacePages';

/**
 * What the window does behind the amp: the pages sleep, the players do not.
 *
 * The EQ page and the karaoke player are probes that say when their effects
 * run and stop, and hold a count of their own, so "asleep" can be told from
 * "thrown away" — a page that sleeps keeps its state, one that is unmounted
 * comes back at zero.
 */
const mockLog: string[] = [];

jest.mock('../../renderer/MainContent', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: function EqPageProbe() {
      const [presses, setPresses] = React.useState(0);
      React.useEffect(() => {
        mockLog.push('eq page awake');
        return () => {
          mockLog.push('eq page asleep');
        };
      }, []);
      return React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => setPresses((count: number) => count + 1),
        },
        `eq presses ${presses}`,
      );
    },
  };
});

jest.mock('../../renderer/karaoke/KaraokeWorkspace', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: function KaraokePlayerProbe({ isHidden }: { isHidden: boolean }) {
      React.useEffect(() => {
        mockLog.push('karaoke player running');
        return () => {
          mockLog.push('karaoke player stopped');
        };
      }, []);
      return React.createElement(
        'div',
        { 'data-testid': 'karaoke-player', 'data-hidden': String(isHidden) },
        'karaoke player',
      );
    },
  };
});

// The amp itself is not under test, only what it leaves running behind it.
jest.mock('../../renderer/player/MiniPlayer', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: () =>
      React.createElement('div', { 'data-testid': 'amp' }, 'the amp'),
  };
});

/** Every listener main's window state goes to: the shell and the mode store. */
let windowStateListeners: ((state: unknown) => void)[] = [];
const announceWindowMode = async (mode: 'app' | 'player') => {
  await act(async () => {
    windowStateListeners.forEach((listener) =>
      listener({ mode, isMaximized: false, isFullScreen: false }),
    );
  });
};

beforeEach(() => {
  mockLog.length = 0;
  windowStateListeners = [];
  resetPlaybackOwner();
  window.localStorage.clear();
  window.localStorage.setItem(
    DISCLAIMER_ACCEPTED_KEY,
    JSON.stringify(buildAcceptance('1.2.0', 'en')),
  );
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: jest.fn(() => null),
  });
  // jsdom plays nothing; the players only need these to exist.
  ['play', 'pause', 'load'].forEach((method) => {
    Object.defineProperty(HTMLMediaElement.prototype, method, {
      configurable: true,
      value: jest.fn(async () => undefined),
    });
  });
  Object.defineProperty(window, 'electron', {
    configurable: true,
    get: () => ({
      platform: 'win32',
      ipcRenderer: {
        sendMessage: () => {},
        on: (channel: string, func: (...args: unknown[]) => void) => {
          if (channel !== 'window-state-changed') {
            return () => {};
          }
          const listener = (state: unknown) => func(state);
          windowStateListeners.push(listener);
          return () => {
            windowStateListeners = windowStateListeners.filter(
              (candidate) => candidate !== listener,
            );
          };
        },
        removeListener: () => {},
        getWindowState: async () => ({
          mode: 'app',
          isMaximized: false,
          isFullScreen: false,
        }),
        setWindowFullScreen: async (next: boolean) => next,
        minimizeWindow: async () => {},
        toggleMaximizeWindow: async () => false,
        closeWindow: async () => {},
        getLibraryIndex: async () => ({
          index: { version: 1, roots: [], tracks: [] },
          wasReset: false,
        }),
        onLibraryScanProgress: () => () => {},
        onLibraryTracksAdded: () => () => {},
        onLibraryIndexChanged: () => () => {},
      },
    }),
  });
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
});

describe('the window behind the amp', () => {
  it('puts the page to sleep and keeps the player playing, then wakes the page as it was', async () => {
    render(<App />);
    await act(async () => Promise.resolve());

    // A player with something in it: opened once, and playing, so the shell
    // keeps it mounted off its tab (`useIdlePlayerMount`).
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Karaoke' }));
      await preloadTab('karaoke');
    });
    act(() => claimPlayback('karaoke'));
    fireEvent.click(screen.getByRole('tab', { name: 'EQ' }));
    fireEvent.click(screen.getByRole('button', { name: 'eq presses 0' }));
    expect(
      screen.getByRole('button', { name: 'eq presses 1' }),
    ).toBeInTheDocument();
    // The probe does report its effects, so its silence below means something.
    expect(mockLog).toContain('karaoke player running');
    mockLog.length = 0;

    await announceWindowMode('player');
    expect(screen.getByTestId('amp')).toBeInTheDocument();
    expect(mockLog).toEqual(['eq page asleep']);
    // Put away the way a tab switch puts it away, and not stopped.
    expect(screen.getByTestId('karaoke-player')).toHaveAttribute(
      'data-hidden',
      'true',
    );

    mockLog.length = 0;
    await announceWindowMode('app');
    expect(screen.queryByTestId('amp')).toBeNull();
    expect(mockLog).toEqual(['eq page awake']);
    // Woken, not rebuilt: the count it had before the amp is still there.
    expect(
      screen.getByRole('button', { name: 'eq presses 1' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('karaoke-player')).toBeInTheDocument();
  });
});
