/* FluidEQ — GPL-3.0-or-later */
import { ipcRenderer, type IpcRendererEvent } from 'electron';

export const outputMirrorBridge = {
  getOutputMirrorProfiles: (
    deviceId: string,
  ): Promise<{ current: string; names: string[] }> =>
    ipcRenderer.invoke('output-mirror-profiles', deviceId),
  startOutputMirror: (
    token: string,
    guid: string,
    mode: 'music' | 'video',
    volume: number,
  ): Promise<boolean> =>
    ipcRenderer.invoke('output-mirror-start', token, guid, mode, volume),
  stopOutputMirror: (token: string): Promise<void> =>
    ipcRenderer.invoke('output-mirror-stop', token),
  setOutputMirrorVolume: (token: string, volume: number): Promise<void> =>
    ipcRenderer.invoke('output-mirror-volume', token, volume),
  onOutputMirrorFailed: (listener: (token: string) => void) => {
    const receive = (_event: IpcRendererEvent, token: string) =>
      listener(token);
    ipcRenderer.on('output-mirror-failed', receive);
    return () => ipcRenderer.removeListener('output-mirror-failed', receive);
  },
};
