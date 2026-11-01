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
import type {
  ILibraryAnswers,
  ILibrarySummary,
  TLibraryRequest,
} from '../../common/library/query';

/** An empty library, as main's store answers it (`App.test.tsx` has the same). */
const EMPTY_LIBRARY: ILibrarySummary = {
  version: 0,
  roots: [],
  trackCount: 0,
  videoCount: 0,
  wasReset: false,
};

/** Every question but a page, whose answer carries the offset it was asked at. */
const EMPTY_ANSWERS: Omit<ILibraryAnswers, 'page'> = {
  position: -1,
  letters: {},
  ids: [],
  tracks: [],
  continuation: [],
  duration: 0,
  headings: [],
  rest: -1,
};

const emptyLibraryAnswer = (
  request: TLibraryRequest,
): ILibraryAnswers[TLibraryRequest['type']] => {
  if (request.type === 'page') {
    return {
      total: 0,
      nearCount: 0,
      markedCount: 0,
      offset: request.offset,
      items: [],
      version: EMPTY_LIBRARY.version,
    };
  }
  return EMPTY_ANSWERS[request.type];
};

/**
 * What the window does behind the amp: the pages are taken down, the players
 * are not.
 *
 * The EQ page and the karaoke player are probes that say when their effects
 * run and stop, and hold a count of their own, so "taken down" can be told
 * from "asleep" — a page that slept kept its state, one that is taken down
 * comes back at zero, as it does from a tab switch.
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

// The graph's visualizer stands beside the graph, taken down with it.
jest.mock('../../renderer/graph/GraphScene', () => {
  const React = jest.requireActual('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'graph-scene' }),
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
const outputMirrorResetListeners = new Set<() => void>();
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
  outputMirrorResetListeners.clear();
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
        onOutputMirrorsReset: (listener: () => void) => {
          outputMirrorResetListeners.add(listener);
          return () => {
            outputMirrorResetListeners.delete(listener);
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
        getLibrarySummary: async () => EMPTY_LIBRARY,
        queryLibrary: async (request: TLibraryRequest) =>
          emptyLibraryAnswer(request),
        onLibraryScanProgress: () => () => {},
        onLibraryChanged: () => () => {},
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
  it('takes the page down and keeps the player playing, then builds the page again', async () => {
    const { unmount } = render(<App />);
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

    // Not there at all, rather than kept asleep with all it held — the page
    // and the graph's visualizer alike.
    expect(screen.queryByRole('button', { name: /eq presses/ })).toBeNull();
    expect(screen.queryByTestId('graph-scene')).toBeNull();

    mockLog.length = 0;
    await announceWindowMode('app');
    expect(screen.queryByTestId('amp')).toBeNull();
    expect(mockLog).toEqual(['eq page awake']);
    // Built again, as a tab switch builds it: its own count starts over.
    expect(
      screen.getByRole('button', { name: 'eq presses 0' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('graph-scene')).toBeInTheDocument();
    expect(screen.getByTestId('karaoke-player')).toBeInTheDocument();
    expect(outputMirrorResetListeners.size).toBeGreaterThan(0);
    await act(async () => unmount());
    expect(outputMirrorResetListeners.size).toBe(0);
  });

  it('leaves the Karaoke page as it was, so a Maker job keeps running behind it', async () => {
    // Hidden, the Karaoke page renders only its audio host: an open Maker
    // would unmount and cancel a background removal that takes minutes —
    // and the amp is where somebody waits for one.
    render(<App />);
    await act(async () => Promise.resolve());
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Karaoke' }));
      await preloadTab('karaoke');
    });
    act(() => claimPlayback('karaoke'));
    expect(screen.getByTestId('karaoke-player')).toHaveAttribute(
      'data-hidden',
      'false',
    );
    mockLog.length = 0;

    await announceWindowMode('player');
    expect(screen.getByTestId('amp')).toBeInTheDocument();
    expect(screen.getByTestId('karaoke-player')).toHaveAttribute(
      'data-hidden',
      'false',
    );
    expect(mockLog).not.toContain('karaoke player stopped');
  });
});
