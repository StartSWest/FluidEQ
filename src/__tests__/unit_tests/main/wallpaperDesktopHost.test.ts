/** @jest-environment node */
import type { BrowserWindow } from 'electron';
import {
  desktopHost,
  supportsDesktopWallpaper,
} from 'main/wallpaper/desktopHost';
import startMacWallpaperHost from 'main/wallpaper/macHost';
import {
  startWallpaperHost,
  wallpaperHostPath,
} from 'main/wallpaper/nativeHost';

jest.mock('main/wallpaper/nativeHost', () => ({
  startWallpaperHost: jest.fn(),
  wallpaperHostPath: jest.fn(),
}));
jest.mock('main/wallpaper/macHost', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const originalPlatform = process.platform;
afterAll(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);
beforeEach(() => jest.clearAllMocks());

it('uses Mac desktop support without finding or spawning a Windows helper', () => {
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  expect(supportsDesktopWallpaper()).toBe(true);
  expect(desktopHost()).toBe(startMacWallpaperHost);
  expect(wallpaperHostPath).not.toHaveBeenCalled();
});

it('keeps the Windows native handle and helper attachment unchanged', () => {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  jest.mocked(wallpaperHostPath).mockReturnValue('FluidEQ-Wallpaper.exe');
  const handle = Buffer.alloc(8);
  const window = {
    getNativeWindowHandle: () => handle,
  } as unknown as BrowserWindow;
  const report = jest.fn();
  expect(supportsDesktopWallpaper()).toBe(true);
  desktopHost()?.(window, report);
  expect(startWallpaperHost).toHaveBeenCalledWith(
    'FluidEQ-Wallpaper.exe',
    handle,
    report,
  );
  jest.mocked(wallpaperHostPath).mockReturnValue(undefined);
  expect(desktopHost()).toBeUndefined();
});

it('does not enable an unsupported desktop platform', () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  expect(supportsDesktopWallpaper()).toBe(false);
  expect(desktopHost()).toBeUndefined();
  expect(wallpaperHostPath).not.toHaveBeenCalled();
});
