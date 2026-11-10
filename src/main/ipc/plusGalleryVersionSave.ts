/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain } from 'electron';
import { memberLookId } from '../../common/memberScenes';
import {
  FLUIDEQ_CREATOR_ID,
  type TSaveGalleryVersion,
} from '../../common/plusGallery';
import { premiumLookId } from '../../common/scenePacks';
import type { IMemberSceneStore } from '../memberScenes/store';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';
import { fetchVersionFile } from '../plus/galleryVersionFile';
import type { IScenePackStore } from '../scenePackStore';

/**
 * Saving one of the versions the server keeps of a scene (its last ten,
 * fluideq-premium 0100) on this computer, where it stays the member's after
 * the server lets it go (Ivan, 2026-11-09: "a member can pick any of those 10
 * and save it locally, and that saved version stays theirs even after it
 * leaves the server").
 *
 * It lands among the scene's kept versions (`keptVersions.ts`), in the same
 * look, never in place of the newest, and plays through `scene-versions-play`
 * like any other kept one. Owners only, asked before the download and again
 * after it; the server asks too, and the store verifies the file as it
 * verifies every other copy it holds.
 *
 * A save runs to its end whether or not the page that asked is still open,
 * and can be cancelled: the page names the save it started, and a cancel that
 * arrives once the file is written changes nothing, so the answer is then
 * the saved one.
 */

const CHANNELS = [
  'plus-gallery-save-version',
  'plus-gallery-save-version-cancel',
] as const;

export interface IGalleryVersionSaveDeps {
  access: IGalleryAccess;
  store: Pick<IMemberSceneStore, 'keepSaved' | 'isBlocked'>;
  officialStore?: Pick<IScenePackStore, 'keepSaved'>;
  /** Asks for the block list now; a scene blocked since is not saved. */
  refreshBlocked: () => Promise<void>;
  /** The looks' lists and the kept versions, told one more is kept. */
  announce: () => void;
  announceOfficial?: () => void;
  logger?: { warn(message: string): void };
}

const readVersion = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? value
    : undefined;

export const registerGalleryVersionSaveIpc = ({
  access,
  store,
  officialStore,
  refreshBlocked,
  announce,
  announceOfficial,
  logger,
}: IGalleryVersionSaveDeps) => {
  /** Saves under way, by scene and version: one each, shared by every ask. */
  const saving = new Map<
    string,
    { abort: AbortController; answer: Promise<TSaveGalleryVersion> }
  >();

  const save = async (
    authorId: string,
    sceneId: string,
    version: number,
    signal: AbortSignal,
  ): Promise<TSaveGalleryVersion> => {
    const me = access.accountId();
    if (me === undefined) {
      return { ok: false, reason: 'signed-out' };
    }
    const official = authorId === FLUIDEQ_CREATOR_ID;
    const lookId = official
      ? premiumLookId(sceneId)
      : memberLookId(authorId, sceneId);
    // Asked again after every wait: an account that signed out or changed
    // meanwhile does not have its download saved under another.
    const stillMine = (): TSaveGalleryVersion | undefined => {
      const now = access.accountId();
      if (now === undefined) {
        return { ok: false, reason: 'signed-out' };
      }
      return now === me && access.owns(lookId)
        ? undefined
        : { ok: false, reason: 'not-owned' };
    };
    // The member's own scene is their Studio project, which keeps its own
    // history; no version of it plays from the kept ones.
    if (authorId === me) {
      return { ok: false, reason: 'failed' };
    }
    const refused = stillMine();
    if (refused) {
      return refused;
    }
    if (!official) {
      try {
        await refreshBlocked();
      } catch (error) {
        logger?.warn(
          `Block list not refreshed before a save: ${String(error)}`,
        );
      }
      if (store.isBlocked(authorId, sceneId)) {
        return { ok: false, reason: 'gone' };
      }
    }
    const auth = await access.auth();
    if (!auth) {
      return { ok: false, reason: 'signed-out' };
    }
    const fetched = await fetchVersionFile(
      auth,
      authorId,
      sceneId,
      version,
      signal,
    );
    if (!fetched.ok) {
      return fetched;
    }
    const after = stillMine();
    if (after) {
      return after;
    }
    if (signal.aborted) {
      return { ok: false, reason: 'cancelled' };
    }
    try {
      const kept = official
        ? officialStore?.keepSaved(fetched.envelope, sceneId, version)
        : store.keepSaved(fetched.envelope, authorId, sceneId, version);
      if (!kept) {
        return { ok: false, reason: 'failed' };
      }
    } catch (error) {
      logger?.warn(`Saving a scene version failed: ${String(error)}`);
      return { ok: false, reason: 'failed' };
    }
    (official ? announceOfficial : announce)?.();
    return { ok: true, version };
  };

  ipcMain.handle(
    'plus-gallery-save-version',
    (
      _event,
      authorId: unknown,
      sceneId: unknown,
      rawVersion: unknown,
    ): Promise<TSaveGalleryVersion> => {
      const ref = sceneRefOf(authorId, sceneId);
      const version = readVersion(rawVersion);
      if (!ref || version === undefined) {
        return Promise.resolve({ ok: false, reason: 'failed' });
      }
      const key = `${ref.authorId}/${ref.packId}@${version}`;
      const under = saving.get(key);
      if (under) {
        return under.answer;
      }
      const abort = new AbortController();
      const answer = save(ref.authorId, ref.packId, version, abort.signal)
        .catch((error: unknown): TSaveGalleryVersion => {
          logger?.warn(`Saving a scene version failed: ${String(error)}`);
          return { ok: false, reason: 'failed' };
        })
        .finally(() => saving.delete(key));
      saving.set(key, { abort, answer });
      return answer;
    },
  );

  ipcMain.handle(
    'plus-gallery-save-version-cancel',
    (_event, authorId: unknown, sceneId: unknown, rawVersion: unknown) => {
      const ref = sceneRefOf(authorId, sceneId);
      const version = readVersion(rawVersion);
      const under =
        ref && version !== undefined
          ? saving.get(`${ref.authorId}/${ref.packId}@${version}`)
          : undefined;
      under?.abort.abort();
      return under !== undefined;
    },
  );

  return () => {
    saving.forEach(({ abort }) => abort.abort());
    CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  };
};
