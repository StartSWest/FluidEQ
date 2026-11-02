/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which backgrounds the C++ host draws, and what that spares the app.
 *
 * A background moving with the music is drawn by the host where it runs;
 * set again to the calm motion it goes to a page, and back to the host with
 * the music — never one surface taking the other's scene. The host hears
 * the output itself, so a background it draws keeps neither the core
 * listening nor the window loaded; one on a page still does (the control).
 */
import {
  flush,
  mockElectron,
  mockNativeHost,
  mockSurfaceModule,
  mockSurfaces,
  request,
  setup,
  setUpWindowsDesk,
} from '../../utils/wallpaperManagerHarness';

jest.mock('electron', () => mockElectron());
jest.mock('../../../main/wallpaper/nativeHost', () => mockNativeHost());
jest.mock('../../../main/wallpaper/surface', () => mockSurfaceModule());
jest.mock('../../../main/wallpaper/desktopHost', () => ({
  createDesktopHost: () => ({ open: jest.fn(), pid: () => 4242 }),
}));
jest.mock('../../../main/wallpaper/nativeSurface', () => ({
  // The page's fake, drawn by the host instead.
  createNativeDesktopSurface: (
    options: Parameters<
      ReturnType<typeof mockSurfaceModule>['createDesktopSurface']
    >[0],
  ) =>
    Object.assign(mockSurfaceModule().createDesktopSurface(options), {
      drawnBy: 'host',
      onBattery: (options as unknown as { onBattery(): boolean }).onBattery,
    }),
}));

/* eslint-disable import/first -- install the mocks first */
import { createWallpaperManager } from '../../../main/wallpaper/manager';
/* eslint-enable import/first */

setUpWindowsDesk();

const drawnBy = (index: number) =>
  (mockSurfaces[index] as unknown as { drawnBy: string }).drawnBy;

/** A desk whose core can hear the output and whose host can draw. */
const desk = (withHost = true) => {
  const harness = setup();
  const want = jest.fn();
  const holdWindow = jest.fn();
  harness.deps.desktopSound = {
    ...harness.deps.desktopSound,
    want,
    serves: () => true,
  };
  harness.deps.holdWindow = holdWindow;
  if (withHost) {
    harness.deps.sceneHost = {
      executable: 'FluidEQ-Scenes.exe',
      angleDir: 'a',
    };
  }
  return { ...harness, want, holdWindow };
};

describe('backgrounds drawn by the C++ host', () => {
  it('draws one moving with the music, and leaves the calm motion to a page', () => {
    const { deps } = desk();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    expect(mockSurfaces).toHaveLength(1);
    expect(drawnBy(0)).toBe('host');

    manager.start(request({ displayIds: [2], motion: 'calm' }));
    expect(mockSurfaces).toHaveLength(2);
    expect(drawnBy(1)).toBe('page');
    // The host's surface never takes the calm motion as a retune.
    expect(mockSurfaces[0].retune).not.toHaveBeenCalled();

    manager.start(request({ displayIds: [2], motion: 'music' }));
    expect(mockSurfaces).toHaveLength(3);
    expect(drawnBy(2)).toBe('host');
    expect(mockSurfaces[1].retune).not.toHaveBeenCalled();
  });

  it('sends another look set calm to a page, never into its own surface', () => {
    const { deps } = desk();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    manager.start(
      request({ displayIds: [2], lookId: 'premium:other', motion: 'calm' }),
    );
    expect(mockSurfaces[0].changeScene).not.toHaveBeenCalled();
    expect(drawnBy(mockSurfaces.length - 1)).toBe('page');
  });

  it('knows when the computer goes on its battery', async () => {
    const { deps } = desk();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request({ displayIds: [2], motion: 'music' }));
    const surface = mockSurfaces[0] as unknown as { onBattery(): boolean };
    expect(surface.onBattery()).toBe(false);
    // This manager's own watch: the last one made in this file.
    const { powerMonitor } =
      jest.requireMock<typeof import('electron')>('electron');
    const unplugged = (powerMonitor.on as jest.Mock).mock.calls
      .filter(([event]) => event === 'on-battery')
      .pop()?.[1] as () => void;
    unplugged();
    expect(surface.onBattery()).toBe(true);
  });

  it('is retuned in place for what it can take', () => {
    const { deps } = desk();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    manager.start(
      request({
        displayIds: [2],
        motion: 'music',
        wave: { height: 0.5, position: 0 },
      }),
    );
    expect(mockSurfaces).toHaveLength(1);
    expect(mockSurfaces[0].retune).toHaveBeenCalledTimes(1);
  });

  it('keeps neither the core listening nor the window loaded for it', () => {
    const { deps, want, holdWindow } = desk();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    expect(want).not.toHaveBeenCalledWith(true);
    expect(holdWindow).not.toHaveBeenCalledWith(true);
    expect(manager.state().screens[0].drawnByHost).toBe(true);
  });

  it('where there is no host, a page draws it and the core listens (the control)', () => {
    const { deps, want } = desk(false);
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    expect(drawnBy(0)).toBe('page');
    expect(want).toHaveBeenCalledWith(true);
    expect(manager.state().screens[0].drawnByHost).toBeUndefined();
  });

  it('holds main while a background is set on any monitor, and lets it go with the last', () => {
    const { deps } = desk();
    const busy: boolean[] = [];
    deps.onBusy = (isBusy) => busy.push(isBusy);
    const manager = createWallpaperManager(deps);
    expect(busy).toEqual([false]);
    manager.start(request({ displayIds: [2], motion: 'music' }));
    expect(busy[busy.length - 1]).toBe(true);
    manager.stop([2]);
    expect(busy[busy.length - 1]).toBe(false);
  });
});
