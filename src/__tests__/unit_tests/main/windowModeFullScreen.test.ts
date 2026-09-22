/** @jest-environment node */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';

const WORK_AREA = { x: 0, y: 0, width: 2560, height: 1392 };
const DISPLAY = { x: 0, y: 0, width: 2560, height: 1440 };

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
 * A window that does what Windows does with full screen: the bounds become
 * the display's on the way in and go back to what they were on the way out,
 * inside the call — with the window's own events raised BEFORE the change,
 * which is the order Electron raises them in on Windows.
 */
const fakeWindow = () => {
  const events = new EventEmitter();
  let bounds: IRect = { x: 100, y: 120, width: 520, height: 640 };
  let before: IRect | undefined;
  let isFullScreen = false;
  const minimum: Array<[number, number]> = [];
  const maximum: Array<[number, number]> = [];
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
      bounds = { ...bounds, ...next };
    },
    setFullScreen: (next: boolean) => {
      if (next === isFullScreen) {
        return;
      }
      if (next) {
        events.emit('enter-full-screen');
        before = bounds;
        bounds = { ...DISPLAY };
      } else {
        events.emit('leave-full-screen');
        bounds = before ?? bounds;
        before = undefined;
      }
      isFullScreen = next;
    },
    setMinimumSize: (width: number, height: number) => {
      minimum.push([width, height]);
    },
    setMaximumSize: (width: number, height: number) => {
      maximum.push([width, height]);
    },
    setMaximizable: () => undefined,
    setAlwaysOnTop: () => undefined,
    unmaximize: () => undefined,
    maximize: () => undefined,
    webContents: { getZoomFactor: () => 1 },
  };
  return {
    win: win as unknown as BrowserWindow,
    bounds: () => bounds,
    minimum,
    maximum,
    lastMinimum: () => minimum[minimum.length - 1],
    lastMaximum: () => maximum[maximum.length - 1],
  };
};

const NO_CEILING = 32_767;

/** A player held to its decks' height, followed by the module. */
const playerAt = () => {
  const modes = createWindowModes();
  const fake = fakeWindow();
  modes.restore({
    mode: 'player',
    isPinned: false,
    app: {},
    player: fake.bounds(),
  });
  modes.followWindow(fake.win);
  // The page says the player is exactly its decks: held to 640.
  modes.limitPlayerHeight(fake.win, 640, 640);
  return { modes, ...fake };
};

describe('the player and full screen', () => {
  it('lifts its own limits before the window grows, and puts them back after', () => {
    const { modes, win, lastMaximum, lastMinimum } = playerAt();
    expect(lastMaximum()[1]).toBe(640);

    modes.setFullScreen(win, true);
    // The ceiling came off — before `setFullScreen`, which is what Windows
    // needs, but the last call is what can be checked here.
    expect(lastMaximum()[1]).toBe(NO_CEILING);

    modes.setFullScreen(win, false);
    expect(lastMaximum()[1]).toBe(640);
    expect(lastMinimum()[1]).toBe(640);
  });

  it('comes back at exactly the bounds it left from', () => {
    const { modes, win, bounds } = playerAt();
    const left = bounds();
    modes.setFullScreen(win, true);
    expect(bounds()).toEqual(DISPLAY);
    modes.setFullScreen(win, false);
    expect(bounds()).toEqual(left);
    expect(modes.memory().player).toEqual(left);
  });

  it('takes nothing the page measures while the picture has the screen', () => {
    const { modes, win, bounds, lastMinimum, lastMaximum } = playerAt();
    modes.setFullScreen(win, true);
    // The page, laid out on the whole display, says its layout is 1392 tall
    // and wants 2560 across — the numbers that used to hold the window at the
    // work area's full height for the rest of the session.
    modes.limitPlayerHeight(win, 1392, 1392);
    modes.floorPlayerWidth(win, 2560);
    modes.resizePlayer(win, 1392);
    modes.setFullScreen(win, false);
    expect(bounds()).toEqual({ x: 100, y: 120, width: 520, height: 640 });
    expect(lastMinimum()).toEqual([expect.any(Number), 640]);
    expect(lastMaximum()[1]).toBe(640);
    expect(lastMinimum()[0]).toBeLessThan(2560);
  });

  it('does not write the screen down as where the player was left', () => {
    const { modes, win } = playerAt();
    const left = modes.memory().player;
    modes.setFullScreen(win, true);
    // Windows reports the transition as the window having been moved and
    // resized, exactly as a drag would.
    win.emit('moved');
    win.emit('resized');
    expect(modes.memory().player).toEqual(left);
    modes.setFullScreen(win, false);
    expect(modes.memory().player).toEqual(left);
  });

  it('lifts the ceiling for a full screen it was not asked for', () => {
    const { win, lastMaximum } = playerAt();
    expect(lastMaximum()[1]).toBe(640);
    // The menu's F11 goes straight to the window; the window's own event is
    // all this module hears of it.
    win.emit('enter-full-screen');
    expect(lastMaximum()[1]).toBe(NO_CEILING);
  });

  it('is refused a switch of mode while full screen', async () => {
    const { modes, win } = playerAt();
    modes.setFullScreen(win, true);
    await expect(modes.setMode(win, 'app')).resolves.toBe('player');
  });
});
