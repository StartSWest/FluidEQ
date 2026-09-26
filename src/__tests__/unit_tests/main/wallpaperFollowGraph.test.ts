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
  mockSurfaceModule,
  mockSurfaces,
  request,
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

/** Who shows what now, in the order the monitors were started. */
const showing = (manager: ReturnType<typeof createWallpaperManager>) =>
  manager
    .state()
    .screens.map((screen) => [screen.displayId, screen.lookId])
    .sort(([a], [b]) => Number(a) - Number(b));

describe('a monitor following the graph', () => {
  it('goes to each Plus visualizer the graph changes to, and remembers it', () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2], followsGraph: true }));
    manager.start(request({ displayIds: [3], lookId: 'premium:ember' }));

    manager.setGraphLook('premium:aurora');
    // Only the monitor set to follow moves; the other keeps what it was given.
    expect(showing(manager)).toEqual([
      [2, 'premium:aurora'],
      [3, 'premium:ember'],
    ]);
    const followed = file().screens.find((entry) => entry.displayId === 2);
    expect(followed?.choice).toEqual({
      lookId: 'premium:aurora',
      wave: { height: 1, position: 0 },
      motion: 'music',
      followsGraph: true,
    });

    manager.setGraphLook('premium:neon-city');
    expect(showing(manager)[0]).toEqual([2, 'premium:neon-city']);
  });

  // The replacement goes where every change of visualizer goes: into the
  // page already on the desktop, which keeps the one it shows until the new
  // one has drawn and crossfades.
  it('changes to the graph’s in the page it already has, never a new window', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ followsGraph: true }));
    manager.setGraphLook('premium:aurora');
    const [playing] = mockSurfaces;
    expect(mockSurfaces).toHaveLength(1);
    expect(playing.changeScene).toHaveBeenCalledWith(
      expect.objectContaining({
        lookId: 'premium:aurora',
        followsGraph: true,
      }),
      expect.anything(),
      undefined,
    );
    expect(playing.release).not.toHaveBeenCalled();
  });

  // The graph on a free visualizer says nothing at all (the window sends
  // only Plus ones); a look this computer cannot load is the same case here,
  // and the desktop keeps the last Plus visualizer rather than going blank.
  it('stays on what it shows while the graph’s visualizer cannot be loaded', () => {
    const { deps, scenes } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ followsGraph: true }));
    const placed = mockSurfaces.length;

    manager.setGraphLook('member:somebody:gone');
    expect(scenes.loadScene).toHaveBeenLastCalledWith('member:somebody:gone');
    expect(mockSurfaces).toHaveLength(placed);
    expect(showing(manager)).toEqual([[2, 'premium:alpine']]);
  });

  it('goes to the graph’s visualizer at once when it is set to follow', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.setGraphLook('premium:aurora');
    manager.start(request());
    expect(showing(manager)).toEqual([[2, 'premium:alpine']]);

    manager.start(request({ followsGraph: true }));
    expect(showing(manager)).toEqual([[2, 'premium:aurora']]);
  });

  // The Set dialog carries no switch for it: setting the same visualizer
  // again for its wave or motion must not quietly stop the following.
  it('keeps following when its own visualizer is set again, and stops for another one', () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ followsGraph: true }));
    manager.start(request({ motion: 'calm' }));
    expect(mockSurfaces[0].retune).toHaveBeenLastCalledWith({
      lookId: 'premium:alpine',
      wave: { height: 1, position: 0 },
      motion: 'calm',
      followsGraph: true,
    });
    expect(file().screens[0].choice.followsGraph).toBe(true);

    manager.start(request({ lookId: 'premium:ember' }));
    expect(file().screens[0].choice.followsGraph).toBeUndefined();
    manager.setGraphLook('premium:aurora');
    expect(showing(manager)).toEqual([[2, 'premium:ember']]);
  });

  it('stops following when switched off, and keeps what it shows', () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ followsGraph: true }));
    manager.start(request({ followsGraph: false }));
    expect(file().screens[0].choice.followsGraph).toBeUndefined();

    manager.setGraphLook('premium:aurora');
    expect(showing(manager)).toEqual([[2, 'premium:alpine']]);
  });

  // A scene removed or refused here is mended by another scene; a monitor
  // unplugged or a desktop that failed is not, and waits as it always did.
  it('mends a monitor whose visualizer failed only where another scene can', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ displayIds: [2, 3], followsGraph: true }));
    const [second, third] = mockSurfaces;
    second.fail('refused');
    third.fail('host');

    manager.setGraphLook('premium:aurora');
    expect(manager.state().screens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayId: 2, lookId: 'premium:aurora' }),
        expect.objectContaining({
          displayId: 3,
          lookId: 'premium:alpine',
          error: 'host',
        }),
      ]),
    );
  });

  it('moves nothing without the membership', () => {
    const { deps, setEntitled } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request({ followsGraph: true }));
    setEntitled(false);
    const placed = mockSurfaces.length;
    manager.setGraphLook('premium:aurora');
    expect(mockSurfaces).toHaveLength(placed);
  });
});

describe('following the graph across launches', () => {
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
        displayId: 3,
        choice: {
          lookId: 'premium:alpine',
          wave: { height: 1, position: 0 },
          motion: 'music',
          followsGraph: true,
        },
        monitor: {
          label: 'Odyssey G5',
          x: 2560,
          y: 0,
          width: 2560,
          height: 1440,
        },
      },
    ],
  });

  // The window says what the graph shows as soon as it opens, which can be
  // before the backgrounds are back: they catch up when they are.
  it('comes back following, onto what the graph moved to meanwhile', async () => {
    const { deps } = setup(remembered());
    const manager = createWallpaperManager(deps);
    await flush();
    manager.setGraphLook('premium:aurora');
    expect(mockSurfaces).toHaveLength(0);

    manager.restoreSaved();
    expect(showing(manager)).toEqual([[3, 'premium:aurora']]);
    expect(manager.state().screens[0].followsGraph).toBe(true);
  });
});

describe('who may say what the graph shows', () => {
  it('hears it only from FluidEQ’s own window, and only as a visualizer id', () => {
    const { deps, owner } = setup();
    registerWallpaperIpc(deps);
    const fromWindow = { sender: owner, senderFrame: owner.mainFrame };
    mockHandlers.get('wallpaper-start')?.(
      fromWindow,
      request({ followsGraph: true }),
    );
    const graphLook = mockMessages.get('wallpaper-graph-look');
    const lookOnMonitor = () => mockSurfaces[mockSurfaces.length - 1].lookId;

    const stranger = { mainFrame: {} };
    graphLook?.(
      { sender: stranger, senderFrame: stranger.mainFrame },
      'premium:aurora',
    );
    // A frame inside the window is not the window either.
    graphLook?.({ sender: owner, senderFrame: {} }, 'premium:aurora');
    graphLook?.(fromWindow, 'premium:../../aurora');
    graphLook?.(fromWindow, 42);
    expect(lookOnMonitor()).toBe('premium:alpine');

    // Positive control: the window itself, with a real id, moves it.
    graphLook?.(fromWindow, 'premium:aurora');
    expect(lookOnMonitor()).toBe('premium:aurora');
  });
});
