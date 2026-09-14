/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Processes list's side of `FluidEQ-Meter.exe`
 * (`native/process-meter/src/main.cpp`): the private working set and CPU time
 * of each process the list shows, which Node has no way to read.
 *
 * The meter is started by the first question and stopped when the list says
 * it closed, the window reloads, or the app quits — its input closing is what
 * ends it, so FluidEQ ending any other way ends it too.
 *
 * Every question is answered with a measurement taken after it was asked.
 * The first version handed back the previous answer and asked for the next,
 * which is invisible to a list asking every frame and wrong for anyone else:
 * two questions a minute apart were answered with one reading from before the
 * first, and a CPU figure worked out from them described nothing. Questions
 * that arrive while one is being measured share its answer.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';

export const PROCESS_METER_EXECUTABLE =
  process.platform === 'win32' ? 'FluidEQ-Meter.exe' : undefined;

export interface IMeterReading {
  /** Task Manager's Memory column: what this process alone holds in RAM. */
  privateBytes?: number;
  workingSetBytes?: number;
  cpuSeconds?: number;
  /** The executable's file name, `FluidEQ-Wallpaper.exe`, when it could be read. */
  executable?: string;
}

const figure = (text: string | undefined): number | undefined => {
  if (text === undefined || !/^\d+$/.test(text)) {
    return undefined;
  }
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : undefined;
};

/**
 * One reply line, `pid private working cpu name;...`, as readings by pid.
 *
 * The name runs to the end of its entry, because a file name can hold spaces.
 * A malformed entry is skipped rather than failing the line: the rest of the
 * list is still true, and a dash for one process is the honest answer.
 */
export const parseMeterReply = (line: string): Map<number, IMeterReading> => {
  const readings = new Map<number, IMeterReading>();
  line
    .trim()
    .split(';')
    .forEach((entry) => {
      const [pidText, privateText, workingText, cpuText, ...nameParts] = entry
        .trim()
        .split(' ');
      const pid = figure(pidText);
      if (pid === undefined || pid === 0 || cpuText === undefined) {
        return;
      }
      const cpuTicks = figure(cpuText);
      const name = nameParts.join(' ');
      readings.set(pid, {
        privateBytes: figure(privateText),
        workingSetBytes: figure(workingText),
        cpuSeconds: cpuTicks === undefined ? undefined : cpuTicks / 1e7,
        ...(name && name !== '-' ? { executable: name } : {}),
      });
    });
  return readings;
};

export interface IProcessMeter {
  /**
   * A measurement of `pids`, and of every process `childrenOf` started, taken
   * now. Undefined when there is no meter on this machine, or it went away
   * mid-measurement, so the caller keeps Electron's own figures instead of
   * showing dashes forever.
   */
  read: (
    pids: readonly number[],
    childrenOf?: number,
  ) => Promise<ReadonlyMap<number, IMeterReading> | undefined>;
  stop: () => void;
}

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

export const findProcessMeterExecutable = (): string | undefined => {
  if (!PROCESS_METER_EXECUTABLE) {
    return undefined;
  }
  return [
    path.join(resourcesPath(), 'native', PROCESS_METER_EXECUTABLE),
    path.join(__dirname, '../../native/.build/bin', PROCESS_METER_EXECUTABLE),
    path.join(
      __dirname,
      '../../../native/.build/bin',
      PROCESS_METER_EXECUTABLE,
    ),
  ].find((candidate) => existsSync(candidate));
};

export const createProcessMeter = (
  locate: () => string | undefined = findProcessMeterExecutable,
): IProcessMeter => {
  let child: ChildProcessWithoutNullStreams | undefined;
  /** The measurement being taken, which every question asked meanwhile shares. */
  let inFlight:
    | {
        promise: Promise<ReadonlyMap<number, IMeterReading> | undefined>;
        resolve: (
          readings: ReadonlyMap<number, IMeterReading> | undefined,
        ) => void;
      }
    | undefined;
  let buffered = '';
  // Set once a start failed, so a machine without the meter stops trying on
  // every frame; cleared by `stop`, so the next opening of the list tries again.
  let unavailable = false;

  const stop = () => {
    const running = child;
    child = undefined;
    buffered = '';
    // Whoever is waiting is answered, with nothing, rather than left hanging on
    // a process that will never reply.
    inFlight?.resolve(undefined);
    inFlight = undefined;
    // Closing its input is how it is told to exit; nothing needs killing.
    running?.stdin.end();
  };

  const start = (): ChildProcessWithoutNullStreams | undefined => {
    if (child || unavailable) {
      return child;
    }
    const executable = locate();
    if (!executable) {
      unavailable = true;
      return undefined;
    }
    const started = spawn(executable, [], { windowsHide: true });
    started.stdout.setEncoding('utf8');
    started.stdout.on('data', (chunk: string) => {
      if (started !== child) {
        return;
      }
      buffered += chunk;
      const end = buffered.indexOf('\n');
      if (end < 0) {
        return;
      }
      const readings = parseMeterReply(buffered.slice(0, end));
      buffered = buffered.slice(end + 1);
      const answered = inFlight;
      inFlight = undefined;
      answered?.resolve(readings);
    });
    // An error on the stream is the process going away, which `exit` reports.
    started.stdin.on('error', () => undefined);
    started.on('error', (error) => {
      log.warn(`The process meter could not run: ${error.message}`);
      if (started === child) {
        unavailable = true;
        stop();
      }
    });
    started.on('exit', () => {
      if (started === child) {
        stop();
      }
    });
    child = started;
    return child;
  };

  return {
    read: (pids, childrenOf) => {
      if (inFlight) {
        return inFlight.promise;
      }
      const running = start();
      const asked = [
        ...pids.map(String),
        ...(childrenOf === undefined ? [] : [`c${childrenOf}`]),
      ];
      if (!running || asked.length === 0) {
        return Promise.resolve(undefined);
      }
      let answer: (
        readings: ReadonlyMap<number, IMeterReading> | undefined,
      ) => void = () => undefined;
      const promise = new Promise<
        ReadonlyMap<number, IMeterReading> | undefined
      >((resolve) => {
        answer = resolve;
      });
      inFlight = { promise, resolve: answer };
      running.stdin.write(`${asked.join(' ')}\n`);
      return promise;
    },
    stop: () => {
      unavailable = false;
      stop();
    },
  };
};
