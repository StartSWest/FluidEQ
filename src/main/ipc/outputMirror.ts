/* FluidEQ — GPL-3.0-or-later */
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';
import { discoverAudioDevices } from '../audioDevices';
import {
  startNativeOutputMirror,
  type INativeOutputMirror,
} from '../remoteAudioCapture';

let stopAll: () => Promise<void> = () => Promise.resolve();
let outputSwitches = 0;
export const withOutputMirrorsStopped = async (
  changeOutput: () => Promise<void>,
) => {
  outputSwitches += 1;
  try {
    await stopAll();
    await changeOutput();
  } finally {
    outputSwitches -= 1;
  }
};

export const registerOutputMirrorIpc = (
  getWindow: () => BrowserWindow | null,
) => {
  const mirrors = new Map<string, INativeOutputMirror>();
  const pending = new Set<string>();
  const inFlight = new Set<Promise<void>>();
  let generation = 0;
  let owner: BrowserWindow['webContents'] | undefined;
  const reset = () => {
    generation += 1;
    const stopping = [...mirrors.values()].map((mirror) => mirror.close());
    mirrors.clear();
    pending.clear();
    return Promise.all([...stopping, ...inFlight]).then(() => undefined);
  };
  stopAll = reset;
  const authorize = (event: IpcMainInvokeEvent) => {
    const window = getWindow();
    if (
      !window ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    ) {
      throw new Error('Second output request came from an unknown window.');
    }
    if (owner !== event.sender) {
      reset();
      owner = event.sender;
      owner.on('render-process-gone', reset);
      owner.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
        if (mainFrame && !inPlace) {
          reset();
        }
      });
      owner.once('destroyed', reset);
    }
  };
  ipcMain.handle(
    'output-mirror-start',
    async (
      event,
      token: unknown,
      guid: unknown,
      mode: unknown,
      volume: unknown,
    ) => {
      authorize(event);
      if (outputSwitches > 0) {
        return false;
      }
      if (
        typeof token !== 'string' ||
        token.length > 100 ||
        pending.has(token) ||
        mirrors.has(token) ||
        typeof guid !== 'string' ||
        !/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(
          guid,
        ) ||
        (mode !== 'music' && mode !== 'video') ||
        typeof volume !== 'number' ||
        !Number.isFinite(volume) ||
        volume < 0 ||
        volume > 1
      ) {
        throw new Error('Invalid second output request.');
      }
      pending.add(token);
      let finish: () => void = () => undefined;
      const completion = new Promise<void>((resolve) => {
        finish = resolve;
      });
      inFlight.add(completion);
      const startedGeneration = generation;
      let failed = false;
      const failure = () => {
        failed = true;
        mirrors.get(token)?.close();
        mirrors.delete(token);
        if (!event.sender.isDestroyed()) {
          event.sender.send('output-mirror-failed', token);
        }
      };
      try {
        const devices = await discoverAudioDevices();
        const device = devices.find(
          (candidate) => candidate.guid.toLowerCase() === guid.toLowerCase(),
        );
        if (!device?.isActive || device.isDefault) {
          throw new Error(
            'The second output is unavailable or is now the main output.',
          );
        }
        if (!pending.has(token) || generation !== startedGeneration) {
          return false;
        }
        const mirror = await startNativeOutputMirror(
          guid,
          mode,
          volume,
          failure,
        );
        if (failed || !pending.has(token) || generation !== startedGeneration) {
          await mirror.close();
          return false;
        }
        mirrors.set(token, mirror);
        return true;
      } finally {
        pending.delete(token);
        inFlight.delete(completion);
        finish();
      }
    },
  );
  ipcMain.handle('output-mirror-stop', async (event, token: unknown) => {
    authorize(event);
    if (typeof token !== 'string') {
      return;
    }
    pending.delete(token);
    const stopping = mirrors.get(token)?.close();
    mirrors.delete(token);
    await stopping;
  });
  ipcMain.handle(
    'output-mirror-volume',
    async (event, token: unknown, volume: unknown) => {
      authorize(event);
      if (
        typeof token !== 'string' ||
        typeof volume !== 'number' ||
        !Number.isFinite(volume) ||
        volume < 0 ||
        volume > 1
      ) {
        throw new Error('Invalid second output volume.');
      }
      try {
        await mirrors.get(token)?.setVolume(volume);
      } catch (error) {
        log.error('Second output volume failed', error);
        mirrors.get(token)?.close();
        mirrors.delete(token);
        event.sender.send('output-mirror-failed', token);
        throw error;
      }
    },
  );
  return reset;
};
