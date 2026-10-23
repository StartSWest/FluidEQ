/* FluidEQ — GPL-3.0-or-later */
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import log from 'electron-log';
import { discoverAudioDevices } from '../audioDevices';
import type { INativeOutputMirror } from '../remoteAudioCapture';
import type { ISecondOutputs } from '../secondOutputRoute';

let stopAll: () => Promise<void> = () => Promise.resolve();
let outputSwitches = 0;
let outputsSettled = Promise.resolve();
let finishSwitches: (() => void) | undefined;
type TOutputChange = () => Promise<void>;
let retargetMain: (
  targetId: string,
  changeOutput: TOutputChange,
  afterChange?: TOutputChange,
) => Promise<void> = async (_targetId, changeOutput, afterChange) => {
  await stopAll();
  await changeOutput();
  await afterChange?.();
};
const duringOutputChange = async (work: TOutputChange) => {
  if (outputSwitches === 0) {
    outputsSettled = new Promise<void>((resolve) => {
      finishSwitches = resolve;
    });
  }
  outputSwitches += 1;
  try {
    await work();
  } finally {
    outputSwitches -= 1;
    if (outputSwitches === 0) {
      finishSwitches?.();
      finishSwitches = undefined;
    }
  }
};
export const withOutputMirrorsStopped = (changeOutput: TOutputChange) =>
  duringOutputChange(async () => {
    await stopAll();
    await changeOutput();
  });

/** Main selector: keep native streams, with the helper's stop fallback. */
export const withOutputMirrorsRetargeted = (
  targetId: string,
  changeOutput: TOutputChange,
  afterChange?: TOutputChange,
) =>
  duringOutputChange(() => retargetMain(targetId, changeOutput, afterChange));

/** Windows changed its default externally; the same routing applies. */
export const followOutputMirrorMain = (targetId: string) =>
  outputSwitches > 0
    ? Promise.resolve()
    : withOutputMirrorsRetargeted(targetId, async () => undefined);

/**
 * The window's second outputs. Which way each one plays — straight from the
 * FluidEQ Engine or as the helper's copy — is `secondOutputs`' choice, and
 * nothing the window sees.
 */
export const registerOutputMirrorIpc = (
  getWindow: () => BrowserWindow | null,
  secondOutputs: ISecondOutputs,
) => {
  const mirrors = new Map<string, INativeOutputMirror>();
  const pending = new Set<string>();
  const inFlight = new Set<Promise<void>>();
  let generation = 0;
  let owner: BrowserWindow['webContents'] | undefined;
  const reset = () => {
    const resetOwner = owner;
    generation += 1;
    const stopping = [...mirrors.values()].map((mirror) => mirror.close());
    mirrors.clear();
    pending.clear();
    return Promise.all([...stopping, ...inFlight]).then(() => {
      if (resetOwner && !resetOwner.isDestroyed()) {
        resetOwner.send('output-mirrors-reset');
      }
      return undefined;
    });
  };
  stopAll = reset;
  retargetMain = async (targetId, changeOutput, afterChange) => {
    // Already-started work settles first; new starts wait at outputsSettled.
    // There is no receiver readiness wait, only ownership of local handles.
    await Promise.all([...inFlight]);
    const devices = await discoverAudioDevices();
    const target = devices.find((device) => device.id === targetId);
    if (!target?.isActive) {
      throw new Error('The selected audio output is no longer available.');
    }
    await secondOutputs.retargetMain(target, changeOutput, afterChange);
  };
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
    async (event, token: unknown, guid: unknown, volume: unknown) => {
      authorize(event);
      if (
        typeof token !== 'string' ||
        token.length > 100 ||
        pending.has(token) ||
        mirrors.has(token) ||
        typeof guid !== 'string' ||
        !/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(
          guid,
        ) ||
        typeof volume !== 'number' ||
        !Number.isFinite(volume) ||
        volume < 0 ||
        volume > 1
      ) {
        throw new Error('Invalid second output request.');
      }
      pending.add(token);
      const startedGeneration = generation;
      // Windows can announce the new default before its switch request
      // returns. Preserved secondary selections wait for that request rather
      // than becoming permanent playback failures. These waiters cannot join
      // inFlight: stopAll waits for it before the switch can finish.
      while (outputSwitches > 0) {
        await outputsSettled;
      }
      if (!pending.has(token) || generation !== startedGeneration) {
        return false;
      }
      let finish: () => void = () => undefined;
      const completion = new Promise<void>((resolve) => {
        finish = resolve;
      });
      inFlight.add(completion);
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
        const main = devices.find(
          (candidate) => candidate.isDefault && candidate.isActive,
        );
        if (!device?.isActive || device.isDefault || !main) {
          throw new Error(
            'The second output is unavailable or is now the main output.',
          );
        }
        if (!pending.has(token) || generation !== startedGeneration) {
          return false;
        }
        const mirror = await secondOutputs.start(
          main,
          device,
          volume,
          failure,
          (milliseconds, kind) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(
                'output-mirror-delay',
                token,
                milliseconds,
                kind,
              );
            }
          },
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
