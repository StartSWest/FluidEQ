/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import log from 'electron-log';

/**
 * One asynchronous, coalescing writer for the files that change while a
 * slider is being dragged.
 *
 * A drag sends the main process a stream of updates, and every one of them
 * used to end in three or four `writeFileSync` calls — the state file, the
 * attached preset, the APO config and its includes — each of which stalled
 * the main process for however long the disk took, with the next update
 * already queued behind it. Nothing in the renderer waits on those writes to
 * move the thumb, but the replies it does wait on for error rollback arrived
 * late, and every other IPC in the process (device polling, the meter, the
 * DSP host) queued behind the disk too.
 *
 * Here a write is a request, not an act. The latest contents for a path
 * replace whatever was pending for it, one write is in flight per path at a
 * time, and when it lands the newest pending contents go next. A drag that
 * produces two hundred updates ends in a handful of writes, none of which
 * block anything, and the file always ends up holding the last value.
 *
 * Contents are compared before they are queued: a file whose contents have
 * not changed is not touched, which matters for the APO config because
 * Equalizer APO reloads on every write it sees.
 */

interface IPathState {
  /** What the file holds, or will hold once the in-flight write lands. */
  latest: string;
  /** Contents waiting to be written after the in-flight write, if any. */
  pending?: string;
  inFlight?: Promise<void>;
  failure?: { error: unknown };
  disk?: { mtimeMs: number; size: number };
}

const paths = new Map<string, IPathState>();
const operations = new Map<
  string,
  { pending?: () => Promise<void>; inFlight: Promise<void> }
>();

/** Observe background failures without changing the promise callers await. */
const observed = (promise: Promise<void>): Promise<void> => {
  promise.catch((error: unknown) =>
    log.error('Background file write failed', error),
  );
  return promise;
};

const drain = (filePath: string, entry: IPathState): void => {
  if (entry.inFlight || entry.pending === undefined) {
    return;
  }
  const contents = entry.pending;
  entry.pending = undefined;
  const landed = async () => {
    try {
      await fs.promises.writeFile(filePath, contents, 'utf8');
      const stat = await fs.promises.stat(filePath);
      entry.disk = { mtimeMs: stat.mtimeMs, size: stat.size };
      entry.failure = undefined;
    } catch (error) {
      // A failed write is not a saved value: identical requests must retry,
      // and callers waiting to confirm a save must receive the failure.
      entry.failure = { error };
      entry.disk = undefined;
    } finally {
      entry.inFlight = undefined;
      drain(filePath, entry);
    }
  };
  entry.inFlight = landed();
};

/**
 * Every write asked for on one path, landed. For the moment before a file is
 * deleted or renamed: a write still in flight would otherwise land after the
 * delete and quietly resurrect the file.
 */
export const settlePath = async (filePath: string): Promise<void> => {
  const entry = paths.get(filePath);
  while (entry?.inFlight) {
    // eslint-disable-next-line no-await-in-loop -- one write at a time, by design
    await entry.inFlight;
  }
  if (entry?.failure) {
    throw entry.failure.error;
  }
};

const diskIsUnchanged = (filePath: string, entry: IPathState): boolean => {
  if (!entry.disk) {
    return false;
  }
  try {
    const stat = fs.statSync(filePath);
    return stat.mtimeMs === entry.disk.mtimeMs && stat.size === entry.disk.size;
  } catch {
    return false;
  }
};

/**
 * Ask for `contents` to be the file's contents.
 *
 * Returns at once, and returns a promise that settles when this path has
 * nothing left on its way to the disk. Nothing in the app waits on it — the
 * whole point is that a drag does not — but a caller that needs the file to
 * exist before it looks at it has a way to say so without polling.
 */
export const scheduleWrite = (
  filePath: string,
  contents: string,
): Promise<void> => {
  const entry = paths.get(filePath);
  if (entry) {
    if (
      entry.latest === contents &&
      !entry.failure &&
      (entry.inFlight || diskIsUnchanged(filePath, entry))
    ) {
      return observed(settlePath(filePath));
    }
    entry.latest = contents;
    entry.pending = contents;
    drain(filePath, entry);
    return observed(settlePath(filePath));
  }
  const fresh: IPathState = { latest: contents, pending: contents };
  paths.set(filePath, fresh);
  drain(filePath, fresh);
  return observed(settlePath(filePath));
};

/**
 * The contents this writer last accepted for a path, whether or not they
 * have reached the disk yet. A reader that goes through here never sees a
 * file that is behind a write still in flight.
 */
export const peekScheduled = (filePath: string): string | undefined => {
  const entry = paths.get(filePath);
  // Once a write settles, the disk owns the truth again. Keeping the last
  // request forever hid external edits and even files that failed to save.
  return entry?.inFlight || entry?.pending !== undefined
    ? entry.latest
    : undefined;
};

/**
 * Seed the writer with what a file holds now, so the first scheduled write
 * with identical contents is skipped rather than made.
 */
export const noteOnDisk = (filePath: string, contents: string): void => {
  if (!paths.has(filePath)) {
    const stat = fs.statSync(filePath);
    paths.set(filePath, {
      latest: contents,
      disk: { mtimeMs: stat.mtimeMs, size: stat.size },
    });
  }
};

/**
 * Forget a path, for a file that has been deleted or renamed underneath the
 * writer. A later write to the same path starts fresh.
 */
export const forgetPath = (filePath: string): void => {
  paths.delete(filePath);
};

/**
 * Whether anything is still on its way to the disk. The Equalizer APO config
 * watcher asks before it reads the config back: a file the app is mid-way
 * through writing is not an external edit, and reading it as one adopted a
 * stale chain over the state — every band but the one being dragged snapped
 * back to where it had been a moment earlier.
 */
export const hasUnsettledWrites = (): boolean =>
  operations.size > 0 ||
  [...paths.values()].some(
    (entry) => entry.inFlight !== undefined || entry.pending !== undefined,
  );

/**
 * Every write that has been asked for, landed. For shutdown: the process
 * must not exit with the last slider position still in the queue.
 */
export const flushPendingWrites = async (): Promise<void> => {
  const inFlight = [...paths.values()]
    .map((entry) => entry.inFlight)
    .filter((promise): promise is Promise<void> => promise !== undefined);
  const outcomes = await Promise.allSettled([
    ...inFlight,
    ...[...operations.values()].map((entry) => entry.inFlight),
  ]);
  // A write that landed may have released a pending one; go again until
  // nothing is moving.
  if (hasUnsettledWrites()) {
    await flushPendingWrites();
  }
  const rejected = outcomes.find(
    (outcome): outcome is PromiseRejectedResult =>
      outcome.status === 'rejected',
  );
  if (rejected) {
    throw rejected.reason;
  }
  const failed = [...paths.values()].find((entry) => entry.failure);
  if (failed?.failure) {
    throw failed.failure.error;
  }
};

/** Serialize dependent config snapshots while coalescing queued slider edits.
 * The shutdown and APO watcher barriers include the whole operation, including
 * files whose writes have not started yet. */
export const scheduleWriteOperation = (
  key: string,
  work: () => Promise<void>,
): Promise<void> => {
  const existing = operations.get(key);
  if (existing) {
    existing.pending = work;
    return existing.inFlight;
  }
  const entry: { pending?: () => Promise<void>; inFlight: Promise<void> } = {
    pending: work,
    inFlight: Promise.resolve(),
  };
  operations.set(key, entry);
  const run = async () => {
    try {
      while (entry.pending) {
        const next = entry.pending;
        entry.pending = undefined;
        await next();
      }
      return undefined;
    } finally {
      operations.delete(key);
    }
  };
  entry.inFlight = Promise.resolve().then(run);
  return observed(entry.inFlight);
};
