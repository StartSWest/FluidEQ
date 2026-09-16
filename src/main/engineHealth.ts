/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Reading what the FluidEQ Engine says about each output.
 *
 * The engine writes `<engine root>\status-{GUID}.json` whenever it locks for
 * an output, changes what it runs there, or lets it go — see
 * `native/system-apo/src/status_file.h` for the other end, and
 * `native/system-apo/tests/status_test.cpp` for the exact text this parses.
 * Nothing here can fail loudly: a file that is missing, half-read or from a
 * shape this app does not know is an output with nothing to say, never an
 * exception out of the main process.
 */

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  IEngineHealth,
  IEngineOutputHealth,
  IFinishedSong,
  normaliseEndpointGuid,
  isRoomState,
} from '../common/engineHealth';

const STATUS_FILE = /^status-(\{[0-9A-Fa-f-]+\})\.json$/;

/**
 * A complaint about one status file, once for the life of the process.
 *
 * The directory is re-read on every change the engine makes, several times a
 * minute while music plays, and a file that cannot be read stays unreadable
 * across all of them; one line per read would bury the log a report is made
 * from under the very line meant to help. The engine rewrites the file in
 * place, so a later good read needs no reset — it simply stops complaining.
 */
const complained = new Set<string>();
const complainOnce = (name: string, message: string, error?: unknown) => {
  if (complained.has(name)) {
    return;
  }
  complained.add(name);
  if (error === undefined) {
    log.warn(message);
  } else {
    log.warn(message, error);
  }
};

/** One file, as written — before the writing process is checked. */
export interface IEngineStatusRecord extends IEngineOutputHealth {
  pid: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * The finished song an engine that levels by song reports, or undefined. A
 * malformed one is dropped on its own rather than taking the whole status
 * with it: the notice about the engine running matters more than one song.
 */
const parseFinishedSong = (value: unknown): IFinishedSong | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  const { id, level, peak, seconds } = value;
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{16}$/.test(id) ||
    !isFiniteNumber(level) ||
    !isFiniteNumber(peak) ||
    !isFiniteNumber(seconds)
  ) {
    return undefined;
  }
  return { id, levelLufs: level, peakDb: peak, seconds };
};

/**
 * A status file's text, or undefined for anything that is not a version-1
 * status with every field of the right type. Unknown extra fields are
 * ignored, so an engine that adds one does not go dark to an older app.
 */
export const parseEngineStatus = (
  text: string,
): IEngineStatusRecord | undefined => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    // Half a file cannot happen — the engine renames a finished one into
    // place — but anything else that is not JSON is simply not a status.
    return undefined;
  }
  if (!isObject(value)) {
    return undefined;
  }
  const { version, endpoint, pid, locked, processing, owner, problems } = value;
  if (
    version !== 1 ||
    typeof endpoint !== 'string' ||
    typeof pid !== 'number' ||
    !Number.isInteger(pid) ||
    typeof locked !== 'boolean' ||
    typeof processing !== 'boolean' ||
    typeof owner !== 'boolean' ||
    !Array.isArray(problems) ||
    !problems.every(isString)
  ) {
    return undefined;
  }
  const lastSong = parseFinishedSong(value.lastSong);
  // Bounded: it crosses to the window and into bug reports, and the engine's
  // own sentences are short. A longer one from some future engine is kept as
  // much of as is useful rather than dropped.
  const reason = isString(value.reason)
    ? value.reason.trim().slice(0, 200)
    : '';
  return {
    endpoint: normaliseEndpointGuid(endpoint),
    pid,
    locked,
    processing,
    owner,
    problems: problems.filter(isString),
    ...(reason ? { reason } : {}),
    ...(lastSong ? { lastSong } : {}),
    // Both from an engine with the room; a word this app does not know is
    // a state from a newer engine and is left out rather than guessed at.
    ...(typeof value.channels === 'number' &&
    Number.isInteger(value.channels) &&
    value.channels >= 0
      ? { channels: value.channels }
      : {}),
    ...(isRoomState(value.room) ? { room: value.room } : {}),
  };
};

/**
 * Whether a process is still there. Signal 0 sends nothing: it only asks.
 *
 * The engine's audio process runs as LOCAL SERVICE, which this user may not
 * open — Windows answers that with EPERM, and a process that refuses to be
 * opened is one that exists. ESRCH is the only "gone".
 */
export const isProcessAlive = (pid: number): boolean => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
};

/**
 * Every output the engine has written about, read fresh from `root`.
 *
 * `locked` is taken back when the audio process that wrote it has gone: a
 * crash or a restart of Windows' audio leaves the last file behind, and it
 * would otherwise go on saying the engine is running an output that no
 * process is running at all.
 */
export const readEngineHealth = async (
  root: string,
  isAlive: (pid: number) => boolean = isProcessAlive,
): Promise<IEngineHealth> => {
  let names: string[];
  try {
    names = await fs.promises.readdir(root);
  } catch {
    // No engine root: the engine was never installed on this machine.
    return { outputs: [] };
  }
  const records = await Promise.all(
    names
      .filter((name) => STATUS_FILE.test(name))
      .map(async (name) => {
        try {
          const text = await fs.promises.readFile(
            path.join(root, name),
            'utf8',
          );
          const record = parseEngineStatus(text);
          if (record === undefined) {
            // A status the app cannot read is an output it will call "never
            // loaded": the difference between a broken engine and a broken
            // file has to be in the log, once per file rather than per read.
            complainOnce(name, `The engine status ${name} could not be read`);
          }
          return record;
        } catch (error) {
          complainOnce(
            name,
            `The engine status ${name} could not be opened`,
            error,
          );
          return undefined;
        }
      }),
  );
  const outputs = records
    .filter((record): record is IEngineStatusRecord => record !== undefined)
    .map(({ pid, ...output }) => ({
      ...output,
      locked: output.locked && isAlive(pid),
    }))
    // Sorted so that two reads of the same files compare equal as text.
    .sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  return { outputs };
};

export interface IEngineHealthMonitor {
  /** A fresh read; also starts watching, if the root has appeared since. */
  read: () => Promise<IEngineHealth>;
  close: () => void;
}

/**
 * Tells `onChange` whenever what the engine says changes.
 *
 * Driven by the directory telling us a file changed — the engine renames a
 * finished status into place, which is a change like any other — never by
 * looking again on a clock. A root that does not exist yet is watched from
 * the first `read` after it does: the window asks at every moment the answer
 * matters (it starts, it hears sound, the engine is installed or chosen).
 */
export const createEngineHealthMonitor = (
  root: string,
  onChange: (health: IEngineHealth) => void,
  isAlive: (pid: number) => boolean = isProcessAlive,
): IEngineHealthMonitor => {
  let watcher: fs.FSWatcher | undefined;
  let closed = false;
  let last = '';
  // Reads run one after another, and are published in the order they ran.
  // Two overlapping reads could finish the wrong way round, and the window
  // would be handed an older answer after a newer one — an engine that
  // locked a moment ago reported as not running, long enough to flash a
  // notice about it.
  let tail: Promise<unknown> = Promise.resolve();
  // A read waiting for its turn. It sees every change made before it starts,
  // so a request arriving meanwhile shares it rather than queueing another:
  // a status is written aside and renamed, which is two or three changes.
  let queued: Promise<IEngineHealth> | undefined;

  const publish = (health: IEngineHealth) => {
    const text = JSON.stringify(health);
    if (text !== last) {
      last = text;
      onChange(health);
    }
  };

  const readInOrder = (): Promise<IEngineHealth> => {
    if (queued) {
      return queued;
    }
    const next = tail.then(async () => {
      // Started: a change from here on needs a read after this one.
      queued = undefined;
      const health = await readEngineHealth(root, isAlive);
      if (!closed) {
        publish(health);
      }
      return health;
    });
    queued = next;
    tail = next.catch(() => undefined);
    return next;
  };

  const ensureWatching = () => {
    if (watcher || closed) {
      return;
    }
    try {
      watcher = fs.watch(root, (_event, name) => {
        if (typeof name === 'string' && !STATUS_FILE.test(name)) {
          return; // The engine's log and configuration live here too.
        }
        readInOrder().catch(() => undefined);
      });
    } catch (error) {
      // The root does not exist yet — the next `read` tries again — and that
      // is silent. Anything else means the engine's statuses will only ever
      // be seen when the window asks, never as they change: worth a line.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        complainOnce(
          'watch',
          "The engine's status folder could not be watched",
          error,
        );
      }
      return;
    }
    watcher.on('error', (error) => {
      // The root went away — an uninstall. Forget the watcher, so a later
      // `read` can start another once the engine is back.
      log.warn("The engine's status folder stopped being watchable", error);
      watcher?.close();
      watcher = undefined;
    });
  };

  return {
    read: () => {
      ensureWatching();
      return readInOrder();
    },
    close: () => {
      closed = true;
      watcher?.close();
      watcher = undefined;
    },
  };
};
