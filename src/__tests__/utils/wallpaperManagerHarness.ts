/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IScenePerformance } from '../../common/scenePerformance';
import type {
  IWallpaperChoice,
  IWallpaperStart,
  IWallpaperTuning,
} from '../../common/wallpaper';
import type { IEntitlement } from '../../main/account/entitlement';
import type {
  IArrangementStore,
  IWallpaperArrangement,
} from '../../main/wallpaper/arrangement';
import type { IWallpaperDeps } from '../../main/wallpaper/manager';
import type { IWallpaperScene } from '../../main/wallpaper/surface';

/**
 * What the desktop background manager's suites share: Electron's screen and
 * IPC, a desktop surface that records what was asked of it, and the manager's
 * dependencies. Each suite installs the mocks itself, because a factory
 * applies only to the file that declares it:
 *
 *   jest.mock('electron', () => mockElectron());
 *   jest.mock('../../../main/wallpaper/nativeHost', () => mockNativeHost());
 *   jest.mock('../../../main/wallpaper/surface', () => mockSurfaceModule());
 */

export interface IFakeSurface {
  displayId: number;
  lookId: string;
  /** What the monitor was started with, for a case about the choice. */
  performance: IScenePerformance;
  /** What the listener had set for its look when it started. */
  tuning: IWallpaperTuning | undefined;
  applyTuning: jest.Mock;
  contents: { mainFrame: object };
  choice(): IWallpaperChoice;
  retune: jest.Mock;
  retunePerformance: jest.Mock;
  release: jest.Mock;
  applyPolicy: jest.Mock;
  fail: jest.Mock;
  /** It is on the desktop now: what it replaced may go. */
  ready(): void;
}

interface IFakeDisplay {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  size: { width: number; height: number };
  scaleFactor: number;
}

export const mockSurfaces: IFakeSurface[] = [];
export const mockScreenListeners = new Map<
  string,
  (...args: unknown[]) => void
>();
export const mockHandlers = new Map<string, (...args: unknown[]) => unknown>();
export const mockMessages = new Map<string, (...args: unknown[]) => unknown>();
let mockDisplayList: IFakeDisplay[] = [];

export const connect = (
  id: number,
  x: number,
  label: string,
  size = { width: 2560, height: 1440 },
): IFakeDisplay => ({
  id,
  label,
  bounds: { x, y: 0, ...size },
  size,
  scaleFactor: 1,
});

export const displays = () => mockDisplayList;
export const setDisplays = (next: IFakeDisplay[]) => {
  mockDisplayList = next;
};

export const mockElectron = () => ({
  app: {
    isReady: () => true,
    whenReady: () => Promise.resolve(),
    once: jest.fn(),
  },
  screen: {
    getAllDisplays: () => mockDisplayList,
    getPrimaryDisplay: () => mockDisplayList[0],
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
});

export const mockNativeHost = () => ({
  wallpaperHostPath: () => 'FluidEQ-Wallpaper.exe',
});

export const mockSurfaceModule = () => ({
  createDesktopSurface: (options: {
    displayId: number;
    choice: IWallpaperChoice;
    performance: IScenePerformance;
    tuning: IWallpaperTuning | undefined;
    onReady(): void;
    onFail(error: string): void;
  }) => {
    let { choice } = options;
    if (options.tuning?.wave) {
      choice = { ...choice, wave: options.tuning.wave };
    }
    const surface: IFakeSurface = {
      displayId: options.displayId,
      lookId: options.choice.lookId,
      performance: options.performance,
      tuning: options.tuning,
      contents: { mainFrame: {} },
      choice: () => choice,
      retune: jest.fn((next: IWallpaperChoice) => {
        choice = { ...choice, wave: next.wave, motion: next.motion };
      }),
      retunePerformance: jest.fn(),
      applyTuning: jest.fn((next: IWallpaperTuning | undefined) => {
        if (next?.wave) {
          choice = { ...choice, wave: next.wave };
        }
      }),
      release: jest.fn(),
      applyPolicy: jest.fn(),
      fail: jest.fn((error: string) => options.onFail(error)),
      ready: () => options.onReady(),
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
});

/** Lets `app.whenReady()` settle, which is when the monitor events are heard. */
export const flush = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

/** Every premium look loads; nothing else does, and nothing is refused. */
const premiumScene = (lookId: string): IWallpaperScene | undefined =>
  lookId.startsWith('premium:')
    ? ({
        pack: { id: lookId, version: 1, source: 'void main() {}' },
        member: false,
      } as unknown as IWallpaperScene)
    : undefined;

export const setup = (stored?: IWallpaperArrangement) => {
  let entitled = true;
  const entitlementListeners = new Set<() => void>();
  let file: IWallpaperArrangement = stored ?? {
    pauseOnBattery: true,
    performance: {
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'off',
    },
    tuning: {},
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
  const sceneListeners = new Set<() => void>();
  const scenes = {
    loadScene: jest.fn(premiumScene),
    subscribeScenes: jest.fn((listener: () => void) => {
      sceneListeners.add(listener);
      return () => sceneListeners.delete(listener);
    }),
    reportSceneFailure: jest.fn(),
  };
  const deps: IWallpaperDeps = {
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
    ...scenes,
  };
  return {
    deps,
    owner,
    arrangement,
    scenes,
    file: () => file,
    setEntitled: (next: boolean) => {
      entitled = next;
      entitlementListeners.forEach((listener) => listener());
    },
    /** The looks changed, as an install, an update or a refusal announces. */
    announceScenes: () => sceneListeners.forEach((listener) => listener()),
  };
};

export const request = (
  over: Partial<IWallpaperStart> = {},
): IWallpaperStart => ({
  lookId: 'premium:alpine',
  displayIds: [2],
  pauseOnBattery: true,
  wave: { height: 1, position: 0 },
  motion: 'music',
  ...over,
});

/**
 * Windows for the whole suite, where desktop backgrounds exist; and a clean
 * slate before each case, with the three monitors of the desk they were made on.
 */
export const setUpWindowsDesk = () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  beforeAll(() =>
    Object.defineProperty(process, 'platform', { value: 'win32' }),
  );
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
    setDisplays([
      connect(1, -2560, ''),
      connect(2, 0, 'Y27qf-30'),
      connect(3, 2560, 'Odyssey G5'),
    ]);
  });
};
