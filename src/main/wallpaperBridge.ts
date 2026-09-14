import { ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  WALLPAPER,
  type IWallpaperAudio,
  type IWallpaperStart,
} from '../common/wallpaper';

/**
 * Controls belong to the app. The wallpaper receives a separate preload.
 * Main's replies are `unknown` here on purpose: the window checks their shape.
 */
const wallpaperBridge = {
  getWallpaperState: (): Promise<unknown> =>
    ipcRenderer.invoke(WALLPAPER.state),
  startWallpaper: (request: IWallpaperStart): Promise<unknown> =>
    ipcRenderer.invoke(WALLPAPER.start, request),
  /** Without ids, every monitor stops. */
  stopWallpaper: (displayIds?: number[]): Promise<unknown> =>
    ipcRenderer.invoke(WALLPAPER.stop, displayIds),
  onWallpaperState: (listener: (state: unknown) => void) => {
    const receive = (_event: IpcRendererEvent, state: unknown) =>
      listener(state);
    ipcRenderer.on(WALLPAPER.changed, receive);
    return () => {
      ipcRenderer.removeListener(WALLPAPER.changed, receive);
    };
  },
  onWallpaperAudioRequest: (listener: (requestId: number) => void) => {
    const receive = (_event: IpcRendererEvent, requestId: number) =>
      listener(requestId);
    ipcRenderer.on(WALLPAPER.readAudio, receive);
    // Only now can a read be answered, so main lets go of any sent earlier.
    ipcRenderer.send(WALLPAPER.audioReady);
    return () => {
      ipcRenderer.removeListener(WALLPAPER.readAudio, receive);
    };
  },
  sendWallpaperAudio: (requestId: number, frame: IWallpaperAudio) =>
    ipcRenderer.send(WALLPAPER.audio, { requestId, frame }),
};

export default wallpaperBridge;
