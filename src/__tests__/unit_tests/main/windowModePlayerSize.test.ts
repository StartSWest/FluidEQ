/** @jest-environment node */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';

// Ivan's screen, 2026-09-28: the amp had been remembered as this work area
// exactly, and every switch opened it the size of the screen.
const WORK_AREA = { x: 0, y: 34, width: 1440, height: 792 };
const DISPLAY = { x: 0, y: 0, width: 1440, height: 900 };
// A maximised window overhangs the work area by its resize border.
const MAXIMISED = { x: -8, y: 26, width: 1456, height: 808 };

jest.mock('electron', () => ({
  screen: {
    getDisplayMatching: () => ({ workArea: WORK_AREA }),
    getAllDisplays: () => [{ workArea: WORK_AREA }],
  },
}));
jest.mock('../../../main/windowDwm', () => ({
  setWindowTransitions: () => undefined,
}));

// eslint-disable-next-line import/first
import { createWindowModes } from '../../../main/windowMode';

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A window that maximises and restores the way Windows does: on its own
 * message loop, so `unmaximize()` returns with the window still maximised and
 * the `unmaximize` event arrives later (`finishRestore`).
 */
const fakeWindow = (start: IRect, isMaximizedAtStart: boolean) => {
  const events = new EventEmitter();
  let normal = { ...start };
  let isMaximized = isMaximizedAtStart;
  let isFullScreen = false;
  let beforeFullScreen: IRect | undefined;
  const bounds = (): IRect => {
    if (isFullScreen) {
      return { ...DISPLAY };
    }
    return isMaximized ? { ...MAXIMISED } : { ...normal };
  };
  const win = {
    on: events.on.bind(events),
    once: events.once.bind(events),
    emit: events.emit.bind(events),
    isDestroyed: () => false,
    isMaximized: () => isMaximized,
    isFullScreen: () => isFullScreen,
    getBounds: bounds,
    getNormalBounds: () => ({ ...normal }),
    setBounds: (next: Partial<IRect>) => {
      normal = { ...normal, ...next };
    },
    setFullScreen: (next: boolean) => {
      if (next) {
        beforeFullScreen = normal;
      } else if (beforeFullScreen) {
        normal = beforeFullScreen;
      }
      isFullScreen = next;
    },
    setMinimumSize: () => undefined,
    setMaximumSize: () => undefined,
    setMaximizable: () => undefined,
    setAlwaysOnTop: () => undefined,
    unmaximize: () => undefined,
    maximize: () => {
      isMaximized = true;
      events.emit('maximize');
    },
    webContents: { getZoomFactor: () => 1 },
  };
  return {
    win: win as unknown as BrowserWindow,
    bounds,
    /** Windows has restored the window: its normal bounds are its own. */
    finishRestore: () => {
      isMaximized = false;
      events.emit('unmaximize');
    },
    /**
     * Windows has restored the window and not said so yet: the window reports
     * the app's normal bounds before the `unmaximize` event arrives.
     */
    restoreUnannounced: () => {
      isMaximized = false;
    },
    /** Windows maximises the window by itself (a snap, a shortcut). */
    maximizeBySystem: () => {
      isMaximized = true;
      events.emit('resized');
    },
    /** The listener drags the window's edge and lets go. */
    drag: (next: IRect) => {
      normal = { ...next };
      events.emit('resized');
    },
  };
};

const APP = { x: 100, y: 80, width: 1200, height: 700 };
const FIRST = { x: 480, y: 34, width: 480, height: 792 };

const modesAt = (
  player: Partial<IRect> | undefined,
  { maximized = false }: { maximized?: boolean } = {},
) => {
  const modes = createWindowModes('win32');
  const fake = fakeWindow(APP, maximized);
  modes.restore({ mode: 'app', isPinned: false, app: {}, player });
  modes.followWindow(fake.win);
  return { modes, ...fake };
};

describe('the size the amp opens at', () => {
  it('is its own narrow size, in the middle of the screen, the first time', async () => {
    const { modes, win, bounds } = modesAt(undefined);
    await modes.setMode(win, 'player');
    // 480 wide and 1080 tall, as tall as this screen allows.
    expect(bounds()).toEqual(FIRST);
  });

  it('is its own narrow size again when it was remembered as the whole screen', async () => {
    const { modes, win, bounds } = modesAt({ ...WORK_AREA });
    await modes.setMode(win, 'player');
    expect(bounds()).toEqual(FIRST);
    const maximised = modesAt({ ...MAXIMISED });
    await maximised.modes.setMode(maximised.win, 'player');
    expect(maximised.bounds()).toEqual(FIRST);
  });

  it('is the size the listener left it at, switch after switch', async () => {
    const { modes, win, bounds, drag } = modesAt(undefined);
    await modes.setMode(win, 'player');
    const sized = { x: 700, y: 60, width: 620, height: 700 };
    drag(sized);
    expect(modes.playerBounds(win)).toEqual(sized);
    await modes.setMode(win, 'app');
    expect(modes.memory().player).toEqual(sized);
    await modes.setMode(win, 'player');
    expect(bounds()).toEqual(sized);
  });
});

describe('what is written down as the amp’s size', () => {
  it('is never the full screen’s', async () => {
    const { modes, win, drag } = modesAt(undefined);
    await modes.setMode(win, 'player');
    const sized = { x: 700, y: 60, width: 620, height: 700 };
    drag(sized);
    modes.setFullScreen(win, true);
    // The window-state file is written on every resize, the full screen's
    // included.
    expect(modes.playerBounds(win)).toEqual(sized);
    win.emit('resized');
    expect(modes.memory().player).toEqual(sized);
  });

  it('is never the maximised app’s, on a switch pressed back before Windows restored it', async () => {
    const remembered = { x: 700, y: 60, width: 620, height: 700 };
    const { modes, win, bounds, finishRestore } = modesAt(remembered, {
      maximized: true,
    });
    const goingIn = modes.setMode(win, 'player');
    // Still maximised: Windows has not restored the window yet.
    expect(modes.playerBounds(win)).toEqual(remembered);
    const goingBack = modes.setMode(win, 'app');
    finishRestore();
    await goingIn;
    await goingBack;
    expect(modes.memory().player).toEqual(remembered);
    // And the next switch opens it where it was, not the size of the screen.
    await modes.setMode(win, 'player');
    expect(bounds()).toEqual(remembered);
  });

  it('is never the app’s, restored by Windows before the switch has placed the player', async () => {
    const remembered = { x: 700, y: 60, width: 620, height: 700 };
    const { modes, win, bounds, restoreUnannounced, finishRestore } = modesAt(
      remembered,
      { maximized: true },
    );
    const goingIn = modes.setMode(win, 'player');
    restoreUnannounced();
    // The window reports the app's normal bounds, and it is not maximised.
    expect(bounds()).toEqual(APP);
    expect(modes.playerBounds(win)).toEqual(remembered);
    win.emit('resized');
    expect(modes.memory().player).toEqual(remembered);
    finishRestore();
    await goingIn;
    expect(bounds()).toEqual(remembered);
  });

  it('is never a maximised window’s, however the window came to be maximised', async () => {
    const { modes, win, drag, maximizeBySystem } = modesAt(undefined);
    await modes.setMode(win, 'player');
    const sized = { x: 700, y: 60, width: 620, height: 700 };
    drag(sized);
    maximizeBySystem();
    expect(modes.playerBounds(win)).toEqual(sized);
    expect(modes.memory().player).toEqual(sized);
  });

  it('is the player’s own once a switch from a maximised app has placed it', async () => {
    const { modes, win, bounds, finishRestore } = modesAt(undefined, {
      maximized: true,
    });
    const goingIn = modes.setMode(win, 'player');
    finishRestore();
    await goingIn;
    expect(bounds()).toEqual(FIRST);
    expect(modes.playerBounds(win)).toEqual(FIRST);
  });
});
