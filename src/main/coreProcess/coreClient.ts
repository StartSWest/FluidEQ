/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main's hold on the core's sound services (`core/process/coreServices.ts`),
 * hosted in the core's own process — "FluidEQ Core" — while anything needs
 * to hear the output: the window's live displays, a desktop background
 * following the music, a song memory counting time, Auto normalize on
 * Equalizer APO. With none of those, the process is not running at all, so
 * a FluidEQ sitting in the tray holds no core.
 *
 * Main keeps what is wanted and hands it over whenever a process starts, so
 * a core that started late, or started again after a crash, picks up where
 * the last one was. What crosses is small (`coreWire.ts`): a clock's step, a
 * desktop frame asked for, a trim to write. The window's port is handed
 * across whole.
 *
 * A core that keeps ending by itself is let go after `MAX_RESTARTS`: its
 * clocks say they are lost (the window's players then tick them), the desktop
 * backgrounds go back to the window, and a window's port is told it failed.
 */
import type { MessagePortMain } from 'electron';
import type { ICoreLog } from '../../core/coreLog';
import type {
  IApoHeadroom,
  IApoHeadroomState,
} from '../../core/headroom/apoHeadroom';
import {
  createDesktopFrameReader,
  type IDesktopFrame,
} from '../../core/liveFrames/desktopFrames';
import type { IDesktopSound } from '../../core/liveFrames/desktopSound';
import type {
  ICoreServices,
  IHeardClock,
} from '../../core/process/coreServices';
import { parseFromCore, type TToCore } from '../../core/process/coreWire';

/** The desktop backgrounds' music, as main sees it (`desktopSound.ts`). */
export interface IDesktopSoundClient {
  want(wanted: boolean): void;
  outputChanged(): void;
  serves(): boolean;
  /** The newest frame, made where it is asked for. */
  read(): Promise<IDesktopFrame>;
  onServesChanged(listener: (serves: boolean) => void): () => void;
}

export interface ICoreClient {
  attachWindowPort(port: MessagePortMain): void;
  desktopSound: IDesktopSoundClient;
  createClock(options: {
    secondsPerStep: number;
    onStep: () => void;
    onLost: () => void;
  }): IHeardClock;
  apoHeadroom: IApoHeadroom;
  close(): void;
}

/** What main needs of Electron's `UtilityProcess`. */
export interface ICoreChild {
  postMessage(message: TToCore, transfer?: MessagePortMain[]): void;
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  kill(): boolean;
}

/** Restarts of a core that ended by itself, in one session, before it is let go. */
export const MAX_RESTARTS = 3;

/** The core's desktop sound as main reads it, in the same process. */
export const desktopSoundClientOf = (
  desktop: IDesktopSound,
): IDesktopSoundClient => ({
  want: (wanted) => desktop.want(wanted),
  outputChanged: () => desktop.outputChanged(),
  serves: () => desktop.serves(),
  read: () => Promise.resolve(desktop.read()),
  onServesChanged: (listener) => desktop.onServesChanged(listener),
});

/** The same services in main itself, for where no process can be started. */
export const createLocalCoreClient = (
  services: ICoreServices,
): ICoreClient => ({
  attachWindowPort: (port) => services.attachWindowPort(port, () => undefined),
  desktopSound: desktopSoundClientOf(services.desktop),
  createClock: (options) => services.clock(options),
  apoHeadroom: services.headroom,
  close: () => undefined,
});

interface IClockEntry {
  secondsPerStep: number;
  wanted: boolean;
  onStep: () => void;
  onLost: () => void;
}

export const createProcessCoreClient = ({
  fork,
  applyTrim,
  log,
}: {
  fork: () => ICoreChild;
  applyTrim: (trimDb: number) => Promise<boolean>;
  log: ICoreLog;
}): ICoreClient => {
  let child: ICoreChild | undefined;
  let isReady = false;
  let restarts = 0;
  let isBroken = false;
  let isClosed = false;
  let lastId = 0;
  const nextId = () => {
    lastId += 1;
    return lastId;
  };

  const ports = new Map<number, MessagePortMain>();
  /** Handed over once the process is listening. */
  const waitingPorts = new Map<number, MessagePortMain>();
  let isDesktopWanted = false;
  let desktopServes = true;
  const servesListeners = new Set<(serves: boolean) => void>();
  const clocks = new Map<number, IClockEntry>();
  /** Clocks that cannot hear the output until they are reset. */
  const lostClocks = new Set<number>();
  let headroom: IApoHeadroomState | undefined;
  const reads = new Map<number, (frame: IDesktopFrame) => void>();
  const silence = createDesktopFrameReader().read();

  const isNeeded = () =>
    !isClosed &&
    !isBroken &&
    (ports.size > 0 ||
      (isDesktopWanted && desktopServes) ||
      [...clocks].some(([id, clock]) => clock.wanted && !lostClocks.has(id)) ||
      headroom?.enabled === true);

  const sendNow = (message: TToCore) => {
    if (child && isReady) {
      child.postMessage(message);
    }
  };

  const tellServes = (serves: boolean) => {
    if (serves !== desktopServes) {
      desktopServes = serves;
      servesListeners.forEach((listener) => listener(serves));
    }
  };

  /** Everything a fresh process has to be told, in one go. */
  const handOver = (to: ICoreChild) => {
    if (isDesktopWanted && desktopServes) {
      to.postMessage({ kind: 'desktop-want', wanted: true });
    }
    clocks.forEach((clock, id) => {
      if (clock.wanted && !lostClocks.has(id)) {
        to.postMessage({
          kind: 'clock-follow',
          id,
          secondsPerStep: clock.secondsPerStep,
          wanted: true,
        });
      }
    });
    if (headroom?.enabled) {
      to.postMessage({ kind: 'headroom-follow', state: headroom });
    }
    waitingPorts.forEach((port, id) => {
      to.postMessage({ kind: 'port', id }, [port]);
    });
    waitingPorts.clear();
  };

  /** Every read still waiting is answered with silence: none will come. */
  const answerReadsWithSilence = () => {
    reads.forEach((resolve) => resolve(silence));
    reads.clear();
  };

  const loseClock = (id: number) => {
    const clock = clocks.get(id);
    if (clock && !lostClocks.has(id)) {
      lostClocks.add(id);
      clock.onLost();
    }
  };

  const giveUp = () => {
    isBroken = true;
    log.error(
      `The core ended by itself ${restarts} times; the window hears the output itself from now.`,
    );
    waitingPorts.forEach((port) => {
      port.postMessage({ kind: 'failed' });
      port.close();
    });
    waitingPorts.clear();
    ports.clear();
    tellServes(false);
    clocks.forEach((clock, id) => {
      if (clock.wanted) {
        loseClock(id);
      }
    });
  };

  /**
   * One message from the process; whether what is needed changed with it,
   * so the caller settles the process again.
   */
  const receive = (from: ICoreChild, raw: unknown): boolean => {
    const message = parseFromCore(raw);
    if (from !== child || !message) {
      return false;
    }
    switch (message.kind) {
      case 'ready':
        isReady = true;
        handOver(from);
        return false;
      case 'log':
        log[message.level](`Core: ${message.message}`);
        return false;
      case 'port-gone':
        ports.delete(message.id);
        return true;
      case 'desktop-frame':
        reads.get(message.id)?.(message.frame);
        reads.delete(message.id);
        return false;
      case 'desktop-serves':
        tellServes(message.serves);
        return true;
      case 'clock-step':
        clocks.get(message.id)?.onStep();
        return false;
      case 'clock-lost':
        loseClock(message.id);
        return true;
      case 'trim':
        applyTrim(message.trimDb)
          .catch(() => false)
          .then((applied) => {
            if (child === from) {
              from.postMessage({
                kind: 'trim-result',
                id: message.id,
                applied,
              });
            }
            return undefined;
          })
          .catch(() => undefined);
        return false;
      default:
        return false;
    }
  };

  /** A process that has ended: whether it is to be started again. */
  const ended = (from: ICoreChild, code: number, wasDismissed: boolean) => {
    if (from !== child) {
      return false;
    }
    child = undefined;
    isReady = false;
    answerReadsWithSilence();
    // Its ports died with it; the window hears that as its port closing.
    ports.clear();
    if (wasDismissed) {
      return false;
    }
    restarts += 1;
    log.warn(`The core ended by itself (code ${code}).`);
    if (restarts > MAX_RESTARTS) {
      giveUp();
      return false;
    }
    return true;
  };

  /** Ended by main, so its exit is no crash. */
  const dismissed = new WeakSet<ICoreChild>();

  /** The process runs exactly while something needs it. */
  const settle = (): void => {
    if (!isNeeded()) {
      if (child) {
        const ending = child;
        dismissed.add(ending);
        ended(ending, 0, true);
        ending.kill();
      }
      return;
    }
    if (child) {
      return;
    }
    let started: ICoreChild;
    try {
      started = fork();
    } catch (error) {
      restarts += 1;
      log.error(
        `The core could not start: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      if (restarts > MAX_RESTARTS) {
        giveUp();
      }
      return;
    }
    child = started;
    isReady = false;
    started.on('message', (raw) => {
      if (receive(started, raw)) {
        settle();
      }
    });
    started.on('exit', (code) => {
      if (ended(started, code, dismissed.has(started))) {
        settle();
      }
    });
  };

  return {
    attachWindowPort: (port) => {
      if (isBroken || isClosed) {
        port.postMessage({ kind: 'failed' });
        port.close();
        return;
      }
      const id = nextId();
      ports.set(id, port);
      settle();
      if (child && isReady) {
        child.postMessage({ kind: 'port', id }, [port]);
      } else {
        waitingPorts.set(id, port);
      }
    },

    desktopSound: {
      want: (wanted) => {
        isDesktopWanted = wanted;
        sendNow({ kind: 'desktop-want', wanted });
        settle();
      },
      outputChanged: () => {
        if (child && isReady) {
          sendNow({ kind: 'desktop-output-changed' });
          return;
        }
        // A process that starts now hears afresh, as the core's own
        // `outputChanged` would have it.
        if (!isBroken) {
          tellServes(true);
          settle();
        }
      },
      serves: () => desktopServes,
      read: () => {
        if (!child || !isReady) {
          return Promise.resolve(silence);
        }
        const id = nextId();
        return new Promise((resolve) => {
          reads.set(id, resolve);
          sendNow({ kind: 'desktop-read', id });
        });
      },
      onServesChanged: (listener) => {
        servesListeners.add(listener);
        return () => {
          servesListeners.delete(listener);
        };
      },
    },

    createClock: ({ secondsPerStep, onStep, onLost }) => {
      const id = nextId();
      const clock: IClockEntry = {
        secondsPerStep,
        wanted: false,
        onStep,
        onLost,
      };
      clocks.set(id, clock);
      if (isBroken) {
        lostClocks.add(id);
      }
      return {
        follow: (isWanted) => {
          clock.wanted = isWanted;
          if (!lostClocks.has(id)) {
            sendNow({
              kind: 'clock-follow',
              id,
              secondsPerStep,
              wanted: isWanted,
            });
          }
          settle();
        },
        isLost: () => lostClocks.has(id),
        reset: () => {
          if (isBroken) {
            return;
          }
          lostClocks.delete(id);
          sendNow({ kind: 'clock-reset', id });
        },
      };
    },

    apoHeadroom: {
      follow: (state) => {
        headroom = state;
        sendNow({ kind: 'headroom-follow', state });
        settle();
      },
      edited: () => sendNow({ kind: 'headroom-edited' }),
      outputChanged: () => sendNow({ kind: 'headroom-output-changed' }),
    },

    close: () => {
      isClosed = true;
      settle();
    },
  };
};
