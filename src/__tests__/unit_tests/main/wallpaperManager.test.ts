/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  connect,
  displays,
  flush,
  mockElectron,
  mockHandlers,
  mockNativeHost,
  mockScreenListeners,
  mockSurfaceModule,
  mockSurfaces,
  request,
  setDisplays,
  setup,
  setUpWindowsDesk,
} from '../../utils/wallpaperManagerHarness';

jest.mock('electron', () => mockElectron());
jest.mock('../../../main/wallpaper/nativeHost', () => mockNativeHost());
jest.mock('../../../main/wallpaper/surface', () => mockSurfaceModule());

/* eslint-disable import/first -- install the mocks first */
import type { IWallpaperArrangement } from '../../../main/wallpaper/arrangement';
import { createWallpaperManager } from '../../../main/wallpaper/manager';
import registerWallpaperIpc from '../../../main/wallpaper/register';
/* eslint-enable import/first */

setUpWindowsDesk();

describe('setting a monitor’s background', () => {
  it('puts the visualizer on every monitor named and remembers each with where it stands', () => {
    const { deps, owner, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(
      request({
        displayIds: [2, 3],
        motion: 'calm',
        wave: { height: 0.4, position: 0.6 },
      }),
    );
    expect(mockSurfaces.map((surface) => surface.displayId)).toEqual([2, 3]);
    expect(manager.state().screens.map((screen) => screen.motion)).toEqual([
      'calm',
      'calm',
    ]);
    expect(file().screens).toEqual([
      expect.objectContaining({
        displayId: 2,
        choice: {
          lookId: 'premium:alpine',
          wave: { height: 0.4, position: 0.6 },
          motion: 'calm',
        },
        monitor: { label: 'Y27qf-30', x: 0, y: 0, width: 2560, height: 1440 },
      }),
      expect.objectContaining({ displayId: 3 }),
    ]);
    expect(owner.send).toHaveBeenCalledWith(
      'wallpaper-changed',
      expect.objectContaining({ supported: true }),
    );
  });

  it('does not remember a background it refused to start', () => {
    const { deps, setEntitled, file } = setup();
    const manager = createWallpaperManager(deps);
    setEntitled(false);
    manager.start(request());
    expect(mockSurfaces).toHaveLength(0);
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ displayId: 2, error: 'not-entitled' }),
    ]);
    expect(file().screens).toEqual([]);
  });

  // Set again with another wave or the other motion: the one playing takes it
  // in place, where a new surface would blink the desktop and start over.
  it('retunes a visualizer set again on its monitor instead of starting it over', () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request());
    manager.start(
      request({ motion: 'calm', wave: { height: 0.3, position: 0.5 } }),
    );
    expect(mockSurfaces).toHaveLength(1);
    expect(mockSurfaces[0].retune).toHaveBeenCalledWith({
      lookId: 'premium:alpine',
      wave: { height: 0.3, position: 0.5 },
      motion: 'calm',
    });
    expect(file().screens[0].choice.motion).toBe('calm');
  });

  // Let go first, and the desktop's own wallpaper was on screen for as long
  // as the new scene took to load and compile — a second of it, on every
  // visualizer set and every scene brought up to date.
  it('keeps the visualizer a monitor is playing until its replacement is on the desktop', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request());
    manager.start(request({ lookId: 'premium:aurora' }));
    const [playing, coming] = mockSurfaces;
    expect(mockSurfaces).toHaveLength(2);
    expect(playing.release).not.toHaveBeenCalled();
    // The list says what the monitor is coming to, and the page that is on
    // its way out is still answered while it draws.
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ lookId: 'premium:aurora' }),
    ]);
    expect(manager.surfaceFor(playing.contents as never)).toBe(playing);

    coming.ready();
    expect(playing.release).toHaveBeenCalledTimes(1);
  });

  it('lets the old one go with the new one when the new one cannot start', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request());
    manager.start(request({ lookId: 'premium:aurora' }));
    const [playing, coming] = mockSurfaces;

    coming.fail('renderer');
    expect(playing.release).toHaveBeenCalledTimes(1);
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ phase: 'error', error: 'renderer' }),
    ]);
  });

  it('stops the one on its way out when the monitor is stopped mid-change', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request());
    manager.start(request({ lookId: 'premium:aurora' }));
    const [playing, coming] = mockSurfaces;

    manager.stop(undefined);
    expect(playing.release).toHaveBeenCalledTimes(1);
    expect(coming.release).toHaveBeenCalledTimes(1);
    expect(manager.state().screens).toEqual([]);
  });
});

describe('the music a background hears', () => {
  it('asks FluidEQ’s window for the music only for a background following it', () => {
    const { deps, owner } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    manager.start(
      request({ lookId: 'premium:aurora', displayIds: [3], motion: 'calm' }),
    );
    const [music, calm] = mockSurfaces;
    owner.send.mockClear();

    expect(manager.requestAudio(calm as never)).toBeUndefined();
    expect(owner.send).not.toHaveBeenCalledWith(
      'wallpaper-read-audio',
      expect.anything(),
    );

    expect(manager.requestAudio(music as never)).toBeInstanceOf(Promise);
    expect(owner.send).toHaveBeenCalledWith(
      'wallpaper-read-audio',
      expect.any(Number),
    );
  });

  it('stops giving a background the music once it is set calm', () => {
    const { deps, owner } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request());
    manager.start(request({ motion: 'calm' }));
    owner.send.mockClear();
    expect(manager.requestAudio(mockSurfaces[0] as never)).toBeUndefined();
    expect(owner.send).not.toHaveBeenCalled();
  });
});

describe('how hard the monitors draw', () => {
  const chosen = {
    frameRate: 'display',
    resolution: 'auto',
    autoFloor: 0.35,
    upscaler: 'fsr',
    smoothing: 'off',
  } as const;

  // The page draws by the scaler and the smoothing as much as by the rate and
  // the size; comparing two of the five left a background on the scaler it
  // started with, on the desktop and in the file, until something else moved.
  it('takes every part of the window’s choice to the monitors and remembers it', () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2, 3] }));

    manager.setPerformance({ ...chosen, upscaler: 'simple' });
    expect(
      mockSurfaces.map((surface) => surface.retunePerformance.mock.calls[0][0]),
    ).toEqual([
      { ...chosen, upscaler: 'simple' },
      { ...chosen, upscaler: 'simple' },
    ]);
    expect(file().performance).toEqual({ ...chosen, upscaler: 'simple' });

    manager.setPerformance({ ...chosen, smoothing: 'best' });
    expect(file().performance).toEqual({ ...chosen, smoothing: 'best' });
    expect(mockSurfaces[0].retunePerformance).toHaveBeenCalledTimes(2);

    // The same choice again is not a change.
    manager.setPerformance({ ...chosen, smoothing: 'best' });
    expect(mockSurfaces[0].retunePerformance).toHaveBeenCalledTimes(2);
  });

  it('starts a monitor with the choice it was left with', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.setPerformance({ ...chosen, resolution: 'balanced' });
    manager.start(request());
    expect(mockSurfaces[0].performance).toEqual({
      ...chosen,
      resolution: 'balanced',
    });
  });
});

describe('what each visualizer is set to', () => {
  const alpine = {
    params: { glow: 0.4 },
    response: { attack: 120 },
    wave: { height: 0.5, position: 0.25 },
  };

  // A background is the same visualizer the graph draws, so what the listener
  // set for it there is what it is drawn with here — at once, and at the next
  // launch, which is why it is written down beside the backgrounds.
  it('takes the window’s record to every monitor showing that look, and remembers it', () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2, 3] }));

    manager.setTuning({ 'premium:alpine': alpine });
    expect(
      mockSurfaces.map((surface) => surface.applyTuning.mock.calls[0][0]),
    ).toEqual([alpine, alpine]);
    expect(file().tuning).toEqual({ 'premium:alpine': alpine });
    // The band it landed on is this monitor's now: the list and the next
    // launch show what the desktop shows.
    expect(file().screens[0].choice.wave).toEqual({
      height: 0.5,
      position: 0.25,
    });

    // The same record again is not a change.
    manager.setTuning({ 'premium:alpine': alpine });
    expect(mockSurfaces[0].applyTuning).toHaveBeenCalledTimes(1);
  });

  it('gives a monitor starting later what its look is set to', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.setTuning({ 'premium:alpine': alpine });
    manager.start(request());
    expect(mockSurfaces[0].tuning).toEqual(alpine);
    expect(mockSurfaces[0].choice().wave).toEqual({
      height: 0.5,
      position: 0.25,
    });
  });

  it('gives a monitor nothing for a look nobody has tuned', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.setTuning({ 'premium:aurora': alpine });
    manager.start(request());
    expect(mockSurfaces[0].tuning).toBeUndefined();
    expect(mockSurfaces[0].choice().wave).toEqual({ height: 1, position: 0 });
  });
});

describe('stopping', () => {
  it('forgets a stopped monitor, and Stop all forgets every one', () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [1, 2, 3] }));
    manager.stop([2]);
    expect(file().screens.map((screen) => screen.displayId)).toEqual([1, 3]);
    manager.stop(undefined);
    expect(file().screens).toEqual([]);
    expect(manager.state().screens).toEqual([]);
    expect(
      mockSurfaces.every((surface) => surface.release.mock.calls.length > 0),
    ).toBe(true);
  });
});

describe('coming back at launch', () => {
  const remembered = (): IWallpaperArrangement => ({
    pauseOnBattery: false,
    performance: {
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'off',
    },
    tuning: {},
    screens: [
      {
        displayId: 30,
        choice: {
          lookId: 'premium:aurora',
          wave: { height: 0.4, position: 0.65 },
          motion: 'calm',
        },
        monitor: {
          label: 'Odyssey G5',
          x: 2560,
          y: 0,
          width: 2560,
          height: 1440,
        },
      },
      {
        displayId: 40,
        choice: {
          lookId: 'premium:alpine',
          wave: { height: 1, position: 0 },
          motion: 'music',
        },
        monitor: {
          label: 'Portable',
          x: 5120,
          y: 0,
          width: 1920,
          height: 1080,
        },
      },
    ],
  });

  it('waits for the membership, then brings each background back as it was set', async () => {
    const { deps, setEntitled, file } = setup(remembered());
    const manager = createWallpaperManager(deps);
    await flush();
    setEntitled(false);
    manager.restoreSaved();
    expect(mockSurfaces).toHaveLength(0);

    setEntitled(true);
    // Windows renumbered the Odyssey from 30 to 3; it is found by name and size.
    expect(
      mockSurfaces.map((surface) => [surface.displayId, surface.choice()]),
    ).toEqual([
      [
        3,
        {
          lookId: 'premium:aurora',
          wave: { height: 0.4, position: 0.65 },
          motion: 'calm',
        },
      ],
    ]);
    expect(manager.state().pauseOnBattery).toBe(false);
    // The portable monitor is not plugged in: it waits, still remembered.
    expect(manager.state().screens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayId: 40, error: 'missing-display' }),
      ]),
    );
    expect(
      file()
        .screens.map((screen) => screen.displayId)
        .sort(),
    ).toEqual([3, 40]);
  });

  it('brings a monitor’s background back when it is plugged in again', async () => {
    const { deps } = setup(remembered());
    const manager = createWallpaperManager(deps);
    await flush();
    manager.restoreSaved();
    expect(mockSurfaces).toHaveLength(1);

    const portable = connect(41, 5120, 'Portable', {
      width: 1920,
      height: 1080,
    });
    setDisplays([...displays(), portable]);
    mockScreenListeners.get('display-added')?.({}, portable);
    expect(mockSurfaces.map((surface) => surface.displayId)).toEqual([3, 41]);
    expect(mockSurfaces[1].choice().lookId).toBe('premium:alpine');
  });

  it('keeps an unplugged monitor’s background waiting rather than forgetting it', async () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request({ displayIds: [3], motion: 'calm' }));
    setDisplays(displays().filter((display) => display.id !== 3));
    mockScreenListeners.get('display-removed')?.({}, { id: 3 });
    expect(mockSurfaces[0].release).toHaveBeenCalled();
    expect(manager.state().screens).toEqual([
      expect.objectContaining({
        displayId: 3,
        error: 'missing-display',
        motion: 'calm',
      }),
    ]);
    expect(file().screens.map((screen) => screen.displayId)).toEqual([3]);
  });
});

describe('the membership', () => {
  it('stops every background when it lapses and brings them back when it returns', () => {
    const { deps, setEntitled } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'calm' }));
    setEntitled(false);
    expect(mockSurfaces[0].release).toHaveBeenCalled();
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ error: 'not-entitled', motion: 'calm' }),
    ]);
    setEntitled(true);
    expect(mockSurfaces).toHaveLength(2);
    expect(mockSurfaces[1].choice().motion).toBe('calm');
  });
});

describe('who may ask', () => {
  it('lets only FluidEQ’s own window set or stop a background', () => {
    const { deps, owner } = setup();
    registerWallpaperIpc(deps);
    const start = mockHandlers.get('wallpaper-start');
    const stranger = { mainFrame: {} };
    expect(() =>
      start?.({ sender: stranger, senderFrame: stranger.mainFrame }, request()),
    ).toThrow('Desktop controls belong to FluidEQ.');
    expect(mockSurfaces).toHaveLength(0);
    // A frame inside the window is not the window either.
    expect(() =>
      start?.({ sender: owner, senderFrame: {} }, request()),
    ).toThrow('Desktop controls belong to FluidEQ.');

    const state = start?.(
      { sender: owner, senderFrame: owner.mainFrame },
      request(),
    );
    expect(state).toEqual(expect.objectContaining({ supported: true }));
    expect(mockSurfaces).toHaveLength(1);
  });

  it('ignores a malformed request from the window', () => {
    const { deps, owner } = setup();
    registerWallpaperIpc(deps);
    mockHandlers.get('wallpaper-start')?.(
      { sender: owner, senderFrame: owner.mainFrame },
      { ...request(), displayIds: [2, 2] },
    );
    expect(mockSurfaces).toHaveLength(0);
  });

  it('gives a desktop page its own scene and nothing to any other page', () => {
    const { deps, owner } = setup();
    registerWallpaperIpc(deps);
    mockHandlers.get('wallpaper-start')?.(
      { sender: owner, senderFrame: owner.mainFrame },
      request({ motion: 'calm' }),
    );
    const bootstrap = mockHandlers.get('wallpaper-bootstrap');
    const [surface] = mockSurfaces;
    expect(
      bootstrap?.({
        sender: surface.contents,
        senderFrame: surface.contents.mainFrame,
      }),
    ).toEqual(
      expect.objectContaining({
        state: expect.objectContaining({ motion: 'calm' }),
      }),
    );
    expect(
      bootstrap?.({ sender: owner, senderFrame: owner.mainFrame }),
    ).toBeUndefined();
    const audio = mockHandlers.get('wallpaper-request-audio');
    expect(
      audio?.({ sender: owner, senderFrame: owner.mainFrame }),
    ).toBeUndefined();
  });
});
