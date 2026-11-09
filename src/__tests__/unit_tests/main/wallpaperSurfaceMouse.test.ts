/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

type THostEvent = 'ready' | 'active' | 'paused' | 'paused-owner' | 'error';

const mockWindow = {
  showInactive: jest.fn(),
  destroy: jest.fn(),
  isDestroyed: () => false,
  on: jest.fn(),
  loadURL: jest.fn(() => Promise.resolve()),
  getNativeWindowHandle: () => Buffer.alloc(8),
  webContents: {
    isDestroyed: () => false,
    send: jest.fn(),
    sendInputEvent: jest.fn(),
    on: jest.fn(),
  },
};
const mockHost = {
  report: (_event: THostEvent) => undefined as void,
  pointer: (_record: unknown) => undefined as void,
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
    onPointer: (record: unknown) => void,
  ) => {
    mockHost.report = onEvent;
    mockHost.pointer = onPointer;
    return mockHost;
  },
}));

/* eslint-disable import/first -- install the mocks first */
import { WALLPAPER, type TWallpaperPause } from '../../../common/wallpaper';
import { parsePointerRecord } from '../../../main/wallpaper/pointerRelay';
import { createDesktopSurface } from '../../../main/wallpaper/surface';
/* eslint-enable import/first */

const WAVE = { height: 1, position: 0 };

/**
 * A monitor at 150%, playing and placed by its helper, its scene answering
 * the mouse unless told otherwise.
 */
const playing = (
  options: { interactive?: boolean; pause?: () => TWallpaperPause } = {},
) => {
  const surface = createDesktopSurface({
    displayId: 2,
    bounds: { x: 0, y: 0, width: 1707, height: 960 },
    scale: 1.5,
    choice: {
      lookId: 'premium:aurora',
      wave: WAVE,
      motion: 'music',
      ...(options.interactive === false ? { interactive: false } : {}),
    },
    performance: {
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'off',
    },
    tuning: undefined,
    daylight: () => undefined,
    brightness: () => undefined,
    locale: () => 'de',
    scene: { pack: { id: 'aurora', version: 1 } as never, madeBy: 'fluideq' },
    executable: 'FluidEQ-Wallpaper.exe',
    pauseReason: (cover) => (cover === 'none' ? options.pause?.() : 'covered'),
    onReady: jest.fn(),
    onChange: jest.fn(),
    onFail: jest.fn(),
  });
  surface.drawn(1);
  mockHost.report('ready');
  mockHost.report('active');
  return surface;
};

const record = (line: string) => {
  const parsed = parsePointerRecord(line);
  if (!parsed) {
    throw new Error(`not a record: ${line}`);
  }
  mockHost.pointer(parsed);
};

const lastTouch = () => mockHost.setTouch.mock.calls.at(-1)?.[0];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('when the desktop helper passes the mouse on', () => {
  it('passes it on while the scene plays on the desktop', () => {
    playing();
    expect(lastTouch()).toBe(true);
  });

  it('stops while the monitor is covered, and starts again when it is not', () => {
    playing();
    mockHost.report('paused');
    expect(lastTouch()).toBe(false);
    mockHost.report('active');
    expect(lastTouch()).toBe(true);
  });

  it('stops while the background is paused for anything else', () => {
    let reason: TWallpaperPause | undefined = 'locked';
    const surface = playing({ pause: () => reason });
    expect(lastTouch()).toBe(false);
    reason = undefined;
    surface.applyPolicy();
    expect(lastTouch()).toBe(true);
  });

  it('never passes it on where the listener turned it off', () => {
    const surface = playing({ interactive: false });
    expect(mockHost.setTouch).not.toHaveBeenCalledWith(true);
    expect(surface.choice().interactive).toBe(false);
    expect(surface.surfaceState().interactive).toBe(false);
  });

  it('follows the switch moved on a monitor already playing', () => {
    const surface = playing();
    surface.retune({ wave: WAVE, motion: 'music', interactive: false });
    expect(lastTouch()).toBe(false);
    expect(mockWindow.webContents.send).toHaveBeenLastCalledWith(
      WALLPAPER.surfaceChanged,
      expect.objectContaining({ interactive: false }),
    );
    surface.retune({ wave: WAVE, motion: 'music' });
    expect(lastTouch()).toBe(true);
    expect(surface.choice().interactive).toBeUndefined();
  });

  it('tells the page the window’s language', () => {
    const surface = playing();
    expect(surface.surfaceState().locale).toBe('de');
  });
});

describe('what the page is handed', () => {
  it('is the mouse as real input, in the page’s pixels', () => {
    playing();
    record('pointer:move 300 150 0 0');
    record('pointer:down 300 150 1 1 0');
    expect(mockWindow.webContents.sendInputEvent).toHaveBeenNthCalledWith(1, {
      type: 'mouseMove',
      x: 200,
      y: 100,
      modifiers: [],
    });
    expect(mockWindow.webContents.sendInputEvent).toHaveBeenNthCalledWith(2, {
      type: 'mouseDown',
      x: 200,
      y: 100,
      button: 'left',
      clickCount: 1,
      modifiers: ['control', 'leftbuttondown'],
    });
  });

  it('is the wheel as a message of its own', () => {
    playing();
    record('pointer:wheel 300 150 1 0 120');
    expect(mockWindow.webContents.send).toHaveBeenLastCalledWith(
      WALLPAPER.wheel,
      { x: 200, y: 100, deltaY: -100, ctrlKey: true },
    );
    expect(mockWindow.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  // The helper's leave after the mouse stops is what makes the page forget a
  // press it was holding; anything else arriving late is dropped.
  it('is nothing once the mouse is off, but the leave that ends it', () => {
    playing();
    record('pointer:move 30 30 0 0');
    mockHost.report('paused');
    record('pointer:move 60 60 0 0');
    record('pointer:wheel 60 60 1 0 120');
    record('pointer:leave');
    expect(mockWindow.webContents.sendInputEvent.mock.calls).toEqual([
      [{ type: 'mouseMove', x: 20, y: 20, modifiers: [] }],
      [{ type: 'mouseLeave', x: 20, y: 20 }],
    ]);
    expect(mockWindow.webContents.send).not.toHaveBeenCalledWith(
      WALLPAPER.wheel,
      expect.anything(),
    );
  });
});
