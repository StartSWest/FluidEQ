/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import { app, ipcMain, type BrowserWindow } from 'electron';
import type { IModerationStatus } from '../../common/plusModeration';
import {
  readReviewAnswer,
  type IReviewItem,
  type ISceneSubmission,
} from '../../common/plusReview';
import {
  sceneReviewNotice,
  waitingKeys,
  type TSceneReviewNotice,
} from '../../common/sceneReviewNotice';
import type { IScenePack } from '../../common/scenePacks';
import { openMemberEnvelope } from '../memberScenes/sharing';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';
import { moderationStatus } from '../plus/moderationApi';
import { createReviewNoticeSeen } from '../plus/reviewNoticeSeen';
import {
  answerSubmission,
  fetchSubmissionEnvelope,
  fetchSubmissionPicture,
  mySubmissions,
  reviewQueue,
  type TReviewAnswerFailure,
  type TReviewFailure,
} from '../plus/reviewApi';

/**
 * Scenes under review, over IPC (server migration 0037): the admin's queue,
 * the waiting scene itself to watch, the answer; a maker's list of what they
 * sent; and the corner notice that tells either of them there is news.
 *
 * Offering any of it is a courtesy. Who the admin is and who may read a file
 * that waits is the server's to say on every call, and an answer names the
 * version and the bytes the admin watched, so a scene sent again meanwhile is
 * never approved in the place of the one on screen.
 *
 * The notice is decided here (`common/sceneReviewNotice.ts`) from what the
 * server said at the last event — launch, the membership changing, somebody
 * coming back to the computer — and what this computer already told the
 * account. There is no clock: news waits for the next time somebody is here
 * to read it, which is the only time it could be read.
 */

export type TReviewQueueOutcome =
  { ok: true; items: IReviewItem[] } | { ok: false; reason: TReviewFailure };

export type TReviewSceneOutcome =
  | { ok: true; pack: IScenePack }
  | { ok: false; reason: TReviewFailure | 'changed' };

export type TReviewAnswerOutcome =
  { ok: true } | { ok: false; reason: TReviewAnswerFailure };

export type TMySubmissionsOutcome =
  | { ok: true; submissions: ISceneSubmission[] }
  | { ok: false; reason: TReviewFailure };

/** What crosses to the window: the notice, and the admin's queue length. */
export interface ISceneReviewState {
  accountId?: string;
  notice: TSceneReviewNotice | null;
  /** Scenes waiting for the admin as last asked; absent for a member. */
  waiting?: number;
}

export interface IPlusReviewIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  access: IGalleryAccess;
  /** An approval put a scene in the gallery: its lists are asked again. */
  onGalleryChanged: () => Promise<void>;
  /** Signing in and out, and a membership changing, all arrive here. */
  onAccountChange: (listener: () => void) => () => void;
  logger?: { warn(message: string, ...details: unknown[]): void };
}

export interface IPlusReviewRegistration {
  /** Somebody is at the machine: ask the server unless it was just asked. */
  refreshIfDue(reason: string): Promise<void>;
  /**
   * Something this app did moved what waits — a publication sent, a scene
   * deleted — so the server is asked again now, after any read already under
   * way.
   */
  refreshNow(): Promise<void>;
  dispose(): void;
}

/**
 * How long one answer from the server stands for the notice. Waking the
 * computer, unlocking it and the window coming forward arrive together; one
 * ask covers the burst. Checked when an event arrives — never a timer.
 */
const ASKED_WITHIN_MS = 60 * 1000;

/** The hash that names a waiting submission's bytes and its folder. */
const SHA256 = /^[0-9a-f]{64}$/;

const CHANNELS = [
  'plus-review-queue',
  'plus-review-scene',
  'plus-review-picture',
  'plus-review-answer',
  'plus-my-submissions',
  'scene-review-notice',
  'scene-review-notice-seen',
] as const;

interface IFacts {
  accountId: string;
  status?: IModerationStatus;
  waiting?: IReviewItem[];
  mine?: ISceneSubmission[];
}

export const registerPlusReviewIpc = ({
  getMainWindow,
  userDataDir,
  access,
  onGalleryChanged,
  onAccountChange,
  logger,
}: IPlusReviewIpcDeps): IPlusReviewRegistration => {
  const seen = createReviewNoticeSeen(userDataDir);
  // Put away this session. The file is the record that outlives it, but a
  // disk that refuses the write must not leave the notice on screen after
  // somebody closed it.
  const seenNow = new Map<string, Set<string>>();
  let facts: IFacts | undefined;
  let askedAt = 0;
  let asking: Promise<void> | undefined;
  let sent = '';
  // Every read of the queue is numbered as it STARTS, and the queue kept is
  // the one read last: a slow read begun before an answer must not finish
  // after the queue opened since and put the answered scene back.
  let reads = 0;
  let queueRead = 0;

  /** The token for this account, and nothing once a different one signs in. */
  const authFor = async (me: string | undefined) => {
    const auth = me ? await access.auth() : undefined;
    return auth && access.accountId() === me ? auth : undefined;
  };

  const seenBy = (accountId: string) =>
    new Set([...seen.read(accountId), ...(seenNow.get(accountId) ?? [])]);

  const markSeen = (accountId: string, keys: readonly string[]) => {
    const now = seenNow.get(accountId) ?? new Set<string>();
    keys.forEach((key) => now.add(key));
    seenNow.set(accountId, now);
    try {
      seen.add(accountId, keys);
    } catch (error) {
      logger?.warn('Scene review news could not be remembered', error);
    }
  };

  const state = (): ISceneReviewState => {
    const me = access.accountId();
    if (!me || facts?.accountId !== me) {
      return { notice: null };
    }
    const notice = sceneReviewNotice({
      ...(facts.waiting ? { waiting: facts.waiting } : {}),
      ...(facts.mine ? { mine: facts.mine } : {}),
      seen: seenBy(me),
      now: Date.now(),
    });
    return {
      accountId: me,
      notice: notice ?? null,
      ...(facts.status?.admin ? { waiting: facts.status.review } : {}),
    };
  };

  // Sent only when it changed: most events change nothing.
  const announce = () => {
    const current = state();
    const serialised = JSON.stringify(current);
    if (serialised === sent) {
      return;
    }
    sent = serialised;
    getMainWindow()?.webContents.send('scene-review-notice-changed', current);
  };

  const ask = async () => {
    reads += 1;
    const read = reads;
    const me = access.accountId();
    const auth = await authFor(me);
    if (!me || !auth) {
      facts = undefined;
      return;
    }
    const [status, mine] = await Promise.all([
      moderationStatus(auth),
      mySubmissions(auth),
    ]);
    // The queue is read only when there is something in it to name.
    const queue =
      status.ok && status.status.admin && status.status.review > 0
        ? await reviewQueue(auth)
        : undefined;
    if (access.accountId() !== me) {
      return;
    }
    // What this read learnt of the queue: empty by the count, or the list.
    let freshWaiting: IReviewItem[] | undefined;
    if (status.ok && status.status.admin) {
      if (status.status.review === 0) {
        freshWaiting = [];
      } else if (queue?.ok) {
        freshWaiting = queue.rows;
      }
    }
    // A failed read keeps what was known rather than telling somebody the
    // news they already had again, or taking it away because the network
    // blinked; so does a read the open queue has overtaken.
    const kept = facts?.accountId === me ? facts : undefined;
    const overtaken = kept?.waiting !== undefined && queueRead > read;
    let nextStatus = status.ok ? status.status : kept?.status;
    if (overtaken && nextStatus && kept.waiting) {
      // The list the admin opened since is the count too.
      nextStatus = { ...nextStatus, review: kept.waiting.length };
    }
    const nextMine = mine.ok ? mine.rows : kept?.mine;
    let nextWaiting: IReviewItem[] | undefined;
    if (nextStatus?.admin) {
      nextWaiting =
        !overtaken && freshWaiting ? freshWaiting : (kept?.waiting ?? []);
    }
    if (!overtaken && freshWaiting) {
      queueRead = read;
    }
    facts = {
      accountId: me,
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextWaiting ? { waiting: nextWaiting } : {}),
      ...(nextMine ? { mine: nextMine } : {}),
    };
  };

  const refresh = async (force: boolean) => {
    if (!force && Date.now() - askedAt < ASKED_WITHIN_MS) {
      if (asking) {
        await asking;
      }
      announce();
      return;
    }
    askedAt = Date.now();
    // After the read under way, never joined to it: that one may have asked
    // the server before whatever made this one necessary — an answer just
    // given — and its answer would be the one kept.
    const before = asking ?? Promise.resolve();
    const mine = before.catch(() => undefined).then(() => ask());
    asking = mine;
    try {
      await mine;
    } finally {
      if (asking === mine) {
        asking = undefined;
      }
    }
    announce();
  };

  ipcMain.handle(
    'plus-review-queue',
    async (): Promise<TReviewQueueOutcome> => {
      const me = access.accountId();
      const auth = await authFor(me);
      if (!me || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      reads += 1;
      const read = reads;
      const outcome = await reviewQueue(auth);
      if (access.accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }
      if (!outcome.ok) {
        return outcome;
      }
      // The admin is looking at the queue: everything in it has been told.
      markSeen(me, waitingKeys(outcome.rows));
      // Kept even before the first background read has answered: that read
      // began earlier, and must find this one fresher when it lands.
      if (read > queueRead) {
        queueRead = read;
        const base: IFacts =
          facts?.accountId === me ? facts : { accountId: me };
        facts = {
          ...base,
          waiting: outcome.rows,
          ...(base.status
            ? { status: { ...base.status, review: outcome.rows.length } }
            : {}),
        };
      }
      announce();
      return { ok: true, items: outcome.rows };
    },
  );

  ipcMain.handle(
    'plus-review-scene',
    async (
      _event,
      authorId: unknown,
      sceneId: unknown,
      sha256: unknown,
    ): Promise<TReviewSceneOutcome> => {
      const ref = sceneRefOf(authorId, sceneId);
      if (!ref || typeof sha256 !== 'string' || !SHA256.test(sha256)) {
        return { ok: false, reason: 'server' };
      }
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      // From the folder the hash names (server migration 0038), so it can
      // only ever be those bytes; a folder no longer there is a submission
      // no longer waiting.
      const fetched = await fetchSubmissionEnvelope(
        auth,
        ref.authorId,
        ref.packId,
        sha256,
      );
      if (access.accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }
      if (!fetched.ok) {
        return fetched;
      }
      const { envelope } = fetched;
      // And checked here all the same: the admin must never watch one version
      // and answer for another.
      const hashed = createHash('sha256')
        .update(Buffer.from(envelope.payload, 'base64'))
        .digest('hex');
      if (hashed !== sha256) {
        return { ok: false, reason: 'changed' };
      }
      // Through the one door every shared scene comes in by: the member key,
      // then every rule a scene is held to. Waiting for review is no reason to
      // run anything an approved scene could not.
      const payload = openMemberEnvelope(envelope);
      if (
        !payload ||
        payload.author.id !== ref.authorId ||
        payload.pack.id !== ref.packId
      ) {
        return { ok: false, reason: 'server' };
      }
      return { ok: true, pack: payload.pack };
    },
  );

  ipcMain.handle(
    'plus-review-picture',
    async (
      _event,
      authorId: unknown,
      sceneId: unknown,
      sha256: unknown,
    ): Promise<string | undefined> => {
      const ref = sceneRefOf(authorId, sceneId);
      if (!ref || typeof sha256 !== 'string' || !SHA256.test(sha256)) {
        return undefined;
      }
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return undefined;
      }
      const bytes = await fetchSubmissionPicture(
        auth,
        ref.authorId,
        ref.packId,
        sha256,
      );
      return bytes && access.accountId() === me
        ? `data:image/webp;base64,${Buffer.from(bytes).toString('base64')}`
        : undefined;
    },
  );

  ipcMain.handle(
    'plus-review-answer',
    async (
      _event,
      authorId: unknown,
      sceneId: unknown,
      version: unknown,
      sha256: unknown,
      rawAnswer: unknown,
    ): Promise<TReviewAnswerOutcome> => {
      const ref = sceneRefOf(authorId, sceneId);
      const answer = readReviewAnswer(rawAnswer);
      if (
        !ref ||
        !answer ||
        typeof version !== 'number' ||
        !Number.isInteger(version) ||
        version <= 0 ||
        typeof sha256 !== 'string' ||
        !SHA256.test(sha256)
      ) {
        return { ok: false, reason: 'server' };
      }
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await answerSubmission(
        auth,
        { authorId: ref.authorId, sceneId: ref.packId, version, sha256 },
        answer,
      );
      if (outcome.ok && answer.action === 'approve') {
        // The answer already stands on the server; a stale local list only
        // costs this window a moment, so it is not the reply's to wait for.
        onGalleryChanged().catch((error) =>
          logger?.warn('Refreshing after an approval failed', error),
        );
      }
      // The queue and the count moved either way, and a refusal of a stale
      // answer means the queue this window holds is stale too.
      refresh(true).catch(() => undefined);
      return outcome;
    },
  );

  ipcMain.handle(
    'plus-my-submissions',
    async (): Promise<TMySubmissionsOutcome> => {
      const me = access.accountId();
      const auth = await authFor(me);
      if (!auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await mySubmissions(auth);
      if (access.accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }
      return outcome.ok
        ? { ok: true, submissions: outcome.rows }
        : { ok: false, reason: outcome.reason };
    },
  );

  ipcMain.handle('scene-review-notice', () => state());

  // The window names the keys of the notice it showed. Only keys this side
  // would put in a notice right now are recorded: anything else is not a
  // notice this side sent.
  ipcMain.handle('scene-review-notice-seen', (_event, keys: unknown) => {
    const me = access.accountId();
    const current = state().notice;
    if (me && current && Array.isArray(keys)) {
      const shown = new Set(current.keys);
      markSeen(
        me,
        keys.filter(
          (key): key is string => typeof key === 'string' && shown.has(key),
        ),
      );
    }
    announce();
    return state();
  });

  const unsubscribe = onAccountChange(() => {
    refresh(true).catch(() => undefined);
  });
  // `ready` rather than now: before it the stored session cannot be read.
  app
    .whenReady()
    .then(() => refresh(true))
    .catch(() => undefined);

  return {
    refreshIfDue: (reason) =>
      refresh(false).catch((error) => {
        logger?.warn(`Scene review news after ${reason} failed`, error);
      }),
    refreshNow: () =>
      refresh(true).catch((error) => {
        logger?.warn('Scene review news after a change failed', error);
      }),
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
