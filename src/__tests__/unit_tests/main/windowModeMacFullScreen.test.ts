/** @jest-environment node */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';

const WORK_AREA = { x: 0, y: 0, width: 1440, height: 875 };
const DISPLAY = { x: 0, y: 0, width: 1440, height: 900 };

jest.mock('electron', () => ({
  screen: {
    getDisplayMatching: () => ({ workArea: WORK_AREA }),
    getAllDisplays: () => [{ workArea: WORK_AREA }],
  },
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
 * A window that does what a Mac does with full screen: the call only starts
 * an animation, the window's bounds cannot be set until it has finished, and
 * the window's own event says so AFTER the change (`finish`). AppKit also
 * refuses full screen to a window that is not fullscreenable, as Electron's
 * `SetFullScreen` does.
 */
const fakeMacWindow = () => {
  const events = new EventEmitter();
  let bounds: IRect = { x: 200, y: 140, width: 420, height: 520 };
  let before: IRect | undefined;
  let isFullScreen = false;
  let isFullScreenable = true;
  let pending: boolean | undefined;
  const fullscreenable: boolean[] = [];
  const win = {
    on: events.on.bind(events),
    once: events.once.bind(events),
    emit: events.emit.bind(events),
    isDestroyed: () => false,
    isMaximized: () => false,
    isFullScreen: () => isFullScreen,
    getBounds: () => ({ ...bounds }),
    getNormalBounds: () => ({ ...bounds }),
    setBounds: (next: Partial<IRect>) => {
      if (!isFullScreen) {
        bounds = { ...bounds, ...next };
      }
    },
    setFullScreen: (next: boolean) => {
      if (next !== isFullScreen && isFullScreenable) {
        pending = next;
      }
    },
    setFullScreenable: (next: boolean) => {
      isFullScreenable = next;
      fullscreenable.push(next);
    },
    setMinimumSize: () => undefined,
    setMaximumSize: () => undefined,
    setMaximizable: () => undefined,
    setAlwaysOnTop: () => undefined,
    unmaximize: () => undefined,
    maximize: () => undefined,
    webContents: { getZoomFactor: () => 1 },
  };
  /** The animation ends: the state changes, then the event is raised. */
  const finish = () => {
    if (pending === undefined) {
      return;
    }
    const next = pending;
    pending = undefined;
    if (next) {
      before = bounds;
      bounds = { ...DISPLAY };
      isFullScreen = true;
      events.emit('enter-full-screen');
    } else {
      // A Mac puts the window back where it was by itself.
      bounds = before ?? bounds;
      isFullScreen = false;
      events.emit('leave-full-screen');
    }
  };
  /** The green button: straight at the window, as AppKit would. */
  const pressGreen = () => {
    win.setFullScreen(!isFullScreen);
    finish();
  };
  return {
    win: win as unknown as BrowserWindow,
    bounds: () => bounds,
    finish,
    pressGreen,
    isFullScreenable: () => isFullScreenable,
    fullscreenable,
  };
};

const macWindowAs = (mode: 'app' | 'player') => {
  const modes = createWindowModes('darwin');
  const fake = fakeMacWindow();
  modes.restore({
    mode,
    isPinned: false,
    app: {},
    player: mode === 'player' ? fake.bounds() : undefined,
  });
  modes.followWindow(fake.win);
  modes.applyLimits(fake.win);
  return { modes, ...fake };
};

describe('the green button on a Mac', () => {
  it('takes the full app full screen, and it is the listener’s', () => {
    const { modes, win, pressGreen, isFullScreenable } = macWindowAs('app');
    expect(isFullScreenable()).toBe(true);
    pressGreen();
    expect(win.isFullScreen()).toBe(true);
    expect(modes.isSystemFullScreen()).toBe(true);
    // The graph's own full screen let go inside it leaves it as it is.
    expect(modes.setFullScreen(win, false)).toBe(true);
    expect(win.isFullScreen()).toBe(true);
  });

  it('is disabled on the player', () => {
    const { win, pressGreen, isFullScreenable } = macWindowAs('player');
    expect(isFullScreenable()).toBe(false);
    pressGreen();
    expect(win.isFullScreen()).toBe(false);
  });
});

describe('the player’s visualizer on a Mac', () => {
  it('may take the screen, and the green button is disabled again after', () => {
    const { modes, win, finish, isFullScreenable, fullscreenable } =
      macWindowAs('player');
    modes.setFullScreen(win, true);
    // Fullscreenable before the ask, or AppKit refuses it.
    expect(fullscreenable[fullscreenable.length - 1]).toBe(true);
    finish();
    expect(win.isFullScreen()).toBe(true);
    expect(modes.isSystemFullScreen()).toBe(false);

    modes.setFullScreen(win, false);
    // Still animating out: nothing is disabled under it yet.
    expect(isFullScreenable()).toBe(true);
    finish();
    expect(win.isFullScreen()).toBe(false);
    expect(isFullScreenable()).toBe(false);
  });

  it('comes back at exactly the bounds it left from, once the animation ends', () => {
    const { modes, win, finish, bounds } = macWindowAs('player');
    const left = bounds();
    modes.setFullScreen(win, true);
    finish();
    // The page, laid out on the whole display, says a layout that size.
    win.emit('moved');
    modes.setFullScreen(win, false);
    finish();
    expect(bounds()).toEqual(left);
    expect(modes.memory().player).toEqual(left);
  });
});
