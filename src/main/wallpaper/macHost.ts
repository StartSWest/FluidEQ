import type { BrowserWindow, IpcMainEvent } from 'electron';
import { WALLPAPER } from '../../common/wallpaper';
import type { IWallpaperHost, TWallpaperHostEvent } from './nativeHost';
import macDesktopLevel from './macLevel';

/**
 * Keep the desktop type's CanJoinAllSpaces, Stationary and IgnoresCycle.
 * Electron's level setter accepts a relative Mac level: its negative
 * offset below normal windows puts the picture above the system wallpaper
 * without covering icons or apps. Never use a floating or positive level.
 */
const startMacWallpaperHost = (
  window: BrowserWindow,
  report: (event: TWallpaperHostEvent) => void,
): IWallpaperHost => {
  let stopped = false;
  let ordered = false;
  const level = macDesktopLevel();
  const place = () => {
    if (!stopped && !window.isDestroyed()) {
      window.setAlwaysOnTop(true, 'normal', level);
    }
  };
  // Showing can restore Chromium's cached window ordering. Reassert the
  // desktop level on that event, never on a timer or on every drawn frame.
  place();
  window.on('show', place);
  const visibility = (
    event: IpcMainEvent,
    channel: string,
    visible: unknown,
  ) => {
    if (
      !stopped &&
      channel === WALLPAPER.visibility &&
      event.senderFrame === window.webContents.mainFrame &&
      typeof visible === 'boolean'
    ) {
      report(visible ? 'active' : 'paused');
    }
  };
  // With background throttling enabled, macOS's real window occlusion drives
  // this event. No foreground-window polling or Accessibility access is needed.
  window.webContents.on('ipc-message', visibility);
  report('ready');
  report('active');
  return {
    setVisible: (visible) => {
      if (stopped || window.isDestroyed() || visible === ordered) {
        return;
      }
      // Own the requested show state. Native visibility can include
      // occlusion; checking it here would re-show a covered desktop window
      // every time it reported that another app stood in front of it.
      ordered = visible;
      if (visible) {
        window.showInactive();
      } else {
        window.hide();
      }
    },
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      window.removeListener('show', place);
      window.webContents.removeListener('ipc-message', visibility);
      if (!window.isDestroyed()) {
        window.hide();
      }
    },
  };
};

export default startMacWallpaperHost;
