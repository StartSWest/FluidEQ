/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IWindowState } from '../../../common/windowMode';
import untilLinuxViewportIsWindow from '../../../renderer/player/linuxViewport';

const state = (width: number): IWindowState => ({
  mode: 'player',
  isPinned: false,
  isMaximized: false,
  isFullScreen: false,
  zoom: 1,
  contentSize: { width, height: 850 },
});

const viewport = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 850,
  });
};

it('does not miss a resize arriving before the native size response', async () => {
  viewport(1200);
  let reads = 0;
  const read = jest.fn(async () => {
    reads += 1;
    if (reads === 1) {
      viewport(580);
      window.dispatchEvent(new Event('resize'));
      return state(1200);
    }
    return state(580);
  });
  await untilLinuxViewportIsWindow(read);
  expect(read).toHaveBeenCalledTimes(2);
});

it('waits for an actual resize when the player viewport has not arrived', async () => {
  viewport(1200);
  let finished = false;
  const read = jest.fn(async () => state(580));
  const waiting = untilLinuxViewportIsWindow(read).then(() => {
    finished = true;
    return undefined;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  expect(read).toHaveBeenCalledTimes(1);
  viewport(580);
  window.dispatchEvent(new Event('resize'));
  await waiting;
  expect(finished).toBe(true);
});
