import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  WALLPAPER,
  type IWallpaperSurfaceBridge,
  type IWallpaperSurfaceState,
} from '../common/wallpaper';

// No generic send/invoke, account, filesystem, playback, or scene-export API.
const bridge: IWallpaperSurfaceBridge = {
  platform: process.platform,
  bootstrap: () => ipcRenderer.invoke(WALLPAPER.bootstrap),
  drawn: (generation) => ipcRenderer.send(WALLPAPER.drawn, generation),
  failed: (reason) => ipcRenderer.send(WALLPAPER.failed, reason),
  requestAudio: () => ipcRenderer.invoke(WALLPAPER.requestAudio),
  onState: (listener) => {
    const receive = (_event: IpcRendererEvent, state: IWallpaperSurfaceState) =>
      listener(state);
    ipcRenderer.on(WALLPAPER.surfaceChanged, receive);
    return () => {
      ipcRenderer.removeListener(WALLPAPER.surfaceChanged, receive);
    };
  },
};
contextBridge.exposeInMainWorld('wallpaper', bridge);

if (process.platform === 'darwin') {
  // This runs in the isolated preload, not in an installed scene. Only the
  // owning WebContents' main frame can report its native occlusion state.
  const visibility = () =>
    ipcRenderer.send(
      WALLPAPER.visibility,
      document.visibilityState === 'visible',
    );
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('DOMContentLoaded', visibility, { once: true });
}
