/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';

jest.mock('electron', () => ({
  screen: {
    getDisplayMatching: () => ({
      workArea: { x: 0, y: 0, width: 1600, height: 968 },
    }),
  },
}));
jest.mock('../../../main/windowDwm', () => ({
  setWindowTransitions: jest.fn(),
}));

// eslint-disable-next-line import/first
import { createWindowModes } from '../../../main/windowMode';

const APP = { x: 100, y: 60, width: 1200, height: 850 };
const PLAYER = { x: 150, y: 70, width: 480, height: 850 };

const session = () => {
  const events = new EventEmitter();
  let bounds = { x: 0, y: 0, width: 1600, height: 968 };
  let maximized = true;
  let destroyed = false;
  const setBounds = jest.fn((next: typeof bounds) => {
    bounds = { ...next };
    events.emit('resize');
  });
  const win = Object.assign(events, {
    isDestroyed: () => destroyed,
    isMaximized: () => maximized,
    isFullScreen: () => false,
    getBounds: () => ({ ...bounds }),
    getNormalBounds: () => ({ ...APP }),
    setBounds,
    setMinimumSize: jest.fn(),
    setMaximumSize: jest.fn(),
    setMaximizable: jest.fn(),
    setResizable: jest.fn(),
    setAlwaysOnTop: jest.fn(),
    webContents: Object.assign(new EventEmitter(), { getZoomFactor: () => 1 }),
    unmaximize: () => {
      maximized = false;
      // Measured on GNOME: the state event arrives while the maximized
      // surface is still shrinking, before the normal app size lands.
      bounds = { x: 16, y: 10, width: 1568, height: 926 };
      events.emit('unmaximize');
    },
  }) as unknown as BrowserWindow;
  const modes = createWindowModes('linux');
  modes.restore({
    mode: 'app',
    isPinned: false,
    app: { ...APP, isMaximized: true },
    player: PLAYER,
  });
  const changed = jest.fn();
  modes.listen(changed);
  return {
    win,
    modes,
    events,
    changed,
    setBounds,
    completeNativeRestore: (actual = APP) => {
      bounds = { ...actual };
      events.emit('resize');
    },
    close: () => {
      destroyed = true;
      events.emit('closed');
    },
  };
};

it('keeps the narrow player size after the compositor finishes restoring the full app', async () => {
  const test = session();
  const switched = test.modes.setMode(test.win, 'player');
  expect(test.setBounds).not.toHaveBeenCalled();
  expect(test.changed).not.toHaveBeenCalled();
  test.completeNativeRestore();
  await expect(switched).resolves.toBe('player');
  expect(test.win.getBounds()).toEqual(PLAYER);
  expect(test.modes.memory().player).toEqual(PLAYER);
  expect(test.changed).toHaveBeenCalledTimes(1);
  expect(test.events.listenerCount('resize')).toBe(0);
});

it('finishes without resizing a window closed during the compositor restore', async () => {
  const test = session();
  const switched = test.modes.setMode(test.win, 'player');
  test.close();
  await switched;
  expect(test.setBounds).not.toHaveBeenCalled();
  expect(test.events.listenerCount('resize')).toBe(0);
  expect(test.events.listenerCount('unmaximize')).toBe(0);
});

it('restores the player when the compositor clamps the normal app size', async () => {
  const test = session();
  const switched = test.modes.setMode(test.win, 'player');
  test.completeNativeRestore({ x: 16, y: 10, width: 1056, height: 868 });
  await switched;
  expect(test.win.getBounds()).toEqual(PLAYER);
});
