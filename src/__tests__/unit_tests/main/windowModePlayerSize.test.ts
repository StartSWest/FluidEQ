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
  let ceiling = {
    width: Number.POSITIVE_INFINITY,
    height: Number.POSITIVE_INFINITY,
  };
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
    isVisible: () => true,
    isMinimized: () => false,
    isMaximized: () => isMaximized,
    isFullScreen: () => isFullScreen,
    getBounds: bounds,
    getNormalBounds: () => ({ ...normal }),
    // Windows holds a window under its maximum size, whatever it is asked.
    setBounds: (next: Partial<IRect>) => {
      const asked = { ...normal, ...next };
      normal = {
        ...asked,
        width: Math.min(asked.width, ceiling.width),
        height: Math.min(asked.height, ceiling.height),
      };
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
    setMaximumSize: (width: number, height: number) => {
      ceiling = { width, height };
    },
    setMaximizable: () => undefined,
    setResizable: () => undefined,
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

const APP = { x: 100, y: 34, width: 1200, height: 792 };
// The amp's one width, 480, in the middle of the screen and as tall as it.
const FIRST = { x: 480, y: 34, width: 480, height: 792 };
// Where the listener left it: only its place and its height are theirs.
const SIZED = { x: 700, y: 60, width: 480, height: 700 };

const modesAt = (
  player: Partial<IRect> | undefined,
  { maximized = false }: { maximized?: boolean } = {},
) => {
  const modes = createWindowModes('win32');
  const fake = fakeWindow(APP, maximized);
  modes.restore({
    mode: 'app',
    isPinned: false,
    app: {},
    player: player ?? {},
  });
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
    drag(SIZED);
    expect(modes.playerBounds(win)).toEqual(SIZED);
    await modes.setMode(win, 'app');
    expect(modes.memory().player).toEqual(SIZED);
    await modes.setMode(win, 'player');
    expect(bounds()).toEqual(SIZED);
  });

  // An amp remembered from when it could be any width (the two amps, until
  // 2026-10-25) opens where it stood, at the one width it has now.
  it('is the amp’s one width, where an amp remembered wider stood', async () => {
    const { modes, win, bounds } = modesAt({ ...SIZED, width: 620 });
    await modes.setMode(win, 'player');
    expect(bounds()).toEqual(SIZED);
  });
});

describe('what is written down as the amp’s size', () => {
  it('is never the full screen’s', async () => {
    const { modes, win, drag } = modesAt(undefined);
    await modes.setMode(win, 'player');
    drag(SIZED);
    modes.setFullScreen(win, true);
    // The window-state file is written on every resize, the full screen's
    // included.
    expect(modes.playerBounds(win)).toEqual(SIZED);
    win.emit('resized');
    expect(modes.memory().player).toEqual(SIZED);
  });

  it('is never the maximised app’s, on a switch pressed back before Windows restored it', async () => {
    const { modes, win, bounds, finishRestore } = modesAt(SIZED, {
      maximized: true,
    });
    const goingIn = modes.setMode(win, 'player');
    // Still maximised: Windows has not restored the window yet.
    expect(modes.playerBounds(win)).toEqual(SIZED);
    const goingBack = modes.setMode(win, 'app');
    finishRestore();
    await goingIn;
    await goingBack;
    expect(modes.memory().player).toEqual(SIZED);
    // And the next switch opens it where it was, not the size of the screen.
    await modes.setMode(win, 'player');
    expect(bounds()).toEqual(SIZED);
  });

  it('is never the app’s, restored by Windows before the switch has placed the player', async () => {
    const { modes, win, bounds, restoreUnannounced, finishRestore } = modesAt(
      SIZED,
      { maximized: true },
    );
    const goingIn = modes.setMode(win, 'player');
    restoreUnannounced();
    // The window reports the app's normal bounds, and it is not maximised.
    expect(bounds()).toEqual(APP);
    expect(modes.playerBounds(win)).toEqual(SIZED);
    win.emit('resized');
    expect(modes.memory().player).toEqual(SIZED);
    finishRestore();
    await goingIn;
    expect(bounds()).toEqual(SIZED);
  });

  it('is never a maximised window’s, however the window came to be maximised', async () => {
    const { modes, win, drag, maximizeBySystem } = modesAt(undefined);
    await modes.setMode(win, 'player');
    drag(SIZED);
    maximizeBySystem();
    expect(modes.playerBounds(win)).toEqual(SIZED);
    expect(modes.memory().player).toEqual(SIZED);
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

// One width, and the height the listener's (Ivan, 2026-10-25: "no 2 columns
// and no width resize").
describe('the amp’s width and height', () => {
  it('rises to what its rows need on one line, and comes back to its own', async () => {
    const { modes, win, bounds } = modesAt(SIZED);
    await modes.setMode(win, 'player');
    modes.needPlayerWidth(win, 512);
    expect(bounds().width).toBe(512);
    // Less than its own is its own.
    modes.needPlayerWidth(win, 300);
    expect(bounds().width).toBe(480);
    modes.needPlayerWidth(win, undefined);
    expect(bounds()).toEqual(SIZED);
  });

  // The page's own measure while the picture has the screen is the
  // display's, and taken as a need it was the screen's width.
  it('takes no need from the page while the picture has the screen', async () => {
    const { modes, win, bounds } = modesAt(SIZED);
    await modes.setMode(win, 'player');
    modes.setFullScreen(win, true);
    modes.needPlayerWidth(win, 1440);
    modes.setFullScreen(win, false);
    // The page says its layout again once it is the amp's, which fits the
    // window to what it was told: a need kept from the full screen would be
    // the screen's width then.
    modes.limitPlayerHeight(win, undefined, 650);
    expect(bounds()).toEqual(SIZED);
  });

  // Dragged by its foot, the top stays put; by its top edge, the foot does
  // (Ivan, 2026-10-25: "we need to be able to resize from the top too").
  it('grows from its foot with its top where it was', async () => {
    const { modes, win, bounds } = modesAt(SIZED);
    await modes.setMode(win, 'player');
    modes.resizePlayer(win, 600);
    expect(bounds()).toEqual({ ...SIZED, height: 600 });
  });

  it('grows from its top edge with its foot where it was', async () => {
    const { modes, win, bounds } = modesAt(SIZED);
    await modes.setMode(win, 'player');
    const foot = SIZED.y + SIZED.height;
    modes.resizePlayer(win, 600, true);
    expect(bounds()).toEqual({ ...SIZED, y: foot - 600, height: 600 });
    modes.resizePlayer(win, 720, true);
    expect(bounds()).toEqual({ ...SIZED, y: foot - 720, height: 720 });
    // Never over the top of the screen: there the amp keeps its place on it.
    modes.resizePlayer(win, 740, true);
    expect(bounds()).toEqual({ ...SIZED, y: WORK_AREA.y, height: 740 });
  });

  it('stops its top where the floor puts it, rather than sliding the whole amp down', async () => {
    const { modes, win, bounds } = modesAt(SIZED);
    await modes.setMode(win, 'player');
    // The amp's floor with its sound open (`usePlayerHeightFloor`).
    modes.limitPlayerHeight(win, undefined, 650);
    const foot = SIZED.y + SIZED.height;
    modes.resizePlayer(win, 200, true);
    expect(bounds()).toEqual({ ...SIZED, y: foot - 650, height: 650 });
  });

  // The amp's one width is its maximum as well as its floor, and the app's
  // bounds set under it came out the amp's width (Ivan, 2026-10-25: "your
  // width fix is screwing my full app").
  it('leaves the full app its own width when the window goes back to it', async () => {
    const { modes, win, bounds } = modesAt(SIZED);
    await modes.setMode(win, 'player');
    expect(bounds().width).toBe(480);
    await modes.setMode(win, 'app');
    expect(bounds()).toEqual(APP);
  });
});
