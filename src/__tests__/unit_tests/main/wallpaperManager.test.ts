/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IWallpaperChoice,
  IWallpaperStart,
} from '../../../common/wallpaper';

interface IFakeSurface {
  displayId: number;
  lookId: string;
  contents: { mainFrame: object };
  choice(): IWallpaperChoice;
  retune: jest.Mock;
  release: jest.Mock;
  applyPolicy: jest.Mock;
  fail(error: string): void;
}

const mockSurfaces: IFakeSurface[] = [];
const mockScreenListeners = new Map<string, (...args: unknown[]) => void>();
const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockMessages = new Map<string, (...args: unknown[]) => unknown>();
let mockDisplays: {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
}[] = [];

jest.mock('electron', () => ({
  app: {
    isReady: () => true,
    whenReady: () => Promise.resolve(),
    once: jest.fn(),
  },
  screen: {
    getAllDisplays: () => mockDisplays,
    getPrimaryDisplay: () => mockDisplays[0],
    dipToScreenRect: (_window: unknown, rect: unknown) => rect,
    on: (event: string, listener: (...args: unknown[]) => void) =>
      mockScreenListeners.set(event, listener),
    removeListener: jest.fn(),
  },
  powerMonitor: {
    getSystemIdleState: () => 'active',
    isOnBatteryPower: () => false,
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      mockHandlers.set(channel, handler),
    removeHandler: (channel: string) => mockHandlers.delete(channel),
    on: (channel: string, listener: (...args: unknown[]) => unknown) =>
      mockMessages.set(channel, listener),
    removeListener: jest.fn(),
  },
}));
jest.mock('../../../main/wallpaper/nativeHost', () => ({
  wallpaperHostPath: () => 'FluidEQ-Wallpaper.exe',
}));
jest.mock('../../../main/wallpaper/surface', () => ({
  createDesktopSurface: (options: {
    displayId: number;
    choice: IWallpaperChoice;
    onFail(error: string): void;
  }) => {
    let { choice } = options;
    const surface: IFakeSurface = {
      displayId: options.displayId,
      lookId: options.choice.lookId,
      contents: { mainFrame: {} },
      choice: () => choice,
      retune: jest.fn((next: IWallpaperChoice) => {
        choice = { ...choice, wave: next.wave, motion: next.motion };
      }),
      release: jest.fn(),
      applyPolicy: jest.fn(),
      fail: (error) => options.onFail(error),
    };
    Object.assign(surface, {
      scene: { pack: { version: 1, source: 'void main() {}' } },
      phase: () => 'running',
      pauseReason: () => undefined,
      owns: (contents: unknown) => contents === surface.contents,
      surfaceState: () => ({
        phase: 'running',
        renderGeneration: 1,
        ...choice,
      }),
      drawn: jest.fn(),
    });
    mockSurfaces.push(surface);
    return surface;
  },
}));

/* eslint-disable import/first -- install the mocks first */
import type { IEntitlement } from '../../../main/account/entitlement';
import type {
  IArrangementStore,
  IWallpaperArrangement,
} from '../../../main/wallpaper/arrangement';
import { createWallpaperManager } from '../../../main/wallpaper/manager';
import registerWallpaperIpc from '../../../main/wallpaper/register';
/* eslint-enable import/first */

const connect = (id: number, x: number, label: string) => ({
  id,
  label,
  bounds: { x, y: 0, width: 2560, height: 1440 },
  size: { width: 2560, height: 1440 },
  scaleFactor: 1,
});

/** Lets `app.whenReady()` settle, which is when the monitor events are heard. */
const flush = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

const setup = (stored?: IWallpaperArrangement) => {
  let entitled = true;
  const entitlementListeners = new Set<() => void>();
  let file: IWallpaperArrangement = stored ?? {
    pauseOnBattery: true,
    screens: [],
  };
  const arrangement: IArrangementStore = {
    read: () => file,
    write: jest.fn((next: IWallpaperArrangement) => {
      file = next;
    }),
  };
  const owner = {
    mainFrame: {},
    isDestroyed: () => false,
    send: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
  };
  const deps = {
    getMainWindow: () =>
      ({ isDestroyed: () => false, webContents: owner }) as never,
    entitlement: {
      status: () => ({ state: entitled ? 'active' : 'none' }),
      subscribe: (listener: () => void) => {
        entitlementListeners.add(listener);
        return () => entitlementListeners.delete(listener);
      },
    } as unknown as IEntitlement,
    arrangement,
    loadScene: (lookId: string) =>
      lookId.startsWith('premium:')
        ? {
            pack: { id: lookId, version: 1, source: 'void main() {}' },
            member: false,
          }
        : undefined,
    subscribeScenes: () => () => undefined,
  } as unknown as Parameters<typeof createWallpaperManager>[0];
  return {
    deps,
    owner,
    arrangement,
    file: () => file,
    setEntitled: (next: boolean) => {
      entitled = next;
      entitlementListeners.forEach((listener) => listener());
    },
  };
};

const request = (over: Partial<IWallpaperStart> = {}): IWallpaperStart => ({
  lookId: 'premium:alpine',
  displayIds: [2],
  pauseOnBattery: true,
  wave: { height: 1, position: 0 },
  motion: 'music',
  ...over,
});

const platform = Object.getOwnPropertyDescriptor(process, 'platform');
beforeAll(() => Object.defineProperty(process, 'platform', { value: 'win32' }));
afterAll(() => {
  if (platform) {
    Object.defineProperty(process, 'platform', platform);
  }
});

beforeEach(() => {
  mockSurfaces.length = 0;
  mockScreenListeners.clear();
  mockHandlers.clear();
  mockMessages.clear();
  mockDisplays = [
    connect(1, -2560, ''),
    connect(2, 0, 'Y27qf-30'),
    connect(3, 2560, 'Odyssey G5'),
  ];
});

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

  it('replaces what a monitor showed when another visualizer is set on it', () => {
    const { deps } = setup();
    const manager = createWallpaperManager(deps);
    manager.start(request());
    manager.start(request({ lookId: 'premium:aurora' }));
    expect(mockSurfaces).toHaveLength(2);
    expect(mockSurfaces[0].release).toHaveBeenCalled();
    expect(manager.state().screens).toEqual([
      expect.objectContaining({ lookId: 'premium:aurora' }),
    ]);
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

    mockDisplays = [
      ...mockDisplays,
      {
        id: 41,
        label: 'Portable',
        bounds: { x: 5120, y: 0, width: 1920, height: 1080 },
        size: { width: 1920, height: 1080 },
        scaleFactor: 1,
      },
    ];
    mockScreenListeners.get('display-added')?.({}, mockDisplays[3]);
    expect(mockSurfaces.map((surface) => surface.displayId)).toEqual([3, 41]);
    expect(mockSurfaces[1].choice().lookId).toBe('premium:alpine');
  });

  it('keeps an unplugged monitor’s background waiting rather than forgetting it', async () => {
    const { deps, file } = setup();
    const manager = createWallpaperManager(deps);
    await flush();
    manager.start(request({ displayIds: [3], motion: 'calm' }));
    mockDisplays = mockDisplays.filter((display) => display.id !== 3);
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
