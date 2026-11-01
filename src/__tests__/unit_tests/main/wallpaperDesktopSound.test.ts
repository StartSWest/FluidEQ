/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who answers a desktop background asking for the music.
 *
 * The core, which hears it for them (`core/liveFrames/desktopSound.ts`): a
 * background behind a minimised FluidEQ then needs nothing of the window —
 * no capture of Chromium's, and nothing that would keep the page awake. The
 * window only where the core cannot hear, and while the window shows what
 * this computer sends to another, which the backgrounds show too.
 */
import type {
  ISystemSound,
  ISystemSoundListener,
} from '../../../core/systemSound/systemSound';
import {
  mockElectron,
  mockHandlers,
  mockMessages,
  mockNativeHost,
  mockSurfaceModule,
  mockSurfaces,
  request,
  setup,
  setUpWindowsDesk,
} from '../../utils/wallpaperManagerHarness';
import { analyserSignal, signalBlocks } from '../../utils/analyserSignal';

jest.mock('electron', () => mockElectron());
jest.mock('../../../main/wallpaper/nativeHost', () => mockNativeHost());
jest.mock('../../../main/wallpaper/surface', () => mockSurfaceModule());

/* eslint-disable import/first -- install the mocks first */
import { createDesktopSound } from '../../../core/liveFrames/desktopSound';
import { desktopSoundClientOf } from '../../../main/coreProcess/coreClient';
import { createWallpaperManager } from '../../../main/wallpaper/manager';
import registerWallpaperIpc from '../../../main/wallpaper/register';
/* eslint-enable import/first */

setUpWindowsDesk();

/** A core that hears the output, or one that cannot. */
const withCore = (canHear: boolean) => {
  const runs: { listener: ISystemSoundListener; stop: jest.Mock }[] = [];
  const systemSound: ISystemSound = {
    listen: (listener) => {
      if (!canHear) {
        listener.lost();
        return () => undefined;
      }
      const stop = jest.fn();
      runs.push({ listener, stop });
      return stop;
    },
  };
  const harness = setup();
  harness.deps.desktopSound = desktopSoundClientOf(
    createDesktopSound(systemSound),
  );
  return { ...harness, runs };
};

const askedTheWindow = (send: jest.Mock) =>
  send.mock.calls.some(([channel]) => channel === 'wallpaper-read-audio');

const lastState = (send: jest.Mock) =>
  [...send.mock.calls]
    .reverse()
    .find(([channel]) => channel === 'wallpaper-changed')?.[1];

describe('the music a background hears, from the core', () => {
  it('listens exactly while a background follows the music', () => {
    const { deps, runs } = withCore(true);
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'calm' }));
    expect(runs).toHaveLength(0);

    manager.start(request({ displayIds: [2], motion: 'music' }));
    expect(runs).toHaveLength(1);

    manager.stop([2]);
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
  });

  it('answers a background itself and never asks the window', async () => {
    const { deps, owner, runs } = withCore(true);
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    runs[0].listener.ready();
    signalBlocks(analyserSignal(), 0, 4096).forEach((block) =>
      runs[0].listener.audio(block),
    );
    owner.send.mockClear();

    const frame = await manager.requestAudio(mockSurfaces[0] as never);
    expect(frame?.points.length).toBeGreaterThan(0);
    expect(askedTheWindow(owner.send)).toBe(false);
    expect(manager.state().heardByCore).toBe(true);
  });

  it('asks the window where the core cannot hear, and says so', async () => {
    const { deps, owner } = withCore(false);
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));

    expect(manager.state().heardByCore).toBe(false);
    expect(lastState(owner.send)).toEqual(
      expect.objectContaining({ heardByCore: false }),
    );
    expect(manager.requestAudio(mockSurfaces[0] as never)).toBeInstanceOf(
      Promise,
    );
    expect(askedTheWindow(owner.send)).toBe(true);
  });

  it('hands the window the job while it shows what goes out, and takes it back after', () => {
    const { deps, owner, runs } = withCore(true);
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    expect(runs).toHaveLength(1);

    manager.setSoundFromWindow(true);
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
    expect(manager.state().heardByCore).toBe(false);
    owner.send.mockClear();
    manager.requestAudio(mockSurfaces[0] as never);
    expect(askedTheWindow(owner.send)).toBe(true);

    manager.setSoundFromWindow(false);
    expect(runs).toHaveLength(2);
    expect(manager.state().heardByCore).toBe(true);
  });

  it('takes that word from FluidEQ’s own window only, and only a yes or a no', () => {
    const { deps, owner, runs } = withCore(true);
    registerWallpaperIpc(deps);
    const say = mockMessages.get('wallpaper-sound-from-window');
    const fromOwner = { sender: owner, senderFrame: owner.mainFrame };
    const stranger = { mainFrame: {} };
    mockHandlers.get('wallpaper-start')?.(fromOwner, request());
    expect(runs).toHaveLength(1);

    say?.({ sender: stranger, senderFrame: stranger.mainFrame }, true);
    say?.(fromOwner, 'yes');
    expect(runs[0].stop).not.toHaveBeenCalled();

    say?.(fromOwner, true);
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
  });
});
