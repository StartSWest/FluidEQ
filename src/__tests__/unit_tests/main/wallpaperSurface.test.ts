/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

type THostEvent = 'ready' | 'active' | 'paused' | 'paused-owner' | 'error';

const mockWindow = {
  destroyed: false,
  showInactive: jest.fn(),
  destroy: jest.fn(),
  isDestroyed: () => mockWindow.destroyed,
  on: jest.fn(),
  loadURL: jest.fn(() => Promise.resolve()),
  getNativeWindowHandle: () => Buffer.alloc(8),
  webContents: {
    isDestroyed: () => false,
    send: jest.fn(),
    on: jest.fn(),
  },
};
const mockHost = {
  report: (_event: THostEvent) => undefined as void,
  setVisible: jest.fn(),
  setTouch: jest.fn(),
  stop: jest.fn(),
};

jest.mock('electron', () => ({}));
jest.mock('../../../main/wallpaper/window', () => ({
  createWallpaperWindow: () => mockWindow,
  wallpaperUrl: () => 'http://localhost/wallpaper.html',
}));
jest.mock('../../../main/wallpaper/nativeHost', () => ({
  startWallpaperHost: (
    _executable: string,
    _handle: Buffer,
    onEvent: (event: THostEvent) => void,
  ) => {
    mockHost.report = onEvent;
    return mockHost;
  },
}));

/* eslint-disable import/first -- install the mocks first */
import type {
  IWallpaperDaylight,
  IWallpaperTuning,
  TWallpaperPause,
} from '../../../common/wallpaper';
import { WALLPAPER_CLOCK_DAYLIGHT } from '../../../common/wallpaper';
import { createDesktopSurface } from '../../../main/wallpaper/surface';
/* eslint-enable import/first */

const create = (
  pause: {
    reason?: TWallpaperPause;
    tuning?: IWallpaperTuning;
    followsGraph?: boolean;
    daylight?: () => number | undefined;
    brightness?: () => number | undefined;
    ownDaylight?: IWallpaperDaylight;
  } = {},
) => {
  const onFail = jest.fn();
  const onChange = jest.fn();
  const onReady = jest.fn();
  const surface = createDesktopSurface({
    displayId: 2,
    bounds: { x: 0, y: 0, width: 2560, height: 1440 },
    choice: {
      lookId: 'premium:aurora',
      wave: { height: 1, position: 0 },
      motion: 'music',
      ...(pause.followsGraph ? { followsGraph: true } : {}),
      ...(pause.ownDaylight ? { daylight: pause.ownDaylight } : {}),
    },
    performance: {
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'off',
    },
    tuning: pause.tuning,
    daylight: pause.daylight ?? (() => undefined),
    brightness: pause.brightness ?? (() => undefined),
    locale: () => 'en',
    scale: 1,
    scene: {
      pack: { id: 'aurora', version: 1 } as never,
      madeBy: 'fluideq',
    },
    executable: 'FluidEQ-Wallpaper.exe',
    pauseReason: (cover) => {
      if (cover === 'window') {
        return 'window';
      }
      return cover === 'others' ? 'covered' : pause.reason;
    },
    onReady,
    onChange,
    onFail,
  });
  return { surface, onFail, onChange, onReady };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWindow.destroyed = false;
});

describe('a desktop background appearing', () => {
  // Shown by the helper alone, Chromium never composited the page: the
  // desktop got the window's background colour, black, and nothing else.
  it('is shown through Chromium once, after the helper has placed it and reported', () => {
    const { surface } = create();
    surface.drawn(1);
    expect(mockWindow.showInactive).not.toHaveBeenCalled();

    mockHost.report('ready');
    expect(mockWindow.showInactive).not.toHaveBeenCalled();
    expect(mockHost.setVisible).not.toHaveBeenCalled();

    mockHost.report('active');
    expect(mockHost.setVisible).toHaveBeenLastCalledWith(true);
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
    expect(surface.phase()).toBe('running');

    mockHost.report('active');
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
  });

  // Its picture goes up even on a monitor nothing of which is in sight, so
  // the moment the windows move off it there is already something there.
  it('goes on the desktop paused when windows already cover the monitor', () => {
    const { surface } = create();
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('paused');
    expect(surface.phase()).toBe('paused');
    expect(surface.pauseReason()).toBe('covered');
    expect(mockHost.setVisible).toHaveBeenLastCalledWith(true);
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);

    mockHost.report('active');
    expect(surface.phase()).toBe('running');
    expect(mockHost.setVisible).toHaveBeenLastCalledWith(true);
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
  });

  // What it replaced is let go on this word, so it has to come once the
  // monitor is showing this one — or once it knows nothing is to be shown.
  it('says it is ready once it is on the desktop, and once only', () => {
    const { surface, onReady } = create();
    surface.drawn(1);
    expect(onReady).not.toHaveBeenCalled();
    mockHost.report('ready');
    expect(onReady).not.toHaveBeenCalled();

    mockHost.report('active');
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(surface.phase()).toBe('running');

    mockHost.report('paused');
    mockHost.report('active');
    surface.drawn(surface.surfaceState().renderGeneration);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('says it is ready when it starts on a monitor nothing of which is in sight', () => {
    const { surface, onReady } = create();
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('paused');
    expect(surface.phase()).toBe('paused');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('never shows before the scene has drawn a frame', () => {
    const { surface } = create();
    expect(surface.phase()).toBe('starting');
    expect(mockWindow.showInactive).not.toHaveBeenCalled();
    expect(mockHost.setVisible).not.toHaveBeenCalled();
  });

  // Hiding was the only part of a pause anybody could see: Windows gives a
  // window being maximized its final rectangle before DWM has finished
  // moving it there, so the background came off a strip of desktop that was
  // still on screen and the plain wallpaper flashed through it.
  it('is never taken off the desktop while windows cover it, only stopped', () => {
    const { surface } = create();
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    const { renderGeneration } = surface.surfaceState();

    mockHost.report('paused');
    expect(surface.phase()).toBe('paused');
    expect(surface.pauseReason()).toBe('covered');
    expect(mockHost.setVisible).not.toHaveBeenCalledWith(false);
    // The page keeps the scene it has: nothing asks it to draw afresh.
    expect(surface.surfaceState().renderGeneration).toBe(renderGeneration);

    mockHost.report('active');
    expect(surface.phase()).toBe('running');
    expect(mockHost.setVisible).not.toHaveBeenCalledWith(false);
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
  });

  it('is not taken off the desktop for the PC being locked either', () => {
    const { surface } = create({ reason: 'locked' });
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    expect(surface.phase()).toBe('paused');
    expect(surface.pauseReason()).toBe('locked');
    expect(mockHost.setVisible).not.toHaveBeenCalledWith(false);
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
  });

  // The one pause that does come off: saving power is chosen with the desktop
  // in front of the listener, and their own wallpaper coming back is how they
  // see it took.
  it('comes off the desktop to save battery, and goes back when it is plugged in', () => {
    const pause: { reason?: TWallpaperPause } = { reason: 'battery' };
    const { surface } = create(pause);
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    expect(surface.pauseReason()).toBe('battery');
    expect(mockHost.setVisible).toHaveBeenLastCalledWith(false);
    expect(mockWindow.showInactive).not.toHaveBeenCalled();

    pause.reason = undefined;
    surface.applyPolicy();
    expect(surface.phase()).toBe('running');
    expect(mockHost.setVisible).toHaveBeenLastCalledWith(true);
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
  });
});

/**
 * The window's time of day, from its Brightness, reaches only a monitor set
 * to follow the graph (Ivan, 2026-09-28: "desktop needs to follow that too
 * ... only if follow graph is enabled for that screen"); any other keeps the
 * time its visualizer's author gave it.
 */
describe('a desktop background and the time of day', () => {
  const running = (options: Parameters<typeof create>[0]) => {
    const made = create(options);
    made.surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    mockWindow.webContents.send.mockClear();
    return made;
  };
  const toldDaylight = () =>
    mockWindow.webContents.send.mock.calls.map(
      ([, state]) => (state as { daylight?: number }).daylight,
    );

  it('follows the window’s on a monitor following the graph, and only a change', () => {
    let daylight = 30;
    const { surface } = running({
      followsGraph: true,
      daylight: () => daylight,
    });
    expect(surface.surfaceState().daylight).toBe(30);
    mockWindow.webContents.send.mockClear();

    daylight = 80;
    surface.applyDaylight();
    surface.applyDaylight();

    expect(toldDaylight()).toEqual([80]);
  });

  it('never tells a monitor that is not following', () => {
    let daylight = 30;
    const { surface } = running({ daylight: () => daylight });
    expect(surface.surfaceState()).not.toHaveProperty('daylight');

    daylight = 80;
    surface.applyDaylight();

    expect(mockWindow.webContents.send).not.toHaveBeenCalled();
  });

  it('gains and loses the window’s as following is switched on and off', () => {
    const { surface } = running({ daylight: () => 60 });
    const same = {
      wave: { height: 1, position: 0 },
      motion: 'music',
    } as const;

    surface.retune({ ...same, followsGraph: true });
    surface.retune({ ...same, followsGraph: false });

    expect(toldDaylight()).toEqual([60, undefined]);
  });
});

/**
 * A monitor that does not follow the graph plays its own time of day, from
 * the graph's three choices (Ivan, 2026-11-08); one that follows is told the
 * graph's whatever its own choice says.
 */
describe('a desktop background with a time of day of its own', () => {
  const running = (options: Parameters<typeof create>[0]) => {
    const made = create(options);
    made.surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    mockWindow.webContents.send.mockClear();
    return made;
  };
  const toldDaylight = () =>
    mockWindow.webContents.send.mock.calls.map(
      ([, state]) => (state as { daylight?: unknown }).daylight,
    );
  const same = { wave: { height: 1, position: 0 }, motion: 'music' } as const;

  it('plays a Daylight set by hand, not the graph’s', () => {
    const { surface } = running({
      daylight: () => 90,
      ownDaylight: { source: 'own', daylight: 25 },
    });
    expect(surface.surfaceState().daylight).toBe(25);
    expect(surface.choice().daylight).toEqual({ source: 'own', daylight: 25 });
  });

  it('follows the window’s Brightness, and tells only a change of it', () => {
    let brightness = 40;
    const { surface } = running({
      daylight: () => 90,
      brightness: () => brightness,
      ownDaylight: { source: 'brightness', daylight: 10 },
    });
    expect(surface.surfaceState().daylight).toBe(40);
    mockWindow.webContents.send.mockClear();

    brightness = 70;
    surface.applyDaylight();
    surface.applyDaylight();

    expect(toldDaylight()).toEqual([70]);
  });

  it('plays its own Daylight until the window has said its Brightness', () => {
    const { surface } = running({
      brightness: () => undefined,
      ownDaylight: { source: 'brightness', daylight: 35 },
    });
    expect(surface.surfaceState().daylight).toBe(35);
  });

  it('reads the clock on the monitor, told once as the word for it', () => {
    const { surface } = running({
      ownDaylight: { source: 'clock', daylight: 0 },
    });
    expect(surface.surfaceState().daylight).toBe(WALLPAPER_CLOCK_DAYLIGHT);
  });

  it('takes the graph’s while it follows, and its own again once it stops', () => {
    const { surface } = running({
      daylight: () => 80,
      ownDaylight: { source: 'own', daylight: 20 },
    });
    const own = { source: 'own', daylight: 20 } as const;

    surface.retune({ ...same, followsGraph: true, daylight: own });
    surface.retune({ ...same, followsGraph: false, daylight: own });

    expect(toldDaylight()).toEqual([80, 20]);
  });

  it('moves to another choice in place, telling the page and nothing else', () => {
    const { surface } = running({
      ownDaylight: { source: 'own', daylight: 20 },
    });

    surface.retune({ ...same, daylight: { source: 'own', daylight: 65 } });

    expect(toldDaylight()).toEqual([65]);
    expect(surface.choice().daylight).toEqual({ source: 'own', daylight: 65 });
  });
});

describe('a desktop background changing and ending', () => {
  it('tells its page a new wave or motion without starting the scene again', () => {
    const { surface } = create();
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    const { renderGeneration } = surface.surfaceState();
    mockWindow.webContents.send.mockClear();

    surface.retune({ wave: { height: 0.3, position: 0.5 }, motion: 'calm' });
    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      'wallpaper-surface-changed',
      {
        phase: 'running',
        renderGeneration,
        wave: { height: 0.3, position: 0.5 },
        motion: 'calm',
        performance: {
          frameRate: 'display',
          resolution: 'auto',
          autoFloor: 0.35,
          upscaler: 'fsr',
          smoothing: 'off',
        },
      },
    );
    expect(surface.choice()).toEqual({
      lookId: 'premium:aurora',
      wave: { height: 0.3, position: 0.5 },
      motion: 'calm',
    });

    mockWindow.webContents.send.mockClear();
    surface.retune({ wave: { height: 0.3, position: 0.5 }, motion: 'calm' });
    expect(mockWindow.webContents.send).not.toHaveBeenCalled();
  });

  /** The window's frame rate and resolution choice reaches the page the same way. */
  it('tells its page the new frame rate and resolution, and only a new one', () => {
    const { surface } = create();
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    const { renderGeneration } = surface.surfaceState();
    mockWindow.webContents.send.mockClear();

    surface.retunePerformance({
      frameRate: 'thirty',
      resolution: 'native',
      autoFloor: 0.5,
      upscaler: 'fsr',
      smoothing: 'off',
    });
    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      'wallpaper-surface-changed',
      {
        phase: 'running',
        renderGeneration,
        wave: { height: 1, position: 0 },
        motion: 'music',
        performance: {
          frameRate: 'thirty',
          resolution: 'native',
          autoFloor: 0.5,
          upscaler: 'fsr',
          smoothing: 'off',
        },
      },
    );

    mockWindow.webContents.send.mockClear();
    surface.retunePerformance({
      frameRate: 'thirty',
      resolution: 'native',
      autoFloor: 0.5,
      upscaler: 'fsr',
      smoothing: 'off',
    });
    expect(mockWindow.webContents.send).not.toHaveBeenCalled();

    // The page draws by the scaler and the smoothing too: a choice that only
    // swaps FSR for the plain stretch used to stop here.
    surface.retunePerformance({
      frameRate: 'thirty',
      resolution: 'native',
      autoFloor: 0.5,
      upscaler: 'simple',
      smoothing: 'fast',
    });
    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      'wallpaper-surface-changed',
      expect.objectContaining({
        performance: {
          frameRate: 'thirty',
          resolution: 'native',
          autoFloor: 0.5,
          upscaler: 'simple',
          smoothing: 'fast',
        },
      }),
    );
  });

  // The controls and timing the listener set in the window, and the band they
  // set it in: a page has no store of its own, so main carries all three.
  it('starts on what its visualizer is set to, and takes a change in place', () => {
    const { surface } = create({
      tuning: {
        params: { glow: 0.4 },
        response: { attack: 120 },
        wave: { height: 0.4, position: 0.2 },
      },
    });
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    const { renderGeneration } = surface.surfaceState();
    expect(surface.surfaceState()).toEqual(
      expect.objectContaining({
        wave: { height: 0.4, position: 0.2 },
        tuning: expect.objectContaining({ params: { glow: 0.4 } }),
      }),
    );
    mockWindow.webContents.send.mockClear();

    surface.applyTuning({
      params: { glow: 0.9 },
      wave: { height: 0.6, position: 0 },
    });
    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      'wallpaper-surface-changed',
      expect.objectContaining({
        renderGeneration,
        wave: { height: 0.6, position: 0 },
        tuning: { params: { glow: 0.9 }, wave: { height: 0.6, position: 0 } },
      }),
    );
    // The monitor's own band is what it is drawn with now.
    expect(surface.choice().wave).toEqual({ height: 0.6, position: 0 });

    mockWindow.webContents.send.mockClear();
    surface.applyTuning({
      params: { glow: 0.9 },
      wave: { height: 0.6, position: 0 },
    });
    expect(mockWindow.webContents.send).not.toHaveBeenCalled();
  });

  // A new window for every visualizer was the blink: the old one was
  // destroyed as the new one was shown, before a frame of it was on screen.
  it('takes another visualizer into the page it has, which asks for it by a new generation', () => {
    const { surface } = create();
    surface.drawn(1);
    mockHost.report('ready');
    mockHost.report('active');
    mockWindow.webContents.send.mockClear();

    const ember = {
      pack: { id: 'ember', version: 3 } as never,
      madeBy: 'fluideq' as const,
    };
    surface.changeScene(
      {
        lookId: 'premium:ember',
        wave: { height: 1, position: 0 },
        motion: 'calm',
        followsGraph: true,
      },
      ember,
      { params: { glow: 0.2 }, wave: { height: 0.5, position: 0.1 } },
    );
    expect(surface.lookId).toBe('premium:ember');
    expect(surface.scene).toBe(ember);
    expect(surface.choice()).toEqual({
      lookId: 'premium:ember',
      wave: { height: 0.5, position: 0.1 },
      motion: 'calm',
      followsGraph: true,
    });
    expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);
    expect(mockWindow.webContents.send).toHaveBeenCalledWith(
      'wallpaper-surface-changed',
      expect.objectContaining({
        phase: 'running',
        renderGeneration: 2,
        motion: 'calm',
        tuning: { params: { glow: 0.2 }, wave: { height: 0.5, position: 0.1 } },
      }),
    );
    // The same window, still on the desktop: nothing shown again or let go.
    expect(mockWindow.showInactive).toHaveBeenCalledTimes(1);
    expect(mockWindow.destroy).not.toHaveBeenCalled();
    expect(mockHost.stop).not.toHaveBeenCalled();

    // A late frame of the one replaced is not the new one's.
    mockWindow.webContents.send.mockClear();
    surface.drawn(1);
    expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    surface.drawn(2);
    expect(mockWindow.webContents.send).toHaveBeenCalledTimes(1);
  });

  it('lets go of its helper and window once when the helper fails, and says so once', () => {
    const { surface, onFail } = create();
    surface.drawn(1);
    mockHost.report('error');
    mockHost.report('error');
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith('host');
    expect(mockHost.stop).toHaveBeenCalledTimes(1);
    expect(mockWindow.destroy).toHaveBeenCalledTimes(1);
  });
});
