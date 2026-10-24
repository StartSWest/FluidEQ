import type { BrowserWindow } from 'electron';
import {
  startWallpaperHost,
  wallpaperHostPath,
  type IWallpaperHost,
  type TWallpaperHostEvent,
} from './nativeHost';
import startMacWallpaperHost from './macHost';

export type TDesktopHost = (
  window: BrowserWindow,
  report: (event: TWallpaperHostEvent) => void,
) => IWallpaperHost;

export const supportsDesktopWallpaper = () =>
  process.platform === 'win32' || process.platform === 'darwin';

/** Mac owns its desktop window directly; Windows attaches through Explorer. */
export const desktopHost = (): TDesktopHost | undefined => {
  if (process.platform === 'darwin') {
    return startMacWallpaperHost;
  }
  if (process.platform !== 'win32') {
    return undefined;
  }
  const executable = wallpaperHostPath();
  return executable
    ? (window, report) =>
        startWallpaperHost(executable, window.getNativeWindowHandle(), report)
    : undefined;
};
