/* FluidEQ — GPL-3.0-or-later */
import type { IpcMainInvokeEvent } from 'electron';

/** A request belongs to a document, not merely to its reusable WebContents.
 * A download started by the crashed page can finish after the replacement
 * loads; it must not then restart native inference for a vanished owner.
 */
const withRendererOperation = async <T>(
  event: IpcMainInvokeEvent,
  work: (assertCurrent: () => void, signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const frame = event.senderFrame;
  const controller = new AbortController();
  const abort = () => controller.abort();
  const navigate = (
    _event: Electron.Event,
    _url: string,
    inPlace: boolean,
    mainFrame: boolean,
  ) => {
    if (mainFrame && !inPlace) {
      abort();
    }
  };
  const assertCurrent = () => {
    if (
      controller.signal.aborted ||
      !frame ||
      frame.isDestroyed() ||
      event.sender.isDestroyed() ||
      event.sender.mainFrame !== frame
    ) {
      const error = new Error('The requesting window was closed or reloaded');
      error.name = 'AbortError';
      throw error;
    }
  };
  event.sender.on('did-start-navigation', navigate);
  event.sender.on('render-process-gone', abort);
  event.sender.on('destroyed', abort);
  try {
    assertCurrent();
    return await work(assertCurrent, controller.signal);
  } finally {
    event.sender.removeListener('did-start-navigation', navigate);
    event.sender.removeListener('render-process-gone', abort);
    event.sender.removeListener('destroyed', abort);
  }
};

export default withRendererOperation;
