import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  WALLPAPER,
  type IWallpaperSurfaceBridge,
  type IWallpaperSurfaceState,
} from '../common/wallpaper';

// No generic send/invoke, account, filesystem, playback, or scene-export API.
const bridge: IWallpaperSurfaceBridge = {
  bootstrap: () => ipcRenderer.invoke(WALLPAPER.bootstrap),
  drawn: (generation) => ipcRenderer.send(WALLPAPER.drawn, generation),
  failed: () => ipcRenderer.send(WALLPAPER.failed),
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
