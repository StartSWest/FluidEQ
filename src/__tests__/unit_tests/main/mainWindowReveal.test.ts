/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the main window appears, and when its geometry is written: both on
 * events, never on a clock.
 *
 * The window used to be shown 1.5 s after `ready-to-show` if nothing else had
 * shown it, and its size and position written 400 ms after the last move.
 * Each test beside a timer count also holds the event that now decides, and
 * each "not yet" beside the event that then does.
 */

import { EventEmitter } from 'events';
import { ipcMain } from 'electron';
import { RENDERER_READY_EVENT } from 'common/constants';
import { GROUP_MEDIA_WATCH } from 'common/groupMediaTransport';
import type { IMainWindowDeps } from '../../../main/mainWindow';
import type { TWindowModes } from '../../../main/windowMode';

type TListener = (...args: unknown[]) => unknown;
const ipcListeners = new Map<string, Set<TListener>>();

interface IFakeWindow extends EventEmitter {
  /** What the window was built with. */
  options: { webPreferences?: Record<string, unknown> } | undefined;
  webContents: EventEmitter & { openDevTools: jest.Mock };
  show: jest.Mock;
  minimize: jest.Mock;
  maximize: jest.Mock;
  destroyed: boolean;
}

const windows: IFakeWindow[] = [];
let finishLoad: () => void = () => undefined;

jest.mock('electron', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- inside a hoisted factory
  const events = require('events') as typeof import('events');
  const Emitter = events.EventEmitter;
  const display = { workArea: { x: 0, y: 0, width: 1920, height: 1080 } };
  class FakeWindow extends Emitter {
    destroyed = false;

    show = jest.fn();

    minimize = jest.fn();

    maximize = jest.fn();

    hide = jest.fn();

    loadURL = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishLoad = resolve;
        }),
    );

    webContents = Object.assign(new Emitter(), {
      session: {
        setPermissionRequestHandler: jest.fn(),
        setPermissionCheckHandler: jest.fn(),
        setDisplayMediaRequestHandler: jest.fn(),
        webRequest: { onHeadersReceived: jest.fn() },
      },
      setWindowOpenHandler: jest.fn(),
      openDevTools: jest.fn(),
      send: jest.fn(),
    });

    options: unknown;

    constructor(options?: unknown) {
      super();
      this.options = options;
      windows.push(this as unknown as IFakeWindow);
    }

    isDestroyed() {
      return this.destroyed;
    }
  }
  return {
    BrowserWindow: FakeWindow,
    app: { isPackaged: false },
    desktopCapturer: { getSources: jest.fn() },
    screen: {
      getDisplayMatching: () => display,
      getPrimaryDisplay: () => display,
      on: jest.fn(),
      off: jest.fn(),
    },
    ipcMain: {
      handle: jest.fn(),
      removeHandler: jest.fn(),
      on: (channel: string, listener: TListener) => {
        const set = ipcListeners.get(channel) ?? new Set<TListener>();
        set.add(listener);
        ipcListeners.set(channel, set);
      },
      removeListener: (channel: string, listener: TListener) => {
        ipcListeners.get(channel)?.delete(listener);
      },
      once: (channel: string, listener: TListener) => {
        const set = ipcListeners.get(channel) ?? new Set<TListener>();
        const once: TListener = (...args) => {
          set.delete(once);
          return listener(...args);
        };
        set.add(once);
        ipcListeners.set(channel, set);
      },
    },
  };
});
jest.mock('../../../main/menu', () =>
  jest.fn().mockImplementation(() => ({ buildMenu: jest.fn() })),
);
jest.mock('../../../main/crashRecovery', () => ({
  installWindowRecovery: () => () => Promise.resolve(),
}));
jest.mock('../../../main/ipc/dspHost', () => ({
  shutdownDspHost: () => Promise.resolve(),
}));
jest.mock('../../../main/nativeInference', () => ({
  shutdownNativeInference: () => Promise.resolve(),
}));
jest.mock('../../../main/taskbarTransport', () => jest.fn());
jest.mock('../../../main/tray', () => ({ isAppQuitting: () => false }));
jest.mock('../../../main/windowBackdrop', () => ({
  applyWindowBackdrop: jest.fn(),
  windowFloorColour: () => '#000000',
}));
jest.mock('../../../main/safeExternal', () => jest.fn());

// eslint-disable-next-line import/first -- the Electron boundary is installed first
import { createMainWindowFactory } from '../../../main/mainWindow';

const saveWindowState = jest.fn();

const deps = (): IMainWindowDeps => ({
  isDebug: false,
  setMainWindow: jest.fn(),
  setActiveAutoUpdater: jest.fn(),
  firstRunPlacement: () => ({ maximize: false, width: 1280, height: 900 }),
  loadWindowState: () => ({ width: 1280, height: 900, x: 10, y: 10 }),
  saveWindowState,
  sendWindowState: jest.fn(),
  sendFullScreenState: jest.fn(),
  windowModes: {
    restore: jest.fn(),
    applyPin: jest.fn(),
    applyLimits: jest.fn(),
    followWindow: jest.fn(),
    mode: () => 'app',
  } as unknown as TWindowModes,
  startsHidden: () => false,
  syncDatabasesOnStartup: () => Promise.resolve(),
  setUpAutoUpdates: () => Promise.resolve(),
  startMemoryProbe: jest.fn(),
  setUpMemoryTraceTrigger: jest.fn(),
});

/** The window built, with its first load still on its way. */
const open = (overrides: Partial<IMainWindowDeps> = {}) => {
  const done = createMainWindowFactory({ ...deps(), ...overrides })();
  const window = windows[windows.length - 1];
  return { window, done };
};

const say = (channel: string, sender: unknown) =>
  ipcListeners.get(channel)?.forEach((listener) => listener({ sender }, []));

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask'] });
  windows.length = 0;
  ipcListeners.clear();
  saveWindowState.mockClear();
  jest.mocked(ipcMain.handle).mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('when the window appears', () => {
  it.each([
    ['darwin', 4],
    ['win32', 0],
  ])(
    'refreshes button placement after native layout on %s',
    async (platform, expected) => {
      const original = process.platform;
      Object.defineProperty(process, 'platform', { value: platform });
      const options = deps();
      const done = createMainWindowFactory(options)();
      try {
        const window = windows[windows.length - 1];
        ['show', 'restore', 'resized', 'focus'].forEach((event) =>
          window.emit(event),
        );
        expect(options.sendWindowState).toHaveBeenCalledTimes(Number(expected));
      } finally {
        Object.defineProperty(process, 'platform', { value: original });
        finishLoad();
        await done;
      }
    },
  );

  it('is not decided by ready-to-show, and no clock is started for it', () => {
    const { window } = open();
    expect(ipcMain.handle).toHaveBeenCalledWith(
      GROUP_MEDIA_WATCH,
      expect.any(Function),
    );
    window.emit('ready-to-show');
    expect(window.show).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    // The positive control: the page saying it painted shows it.
    say(RENDERER_READY_EVENT, window.webContents);
    expect(window.show).toHaveBeenCalledTimes(1);
  });

  it("takes the page's word from its own window only, and shows it once", () => {
    const { window } = open();
    say(RENDERER_READY_EVENT, {});
    expect(window.show).not.toHaveBeenCalled();
    say(RENDERER_READY_EVENT, window.webContents);
    say(RENDERER_READY_EVENT, window.webContents);
    expect(window.show).toHaveBeenCalledTimes(1);
  });

  it('shows a page that finished loading without ever saying it painted', async () => {
    const { window, done } = open();
    expect(window.show).not.toHaveBeenCalled();
    finishLoad();
    await done;
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('shows the window as soon as its page fails, whichever way', () => {
    const failures: Array<(window: IFakeWindow) => void> = [
      (window) =>
        window.webContents.emit(
          'did-fail-load',
          {},
          -102,
          'refused',
          'x',
          true,
        ),
      (window) =>
        window.webContents.emit('render-process-gone', {}, { reason: 'oom' }),
      (window) =>
        window.webContents.emit('preload-error', {}, 'p', new Error('x')),
      (window) => window.emit('unresponsive'),
    ];
    failures.forEach((fail) => {
      const { window } = open();
      // A sub-frame failing is not the page failing.
      window.webContents.emit('did-fail-load', {}, -3, 'aborted', 'x', false);
      expect(window.show).not.toHaveBeenCalled();
      fail(window);
      expect(window.show).toHaveBeenCalledTimes(1);
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops listening for the page once it has been shown', () => {
    const { window } = open();
    expect(ipcListeners.get(RENDERER_READY_EVENT)?.size).toBe(1);
    say(RENDERER_READY_EVENT, window.webContents);
    expect(ipcListeners.get(RENDERER_READY_EVENT)?.size).toBe(0);
  });
});

// No developer tools at launch, in development either. They opened docked
// inside the window on every start, and docked they decide how wide the page
// is: a restart into the amp drew it 1920px wide in a 475px window (Ivan,
// 2026-10-25). The menu opens them in a window of their own
// (`devToolsMenu.test.ts`).
describe('a development launch', () => {
  it('shows the window without opening the developer tools', () => {
    const { window } = open({ isDebug: true });
    say(RENDERER_READY_EVENT, window.webContents);
    // POSITIVE CONTROL: the window was revealed, which is where they opened.
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.webContents.openDevTools).not.toHaveBeenCalled();
  });

  it('keeps a window that starts hidden free of them too', () => {
    const { window } = open({ isDebug: true, startsHidden: () => true });
    say(RENDERER_READY_EVENT, window.webContents);
    // POSITIVE CONTROL: the reveal ran and kept the window hidden.
    expect(ipcListeners.get(RENDERER_READY_EVENT)?.size).toBe(0);
    expect(window.show).not.toHaveBeenCalled();
    expect(window.webContents.openDevTools).not.toHaveBeenCalled();
  });
});

// A page's own full screen never moves the window (Ivan, 2026-09-29: YouTube's
// full-screen press "cancels the action"). Electron takes the window full
// screen for a webview's HTML full screen by the EMBEDDER's setting, so the
// guest's own setting did nothing: the window went full screen by itself, and
// the app's full screen ended with YouTube's the moment the app took the
// player back out of it.
describe('a page going full screen', () => {
  it('leaves the window to the app, which asks for full screen itself', () => {
    const { window } = open();
    expect(window.options?.webPreferences).toMatchObject({
      disableHtmlFullscreenWindowResize: true,
    });
  });
});

describe("the window's size and position", () => {
  it('saves the startup placement before any move or resize', () => {
    const { windowModes } = deps();
    open({ windowModes });
    expect(saveWindowState).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(windowModes.followWindow).mock.invocationCallOrder[0],
    ).toBeLessThan(saveWindowState.mock.invocationCallOrder[0]);
  });

  it('seeds a full-app placement even when the first window is the amp', () => {
    const { windowModes } = deps();
    open({ loadWindowState: () => ({ mode: 'player' }), windowModes });
    expect(windowModes.restore).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'player',
        app: { x: 320, y: 90, width: 1280, height: 900, isMaximized: false },
      }),
    );
  });

  it('are asked for on every move and resize, with no timer in between', () => {
    const { window } = open();
    expect(saveWindowState).toHaveBeenCalledTimes(1);
    window.emit('resize');
    window.emit('resize');
    window.emit('move');
    window.emit('maximize');
    window.emit('unmaximize');
    expect(saveWindowState).toHaveBeenCalledTimes(6);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('are written once more as the window closes', () => {
    const { window } = open();
    window.emit('close', { preventDefault: jest.fn() });
    expect(saveWindowState).toHaveBeenCalledTimes(2);
  });
});
