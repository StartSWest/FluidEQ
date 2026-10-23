/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The FluidEQ Engine for Linux, as a child of this app.
 *
 * On Windows the engine lives inside the audio service and FluidEQ serves a
 * pipe so the engine can tell when FluidEQ has gone (`engineOwnerPipe.ts`).
 * Here the engine is FluidEQ's own child, holding the other end of a pipe
 * this process opened for it (`--owner-fd 3`): FluidEQ quitting, crashing or
 * being killed closes that pipe, and the engine gives the listener's output
 * back as the default and stops. `--exit-with-parent` is the same promise
 * from the kernel's side. Nothing outlives FluidEQ shaping the sound.
 *
 * The same pipe carries the app's requests, a line each (`output <name>`).
 *
 * An engine that ends on its own is started again — by its exit, never by a
 * clock — at most `MAX_RESTARTS` times a session, and never when it said
 * why it cannot run (no sound server, already running for this user).
 */

import { spawn, type ChildProcess } from 'child_process';
import type { Writable } from 'stream';
import electronLog from 'electron-log';
import { findLinuxEngineExecutable } from './linuxEngineFiles';

/** The engine's own exit codes (`native/linux/engine/main.cpp`). */
const EXIT_NO_SOUND_SERVER = 2;
const EXIT_ALREADY_RUNNING = 3;
const MAX_RESTARTS = 3;

type TLog = Pick<typeof electronLog, 'info' | 'warn' | 'error'>;

export interface ILinuxEngine {
  /** Starts the engine if it is not running. False when there is none to start. */
  start: () => boolean;
  /** Stops it and waits for it to have given the default output back. */
  stop: () => Promise<void>;
  /** Stops and starts it: the Linux "restart audio". */
  restart: () => Promise<boolean>;
  /** Asks it to play to the output the sound server calls `name`. */
  selectOutput: (name: string) => boolean;
  isRunning: () => boolean;
  /** Why the last engine could not run, for the window; empty when it runs. */
  trouble: () => string;
}

export interface ILinuxEngineOptions {
  log?: TLog;
  locate?: () => string | undefined;
  launch?: (executable: string) => ChildProcess;
}

const launchEngine = (executable: string): ChildProcess =>
  spawn(executable, ['--owner-fd', '3', '--exit-with-parent'], {
    // stdin and stdout unused; stderr to the log; fd 3 is the owner pipe.
    stdio: ['ignore', 'ignore', 'pipe', 'pipe'],
  });

export const createLinuxEngine = ({
  log = electronLog,
  locate = findLinuxEngineExecutable,
  launch = launchEngine,
}: ILinuxEngineOptions = {}): ILinuxEngine => {
  let child: ChildProcess | undefined;
  let owner: Writable | undefined;
  let exited: Promise<void> = Promise.resolve();
  let stopping = false;
  let restarts = 0;
  let trouble = '';

  const start = (): boolean => {
    if (child) {
      return true;
    }
    const executable = locate();
    if (!executable) {
      trouble = 'FluidEQ-Engine is not where FluidEQ was installed';
      log.error(`Linux engine: ${trouble}.`);
      return false;
    }
    stopping = false;
    const running = launch(executable);
    child = running;
    owner = running.stdio[3] as Writable | undefined;
    // A write to an engine that has just ended is a closed pipe; the exit
    // below is what reports it.
    owner?.on('error', () => undefined);
    let stderr = '';
    running.stderr?.on('data', (chunk: Buffer | string) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-2000);
    });
    running.on('error', (error) => {
      trouble = error.message;
      log.error(`Linux engine could not start: ${error.message}`);
    });
    exited = new Promise((resolve) => {
      running.on('exit', (code, signal) => {
        if (child === running) {
          child = undefined;
          owner = undefined;
        }
        resolve();
        const said = stderr.trim().split('\n').pop() ?? '';
        if (stopping) {
          log.info('Linux engine stopped.');
          return;
        }
        trouble = said || `ended (${signal ?? `code ${code}`})`;
        log.warn(`Linux engine ended by itself: ${trouble}`);
        if (code === EXIT_NO_SOUND_SERVER || code === EXIT_ALREADY_RUNNING) {
          return;
        }
        if (restarts < MAX_RESTARTS) {
          restarts += 1;
          log.info(
            `Linux engine: starting it again (${restarts} of ${MAX_RESTARTS}).`,
          );
          start();
        }
      });
    });
    trouble = '';
    log.info(`Linux engine started (pid ${running.pid ?? '?'}): ${executable}`);
    return true;
  };

  const stop = async (): Promise<void> => {
    if (!child) {
      return;
    }
    stopping = true;
    // The end of the owner pipe is the engine's cue: it hands the default
    // output back before it goes, which is why this waits for its exit.
    owner?.end();
    await exited;
  };

  return {
    start,
    stop,
    restart: async () => {
      await stop();
      restarts = 0;
      return start();
    },
    selectOutput: (name: string) => {
      if (!owner || name.includes('\n')) {
        return false;
      }
      owner.write(`output ${name}\n`);
      return true;
    },
    isRunning: () => child !== undefined,
    trouble: () => trouble,
  };
};

let shared: ILinuxEngine | undefined;

/** The one engine this app runs. */
export const linuxEngine = (): ILinuxEngine => {
  shared ??= createLinuxEngine();
  return shared;
};
