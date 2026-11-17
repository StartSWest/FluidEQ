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
  TTagFailReason,
  TTagItemAnswer,
  TTagItemState,
  TTagJobKind,
} from '../../common/library/tagFields';
import { trackIdForPath } from './libraryScanDiscovery';
import { changesTags, type ITagJobDeps, withReleased } from './tagJobDeps';
import type { IGuardedItem } from './tagRequestGuard';
import { reindexTrack } from './tagReindex';
import { renameTrackFile } from './tagRename';
import { type IUndoEntry, undoFilesOf } from './tagUndo';
import { restoreFromUndo, writeTagsToFile } from './tagWrite';

/** Jobs whose undo is kept; an older job's is let go. */
const KEPT_UNDO_JOBS = 12;

interface IJobItem extends ITagJobItem {
  /** For a write; an undo job's items carry `entry` instead. */
  source?: IGuardedItem;
  entry?: IUndoEntry;
  makeWritable: boolean;
  /** The tags are written (or put back): a retry after the rename failed
   * only renames, and never writes over what the first pass kept. */
  tagsDone?: boolean;
}

interface IJob {
  jobId: string;
  kind: TTagJobKind;
  items: IJobItem[];
  isCancelled: boolean;
  /** What Undo puts back, by song. Empty for an undo job. */
  undo: Map<string, IUndoEntry>;
  undoFolder: string;
  /** A file of this job was renamed, or named back. */
  didRename: boolean;
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

export type { ITagJobDeps };

export const createTagJobs = (deps: ITagJobDeps): ITagJobs => {
  const jobs = new Map<string, IJob>();
  /** Every write and restore, one after another. */
  let chain: Promise<void> = Promise.resolve();

  // Last session's undo can be offered by nobody.
  fs.rmSync(deps.undoRoot, { recursive: true, force: true });

  const stateOf = (job: IJob): ITagJobState => ({
    jobId: job.jobId,
    kind: job.kind,
    items: job.items.map(({ trackId, fileName, state, reason }) => ({
      trackId,
      fileName,
      state,
      ...(state === 'failed' && reason ? { reason } : {}),
    })),
    isSettled: isSettled(job),
    isCancelled: job.isCancelled,
    canUndo: job.kind === 'write' && job.undo.size > 0,
    didRename: job.didRename,
  });

  const tell = (job: IJob) => deps.send(stateOf(job));

  const removeUndoFiles = (job: IJob, entry: IUndoEntry) => {
    if (entry.tags === undefined) {
      return;
    }
    undoFilesOf(entry.tags.piece).forEach((name) => {
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

  const setState = (
    job: IJob,
    item: IJobItem,
    state: TTagItemState,
    reason?: TTagFailReason,
  ) => {
    // eslint-disable-next-line no-param-reassign -- the job's own item, owned here
    item.state = state;
    // eslint-disable-next-line no-param-reassign -- see above
    item.reason = state === 'failed' ? reason : undefined;
    tell(job);
  };

  /**
   * Renames the item's file to `fileName` and moves the song in the Library
   * after it. Answers the song's id from here on, or `undefined` once the
   * item has been told why it stopped.
   */
  const renameItem = async (
    job: IJob,
    item: IJobItem,
    filePath: string,
    fileName: string,
  ): Promise<string | undefined> => {
    const outcome = await withReleased(deps, filePath, () =>
      renameTrackFile(filePath, fileName, deps.lyricsStoreDir),
    );
    if (outcome.state === 'failed') {
      setState(job, item, 'failed', outcome.reason);
      return undefined;
    }
    if (outcome.state !== 'renamed') {
      setState(job, item, outcome.state);
      return undefined;
    }
    const fromId = item.trackId;
    if (outcome.newPath === filePath) {
      return fromId;
    }
    const toId = trackIdForPath(outcome.newPath);
    // eslint-disable-next-line no-param-reassign -- the job's own record
    job.didRename = true;
    deps.store.moveTrack(fromId, toId, outcome.newPath);
    // eslint-disable-next-line no-param-reassign -- the job's own item, which the window names by the song's id
    item.trackId = toId;
    deps.onMoved([{ from: fromId, to: toId }]);
    deps.announce();
    return toId;
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
    const fromId = item.trackId;
    if (!item.tagsDone && changesTags(source.edit)) {
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
      if (outcome.state === 'failed') {
        setState(job, item, 'failed', outcome.reason);
        return;
      }
      if (outcome.state !== 'written') {
        setState(job, item, outcome.state);
        return;
      }
      forgetOlderUndo(fromId, job);
      job.undo.set(fromId, {
        trackId: fromId,
        tags: {
          piece: outcome.piece,
          writtenSize: outcome.writtenSize,
          writtenMtimeMs: outcome.writtenMtimeMs,
        },
      });
      item.tagsDone = true;
      await reindexTrack(deps.store, fromId, deps.storeArtwork);
      deps.announce();
    }
    if (source.fileName !== undefined) {
      // An older job's Undo would name the file back from under this one.
      forgetOlderUndo(fromId, job);
      const toId = await renameItem(job, item, filePath, source.fileName);
      if (toId === undefined) {
        return;
      }
      // Renamed even where the id stays: a change of case alone keeps it,
      // the id being the lowercased path's, and Undo still names it back.
      if (deps.store.trackPath(toId) !== filePath) {
        const kept = job.undo.get(fromId);
        job.undo.delete(fromId);
        job.undo.set(toId, {
          ...kept,
          trackId: toId,
          renamedFrom: path.basename(filePath),
        });
      }
    }
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
      (candidate) => candidate.undo.get(entry.trackId) === entry,
    );
    if (source === undefined) {
      setState(job, item, 'failed');
      return;
    }
    const { tags } = entry;
    if (tags !== undefined && !item.tagsDone) {
      const outcome = await withReleased(deps, filePath, () =>
        restoreFromUndo(filePath, tags.piece, source.undoFolder, {
          size: tags.writtenSize,
          mtimeMs: tags.writtenMtimeMs,
        }),
      );
      // Changed since by somebody else: put back over it would lose their
      // edit.
      if (outcome.state === 'failed') {
        setState(job, item, 'failed', outcome.reason);
        return;
      }
      if (outcome.state !== 'restored') {
        setState(
          job,
          item,
          outcome.state === 'changed' ? 'failed' : outcome.state,
        );
        return;
      }
      item.tagsDone = true;
      removeUndoFiles(source, entry);
      await reindexTrack(deps.store, item.trackId, deps.storeArtwork);
      deps.announce();
      // Only the name is left to put back: a later Undo of this job must
      // not restore tags from the pieces just let go.
      if (entry.renamedFrom !== undefined) {
        const rest: IUndoEntry = {
          trackId: entry.trackId,
          renamedFrom: entry.renamedFrom,
        };
        source.undo.set(entry.trackId, rest);
        item.entry = rest;
      }
    }
    if (entry.renamedFrom !== undefined) {
      const { name } = path.parse(entry.renamedFrom);
      if ((await renameItem(job, item, filePath, name)) === undefined) {
        return;
      }
    }
    source.undo.delete(entry.trackId);
    tell(source);
    setState(job, item, 'written');
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
        didRename: false,
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
      // A file that failed can be tried again or let go as well: a damaged
      // tag that a second pass writes, or a copy that could not be made
      // while the drive was busy.
      if (
        found === undefined ||
        (found.item.state !== 'locked' &&
          found.item.state !== 'read-only' &&
          found.item.state !== 'failed')
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
        didRename: false,
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
