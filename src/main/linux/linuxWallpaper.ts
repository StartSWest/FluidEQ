/* FluidEQ — GPL-3.0-or-later */
import { app, type Display } from 'electron';
import { existsSync } from 'fs';
import path from 'path';
import { toWallpaperDisplays } from '../wallpaper/displays';

/** GNOME owns Wayland's desktop layer; its companion must host the canvas. */
export const linuxWallpaperSupported = (): boolean =>
  process.platform === 'linux' &&
  (process.env.XDG_CURRENT_DESKTOP ?? '').split(':').includes('GNOME') &&
  Boolean(process.env.DISPLAY?.trim()) &&
  (app.commandLine.getSwitchValue('ozone-platform') ||
    process.env.ELECTRON_OZONE_PLATFORM_HINT) === 'x11';

export const linuxWallpaperHostPath = (): string | undefined =>
  [
    path.join(process.resourcesPath, 'native/linux-wallpaper/host.js'),
    path.join(app.getAppPath(), 'native/linux/wallpaper/host.js'),
    path.join(__dirname, '../../../native/linux/wallpaper/host.js'),
  ].find((candidate) => existsSync(candidate));

export const linuxWallpaperDisplays = (
  displays: readonly Display[],
  primary: Display,
) =>
  // XWayland presents one coordinate space. Chromium scales that whole space
  // by its device scale, unlike Windows' per-monitor DIP origins. Main still
  // gives every surface its original Electron bounds for window creation.
  toWallpaperDisplays(displays, primary.id, (rect) => ({
    ...rect,
    x: Math.round(rect.x * primary.scaleFactor),
    y: Math.round(rect.y * primary.scaleFactor),
  }));
