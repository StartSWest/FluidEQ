/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core's own process: "FluidEQ Core" in the Processes list.
 *
 * Electron starts it as a utility process (`main/coreProcess/coreClient.ts`)
 * while something needs to hear the output, and ends it when nothing does.
 * It hosts the core's sound services (`coreServices.ts`) and speaks to main
 * through its parent port (`coreWire.ts`): main says what is wanted, the core
 * answers with steps, frames and trims to write. The window's port arrives
 * here whole, and its blocks never pass through main.
 *
 * Where the native helpers are is handed in on the command line, as
 * `--native-dir=` once per folder, because this process knows nothing of how
 * the app was installed.
 */
import type { ICoreLog } from '../coreLog';
import { createPlatformSystemSoundSource } from '../platform/systemSoundSource';
import {
  createCoreServices,
  type ICorePort,
  type IHeardClock,
} from './coreServices';
import { parseToCore, type TFromCore } from './coreWire';

/** What Electron hands a utility process as `process.parentPort`. */
export interface ICoreParentPort {
  on(
    event: 'message',
    listener: (event: { data: unknown; ports: ICorePort[] }) => void,
  ): unknown;
  postMessage(message: unknown): void;
}

const NATIVE_DIR_ARGUMENT = '--native-dir=';

export const nativeDirsOf = (argv: readonly string[]): string[] =>
  argv
    .filter((argument) => argument.startsWith(NATIVE_DIR_ARGUMENT))
    .map((argument) => argument.slice(NATIVE_DIR_ARGUMENT.length))
    .filter((dir) => dir.length > 0);

/**
 * Auto normalize's trims, written by main: each asked under an id of its
 * own, and settled by main's answer to that id alone.
 */
export const createTrimRequests = (send: (message: TFromCore) => void) => {
  let lastId = 0;
  const waiting = new Map<number, (applied: boolean) => void>();
  return {
    request: (trimDb: number): Promise<boolean> =>
      new Promise((resolve) => {
        lastId += 1;
        waiting.set(lastId, resolve);
        send({ kind: 'trim', id: lastId, trimDb });
      }),
    answer: (id: number, applied: boolean) => {
      waiting.get(id)?.(applied);
      waiting.delete(id);
    },
  };
};

export const runCoreProcess = (
  parent: ICoreParentPort,
  nativeDirs: string[],
): void => {
  const send = (message: TFromCore) => parent.postMessage(message);
  const log: ICoreLog = {
    info: (message) => send({ kind: 'log', level: 'info', message }),
    warn: (message) => send({ kind: 'log', level: 'warn', message }),
    error: (message) => send({ kind: 'log', level: 'error', message }),
  };

  const trims = createTrimRequests(send);
  const services = createCoreServices({
    source: createPlatformSystemSoundSource({ nativeDirs, log }),
    log,
    applyTrim: trims.request,
  });

  const clocks = new Map<number, IHeardClock>();
  const clockFor = (id: number, secondsPerStep: number): IHeardClock => {
    const known = clocks.get(id);
    if (known) {
      return known;
    }
    const clock = services.clock({
      secondsPerStep,
      onStep: () => send({ kind: 'clock-step', id }),
      onLost: () => send({ kind: 'clock-lost', id }),
    });
    clocks.set(id, clock);
    return clock;
  };

  services.desktop.onServesChanged((serves) =>
    send({ kind: 'desktop-serves', serves }),
  );

  parent.on('message', (event) => {
    const message = parseToCore(event.data);
    if (!message) {
      return;
    }
    switch (message.kind) {
      case 'port': {
        const [port] = event.ports;
        const gone = () => send({ kind: 'port-gone', id: message.id });
        if (port) {
          services.attachWindowPort(port, gone);
        } else {
          gone();
        }
        return;
      }
      case 'desktop-want':
        services.desktop.want(message.wanted);
        return;
      case 'desktop-read':
        // Copied as it is sent: the reader overwrites its frame with the
        // next block.
        send({
          kind: 'desktop-frame',
          id: message.id,
          frame: services.desktop.read(),
        });
        return;
      case 'desktop-output-changed':
        services.desktop.outputChanged();
        return;
      case 'clock-follow':
        clockFor(message.id, message.secondsPerStep).follow(message.wanted);
        return;
      case 'clock-reset':
        clocks.get(message.id)?.reset();
        return;
      case 'headroom-follow':
        services.headroom.follow(message.state);
        return;
      case 'headroom-edited':
        services.headroom.edited();
        return;
      case 'headroom-output-changed':
        services.headroom.outputChanged();
        return;
      case 'trim-result':
        trims.answer(message.id, message.applied);
        break;
      default:
    }
  });

  // Main holds every message until this, so none reaches a process that is
  // not yet listening.
  send({ kind: 'ready' });
};

// Electron hands a utility process its parent port here; anywhere else —
// a test importing this file — there is none, and nothing starts.
const { parentPort } = process as unknown as { parentPort?: ICoreParentPort };
if (parentPort) {
  runCoreProcess(parentPort, nativeDirsOf(process.argv));
}
