/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IWallpaperStart,
  IWallpaperState,
} from '../../../common/wallpaper';

/**
 * The window's requests to main for the desktop: each one is sent, and each
 * answer is the one it gets. A request made while another was in flight used
 * to be answered with the state as it was, without being sent; the dialog
 * that made it took that for done and closed on a desktop where nothing had
 * happened, with nothing said why.
 */

const request = (lookId: string): IWallpaperStart => ({
  lookId,
  displayIds: [2],
  pauseOnBattery: true,
  wave: { height: 1, position: 0 },
  motion: 'music',
});

const stateShowing = (lookId: string): IWallpaperState => ({
  supported: true,
  displays: [
    { id: 2, label: 'A', x: 0, y: 0, width: 2560, height: 1440, primary: true },
  ],
  screens: [
    {
      displayId: 2,
      lookId,
      wave: { height: 1, position: 0 },
      motion: 'music',
      phase: 'running',
    },
  ],
  pauseOnBattery: true,
});

/** A promise and the hand that settles it. */
const deferred = <T>() => {
  let settle: (value: T) => void = () => undefined;
  let fail: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  return { promise, settle, fail };
};

/** Lets the queued request reach the bridge: it is sent on the microtask after the one before it. */
const settled = async () => {
  for (let turn = 0; turn < 5; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask at a time, by design
    await Promise.resolve();
  }
};

const withBridge = (startWallpaper: jest.Mock) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { startWallpaper } },
  });
};

beforeEach(() => {
  jest.resetModules();
});

it('sends a request made while another is in flight, once that one is answered', async () => {
  const first = deferred<IWallpaperState>();
  const startWallpaper = jest
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(stateShowing('premium:aurora'));
  withBridge(startWallpaper);
  const { startWallpaper: start } =
    await import('../../../renderer/wallpaper/wallpaperStore');

  const one = start(request('premium:alpine'));
  const two = start(request('premium:aurora'));
  await settled();
  // The second waits for the first: never two answers crossing.
  expect(startWallpaper).toHaveBeenCalledTimes(1);
  first.settle(stateShowing('premium:alpine'));
  expect((await one).screens[0].lookId).toBe('premium:alpine');
  expect((await two).screens[0].lookId).toBe('premium:aurora');
  expect(startWallpaper).toHaveBeenCalledTimes(2);
  expect(startWallpaper).toHaveBeenLastCalledWith(request('premium:aurora'));
});

// The control for the queue: one request alone is sent at once.
it('sends a request on its own at once', async () => {
  const startWallpaper = jest
    .fn()
    .mockResolvedValue(stateShowing('premium:alpine'));
  withBridge(startWallpaper);
  const { startWallpaper: start } =
    await import('../../../renderer/wallpaper/wallpaperStore');
  const answer = start(request('premium:alpine'));
  await settled();
  expect(startWallpaper).toHaveBeenCalledTimes(1);
  expect((await answer).screens[0].phase).toBe('running');
});

it('says a refused request failed on its monitors, never "as it was"', async () => {
  const startWallpaper = jest
    .fn()
    .mockRejectedValue(new Error('Not a desktop background request.'));
  withBridge(startWallpaper);
  const { startWallpaper: start } =
    await import('../../../renderer/wallpaper/wallpaperStore');
  const answer = await start(request('premium:alpine'));
  expect(answer.screens).toEqual([
    expect.objectContaining({
      displayId: 2,
      lookId: 'premium:alpine',
      phase: 'error',
      error: 'unavailable',
    }),
  ]);
});
