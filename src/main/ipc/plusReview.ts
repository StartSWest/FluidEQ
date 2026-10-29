/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, ipcMain, type BrowserWindow } from 'electron';
import type { ISceneSubmission } from '../../common/plusReview';
import {
  sceneReviewNotice,
  type TSceneReviewNotice,
} from '../../common/sceneReviewNotice';
import {
  authorizeGallery,
  sceneRefOf,
  type IGalleryAccess,
} from '../plus/galleryAccess';
import { createReviewNoticeSeen } from '../plus/reviewNoticeSeen';
import {
  fetchSubmissionPicture,
  mySubmissions,
  type TReviewFailure,
} from '../plus/reviewApi';

/**
 * A maker's scenes under review, over IPC (server migration 0037): the list
 * of what they sent, the picture that waits with one, and the corner notice
 * that tells them an answer came.
 *
 * Who may read a file that waits is the server's to say on every call.
 *
 * The notice is decided here (`common/sceneReviewNotice.ts`) from what the
 * server said at the last event — launch, the membership changing, somebody
 * coming back to the computer — and what this computer already told the
 * account. There is no clock: news waits for the next time somebody is here
 * to read it, which is the only time it could be read.
 */

export type TMySubmissionsOutcome =
  | { ok: true; submissions: ISceneSubmission[] }
  | { ok: false; reason: TReviewFailure };

/** What crosses to the window: the notice. */
export interface ISceneReviewState {
  accountId?: string;
  notice: TSceneReviewNotice | null;
}

export interface IPlusReviewIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  access: IGalleryAccess;
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
  'plus-review-picture',
  'plus-my-submissions',
  'scene-review-notice',
  'scene-review-notice-seen',
] as const;

interface IFacts {
  accountId: string;
  mine?: ISceneSubmission[];
}

export const registerPlusReviewIpc = ({
  getMainWindow,
  userDataDir,
  access,
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
      ...(facts.mine ? { mine: facts.mine } : {}),
      seen: seenBy(me),
      now: Date.now(),
    });
    return { accountId: me, notice: notice ?? null };
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
    const me = access.accountId();
    const auth = await authFor(me);
    if (!me || !auth) {
      facts = undefined;
      return;
    }
    const mine = await mySubmissions(auth);
    if (access.accountId() !== me) {
      return;
    }
    // A failed read keeps what was known rather than telling somebody the
    // news they already had again, or taking it away because the network
    // blinked.
    const kept = facts?.accountId === me ? facts : undefined;
    const nextMine = mine.ok ? mine.rows : kept?.mine;
    facts = { accountId: me, ...(nextMine ? { mine: nextMine } : {}) };
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
    // the server before whatever made this one necessary, and its answer
    // would be the one kept.
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
    'plus-my-submissions',
    async (): Promise<TMySubmissionsOutcome> => {
      const me = access.accountId();
      const authorization = await authorizeGallery(access, me);
      if (!authorization.ok) {
        return authorization;
      }
      const outcome = await mySubmissions(authorization.auth);
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
