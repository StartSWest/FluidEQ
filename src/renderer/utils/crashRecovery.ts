/* FluidEQ — GPL-3.0-or-later */
import ChannelEnum from 'common/channels';

let failure: Error | undefined;
let automaticRequested = false;
const listeners = new Set<(error: Error) => void>();

export const getRendererFailure = () => failure;

export const captureRendererFailure = (reason: unknown) => {
  // Cancellation is an expected outcome of leaving a screen or stopping work.
  if (reason instanceof Error && reason.name === 'AbortError') {
    return;
  }
  if (failure) {
    return;
  }
  failure = reason instanceof Error ? reason : new Error(String(reason));
  const error = failure;
  listeners.forEach((listener) => listener(error));
};

export const onRendererFailure = (listener: (error: Error) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const requestWindowRecovery = (automatic: boolean): boolean => {
  if (automatic && automaticRequested) {
    return true;
  }
  automaticRequested = true;
  try {
    window.electron.ipcRenderer.sendMessage(ChannelEnum.RECOVER_WINDOW, [
      automatic ? 'automatic' : 'manual',
    ]);
    return true;
  } catch (error) {
    // A missing preload cannot ask main to recover. Keep the fallback visible.
    // eslint-disable-next-line no-console -- last-resort sink when the logging bridge itself is missing
    console.error('Could not request window recovery', error);
    return false;
  }
};
