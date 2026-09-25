import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IScenePerformance } from '../common/scenePerformance';
import {
  WALLPAPER,
  type IWallpaperAudio,
  type IWallpaperStart,
  type IWallpaperTuning,
} from '../common/wallpaper';

/**
 * Controls belong to the app. The wallpaper receives a separate preload.
 * Main's replies are `unknown` here on purpose: the window checks their shape.
 */
const wallpaperBridge = {
  /**
   * The window's frame rate and resolution choice for visualizers, so the
   * monitors' pages — which have no store of their own — draw by it too.
   */
  setScenePerformance: (value: IScenePerformance) =>
    ipcRenderer.send(WALLPAPER.performance, value),
  /**
   * What the listener set for each visualizer — its controls, its timing and
   * the band it is drawn in — so a monitor showing one is drawn as the window
   * draws it. The whole record, on every change.
   */
  setSceneTuning: (value: Record<string, IWallpaperTuning>) =>
    ipcRenderer.send(WALLPAPER.tuning, value),
  /**
   * The Plus visualizer the graph shows, each time it changes to another
   * one, for the monitors set to follow the graph.
   */
  setGraphLook: (lookId: string) =>
    ipcRenderer.send(WALLPAPER.graphLook, lookId),
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
