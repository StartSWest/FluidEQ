/* FluidEQ — GPL-3.0-or-later */
import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TOutputDelayKind } from '../common/outputDelay';

export const outputMirrorBridge = {
  getOutputMirrorProfiles: (
    deviceId: string,
  ): Promise<{ current: string; names: string[] }> =>
    ipcRenderer.invoke('output-mirror-profiles', deviceId),
  startOutputMirror: (
    token: string,
    guid: string,
    volume: number,
  ): Promise<boolean> =>
    ipcRenderer.invoke('output-mirror-start', token, guid, volume),
  stopOutputMirror: (token: string): Promise<void> =>
    ipcRenderer.invoke('output-mirror-stop', token),
  setOutputMirrorVolume: (token: string, volume: number): Promise<void> =>
    ipcRenderer.invoke('output-mirror-volume', token, volume),
  /** A format/engine teardown needs new tokens; a main retarget does not. */
  onOutputMirrorsReset: (listener: () => void) => {
    ipcRenderer.on('output-mirrors-reset', listener);
    return () => {
      ipcRenderer.removeListener('output-mirrors-reset', listener);
    };
  },
  onOutputMirrorFailed: (listener: (token: string) => void) => {
    const receive = (_event: IpcRendererEvent, token: string) =>
      listener(token);
    ipcRenderer.on('output-mirror-failed', receive);
    return () => ipcRenderer.removeListener('output-mirror-failed', receive);
  },
  /** How far behind each running mirror plays, in milliseconds, about twice
   * a second (`mirror_control.h`). */
  onOutputMirrorDelay: (
    listener: (
      token: string,
      milliseconds: number,
      kind?: TOutputDelayKind,
    ) => void,
  ) => {
    const receive = (
      _event: IpcRendererEvent,
      token: string,
      milliseconds: number,
      kind?: TOutputDelayKind,
    ) => listener(token, milliseconds, kind);
    ipcRenderer.on('output-mirror-delay', receive);
    return () => ipcRenderer.removeListener('output-mirror-delay', receive);
  },
};
