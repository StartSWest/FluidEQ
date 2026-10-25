/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';

let mockScale = 1.25;
jest.mock('electron', () => ({
  screen: {
    getDisplayMatching: () => ({
      scaleFactor: mockScale,
      workArea: { x: 0, y: 24, width: 1536, height: 936 },
    }),
  },
}));

/* eslint-disable import/first -- install Electron's display boundary first */
import keepLinuxWindowTopVisible from '../../../main/linux/linuxWindowTop';
import linuxPlayerBounds from '../../../main/linux/linuxPlayerBounds';
import linuxWindowArgs from '../../../main/linux/linuxWindowBackend';
import {
  holdLinuxWindowSize,
  linuxWindowSizeOf,
  releaseLinuxWindowSize,
} from '../../../main/linux/linuxWindowSize';
/* eslint-enable import/first */

const remembered = { x: 20, y: 24, width: 449, height: 803 };
beforeEach(() => {
  mockScale = 1.25;
});

it('chooses X11 before launch and preserves explicit backends and other platforms', () => {
  const args = ['dev-main.cjs'];
  expect(linuxWindowArgs(args, 'linux', { DISPLAY: ':private' })).toEqual([
    ...args,
    '--ozone-platform=x11',
  ]);
  expect(linuxWindowArgs(args, 'linux', {})).toBe(args);
  expect(linuxWindowArgs(args, 'win32', { DISPLAY: ':private' })).toBe(args);
  expect(linuxWindowArgs(args, 'darwin', { DISPLAY: ':private' })).toBe(args);
  const explicit = [...args, '--ozone-platform=wayland'];
  expect(linuxWindowArgs(explicit, 'linux', { DISPLAY: ':private' })).toBe(
    explicit,
  );
  expect(
    linuxWindowArgs(args, 'linux', {
      DISPLAY: ':private',
      ELECTRON_OZONE_PLATFORM_HINT: 'wayland',
    }),
  ).toBe(args);
});

it('does not save fractional-scale conversion as a new, wider amp on every switch', () => {
  const actual = { ...remembered, width: 450, height: 804 };
  let saved = remembered;
  for (let change = 0; change < 5; change += 1) {
    saved = linuxPlayerBounds(actual, saved);
  }
  expect(saved).toEqual(remembered);
  expect(
    linuxPlayerBounds({ ...actual, width: 600, height: 900 }, saved),
  ).toEqual({
    ...actual,
    width: 600,
    height: 900,
  });
});

it('keeps real one-DIP resizes at an integer desktop scale', () => {
  mockScale = 2;
  const actual = { ...remembered, width: 450, height: 804 };
  expect(linuxPlayerBounds(actual, remembered)).toEqual(actual);
});

it('keeps the titlebar below the panel without a recursive move at fractional scale', () => {
  const bounds = { ...remembered, y: -12 };
  const setPosition = jest.fn((_x: number, _y: number) => {
    // Chromium can report a rounded edge while delivering the correction's
    // synchronous move signal. It must not recursively correct that signal.
    keepLinuxWindowTopVisible(win);
  });
  const win = {
    isDestroyed: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    getBounds: () => bounds,
    setPosition,
  } as unknown as BrowserWindow;
  keepLinuxWindowTopVisible(win);
  expect(setPosition).toHaveBeenCalledTimes(1);
  expect(setPosition).toHaveBeenCalledWith(bounds.x, 25);
  expect(bounds).toEqual({ ...remembered, y: -12 });
});

it.each(['maximized', 'fullscreen'] as const)(
  'leaves a %s window to the compositor',
  (mode) => {
    const setPosition = jest.fn();
    keepLinuxWindowTopVisible({
      isDestroyed: () => false,
      isMaximized: () => mode === 'maximized',
      isFullScreen: () => mode === 'fullscreen',
      setPosition,
    } as unknown as BrowserWindow);
    expect(setPosition).not.toHaveBeenCalled();
  },
);

it.each(['did-start-loading', 'render-process-gone', 'closed', 'revealed'])(
  'releases a pending amp size on %s and removes its listeners',
  (event) => {
    const windowEvents = new EventEmitter();
    const contents = new EventEmitter();
    const win = Object.assign(windowEvents, {
      isDestroyed: () => false,
      webContents: contents,
    }) as unknown as BrowserWindow;
    const release = jest.fn();
    holdLinuxWindowSize(win, { width: 449, height: 803 }, release);
    expect(linuxWindowSizeOf(win)).toEqual({ width: 449, height: 803 });
    if (event === 'revealed') {
      releaseLinuxWindowSize(win);
    } else if (event === 'closed') {
      windowEvents.emit(event);
    } else {
      contents.emit(event);
    }
    expect(linuxWindowSizeOf(win)).toBeUndefined();
    expect(release).toHaveBeenCalledTimes(1);
    expect(contents.listenerCount('did-start-loading')).toBe(0);
    expect(contents.listenerCount('render-process-gone')).toBe(0);
    expect(windowEvents.listenerCount('closed')).toBe(0);
    releaseLinuxWindowSize(win);
    expect(release).toHaveBeenCalledTimes(1);
  },
);
