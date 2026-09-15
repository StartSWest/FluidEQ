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

  // The disk record that used to make a look "refused" everywhere the moment
  // any one monitor's copy failed is gone: when the store can no longer hand
  // a scene back, another monitor showing it sees the ordinary
  // missing-scene outcome, exactly as if it had been removed or lost
  // entitlement — never a stale refusal from somewhere else.
  it('shows a missing scene, not a refusal, on another monitor when the store cannot load it any more', () => {
    const { deps, owner, scenes, announceScenes } = setup();
    registerWallpaperIpc(deps);
    setThrough(owner, { displayIds: [2, 3] });
    const [onTwo, onThree] = mockSurfaces;

    pageFails(onTwo, 'context-lost');
    scenes.loadScene.mockReturnValue(undefined);
    announceScenes();
    expect(onThree.release).toHaveBeenCalled();
    expect(screensThrough(owner)).toEqual([
      expect.objectContaining({ displayId: 2, error: 'refused' }),
      expect.objectContaining({ displayId: 3, error: 'missing-scene' }),
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

describe('a look that cannot be loaded at start time', () => {
  // The old cross-launch refusal record used to make a look that had failed
  // before appear "refused" the moment somebody set it again, rather than
  // "missing" like any other pack the store cannot hand over. That record is
  // gone entirely: a look the store cannot load is always missing-scene at
  // start. 'refused' is reserved for a live attempt failing right now
  // (`surfaceFailed`), never a stale memory of an earlier one.
  it('is shown as missing, never refused, whatever failed on it before', () => {
    const { deps, scenes } = setup();
    const manager = createWallpaperManager(deps);
    scenes.loadScene.mockReturnValue(undefined);
    manager.start(request({ displayIds: [2] }));
    manager.start(request({ lookId: 'premium:gone', displayIds: [3] }));
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ displayId: 2, error: 'missing-scene' }),
      expect.objectContaining({ displayId: 3, error: 'missing-scene' }),
    ]);
  });

  it('is shown the same way at launch, before anything is even tried', async () => {
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
    const manager = createWallpaperManager(deps);
    await flush();
    manager.restoreSaved();
    expect(mockSurfaces).toHaveLength(0);
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ displayId: 2, error: 'missing-scene' }),
    ]);
  });
});
