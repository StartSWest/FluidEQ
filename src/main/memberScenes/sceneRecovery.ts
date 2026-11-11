/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { parseMemberLookId } from '../../common/memberScenes';
import type { IScenePack, IScenePackEnvelope } from '../../common/scenePacks';
import { readProject } from './project';
import { openMemberEnvelope } from './sharing';
import { keptRevisionOf, type IMemberSceneStore } from './store';

/**
 * A look that will not play here is put right from a better copy, in order
 * (Ivan, 2026-11-11: "it works always and never fails, and if it fails it
 * recovers"):
 *
 *  1. the copy in the looks, read again. A copy an earlier FluidEQ wrote in
 *     another layout is healed by the reader itself (`storedFormOf`), so by
 *     the time a look is reported here that has already been tried;
 *  2. the maker's own Studio project for it, built afresh from its folder;
 *  3. the gallery's copy, signed, as every other member receives it.
 *
 * A copy is only taken if it is a different one from every copy that has
 * already failed here this session: the same scene saved again would fail
 * the same way, and say it had been repaired. When no copy is left the
 * answer says so, and the window tells the listener in words, with a way to
 * try again (`sceneTrouble.ts`); it never just plays something else.
 *
 * Nothing here decides who may play a scene: the caller asks only for a
 * look this account already sees, and the gallery answers for itself.
 */

export type TSceneRecovery =
  { recovered: true; from: 'project' | 'gallery' } | { recovered: false };

export interface ISceneRecoveryDeps {
  store: Pick<IMemberSceneStore, 'load' | 'newest' | 'save' | 'saveImported'>;
  accountId: () => string | undefined;
  /** The folders of the member's own Studio projects, never one only opened. */
  ownProjectFolders: () => readonly string[];
  /** The gallery's file for a scene, unverified; nothing when it has none. */
  fetchGalleryCopy: (
    authorId: string,
    sceneId: string,
  ) => Promise<IScenePackEnvelope | undefined>;
  /** The looks changed: every window reads its list again. */
  announce: () => void;
  readProjectPack?: (folder: string) => Promise<IScenePack | undefined>;
  logger?: { info(message: string): void; warn(message: string): void };
}

const readPackOf = async (folder: string) => {
  const build = await readProject(folder);
  return build.ok ? build.pack : undefined;
};

/** The scene a project's `pack.json` names, read alone. */
const sceneIdOf = async (folder: string): Promise<string | undefined> => {
  try {
    const raw: unknown = JSON.parse(
      await fs.promises.readFile(path.join(folder, 'pack.json'), 'utf8'),
    );
    return typeof raw === 'object' &&
      raw !== null &&
      'id' in raw &&
      typeof raw.id === 'string'
      ? raw.id
      : undefined;
  } catch {
    // No `pack.json`, or one mid-save: not a copy to recover from.
    return undefined;
  }
};

export const createSceneRecovery = ({
  store,
  accountId,
  ownProjectFolders,
  fetchGalleryCopy,
  announce,
  readProjectPack = readPackOf,
  logger,
}: ISceneRecoveryDeps) => {
  /** Every copy of a look that has failed here, by what tells copies apart. */
  const failed = new Map<string, Set<string>>();
  const underWay = new Map<string, Promise<TSceneRecovery>>();

  const run = async (
    lookId: string,
    authorId: string,
    packId: string,
  ): Promise<TSceneRecovery> => {
    const me = accountId();
    const tried = failed.get(lookId) ?? new Set<string>();
    failed.set(lookId, tried);
    const playing = store.load(authorId, packId);
    const newest = store.newest(authorId, packId);
    [playing, newest].forEach((pack) => {
      const revision = pack ? keptRevisionOf(pack) : undefined;
      if (revision) {
        tried.add(revision);
      }
    });
    /** A copy worth keeping: a real scene, and not one that failed here. */
    const fresh = (pack: IScenePack) => {
      const revision = keptRevisionOf(pack);
      return revision !== undefined && !tried.has(revision);
    };
    const held = newest?.version ?? 0;

    /** The project in `folder` kept as the look, when it is a better copy. */
    const fromProject = async (folder: string): Promise<boolean> => {
      const pack = await readProjectPack(folder);
      // Never an earlier version than the looks hold: what plays there is
      // at least what was last added or published.
      if (
        me === undefined ||
        !pack ||
        pack.id !== packId ||
        pack.version < held ||
        !fresh(pack) ||
        accountId() !== me
      ) {
        return false;
      }
      try {
        store.save(me, pack);
      } catch (error) {
        logger?.warn(
          `Scene ${lookId} could not be kept from its Studio project: ${String(error)}`,
        );
        return false;
      }
      announce();
      logger?.info(
        `Scene ${lookId} would not play and was put right from its Studio project (v${pack.version}).`,
      );
      return true;
    };
    if (me !== undefined && authorId === me) {
      const folders = ownProjectFolders();
      const named = await Promise.all(folders.map(sceneIdOf));
      // One folder at a time: each read is a whole scene.
      const kept = await folders
        .filter((_folder, at) => named[at] === packId)
        .reduce<Promise<boolean>>(
          async (sofar, folder) => (await sofar) || fromProject(folder),
          Promise.resolve(false),
        );
      if (kept) {
        return { recovered: true, from: 'project' };
      }
    }

    const envelope = await fetchGalleryCopy(authorId, packId).catch(
      () => undefined,
    );
    const payload = envelope ? openMemberEnvelope(envelope) : null;
    if (
      envelope &&
      payload &&
      payload.author.id === authorId &&
      payload.pack.id === packId &&
      payload.pack.version >= held &&
      fresh(payload.pack) &&
      accountId() === me
    ) {
      try {
        if (me !== undefined && authorId === me) {
          store.save(me, payload.pack);
        } else {
          store.saveImported(envelope);
        }
        announce();
        logger?.info(
          `Scene ${lookId} would not play and was put right from the gallery's copy (v${payload.pack.version}).`,
        );
        return { recovered: true, from: 'gallery' };
      } catch (error) {
        logger?.warn(
          `Scene ${lookId} could not be kept from the gallery's copy: ${String(error)}`,
        );
      }
    }
    logger?.warn(
      `Scene ${lookId} would not play and no better copy was found: ${tried.size} tried.`,
    );
    return { recovered: false };
  };

  return {
    /**
     * Puts `lookId` right from the next copy that has not failed here. One
     * recovery of a look at a time: a second report while one is under way
     * gets its answer.
     */
    recover: (lookId: string): Promise<TSceneRecovery> => {
      const ref = parseMemberLookId(lookId);
      if (!ref) {
        return Promise.resolve({ recovered: false });
      }
      const going = underWay.get(lookId);
      if (going) {
        return going;
      }
      const next = run(lookId, ref.authorId, ref.packId)
        .catch((error: unknown): TSceneRecovery => {
          logger?.warn(`Recovering scene ${lookId} failed: ${String(error)}`);
          return { recovered: false };
        })
        .finally(() => {
          underWay.delete(lookId);
        });
      underWay.set(lookId, next);
      return next;
    },
  };
};

export type TSceneRecoverer = ReturnType<typeof createSceneRecovery>;
