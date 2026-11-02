/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One monitor's background drawn by the C++ host, on the rules its page
 * kept: placed behind the icons only once the scene has a frame, by the
 * host's own process; a frame of a scene already replaced ignored; paused
 * where the monitor is covered with the picture held; the listener's
 * performance and the battery told to the host as they change; and a failure
 * of the scene on the monitor failing the surface, one of a replaced scene
 * not.
 */

import { DEFAULT_SCENE_PERFORMANCE } from '../../../common/scenePerformance';
import type { TWallpaperCover } from '../../../common/wallpaper';
import type {
  IDesktopHost,
  IDesktopMonitor,
  IDesktopMonitorEvents,
} from '../../../main/wallpaper/desktopHost';
import type { IMonitorDrawChoice } from '../../../main/wallpaper/desktopHostWire';
import { startWallpaperHost } from '../../../main/wallpaper/nativeHost';
import { createNativeDesktopSurface } from '../../../main/wallpaper/nativeSurface';
import type { IScenePack } from '../../../common/scenePacks';

jest.mock('electron-log', () => ({ warn: jest.fn(), info: jest.fn() }));
jest.mock('../../../main/wallpaper/nativeHost', () => ({
  startWallpaperHost: jest.fn(),
}));

const startHelper = startWallpaperHost as jest.MockedFunction<
  typeof startWallpaperHost
>;

const pack = {
  id: 'aurora',
  source: 'void main() { fragColor = vec4(uLevel); }',
  params: [],
} as unknown as IScenePack;

interface IFakeMonitor extends IDesktopMonitor {
  shown: { id: number; measured: boolean }[];
  chosen: IMonitorDrawChoice[];
  paused: boolean[];
  closed: number;
}

const fakeHost = () => {
  let events: IDesktopMonitorEvents | undefined;
  let opened: IMonitorDrawChoice | undefined;
  const monitor: IFakeMonitor = {
    shown: [],
    chosen: [],
    paused: [],
    closed: 0,
    show: (id, _scene, measured) => monitor.shown.push({ id, measured }),
    daylight: () => undefined,
    choose: (choice) => monitor.chosen.push(choice),
    pause: (paused) => monitor.paused.push(paused),
    close: () => {
      monitor.closed += 1;
    },
    pid: () => 4242,
  };
  const host: IDesktopHost = {
    open: (_rect, choice, told) => {
      opened = choice;
      events = told;
      return monitor;
    },
    pid: () => 4242,
  };
  const told = () => {
    if (!events) {
      throw new Error('the monitor was never opened');
    }
    return events;
  };
  return { host, monitor, told, opened: () => opened };
};

const helper = () => {
  const visible: boolean[] = [];
  const stop = jest.fn();
  let say: (
    event: Parameters<Parameters<typeof startWallpaperHost>[2]>[0],
  ) => void = () => undefined;
  startHelper.mockImplementation((_executable, _handle, onEvent) => {
    say = onEvent;
    return { setVisible: (shown) => visible.push(shown), stop };
  });
  return {
    visible,
    stop,
    say: (event: Parameters<typeof say>[0]) => say(event),
  };
};

const surfaceOf = (
  host: IDesktopHost,
  extra: {
    madeBy?: 'fluideq' | 'member';
    battery?: () => boolean;
    pause?: (cover: TWallpaperCover) => 'covered' | 'battery' | undefined;
  } = {},
) => {
  const onFail = jest.fn();
  const onReady = jest.fn();
  const surface = createNativeDesktopSurface({
    displayId: 7,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    choice: {
      lookId: 'aurora',
      wave: { height: 1, position: 0 },
      motion: 'music',
    },
    scene: { pack, madeBy: extra.madeBy ?? 'fluideq' },
    performance: DEFAULT_SCENE_PERFORMANCE,
    tuning: undefined,
    daylight: () => undefined,
    executable: 'FluidEQ-Wallpaper.exe',
    pauseReason:
      extra.pause ?? ((cover) => (cover === 'none' ? undefined : 'covered')),
    onReady,
    onChange: jest.fn(),
    onFail,
    rect: { x: 0, y: 0, width: 1920, height: 1080 },
    host,
    onBattery: extra.battery ?? (() => false),
  });
  return { surface, onFail, onReady };
};

beforeEach(() => {
  startHelper.mockReset();
});

describe('a background drawn by the C++ host', () => {
  it("is placed once its scene has a frame, as the host's own window", () => {
    const fake = fakeHost();
    helper();
    const { surface } = surfaceOf(fake.host);
    expect(surface.drawnBy).toBe('host');
    expect(fake.monitor.shown).toEqual([{ id: 1, measured: true }]);
    fake.told().window(BigInt(0x1234));
    expect(startHelper).not.toHaveBeenCalled();
    fake.told().drawn(1);
    expect(startHelper).toHaveBeenCalledTimes(1);
    const [executable, handle, , owner] = startHelper.mock.calls[0];
    expect(executable).toBe('FluidEQ-Wallpaper.exe');
    expect(handle.readBigUInt64LE()).toBe(BigInt(0x1234));
    // The helper checks the window belongs to the process that drew it.
    expect(owner).toBe(4242);
  });

  it("climbs a member's scene, and draws FluidEQ's own from the top", () => {
    const fake = fakeHost();
    helper();
    surfaceOf(fake.host, { madeBy: 'member' });
    expect(fake.monitor.shown).toEqual([{ id: 1, measured: false }]);
    expect(fake.opened()).toEqual({
      autoFloor: 0.35,
      fsr: true,
      smoothing: 'best',
      paceMs: 0,
    });
  });

  it('ignores a frame of a scene already replaced', () => {
    const fake = fakeHost();
    helper();
    const { surface } = surfaceOf(fake.host);
    fake.told().window(BigInt(1));
    surface.changeScene(
      { lookId: 'other', wave: { height: 1, position: 0 }, motion: 'music' },
      { pack, madeBy: 'member' },
      undefined,
    );
    expect(fake.monitor.shown[1]).toEqual({ id: 2, measured: false });
    fake.told().drawn(1);
    expect(startHelper).not.toHaveBeenCalled();
    fake.told().drawn(2);
    expect(startHelper).toHaveBeenCalledTimes(1);
  });

  it('pauses the host where the monitor is covered, and holds the picture', () => {
    const fake = fakeHost();
    const placed = helper();
    const { surface, onReady } = surfaceOf(fake.host);
    fake.told().window(BigInt(1));
    fake.told().drawn(1);
    placed.say('ready');
    placed.say('paused');
    expect(surface.phase()).toBe('paused');
    expect(fake.monitor.paused).toEqual([true]);
    expect(placed.visible[placed.visible.length - 1]).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    placed.say('active');
    expect(surface.phase()).toBe('running');
    expect(fake.monitor.paused).toEqual([true, false]);
  });

  it('takes the picture off only to save the battery', () => {
    const fake = fakeHost();
    const placed = helper();
    surfaceOf(fake.host, { pause: () => 'battery' });
    fake.told().window(BigInt(1));
    fake.told().drawn(1);
    placed.say('ready');
    placed.say('active');
    expect(placed.visible[placed.visible.length - 1]).toBe(false);
  });

  it('tells the host the choice again when the battery or the listener moves it', () => {
    const fake = fakeHost();
    helper();
    let battery = false;
    const { surface } = surfaceOf(fake.host, { battery: () => battery });
    surface.applyPolicy();
    expect(fake.monitor.chosen).toEqual([]);
    battery = true;
    surface.applyPolicy();
    expect(fake.monitor.chosen[fake.monitor.chosen.length - 1]?.paceMs).toBe(
      1000 / 60,
    );
    surface.retunePerformance({
      ...DEFAULT_SCENE_PERFORMANCE,
      resolution: 'performance',
    });
    expect(fake.monitor.chosen[fake.monitor.chosen.length - 1]).toMatchObject({
      pinned: 0.5,
    });
    expect(fake.monitor.chosen).toHaveLength(2);
  });

  it('fails with the scene on the monitor, not with one already replaced', () => {
    const fake = fakeHost();
    helper();
    const { surface, onFail } = surfaceOf(fake.host);
    surface.changeScene(
      { lookId: 'other', wave: { height: 1, position: 0 }, motion: 'music' },
      { pack, madeBy: 'fluideq' },
      undefined,
    );
    fake.told().failed(1, 'compile', 'old');
    expect(onFail).not.toHaveBeenCalled();
    fake.told().failed(0, 'lost', 'the GPU was reset');
    expect(onFail).toHaveBeenCalledWith('renderer');
    expect(fake.monitor.closed).toBe(1);
  });

  it('closes the monitor and stops the helper when released', () => {
    const fake = fakeHost();
    const placed = helper();
    const { surface } = surfaceOf(fake.host);
    fake.told().window(BigInt(1));
    fake.told().drawn(1);
    surface.release();
    surface.release();
    expect(fake.monitor.closed).toBe(1);
    expect(placed.stop).toHaveBeenCalledTimes(1);
  });
});
