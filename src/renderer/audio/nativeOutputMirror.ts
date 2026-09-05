/* FluidEQ — GPL-3.0-or-later */
import { reportError } from '../utils/logger';
import type { IOutputMirror, TMirrorMode } from './outputMirror';

export const startNativeMirror = async (
  guid: string,
  mode: TMirrorMode,
  volume: number,
  onFailure?: () => void,
  signal?: AbortSignal,
): Promise<IOutputMirror> => {
  const api = window.electron.ipcRenderer;
  const token = crypto.randomUUID();
  signal?.throwIfAborted();
  let stopped = false;
  let lastVolume = volume;
  const detach = api.onOutputMirrorFailed((failedToken) => {
    if (failedToken === token && !stopped) {
      stopped = true;
      detach();
      signal?.removeEventListener('abort', stop);
      onFailure?.();
    }
  });
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    detach();
    signal?.removeEventListener('abort', stop);
    api
      .stopOutputMirror(token)
      .catch((error: unknown) =>
        reportError('Could not stop second output', error),
      );
  };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    if (!(await api.startOutputMirror(token, guid, mode, volume)) || stopped) {
      throw new Error('The second output was stopped while starting.');
    }
  } catch (error) {
    stop();
    throw error;
  }
  return {
    sinkId: guid,
    mode,
    setVolume: (next) => {
      if (stopped || next === lastVolume) {
        return;
      }
      lastVolume = next;
      api
        .setOutputMirrorVolume(token, next)
        .catch((error: unknown) =>
          reportError('Could not change second output volume', error),
        );
    },
    stop,
  };
};
