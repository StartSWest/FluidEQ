/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether anybody can see the window (`main/windowSeen.ts`): to the tray and
 * to the taskbar both count as gone, and each change is told once.
 */
import { EventEmitter } from 'events';
import watchWindowSeen from 'main/windowSeen';

const fakeWindow = (visible = true, minimized = false) => {
  const emitter = new EventEmitter();
  const window = Object.assign(emitter, {
    visible,
    minimized,
    destroyed: false,
    isVisible: () => window.visible,
    isMinimized: () => window.minimized,
    isDestroyed: () => window.destroyed,
  });
  return window;
};

const watch = (window: ReturnType<typeof fakeWindow>) => {
  const told: boolean[] = [];
  watchWindowSeen(window, (isSeen) => told.push(isSeen));
  return told;
};

it('says at once whether the window is seen', () => {
  expect(watch(fakeWindow())).toEqual([true]);
  expect(watch(fakeWindow(false))).toEqual([false]);
  expect(watch(fakeWindow(true, true))).toEqual([false]);
});

it('counts the tray and the taskbar as gone, whatever the window answers in the event', () => {
  const window = fakeWindow();
  const told = watch(window);
  // Still answering "visible, not minimised" while its own event runs.
  window.emit('minimize');
  expect(told).toEqual([true, false]);
  window.emit('restore');
  window.emit('hide');
  expect(told).toEqual([true, false, true, false]);
});

it('is seen again when shown or restored, and asks the window which', () => {
  const window = fakeWindow(false);
  const told = watch(window);
  window.visible = true;
  window.minimized = true;
  window.emit('show');
  // Shown minimised is still not seen.
  expect(told).toEqual([false]);
  window.minimized = false;
  window.emit('restore');
  expect(told).toEqual([false, true]);
});

it('tells each change once', () => {
  const window = fakeWindow();
  const told = watch(window);
  window.emit('show');
  window.emit('restore');
  window.emit('hide');
  window.emit('minimize');
  expect(told).toEqual([true, false]);
});

it('is gone for good when the window closes, without asking a destroyed window', () => {
  const window = fakeWindow();
  const told = watch(window);
  window.destroyed = true;
  window.isVisible = () => {
    throw new Error('destroyed');
  };
  window.emit('closed');
  expect(told).toEqual([true, false]);
});
