/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window the desktop card is drawn in.
 *
 * Two failures this holds, and both shipped. The card was drawn blank twice:
 * the first time its page refused its own script, and the second time the
 * page was fixed and the card still came up empty, because the window was
 * opened in the app's own session and the app puts its content policy on
 * every document in that session — a policy that refuses inline script,
 * whatever the page says about itself. Neither is visible in the markup or
 * the page's own test; only the window's session says it.
 *
 * And the card wore one theme's cyan on one theme's navy whatever the window
 * looked like, so the window's own colours now travel to it — and only
 * colours, and only the five the page declares.
 */

const mockFromPartition = jest.fn();
const mockLoadFile = jest.fn(() => Promise.resolve());
const mockCreated: { options?: Record<string, unknown> }[] = [];

jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation((options) => {
    mockCreated.push({ options });
    return {
      setAlwaysOnTop: jest.fn(),
      setVisibleOnAllWorkspaces: jest.fn(),
      setIgnoreMouseEvents: jest.fn(),
      once: jest.fn(),
      on: jest.fn(),
      isDestroyed: () => false,
      close: jest.fn(),
      showInactive: jest.fn(),
      loadFile: mockLoadFile,
    };
  }),
  screen: {
    getDisplayNearestPoint: (point: { x: number }) => mockDisplayAt(point.x),
    getDisplayMatching: (rect: { x: number }) => mockDisplayAt(rect.x),
    // The second screen runs at 200%: real pixels halve into Electron's.
    screenToDipPoint: (point: { x: number; y: number }) => ({
      x: point.x / 2,
      y: point.y / 2,
    }),
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
  },
  session: { fromPartition: mockFromPartition },
}));

/**
 * Two screens side by side, as Electron lays them out: the main one at
 * 1920x1080, and a second to its right. A point on neither is on the main one,
 * which is where Electron's own nearest-display answer lands a stray point.
 */
const mockDisplays = [
  {
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
  },
  {
    id: 2,
    bounds: { x: 1920, y: 0, width: 1280, height: 720 },
    workArea: { x: 1920, y: 0, width: 1280, height: 680 },
  },
];
function mockDisplayAt(x: number) {
  return (
    mockDisplays.find(
      (one) => x >= one.bounds.x && x < one.bounds.x + one.bounds.width,
    ) ?? mockDisplays[0]
  );
}

jest.mock('electron-log', () => ({ info: jest.fn() }));

// eslint-disable-next-line import/first
import { createGameToasts } from '../../../main/gameToast';

const ownSession = {
  setPermissionRequestHandler: jest.fn(),
  setPermissionCheckHandler: jest.fn(),
};

const searchOf = (): URLSearchParams => {
  const [, options] = mockLoadFile.mock.calls[
    mockLoadFile.mock.calls.length - 1
  ] as unknown as [string, { search: string }];
  return new URLSearchParams(options.search);
};

beforeEach(() => {
  mockCreated.length = 0;
  mockLoadFile.mockClear();
  mockFromPartition.mockReset();
  mockFromPartition.mockReturnValue(ownSession);
});

describe('the window the game card is drawn in', () => {
  it('is never the app’s own session, whose policy refuses the card’s script', () => {
    createGameToasts().show({ what: 'Loaded Gaming', game: 'for Overwatch' });
    expect(mockFromPartition).toHaveBeenCalledWith('fluideq-game-card');
    const preferences = mockCreated[0].options?.webPreferences as {
      session?: unknown;
    };
    // The control that makes this mean something: without a session of its
    // own, Electron puts a window in the default one — the app's.
    expect(preferences.session).toBe(ownSession);
  });

  it('grants that session nothing: no camera, no microphone, no files', () => {
    createGameToasts().show({ what: 'Loaded Gaming', game: 'for Overwatch' });
    const [[ask]] = ownSession.setPermissionRequestHandler.mock.calls as [
      [
        (
          contents: unknown,
          permission: string,
          answer: (ok: boolean) => void,
        ) => void,
      ],
    ];
    const answer = jest.fn();
    ask(undefined, 'media', answer);
    expect(answer).toHaveBeenCalledWith(false);
  });

  it('carries the window’s own colours, and only the five the page knows', () => {
    createGameToasts().show({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      colors: {
        accent: '#fab1fb',
        panel: '#1b021c',
        base: 'rgb(14, 1, 15)',
        text: '#ecf5fb',
        muted: '#d6e9f7',
        other: '#ffffff',
      },
    });
    const said = searchOf();
    expect(said.get('accent')).toBe('#fab1fb');
    expect(said.get('panel')).toBe('#1b021c');
    expect(said.get('base')).toBe('rgb(14, 1, 15)');
    expect(said.get('text')).toBe('#ecf5fb');
    expect(said.get('muted')).toBe('#d6e9f7');
    expect(said.has('other')).toBe(false);
  });

  it('drops anything that is not plainly a colour', () => {
    createGameToasts().show({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      colors: {
        accent: 'red; background: url(https://example.com/)',
        panel: 'var(--x)',
        base: '',
        text: '#ecf5fb',
      },
    });
    const said = searchOf();
    expect(said.has('accent')).toBe(false);
    expect(said.has('panel')).toBe(false);
    expect(said.has('base')).toBe(false);
    // The positive control beside the refusals: a colour still goes through.
    expect(said.get('text')).toBe('#ecf5fb');
  });
});

/**
 * Which screen the card opens on. Ivan, 2026-09-24: "open it always where
 * the app is at that moment". It followed the game, and some cards opened on
 * another screen than he was looking for them on.
 */
describe('the screen the game card opens on', () => {
  const cardX = () => mockCreated[0].options?.x as number;
  /** Where a card sits on a screen: its bottom-right corner, 26 px in. */
  const cornerOf = (display: (typeof mockDisplays)[number]) =>
    display.workArea.x + display.workArea.width - 520 - 26;

  const appWindow = (
    x: number,
    { minimized = false }: { minimized?: boolean } = {},
  ) =>
    ({
      isDestroyed: () => false,
      isMinimized: () => minimized,
      // Windows parks a minimised window far off every screen.
      getBounds: () =>
        minimized
          ? { x: -32000, y: -32000, width: 160, height: 28 }
          : { x, y: 40, width: 900, height: 600 },
      getNormalBounds: () => ({ x, y: 40, width: 900, height: 600 }),
    }) as never;

  // The game, fullscreen on the main screen.
  const onMainScreen = '0,0,1920,1080';

  it('is the screen FluidEQ is on, whichever screen the game is on', () => {
    createGameToasts(() => appWindow(2100)).show({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      rect: onMainScreen,
    });
    expect(cardX()).toBe(cornerOf(mockDisplays[1]));
  });

  it('is where FluidEQ will come back, while it is minimised', () => {
    createGameToasts(() => appWindow(2100, { minimized: true })).show({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      rect: onMainScreen,
    });
    expect(cardX()).toBe(cornerOf(mockDisplays[1]));
  });

  it('is the game’s screen when there is no window, read in the screens’ own units', () => {
    // The game fullscreen on the second screen, in the real pixels the
    // watcher reports: 3840..6400 at 200% is 1920..3200 on Electron's layout.
    createGameToasts().show({
      what: 'Loaded Gaming',
      game: 'for Overwatch',
      rect: '3840,0,2560,1440',
    });
    expect(cardX()).toBe(cornerOf(mockDisplays[1]));
    // The control: the same rectangle read as it arrives lies on no screen,
    // and Electron would have put the card on the main one.
    expect(mockDisplayAt(3840 + 2560 / 2).id).toBe(1);
  });
});
