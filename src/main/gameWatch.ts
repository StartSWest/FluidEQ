/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The app's side of `FluidEQ-Games.exe`
 * (`native/foreground-watch/src/main.cpp`): which program Windows has just
 * put in front, and which programs are open.
 *
 * It runs only while there is something to match — the window says when —
 * and its input closing is what ends it, so quitting, a crash or the window
 * reloading ends it too. Nothing is left at logon and nothing polls.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import log from 'electron-log';
import { IGameProgram } from '../common/games';

export const GAME_WATCH_EXECUTABLE =
  process.platform === 'win32' ? 'FluidEQ-Games.exe' : undefined;

export interface IGameWatchEvent {
  kind: 'front';
  program: IGameProgram;
}

/**
 * One record from the watcher, or nothing.
 *
 * The fields are tab-separated and the path is last, because a path holds
 * spaces and a game's own description holds anything at all. A name it could
 * not read leaves the file's own name, which is what the player sees in Task
 * Manager; a rectangle it could not read is left out rather than guessed, and
 * the card about the game then goes to the screen the pointer is on.
 */
export const parseGameWatchLine = (
  line: string,
):
  { kind: 'front' | 'open' | 'listed'; program?: IGameProgram } | undefined => {
  const record = line.replace(/\r$/, '');
  if (record === 'listed') {
    return { kind: 'listed' };
  }
  const [kind, pid, third, ...rest] = record.split('\t');
  if ((kind !== 'front' && kind !== 'open') || rest.length === 0) {
    return undefined;
  }
  // The rectangle joined the record after the first watcher shipped, and a
  // packaged app can be newer than the helper beside it for as long as it
  // takes to install one. A third field that is not a rectangle is the name,
  // as it was, rather than a record thrown away.
  const hasRect = /^-?\d+(,-?\d+){3}$/.test(third);
  const rect = hasRect ? third : undefined;
  const name = hasRect ? (rest[0] ?? '') : third;
  const file = (hasRect ? rest.slice(1) : rest).join('\t');
  if (!/^\d+$/.test(pid) || file === '') {
    return undefined;
  }
  return {
    kind,
    program: {
      name: name.trim() || path.basename(file).replace(/\.exe$/i, ''),
      path: file,
      source: 'running',
      ...(rect ? { rect } : {}),
    },
  };
};

const resourcesPath = (): string => {
  const { resourcesPath: found } = process as NodeJS.Process & {
    resourcesPath?: string;
  };
  return typeof found === 'string' ? found : '';
};

export const findGameWatchExecutable = (): string | undefined => {
  if (!GAME_WATCH_EXECUTABLE) {
    return undefined;
  }
  return [
    path.join(resourcesPath(), 'native', GAME_WATCH_EXECUTABLE),
    path.join(__dirname, '../../native/.build/bin', GAME_WATCH_EXECUTABLE),
    path.join(__dirname, '../../../native/.build/bin', GAME_WATCH_EXECUTABLE),
  ].find((candidate) => existsSync(candidate));
};

export interface IGameWatch {
  /** Start watching, or keep watching; the front program arrives at once. */
  start: () => void;
  stop: () => void;
  /** Every program with a window, now. Starts the watcher if it is stopped. */
  running: () => Promise<IGameProgram[]>;
  isWatching: () => boolean;
}

export const createGameWatch = (
  onFront: (program: IGameProgram) => void,
  locate: () => string | undefined = findGameWatchExecutable,
): IGameWatch => {
  let child: ChildProcessWithoutNullStreams | undefined;
  let buffered = '';
  /** The list being gathered, and who is waiting for it. */
  let gathering: IGameProgram[] | undefined;
  let waiting: ((programs: IGameProgram[]) => void)[] = [];
  // Set once a start failed, so a machine without the watcher is not asked
  // again on every keystroke; cleared by `stop`, so the next visit tries.
  let unavailable = false;

  const settle = (programs: IGameProgram[]) => {
    const answered = waiting;
    waiting = [];
    gathering = undefined;
    answered.forEach((resolve) => resolve(programs));
  };

  const stop = () => {
    const running = child;
    child = undefined;
    buffered = '';
    settle([]);
    // Closing its input is how it is told to go; nothing needs killing.
    running?.stdin.end();
  };

  const take = (line: string) => {
    const record = parseGameWatchLine(line);
    if (!record) {
      return;
    }
    if (record.kind === 'front' && record.program) {
      onFront(record.program);
      return;
    }
    if (record.kind === 'open' && record.program && gathering) {
      gathering.push(record.program);
      return;
    }
    if (record.kind === 'listed') {
      settle(gathering ?? []);
    }
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
      let end = buffered.indexOf('\n');
      while (end >= 0) {
        take(buffered.slice(0, end));
        buffered = buffered.slice(end + 1);
        end = buffered.indexOf('\n');
      }
    });
    started.stdin.on('error', () => undefined);
    started.on('error', (error) => {
      log.info('The game watcher could not start', error);
      unavailable = true;
      if (started === child) {
        stop();
      }
    });
    started.on('exit', () => {
      if (started === child) {
        child = undefined;
        buffered = '';
        settle([]);
      }
    });
    child = started;
    return started;
  };

  return {
    start: () => {
      unavailable = false;
      start();
    },
    stop,
    isWatching: () => child !== undefined,
    running: () => {
      unavailable = false;
      const started = start();
      if (!started) {
        return Promise.resolve([]);
      }
      return new Promise<IGameProgram[]>((resolve) => {
        waiting.push(resolve);
        if (gathering === undefined) {
          gathering = [];
          started.stdin.write('list\n');
        }
      });
    },
  };
};
