/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Everything the core makes of the output's sound, whichever process hosts
 * it: the window's live displays (blocks down a port the window handed
 * over), the desktop backgrounds' frames, the clocks the song memories count
 * time with, and Auto normalize on Equalizer APO. One hearing feeds them all
 * (`systemSound.ts`), and it runs only while one of them listens.
 *
 * Its own process hosts it (`coreProcess.ts`); where none can be started —
 * a test, a platform whose hearing lives in main — main hosts the same
 * services directly (`main/coreProcess/coreClient.ts`).
 */
import type { TSystemSoundMessage } from '../../common/systemSound';
import type { ICoreLog } from '../coreLog';
import { createApoHeadroom, type IApoHeadroom } from '../headroom/apoHeadroom';
import {
  createDesktopSound,
  type IDesktopSound,
} from '../liveFrames/desktopSound';
import createHeardClock from '../systemSound/heardClock';
import {
  createSystemSound,
  type ISystemSoundSource,
} from '../systemSound/systemSound';

/** A port the window handed over: Electron's on either side of a process. */
export interface ICorePort {
  postMessage(message: unknown): void;
  on(event: 'close', listener: () => void): unknown;
  start(): void;
  close(): void;
}

/** A clock counted by the sound heard (`heardClock.ts`). */
export interface IHeardClock {
  /** Count while `isWanted`, and stop when it is not. */
  follow(isWanted: boolean): void;
  /** Nothing can hear the output: no step comes until `reset`. */
  isLost(): boolean;
  /** The output changed: it may be heard again. */
  reset(): void;
}

/** A clock that steps once per `secondsPerStep` of sound heard. */
export type TCreateHeardClock = (options: {
  secondsPerStep: number;
  onStep: () => void;
  onLost: () => void;
}) => IHeardClock;

export interface ICoreServices {
  /** Blocks down the window's port until it closes; `gone` when it has. */
  attachWindowPort(port: ICorePort, gone: () => void): void;
  desktop: IDesktopSound;
  clock: TCreateHeardClock;
  headroom: IApoHeadroom;
}

export const createCoreServices = ({
  source,
  log,
  applyTrim,
}: {
  source: ISystemSoundSource | undefined;
  log: ICoreLog;
  /** Write Auto normalize's trim through main; whether it landed. */
  applyTrim: (trimDb: number) => Promise<boolean>;
}): ICoreServices => {
  const systemSound = createSystemSound(source);

  /**
   * The window's port: the port's own end is the window letting go — a
   * capture stopped, a reload, a crash all close it — and the last listener
   * to go stops the hearing.
   */
  const attachWindowPort = (port: ICorePort, gone: () => void) => {
    let isOpen = true;
    let hasBeenHeard = false;
    let stopListening: (() => void) | undefined;
    const close = () => {
      if (!isOpen) {
        return;
      }
      isOpen = false;
      stopListening?.();
      port.close();
      gone();
    };
    const post = (message: TSystemSoundMessage) => {
      if (!isOpen) {
        return;
      }
      try {
        port.postMessage(message);
      } catch (error) {
        log.error(
          `The live capture port closed during delivery: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        close();
      }
    };
    port.on('close', close);
    port.start();
    const stop = systemSound.listen({
      ready: () => {
        hasBeenHeard = true;
        post({ kind: 'ready' });
      },
      audio: (block) => post({ kind: 'push', ...block }),
      lost: () => {
        post({ kind: hasBeenHeard ? 'lost' : 'failed' });
        close();
      },
    });
    // `lost` can arrive inside `listen` itself — no way to hear on this
    // platform — and the port is closed by then, with nothing yet to stop.
    if (isOpen) {
      stopListening = stop;
    } else {
      stop();
    }
  };

  return {
    attachWindowPort,
    desktop: createDesktopSound(systemSound),
    clock: (options) => createHeardClock({ systemSound, ...options }),
    headroom: createApoHeadroom({ systemSound, applyTrim }),
  };
};
