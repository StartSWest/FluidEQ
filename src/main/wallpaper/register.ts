import {
  app,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron';
import {
  WALLPAPER,
  isWallpaperStart,
  isWallpaperStop,
  type IWallpaperBootstrap,
} from '../../common/wallpaper';
import onWindowMessage from '../ipc/windowMessages';
import { createWallpaperManager, type IWallpaperDeps } from './manager';

/**
 * The desktop backgrounds' channels. The window may set and stop them; a
 * desktop surface may only ask for its own scene and the music, and report
 * that it drew or failed. Every sender is checked against the one it must be.
 */
const registerWallpaperIpc = (deps: IWallpaperDeps): (() => void) => {
  const manager = createWallpaperManager(deps);

  const fromOwner = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    event.senderFrame === event.sender.mainFrame &&
    event.sender === manager.ownerContents();
  const surfaceOf = (event: IpcMainEvent | IpcMainInvokeEvent) =>
    event.senderFrame === event.sender.mainFrame
      ? manager.surfaceFor(event.sender)
      : undefined;
  const ownerOnly =
    (handler: (raw: unknown) => void) =>
    (event: IpcMainInvokeEvent, raw: unknown) => {
      if (!fromOwner(event)) {
        throw new Error('Desktop controls belong to FluidEQ.');
      }
      handler(raw);
      return manager.state();
    };

  // The window asking for the state is the first moment it can answer the
  // monitors' audio reads, so what was set before FluidEQ last closed comes
  // back here — or later, when the membership is confirmed.
  ipcMain.handle(WALLPAPER.state, ownerOnly(manager.restoreSaved));
  ipcMain.handle(
    WALLPAPER.start,
    ownerOnly((raw) => {
      if (isWallpaperStart(raw)) {
        manager.start(raw);
      }
    }),
  );
  ipcMain.handle(
    WALLPAPER.stop,
    ownerOnly((raw) => {
      if (isWallpaperStop(raw)) {
        manager.stop(raw);
      }
    }),
  );
  ipcMain.handle(
    WALLPAPER.bootstrap,
    (event): IWallpaperBootstrap | undefined => {
      const surface = surfaceOf(event);
      if (!surface) {
        return undefined;
      }
      if (!manager.entitled()) {
        manager.failEverywhere('not-entitled');
        return undefined;
      }
      return { ...surface.scene, state: surface.surfaceState() };
    },
  );
  ipcMain.handle(WALLPAPER.requestAudio, (event) => {
    const surface = surfaceOf(event);
    if (!surface) {
      return undefined;
    }
    if (!manager.entitled()) {
      manager.failEverywhere('not-entitled');
      return undefined;
    }
    return manager.requestAudio(surface);
  });

  const cleanups = [
    onWindowMessage(WALLPAPER.audio, (event, raw: unknown) => {
      if (fromOwner(event)) {
        manager.acceptAudio(raw);
      }
    }),
    onWindowMessage(WALLPAPER.audioReady, (event) => {
      if (fromOwner(event)) {
        manager.audioReady();
      }
    }),
    onWindowMessage(WALLPAPER.failed, (event, reason: unknown) => {
      const surface = surfaceOf(event);
      if (surface) {
        manager.surfaceFailed(surface, reason);
      }
    }),
    onWindowMessage(WALLPAPER.drawn, (event, generation: unknown) => {
      const surface = surfaceOf(event);
      if (!surface) {
        return;
      }
      if (!manager.entitled()) {
        manager.failEverywhere('not-entitled');
        return;
      }
      surface.drawn(generation);
    }),
  ];

  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    manager.dispose();
    cleanups.forEach((cleanup) => cleanup());
    [
      WALLPAPER.state,
      WALLPAPER.start,
      WALLPAPER.stop,
      WALLPAPER.bootstrap,
      WALLPAPER.requestAudio,
    ].forEach((channel) => ipcMain.removeHandler(channel));
  };
  app.once('before-quit', dispose);
  return dispose;
};

export default registerWallpaperIpc;
