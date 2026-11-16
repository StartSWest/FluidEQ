/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Tag writes as jobs: one file at a time, every file's state told to the
 * window as it changes, and the files that refuse kept waiting for an
 * answer instead of failing the rest.
 *
 * One file at a time across every job, through one chain: two writes to the
 * same song at once would each copy the original and the second rename
 * would undo the first. A song playing in FluidEQ waits as `held` until the
 * window says its song ended (`release`); a file another program holds, or
 * a read-only one, waits for Retry, Skip or Make writable (`answer`).
 *
 * Undo is kept for the session in `<userData>/library-tag-undo`, emptied at
 * every launch: an Undo offered from a write the window no longer shows is
 * a button nobody can find. A song written again drops what an older job
 * kept of it — that undo would put back tags over the newer write.
 */

import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import type {
  ITagJobItem,
  ITagJobState,
  TTagItemAnswer,
  TTagItemState,
  TTagJobKind,
} from '../../common/library/tagFields';
import type { ILibraryStore } from './libraryStore';
import type { IGuardedItem } from './tagRequestGuard';
import { reindexTrack, type TStoreArtwork } from './tagReindex';
import { type IUndoEntry, undoFilesOf } from './tagUndo';
import { restoreFromUndo, writeTagsToFile } from './tagWrite';

/** Jobs whose undo is kept; an older job's is let go. */
const KEPT_UNDO_JOBS = 12;

export interface ITagJobDeps {
  store: ILibraryStore;
  undoRoot: string;
  storeArtwork: TStoreArtwork;
  /** The Library changed: the window asks again for what it shows. */
  announce: () => void;
  send: (state: ITagJobState) => void;
  /**
   * Lets go of a file FluidEQ's own player holds open but is not playing —
   * the next track, readied for a gapless start — so its tags can be
   * written, and answers what puts it back afterwards. Without it the file
   * read as "open in another program" (Ivan, 2026-11-16).
   */
  releaseFile?: (filePath: string) => Promise<() => Promise<void>>;
}

/** The player's hold let go around one write, and given back after it. */
const withReleased = async <T>(
  deps: ITagJobDeps,
  filePath: string,
  write: () => Promise<T>,
): Promise<T> => {
  const putBack = deps.releaseFile
    ? await deps.releaseFile(filePath).catch(() => undefined)
    : undefined;
  try {
    return await write();
  } finally {
    await putBack?.().catch(() => undefined);
  }
};

interface IJobItem extends ITagJobItem {
  /** For a write; an undo job's items carry `entry` instead. */
  source?: IGuardedItem;
  entry?: IUndoEntry;
  makeWritable: boolean;
}

interface IJob {
  jobId: string;
  kind: TTagJobKind;
  items: IJobItem[];
  isCancelled: boolean;
  /** What Undo puts back, by song. Empty for an undo job. */
  undo: Map<string, IUndoEntry>;
  undoFolder: string;
}

export interface ITagJobs {
  start: (items: IGuardedItem[], held: ReadonlySet<string>) => string;
  cancel: (jobId: string) => void;
  answer: (jobId: string, trackId: string, answer: TTagItemAnswer) => void;
  release: (jobId: string, trackId: string) => void;
  undo: (jobId: string) => string | undefined;
}

const newJobId = (): string =>
  `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;

const isSettled = (job: IJob): boolean =>
  job.items.every(
    (item) => item.state !== 'queued' && item.state !== 'writing',
  );

export const createTagJobs = (deps: ITagJobDeps): ITagJobs => {
  const jobs = new Map<string, IJob>();
  /** Every write and restore, one after another. */
  let chain: Promise<void> = Promise.resolve();

  // Last session's undo can be offered by nobody.
  fs.rmSync(deps.undoRoot, { recursive: true, force: true });

  const stateOf = (job: IJob): ITagJobState => ({
    jobId: job.jobId,
    kind: job.kind,
    items: job.items.map(({ trackId, fileName, state }) => ({
      trackId,
      fileName,
      state,
    })),
    isSettled: isSettled(job),
    isCancelled: job.isCancelled,
    canUndo: job.kind === 'write' && job.undo.size > 0,
  });

  const tell = (job: IJob) => deps.send(stateOf(job));

  const removeUndoFiles = (job: IJob, entry: IUndoEntry) => {
    undoFilesOf(entry.piece).forEach((name) => {
      fs.promises
        .rm(path.join(job.undoFolder, name), { force: true })
        .catch(() => undefined);
    });
  };

  /** A song written again: what older jobs kept of it no longer applies. */
  const forgetOlderUndo = (trackId: string, except: IJob) => {
    jobs.forEach((job) => {
      const entry = job.undo.get(trackId);
      if (job !== except && entry !== undefined) {
        job.undo.delete(trackId);
        removeUndoFiles(job, entry);
        tell(job);
      }
    });
  };

  const dropOldJobs = () => {
    const writes = [...jobs.values()].filter((job) => job.kind === 'write');
    writes
      .slice(0, Math.max(0, writes.length - KEPT_UNDO_JOBS))
      .forEach((job) => {
        if (isSettled(job)) {
          jobs.delete(job.jobId);
          fs.promises
            .rm(job.undoFolder, { recursive: true, force: true })
            .catch(() => undefined);
        }
      });
  };

  const setState = (job: IJob, item: IJobItem, state: TTagItemState) => {
    // eslint-disable-next-line no-param-reassign -- the job's own item, owned here
    item.state = state;
    tell(job);
  };

  const writeOne = async (job: IJob, item: IJobItem): Promise<void> => {
    const { source } = item;
    if (source === undefined) {
      return;
    }
    const filePath = deps.store.trackPath(item.trackId);
    if (filePath === undefined) {
      setState(job, item, 'missing');
      return;
    }
    setState(job, item, 'writing');
    const outcome = await withReleased(deps, filePath, () =>
      writeTagsToFile({
        filePath,
        format: source.format,
        edit: source.edit,
        durationMs: source.track.durationMs,
        undoFolder: job.undoFolder,
        undoName: `${job.items.indexOf(item)}`,
        makeWritable: item.makeWritable,
      }),
    );
    if (outcome.state !== 'written') {
      setState(job, item, outcome.state);
      return;
    }
    forgetOlderUndo(item.trackId, job);
    job.undo.set(item.trackId, {
      trackId: item.trackId,
      piece: outcome.piece,
      writtenSize: outcome.writtenSize,
      writtenMtimeMs: outcome.writtenMtimeMs,
    });
    await reindexTrack(deps.store, item.trackId, deps.storeArtwork);
    deps.announce();
    setState(job, item, 'written');
  };

  const restoreOne = async (job: IJob, item: IJobItem): Promise<void> => {
    const { entry } = item;
    const filePath = deps.store.trackPath(item.trackId);
    if (entry === undefined || filePath === undefined) {
      setState(job, item, 'missing');
      return;
    }
    setState(job, item, 'writing');
    const source = [...jobs.values()].find(
      (candidate) => candidate.undo.get(item.trackId) === entry,
    );
    if (source === undefined) {
      setState(job, item, 'failed');
      return;
    }
    const outcome = await withReleased(deps, filePath, () =>
      restoreFromUndo(filePath, entry.piece, source.undoFolder, {
        size: entry.writtenSize,
        mtimeMs: entry.writtenMtimeMs,
      }),
    );
    if (outcome.state === 'restored') {
      source.undo.delete(item.trackId);
      removeUndoFiles(source, entry);
      tell(source);
      await reindexTrack(deps.store, item.trackId, deps.storeArtwork);
      deps.announce();
      setState(job, item, 'written');
      return;
    }
    // Changed since by somebody else: put back over it would lose their edit.
    setState(job, item, outcome.state === 'changed' ? 'failed' : outcome.state);
  };

  /** Queues one item on the chain; it runs when every earlier one is done. */
  const enqueue = (job: IJob, item: IJobItem) => {
    chain = chain
      .then(async () => {
        if (job.isCancelled || item.state !== 'queued') {
          return undefined;
        }
        if (job.kind === 'write') {
          await writeOne(job, item);
        } else {
          await restoreOne(job, item);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error; the item says it failed and the chain goes on
        console.error(`Tag job ${job.jobId} failed on ${item.fileName}`, error);
        setState(job, item, 'failed');
      });
  };

  const findItem = (jobId: string, trackId: string) => {
    const job = jobs.get(jobId);
    const item = job?.items.find((candidate) => candidate.trackId === trackId);
    return job && item ? { job, item } : undefined;
  };

  return {
    start: (items, held) => {
      const jobId = newJobId();
      const job: IJob = {
        jobId,
        kind: 'write',
        isCancelled: false,
        undo: new Map(),
        undoFolder: path.join(deps.undoRoot, jobId),
        items: items.map((source) => ({
          trackId: source.track.id,
          fileName: path.basename(source.track.path),
          state: held.has(source.track.id) ? 'held' : 'queued',
          source,
          makeWritable: false,
        })),
      };
      jobs.set(jobId, job);
      dropOldJobs();
      tell(job);
      job.items.forEach((item) => {
        if (item.state === 'queued') {
          enqueue(job, item);
        }
      });
      return jobId;
    },

    cancel: (jobId) => {
      const job = jobs.get(jobId);
      if (job === undefined || (isSettled(job) && job.isCancelled)) {
        return;
      }
      job.isCancelled = true;
      job.items.forEach((item) => {
        if (item.state !== 'written' && item.state !== 'writing') {
          // eslint-disable-next-line no-param-reassign -- the job's own item
          item.state =
            item.state === 'failed' || item.state === 'missing'
              ? item.state
              : 'skipped';
        }
      });
      tell(job);
    },

    answer: (jobId, trackId, answer) => {
      const found = findItem(jobId, trackId);
      if (
        found === undefined ||
        (found.item.state !== 'locked' && found.item.state !== 'read-only')
      ) {
        return;
      }
      const { job, item } = found;
      if (answer === 'skip') {
        setState(job, item, 'skipped');
        return;
      }
      if (answer === 'make-writable') {
        if (item.state !== 'read-only') {
          return;
        }
        item.makeWritable = true;
      }
      job.isCancelled = false;
      setState(job, item, 'queued');
      enqueue(job, item);
    },

    release: (jobId, trackId) => {
      const found = findItem(jobId, trackId);
      if (found === undefined || found.item.state !== 'held') {
        return;
      }
      setState(found.job, found.item, 'queued');
      enqueue(found.job, found.item);
    },

    undo: (jobId) => {
      const source = jobs.get(jobId);
      if (
        source === undefined ||
        source.kind !== 'write' ||
        source.undo.size === 0
      ) {
        return undefined;
      }
      const undoId = newJobId();
      const entries = [...source.undo.values()];
      const job: IJob = {
        jobId: undoId,
        kind: 'undo',
        isCancelled: false,
        undo: new Map(),
        undoFolder: source.undoFolder,
        items: entries.map((entry) => {
          const filePath = deps.store.trackPath(entry.trackId) ?? '';
          return {
            trackId: entry.trackId,
            fileName: path.basename(filePath),
            state: 'queued',
            entry,
            makeWritable: false,
          };
        }),
      };
      jobs.set(undoId, job);
      tell(job);
      job.items.forEach((item) => enqueue(job, item));
      return undoId;
    },
  };
};
