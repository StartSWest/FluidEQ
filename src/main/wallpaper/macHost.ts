import type { BrowserWindow, IpcMainEvent } from 'electron';
import { WALLPAPER } from '../../common/wallpaper';
import type { IWallpaperHost, TWallpaperHostEvent } from './nativeHost';

/**
 * Electron's Mac `desktop` window already has the desktop level,
 * CanJoinAllSpaces, Stationary and IgnoresCycle. Never raise it with an
 * always-on-top call or transform the app's process type to join Spaces:
 * that would move the wallpaper over apps or hide FluidEQ's normal Dock.
 */
const startMacWallpaperHost = (
  window: BrowserWindow,
  report: (event: TWallpaperHostEvent) => void,
): IWallpaperHost => {
  let stopped = false;
  let ordered = false;
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
      window.webContents.removeListener('ipc-message', visibility);
      if (!window.isDestroyed()) {
        window.hide();
      }
    },
  };
};

export default startMacWallpaperHost;
