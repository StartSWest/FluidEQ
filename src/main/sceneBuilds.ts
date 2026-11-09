/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { parseMemberLookId, readMemberScene } from '../common/memberScenes';
import type { IScenePack } from '../common/scenePacks';
import { readSceneCache, writeSceneCache } from './sceneCacheFile';
import type { IWallpaperScene } from './wallpaper/surface';

/**
 * The last version of each look that built and drew on this computer, kept
 * so a newer version that will not build never puts the plain look in its
 * place (Ivan, 2026-11-09: "I dont want fallbacks like that and some scene
 * still have them"). His own scenes were the ones falling back: a save from
 * the Studio's AI kept a version that did not compile, and every place that
 * showed the look dropped to its fallback style until something listed the
 * looks again — after a relaunch, for good.
 *
 * Remembered by look id, and only as a version the stores themselves handed
 * out: the window says which revision built, and this keeps the store's
 * current pack only when that is the revision it has now, so a version that
 * changed under the build is never the one kept. Answered only while the
 * look itself can still be loaded — a scene taken down, blocked, or no longer
 * this account's to play takes its last build with it.
 *
 * A member's look is also kept on disk, as the stores keep a playback copy
 * (`sceneCacheFile.ts`, read back through the same member rules), so a
 * relaunch on a broken version still plays the one before it. FluidEQ's own
 * looks are kept in memory only: their copies on disk are signed, and a copy
 * kept here would not be.
 */

export interface ISceneBuildsDeps {
  /** Where a member look's last build is kept. */
  dir: string;
  /** The look as the stores have it now (`createWallpaperScenes`). */
  loadScene(lookId: string): IWallpaperScene | undefined;
  logger?: { warn(message: string): void };
}

export interface ISceneBuilds {
  /** The window built this revision of the look: kept if it is the stores'. */
  built(lookId: string, revision: string): void;
  /** A desktop page drew this pack of the look. */
  drawn(lookId: string, pack: IScenePack): void;
  /** The last build of the look, while the look can still be loaded. */
  lastBuilt(lookId: string): IScenePack | undefined;
  /**
   * This pack of the look would not build here. True when a different build
   * is kept, which `loadScene` answers from now on in its place, until the
   * stores hold another version.
   */
  wouldNotBuild(lookId: string, pack: IScenePack): boolean;
  /** The look as the stores have it, or its last build where that will not build. */
  loadScene(lookId: string): IWallpaperScene | undefined;
  /** The look was removed from this computer. */
  forget(lookId: string): void;
}

interface IKept {
  revision: string;
  pack: IScenePack;
}

/** What the looks' listings call a revision: the pack, hashed as held. */
export const sceneRevisionOf = (pack: IScenePack): string =>
  createHash('sha256').update(JSON.stringify(pack)).digest('hex');

const fileOf = (dir: string, lookId: string) =>
  path.join(
    dir,
    `${createHash('sha256').update(lookId).digest('hex').slice(0, 32)}.scene`,
  );

const scopeOf = (lookId: string) => `last-built/${lookId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const createSceneBuilds = ({
  dir,
  loadScene,
  logger,
}: ISceneBuildsDeps): ISceneBuilds => {
  const kept = new Map<string, IKept>();
  // Looks whose disk copy has been looked for this session, found or not.
  const read = new Set<string>();
  // The revision of each look that would not build here, this session.
  const broken = new Map<string, string>();
  // Packs a desktop page has drawn, already kept: hashing a pack with its
  // artwork is not free, and every monitor showing a look reports it.
  const drawnPacks = new WeakSet<IScenePack>();

  const readDisk = (lookId: string): IKept | undefined => {
    const ref = parseMemberLookId(lookId);
    if (!ref) {
      return undefined;
    }
    return readSceneCache(fileOf(dir, lookId), scopeOf(lookId), (record) => {
      if (!isRecord(record) || record.lookId !== lookId) {
        return undefined;
      }
      // Read as every member scene is read, by whatever FluidEQ runs now.
      const pack = readMemberScene(record.pack);
      return pack && pack.id === ref.packId
        ? { revision: sceneRevisionOf(pack), pack }
        : undefined;
    });
  };

  const keptOf = (lookId: string): IKept | undefined => {
    if (!kept.has(lookId) && !read.has(lookId)) {
      read.add(lookId);
      const found = readDisk(lookId);
      if (found) {
        kept.set(lookId, found);
      }
    }
    return kept.get(lookId);
  };

  const keep = (lookId: string, pack: IScenePack, revision: string) => {
    if (keptOf(lookId)?.revision === revision) {
      return;
    }
    kept.set(lookId, { revision, pack });
    if (!parseMemberLookId(lookId)) {
      return;
    }
    try {
      writeSceneCache(fileOf(dir, lookId), scopeOf(lookId), { lookId, pack });
    } catch (error) {
      // Kept for this session all the same; a relaunch on a version that
      // will not build then falls back as it did before.
      logger?.warn(
        `The last build of ${lookId} could not be kept on disk: ${String(error)}`,
      );
    }
  };

  const lastBuilt = (lookId: string): IScenePack | undefined =>
    loadScene(lookId) ? keptOf(lookId)?.pack : undefined;

  return {
    built: (lookId, revision) => {
      // Every place that draws the look says so; the pack is hashed once.
      if (keptOf(lookId)?.revision === revision) {
        return;
      }
      const current = loadScene(lookId);
      if (current && sceneRevisionOf(current.pack) === revision) {
        keep(lookId, current.pack, revision);
      }
    },
    drawn: (lookId, pack) => {
      if (!drawnPacks.has(pack) && loadScene(lookId)) {
        drawnPacks.add(pack);
        keep(lookId, pack, sceneRevisionOf(pack));
      }
    },
    lastBuilt,
    wouldNotBuild: (lookId, pack) => {
      const last = lastBuilt(lookId);
      const revision = sceneRevisionOf(pack);
      if (!last || keptOf(lookId)?.revision === revision) {
        return false;
      }
      broken.set(lookId, revision);
      return true;
    },
    loadScene: (lookId) => {
      const current = loadScene(lookId);
      const bad = broken.get(lookId);
      if (!current || bad === undefined) {
        return current;
      }
      if (sceneRevisionOf(current.pack) !== bad) {
        // The stores hold another version now: it gets its own try.
        broken.delete(lookId);
        return current;
      }
      const last = keptOf(lookId)?.pack;
      return last ? { ...current, pack: last } : current;
    },
    forget: (lookId) => {
      kept.delete(lookId);
      broken.delete(lookId);
      read.add(lookId);
      if (parseMemberLookId(lookId)) {
        try {
          // `rm` takes a link away, never what it points at.
          fs.rmSync(fileOf(dir, lookId), { force: true });
        } catch (error) {
          // The copy left behind is answered for nobody: `lastBuilt` asks
          // the stores first, and a removed look is not there.
          logger?.warn(
            `The last build of ${lookId} could not be removed: ${String(error)}`,
          );
        }
      }
    },
  };
};
