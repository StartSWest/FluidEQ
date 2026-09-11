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
import {
  IEngineHealth,
  IEngineOutputHealth,
  normaliseEndpointGuid,
} from '../common/engineHealth';

const STATUS_FILE = /^status-(\{[0-9A-Fa-f-]+\})\.json$/;

/** One file, as written — before the writing process is checked. */
export interface IEngineStatusRecord extends IEngineOutputHealth {
  pid: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

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
  return {
    endpoint: normaliseEndpointGuid(endpoint),
    pid,
    locked,
    processing,
    owner,
    problems: problems.filter(isString),
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
          return parseEngineStatus(
            await fs.promises.readFile(path.join(root, name), 'utf8'),
          );
        } catch {
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
    } catch {
      // The root does not exist yet; the next `read` tries again.
      return;
    }
    watcher.on('error', () => {
      // The root went away — an uninstall. Forget the watcher, so a later
      // `read` can start another once the engine is back.
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
