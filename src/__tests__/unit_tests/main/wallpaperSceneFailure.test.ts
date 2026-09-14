/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  flush,
  mockElectron,
  mockHandlers,
  mockMessages,
  mockNativeHost,
  mockScreenListeners,
  mockSurfaceModule,
  mockSurfaces,
  request,
  setup,
  setUpWindowsDesk,
  type IFakeSurface,
} from '../../utils/wallpaperManagerHarness';

jest.mock('electron', () => mockElectron());
jest.mock('../../../main/wallpaper/nativeHost', () => mockNativeHost());
jest.mock('../../../main/wallpaper/surface', () => mockSurfaceModule());

/* eslint-disable import/first -- install the mocks first */
import type { IWallpaperState } from '../../../common/wallpaper';
import { createWallpaperManager } from '../../../main/wallpaper/manager';
import registerWallpaperIpc from '../../../main/wallpaper/register';
/* eslint-enable import/first */

setUpWindowsDesk();

/** FluidEQ's window setting a background, as the dialog does. */
const setThrough = (
  owner: { mainFrame: object },
  over: Parameters<typeof request>[0] = {},
) =>
  mockHandlers.get('wallpaper-start')?.(
    { sender: owner, senderFrame: owner.mainFrame },
    request(over),
  );

/** What FluidEQ's window is told every monitor shows. */
const screensThrough = (owner: { mainFrame: object }) =>
  (
    mockHandlers.get('wallpaper-state')?.({
      sender: owner,
      senderFrame: owner.mainFrame,
    }) as IWallpaperState
  ).screens;

/** A desktop page reporting that it cannot draw. */
const pageFails = (surface: IFakeSurface, reason?: unknown) =>
  mockMessages.get('wallpaper-failed')?.(
    { sender: surface.contents, senderFrame: surface.contents.mainFrame },
    reason,
  );

/** Windows telling FluidEQ a monitor changed resolution. */
const monitorResized = (displayId: number) =>
  mockScreenListeners.get('display-metrics-changed')?.({}, { id: displayId }, [
    'bounds',
  ]);

describe('a scene failing on the desktop', () => {
  // The graph writes a scene's failure down so nothing runs its code again.
  // The desktop did not: it stopped that one monitor and started the same code
  // again when a monitor changed or at the next launch, and a scene that
  // resets the graphics driver a few times a minute takes Windows down.
  it('is written down with the graph’s, and the monitor says it was refused', () => {
    const { deps, owner, scenes } = setup();
    registerWallpaperIpc(deps);
    setThrough(owner, { displayIds: [2, 3] });
    const [onTwo] = mockSurfaces;

    pageFails(onTwo, 'gpu-reset');
    expect(onTwo.fail).toHaveBeenCalledWith('refused');
    expect(scenes.reportSceneFailure).toHaveBeenCalledWith(
      'premium:alpine',
      'gpu-reset',
    );
    expect(screensThrough(owner)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayId: 2, error: 'refused' }),
      ]),
    );
  });

  it('stops the same visualizer on every other monitor once the refusal is announced', () => {
    const { deps, owner, scenes, announceScenes } = setup();
    registerWallpaperIpc(deps);
    setThrough(owner, { displayIds: [2, 3] });
    const [onTwo, onThree] = mockSurfaces;

    pageFails(onTwo, 'context-lost');
    scenes.loadScene.mockReturnValue(undefined);
    scenes.isSceneRefused.mockReturnValue(true);
    announceScenes();
    expect(onThree.release).toHaveBeenCalled();
    expect(screensThrough(owner)).toEqual([
      expect.objectContaining({ displayId: 2, error: 'refused' }),
      expect.objectContaining({ displayId: 3, error: 'refused' }),
    ]);
  });

  it('is not started again when its monitor changes or the looks change', async () => {
    const { deps, owner, announceScenes } = setup();
    registerWallpaperIpc(deps);
    await flush();
    setThrough(owner);
    pageFails(mockSurfaces[0], 'compile');

    // Even with a store that would still hand the scene over.
    monitorResized(2);
    announceScenes();
    expect(mockSurfaces).toHaveLength(1);
  });

  // The control for the case above: a page failing for a reason of its own is
  // tried again when the monitor changes, so the monitor event does arrive.
  it('leaves a page that failed on its own as a renderer failure, tried again, with nothing written', async () => {
    const { deps, owner, scenes } = setup();
    registerWallpaperIpc(deps);
    await flush();
    setThrough(owner);

    pageFails(mockSurfaces[0]);
    expect(screensThrough(owner)).toEqual([
      expect.objectContaining({ displayId: 2, error: 'renderer' }),
    ]);
    monitorResized(2);
    expect(mockSurfaces).toHaveLength(2);

    pageFails(mockSurfaces[1], 'everything');
    expect(mockSurfaces[1].fail).toHaveBeenCalledWith('renderer');
    expect(scenes.reportSceneFailure).not.toHaveBeenCalled();
  });
});

describe('a refused visualizer set or remembered', () => {
  it('says it was refused, rather than not installed, when it is set again', () => {
    const { deps, scenes } = setup();
    const manager = createWallpaperManager(deps);
    scenes.loadScene.mockReturnValue(undefined);
    scenes.isSceneRefused.mockImplementation(
      (lookId) => lookId === 'premium:alpine',
    );
    manager.start(request({ displayIds: [2] }));
    manager.start(request({ lookId: 'premium:gone', displayIds: [3] }));
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ displayId: 2, error: 'refused' }),
      expect.objectContaining({ displayId: 3, error: 'missing-scene' }),
    ]);
  });

  it('says so at launch instead of starting it', async () => {
    const { deps, scenes } = setup({
      pauseOnBattery: true,
      screens: [
        {
          displayId: 2,
          choice: {
            lookId: 'premium:alpine',
            wave: { height: 1, position: 0 },
            motion: 'music',
          },
          monitor: { label: 'Y27qf-30', x: 0, y: 0, width: 2560, height: 1440 },
        },
      ],
    });
    scenes.loadScene.mockReturnValue(undefined);
    scenes.isSceneRefused.mockReturnValue(true);
    const manager = createWallpaperManager(deps);
    await flush();
    manager.restoreSaved();
    expect(mockSurfaces).toHaveLength(0);
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ displayId: 2, error: 'refused' }),
    ]);
  });
});
