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
import { createWallpaperManager } from '../../../main/wallpaper/manager';
/* eslint-enable import/first */

setUpWindowsDesk();

/** Windows telling FluidEQ a monitor now has another resolution. */
const monitorResized = (displayId: number) => {
  const resized = displays().map((display) =>
    display.id === displayId
      ? connect(display.id, display.bounds.x, display.label, {
          width: 1920,
          height: 1080,
        })
      : display,
  );
  setDisplays(resized);
  mockScreenListeners.get('display-metrics-changed')?.(
    {},
    resized.find((display) => display.id === displayId),
    ['bounds'],
  );
};

describe('a monitor’s background changing to another', () => {
  // A window of its own for every visualizer was a blink and a hard cut: the
  // old window was destroyed the moment the new one was shown, before a
  // frame of it was on screen. The page on the desktop crossfades instead.
  it('gives a monitor another visualizer in the page it already has', async () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request());
    manager.start(request({ lookId: 'premium:aurora' }));
    const [playing] = mockSurfaces;
    expect(mockSurfaces).toHaveLength(1);
    expect(playing.changeScene).toHaveBeenCalledWith(
      {
        lookId: 'premium:aurora',
        wave: { height: 1, position: 0 },
        motion: 'music',
      },
      expect.objectContaining({
        pack: expect.objectContaining({ id: 'premium:aurora' }),
      }),
      undefined,
    );
    expect(playing.release).not.toHaveBeenCalled();
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ displayId: 2, lookId: 'premium:aurora' }),
    ]);
    expect(file().screens[0].choice.lookId).toBe('premium:aurora');

    // Positive control: a monitor that changed shape cannot keep its window,
    // and gets a new one.
    monitorResized(2);
    expect(mockSurfaces).toHaveLength(2);
  });

  // Let go first, and the desktop's own wallpaper was on screen for as long
  // as the new scene took to load and compile — a second of it, every time a
  // monitor changed shape.
  it('keeps the visualizer a monitor is playing until the window for its new shape is on the desktop', async () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request());
    monitorResized(2);
    const [playing, coming] = mockSurfaces;
    expect(mockSurfaces).toHaveLength(2);
    expect(playing.release).not.toHaveBeenCalled();
    // The page that is on its way out is still answered while it draws.
    expect(manager.surfaceFor(playing.contents as never)).toBe(playing);

    coming.ready();
    expect(playing.release).toHaveBeenCalledTimes(1);
  });

  it('lets the old one go with the new one when the new one cannot start', async () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request());
    monitorResized(2);
    const [playing, coming] = mockSurfaces;

    coming.fail('renderer');
    expect(playing.release).toHaveBeenCalledTimes(1);
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ phase: 'error', error: 'renderer' }),
    ]);
  });

  it('stops the one on its way out when the monitor is stopped mid-change', async () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request());
    monitorResized(2);
    const [playing, coming] = mockSurfaces;

    manager.stop(undefined);
    expect(playing.release).toHaveBeenCalledTimes(1);
    expect(coming.release).toHaveBeenCalledTimes(1);
    expect(manager.state().screens).toEqual([]);
  });

  // A Studio save of the listener's own scene, or an update of FluidEQ's.
  it('brings a newer version of what it shows into the same page', async () => {
    const { deps, scenes, announceScenes } = setup();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request());
    const [playing] = mockSurfaces;
    const saved = {
      pack: { id: 'premium:alpine', version: 2, source: 'void main() {}' },
      madeBy: 'fluideq',
    };
    scenes.loadScene.mockReturnValue(saved as never);

    announceScenes();
    expect(mockSurfaces).toHaveLength(1);
    expect(playing.changeScene).toHaveBeenCalledWith(
      expect.objectContaining({ lookId: 'premium:alpine' }),
      saved,
      undefined,
    );
    expect(playing.release).not.toHaveBeenCalled();
  });
});
