/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
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

/** Directories this process has stopped writing into; see `sealDirectory`. */
const sealedDirectories = new Set<string>();

/** Windows paths name the same file whatever their case. */
const pathKey = (target: string): string => {
  const resolved = path.resolve(target);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

const isSealed = (target: string): boolean => {
  const key = pathKey(target);
  return [...sealedDirectories].some(
    (directory) => key === directory || key.startsWith(directory + path.sep),
  );
};

/**
 * Refuse every later write into `directory`, for the rest of this process.
 *
 * For quitting. Once the engine's directory has been set to "nothing to do",
 * a write still arriving from the window — the end of a drag, an automatic
 * profile following the music — would put the EQ back on an output with no
 * FluidEQ left running to take it off again. A refused write resolves at
 * once, as a write of unchanged contents does, so nothing waiting on it hangs.
 */
export const sealDirectory = (directory: string): void => {
  sealedDirectories.add(pathKey(directory));
};

/** Observe background failures without changing the promise callers await. */
const observed = (promise: Promise<void>): Promise<void> => {
  promise.catch((error: unknown) =>
    log.error('Background file write failed', error),
  );
  return promise;
};

/**
 * The codes a rename comes back with when a reader holds the file it would
 * replace. The engine's watcher opens every config file the moment anything
 * in its folder changes — this writer's own temporary file included — and a
 * plain rename cannot replace a file with a handle on it, even one opened
 * with delete sharing (EPERM). EBUSY is the same collision with a reader that
 * did not share delete at all, which is how Equalizer APO opens its files.
 */
const REPLACE_BLOCKED = new Set(['EPERM', 'EACCES', 'EBUSY']);

const errorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const { code } = error as { code: unknown };
  return typeof code === 'string' ? code : undefined;
};

/**
 * The same contents written over the file where it stands, for when the
 * rename was refused because somebody is reading it.
 *
 * Without this the refused rename was simply lost, and the last position of
 * a drag could be the one that never reached the engine: the screen said one
 * EQ and the speakers played the one before, until something else changed.
 * The engine opens with write sharing, so this succeeds where the rename
 * could not, and the write itself wakes the engine's watcher again after the
 * reader is done — the reload that follows reads the finished file. Written
 * first and cut to length after, never truncated first: an empty file is the
 * pass-through blip the rename exists to prevent.
 */
const overwriteInPlace = async (
  filePath: string,
  contents: string,
): Promise<void> => {
  const bytes = Buffer.from(contents, 'utf8');
  const handle = await fs.promises.open(filePath, 'r+');
  try {
    await handle.write(bytes, 0, bytes.length, 0);
    await handle.truncate(bytes.length);
  } finally {
    await handle.close();
  }
};

/**
 * `contents` written whole to a fresh temporary beside `filePath` — same
 * directory, so the replacement stays on the same filesystem — then handed to
 * `publish`, and the temporary removed whatever became of it.
 */
const viaTemporary = async (
  filePath: string,
  contents: string,
  publish: (temporary: string) => Promise<void>,
): Promise<void> => {
  const temporary = `${filePath}.${process.pid}-${randomUUID()}.tmp`;
  const handle = await fs.promises.open(temporary, 'wx');
  try {
    try {
      await fs.promises.writeFile(handle, contents, 'utf8');
    } finally {
      await handle.close();
    }
    await publish(temporary);
  } finally {
    await fs.promises.rm(temporary, { force: true });
  }
};

/** Publish a complete file. The native engine reads concurrently with saves;
 * truncating the live file briefly turns a device's EQ into pass-through. */
const writeAtomically = (filePath: string, contents: string): Promise<void> =>
  viaTemporary(filePath, contents, async (temporary) => {
    // Readers with an open handle finish reading the previous complete file.
    try {
      await fs.promises.rename(temporary, filePath);
    } catch (error) {
      if (!REPLACE_BLOCKED.has(errorCode(error) ?? '')) {
        throw error;
      }
      await overwriteInPlace(filePath, contents);
    }
  });

const drain = (filePath: string, entry: IPathState): void => {
  if (entry.inFlight || entry.pending === undefined) {
    return;
  }
  const contents = entry.pending;
  entry.pending = undefined;
  const landed = async () => {
    try {
      await writeAtomically(filePath, contents);
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
 * The shape `writeAtomically` gives its temporary files: the target's name,
 * then the writing process and a fresh id. Named here so the sweep below can
 * recognise one and nothing else.
 */
const TEMPORARY = /\.(\d+)-[0-9a-f-]{36}\.tmp$/i;

/**
 * Delete temporary files an earlier run of this app left in `directory`.
 *
 * Every write makes one and removes it again, so the ones that survive are
 * from a process that was killed between the two — twenty-five of them had
 * collected in one listener's engine folder over a week. They change no
 * sound: nothing reads them. They are swept because the engine opens what is
 * in that directory whenever anything there changes, and because a folder of
 * other people's litter is where a real problem goes unnoticed.
 *
 * Only this writer's own names, and never one this process is using: a
 * FluidEQ that is running owns its temporaries, and there is only ever one
 * (`engineOwnerPipe.ts`). A directory that cannot be read is not an error
 * worth failing a launch over — there was simply nothing to sweep.
 */
export const sweepAbandonedWrites = async (
  directory: string,
): Promise<number> => {
  let names: string[];
  try {
    names = await fs.promises.readdir(directory);
  } catch {
    return 0;
  }
  const mine = String(process.pid);
  const swept = await Promise.all(
    names.map(async (name) => {
      const match = TEMPORARY.exec(name);
      if (!match || match[1] === mine) {
        return 0;
      }
      try {
        await fs.promises.rm(path.join(directory, name), { force: true });
        return 1;
      } catch {
        // Somebody else has it open, or it is not ours to remove. Either way
        // the next launch tries again.
        return 0;
      }
    }),
  );
  return swept.reduce((total: number, one) => total + one, 0);
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

/**
 * Write a file now, past the queue and past any seal: the one write a sealed
 * directory still takes, which is the write the seal exists to protect.
 * Whatever was already on its way to this path lands first, so it cannot land
 * afterwards and undo this one.
 */
export const writeFileNow = async (
  filePath: string,
  contents: string,
): Promise<void> => {
  // A failed earlier write is not this write's failure.
  await settlePath(filePath).catch(() => undefined);
  await writeAtomically(filePath, contents);
  paths.delete(filePath);
};

/**
 * Replace a file whole or not at all: `writeFileNow` without the in-place
 * fallback, so a refused rename is a failed write and the file keeps what it
 * held.
 *
 * For a file nothing holds open and that is worth more intact than current.
 * The fallback exists for the engine's config files, which its watcher opens
 * the moment anything in their folder changes; the library index is tens of
 * megabytes, and a crash in the middle of writing it in place would leave half
 * a file that the next launch reads as corrupt and resets — every folder
 * somebody added, gone. A refused rename waits for the next change instead.
 */
export const replaceFileNow = async (
  filePath: string,
  contents: string,
): Promise<void> => {
  await settlePath(filePath).catch(() => undefined);
  await viaTemporary(filePath, contents, (temporary) =>
    fs.promises.rename(temporary, filePath),
  );
  paths.delete(filePath);
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
  if (isSealed(filePath)) {
    return Promise.resolve();
  }
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
 * files whose writes have not started yet.
 *
 * An operation that throws does not end the queue. It used to: the run
 * rejected and whatever had been queued behind the failure was dropped with
 * it, never written, not even at quit — a library folder removed while a
 * failed index write was on its way came back at the next launch. The promise
 * reports the last operation's outcome, because every caller here queues a
 * complete snapshot that supersedes the ones before it: a failure followed by
 * a write that landed is a file that holds the latest state. */
export const scheduleWriteOperation = (
  key: string,
  work: () => Promise<void>,
): Promise<void> => {
  // Keyed by the config directory the operation writes into.
  if (isSealed(key)) {
    return Promise.resolve();
  }
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
    let failure: { error: unknown } | undefined;
    try {
      while (entry.pending) {
        const next = entry.pending;
        entry.pending = undefined;
        try {
          await next();
          failure = undefined;
        } catch (error) {
          failure = { error };
        }
      }
    } finally {
      operations.delete(key);
    }
    if (failure) {
      throw failure.error;
    }
  };
  entry.inFlight = Promise.resolve().then(run);
  return observed(entry.inFlight);
};
