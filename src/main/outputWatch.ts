/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The app's side of `FluidEQ-Outputs.exe` (`native/output-watch/src/main.cpp`):
 * Windows saying the outputs moved, and main reading them again when it does.
 *
 * Main used to learn about a change of output only from the window, which
 * asked for the whole list every three seconds while it was on screen — a
 * PowerShell run each time — and not at all while it was hidden or in the
 * tray. A headset plugged in then went on playing the speakers' profile until
 * somebody opened FluidEQ. Now Windows says when (an endpoint added, removed,
 * made the default, or its effects, enhancements switch, format or name
 * changed), the helper writes `outputs`, and main reads the list once for
 * however many of those lines arrived while it was reading.
 *
 * Its input closing is what ends the helper, so quitting or a crash ends it
 * too; `stop` closes it on purpose. A helper that ends by itself, or never
 * starts, is logged once and started again only on a wake-up — the window
 * being come back to, by default — never on a timer and never straight from
 * its own exit, which for a helper that cannot run would be a loop.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';
import electronLog from 'electron-log';
import coalesceRequests from '../common/coalescedRequest';
import type { IAudioDevice } from '../common/constants';
import { discoverAudioDevices } from './audioDevices';

export const OUTPUT_WATCH_EXECUTABLE =
  process.platform === 'win32' ? 'FluidEQ-Outputs.exe' : undefined;

/** The line the helper writes whenever the outputs may have moved. */
export const OUTPUTS_LINE = 'outputs';

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

/** Packaged beside the other helpers, or where `pnpm dev` built it. */
export const findOutputWatchExecutable = (): string | undefined => {
  if (!OUTPUT_WATCH_EXECUTABLE) {
    return undefined;
  }
  return [
    path.join(resourcesPath(), 'native', OUTPUT_WATCH_EXECUTABLE),
    path.join(__dirname, '../../native/.build/bin', OUTPUT_WATCH_EXECUTABLE),
    path.join(__dirname, '../../../native/.build/bin', OUTPUT_WATCH_EXECUTABLE),
  ].find((candidate) => existsSync(candidate));
};

/**
 * The window being come back to. Sound settings may have been used while it
 * was away, and that is when a helper that ended gets its next start.
 */
const onWindowFocus = (wake: () => void): (() => void) => {
  app.on('browser-window-focus', wake);
  return () => {
    app.removeListener('browser-window-focus', wake);
  };
};

type TLog = Pick<typeof electronLog, 'info' | 'warn' | 'error'>;

export interface IOutputWatchOptions {
  /**
   * A fresh reading of the outputs, after Windows said they moved: main
   * follows it and pushes it to the window (`followOutputs` in
   * `ipc/profiles.ts`). The next reading waits for this to settle.
   */
  onOutputs: (devices: IAudioDevice[]) => Promise<void> | void;
  log?: TLog;
  read?: () => Promise<IAudioDevice[]>;
  locate?: () => string | undefined;
  start?: (executable: string) => ChildProcessWithoutNullStreams;
  /** Subscribes to whatever may start an ended helper again. */
  onWake?: (wake: () => void) => () => void;
}

export interface IOutputWatch {
  stop: () => void;
}

const startHelper = (executable: string) =>
  spawn(executable, [], { windowsHide: true });

/**
 * Starts following. Windows only: elsewhere there is nothing to hear, and the
 * window's own refreshes are all there is.
 */
export const startOutputWatch = ({
  onOutputs,
  log = electronLog,
  read = discoverAudioDevices,
  locate = findOutputWatchExecutable,
  start = startHelper,
  onWake = onWindowFocus,
}: IOutputWatchOptions): IOutputWatch => {
  if (process.platform !== 'win32') {
    return { stop: () => undefined };
  }
  let child: ChildProcessWithoutNullStreams | undefined;
  let buffered = '';
  let isStopped = false;
  // Set by the first failure and cleared by a helper that has spoken since,
  // so a helper that cannot run is one line in the log, not one per wake.
  let hasLoggedTrouble = false;

  const trouble = (message: string, detail?: unknown) => {
    if (hasLoggedTrouble) {
      return;
    }
    hasLoggedTrouble = true;
    log.warn(message, ...(detail === undefined ? [] : [detail]));
  };

  // One reading on the wire and one queued, however many lines arrive: a
  // headset plugged in is an endpoint added, its state, the default for up
  // to three roles and several properties, the helper collapses only what
  // lands before it writes, and each reading is a PowerShell run of 0.6 to
  // 1.3 s. A line arriving while a reading is out may describe a change that
  // reading missed, so it queues one more rather than taking that answer
  // (`coalesceRequests`).
  const follow = coalesceRequests(async () => {
    const devices = await read();
    // Quitting: the engine's config is being put to rest (`engineQuitReset`)
    // and a switch followed now would be one more write against it.
    if (!isStopped) {
      await onOutputs(devices);
    }
  });

  const heard = (line: string) => {
    if (line.trim() !== OUTPUTS_LINE) {
      return;
    }
    hasLoggedTrouble = false;
    follow().catch((error: unknown) => {
      log.error('The outputs Windows reported could not be followed', error);
    });
  };

  const run = () => {
    if (isStopped || child) {
      return;
    }
    const executable = locate();
    if (!executable) {
      trouble(
        'The output watcher is not installed; outputs are followed only when the window reads them',
      );
      return;
    }
    let started: ChildProcessWithoutNullStreams;
    try {
      started = start(executable);
    } catch (error) {
      trouble('The output watcher could not start', error);
      return;
    }
    child = started;
    buffered = '';
    started.stdout.setEncoding('utf8');
    started.stdout.on('data', (chunk: string) => {
      if (started !== child) {
        return;
      }
      buffered += chunk;
      let end = buffered.indexOf('\n');
      while (end >= 0) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 1);
        heard(line);
        end = buffered.indexOf('\n');
      }
    });
    // A write after the helper ended would throw EPIPE here; nothing is ever
    // written, and ending the input on stop is the only use of it.
    started.stdin.on('error', () => undefined);
    const ended = (reason: string, detail?: unknown) => {
      if (started !== child) {
        return;
      }
      child = undefined;
      buffered = '';
      trouble(reason, detail);
    };
    started.on('error', (error) =>
      ended('The output watcher could not start', error),
    );
    started.on('exit', (code, signal) =>
      ended(
        `The output watcher ended (code ${String(code)}, signal ${String(
          signal,
        )}); it starts again when the window is next come back to`,
      ),
    );
  };

  const stopWaking = onWake(run);
  run();

  return {
    stop: () => {
      isStopped = true;
      stopWaking();
      const running = child;
      child = undefined;
      buffered = '';
      running?.stdin.end();
    },
  };
};
