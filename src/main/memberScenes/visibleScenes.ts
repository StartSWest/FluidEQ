/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseMemberLookId } from '../../common/memberScenes';
import type { IScenePack } from '../../common/scenePacks';
import type { IMemberSceneStore, IMemberSceneSummary } from './store';

/**
 * Which member scenes this account may see, and which of them it may load.
 *
 * Kept apart from the IPC because it is one question asked from several
 * places — the list the page draws, the load the graph asks for, the desktop
 * background — and the answer has to be the same every time. Every one of
 * these is the main process's word, not the page's.
 */

export interface IMemberScenesListing {
  entitled: boolean;
  /**
   * The member's own scenes and the ones other members sent them, when they
   * may be drawn.
   */
  scenes: IMemberSceneSummary[];
  /** The same scenes while Plus is off: shown locked, never deleted. */
  locked: IMemberSceneSummary[];
}

/** Who is asking, read fresh on every call rather than once at startup. */
export interface ISceneViewer {
  accountId(): string | undefined;
  entitled(): boolean;
}

/**
 * This account's scenes and the ones other members sent it. Scenes another
 * account on this computer made are theirs, and not listed here.
 */
export const visibleScenes = (
  store: IMemberSceneStore,
  viewer: ISceneViewer,
): IMemberSceneSummary[] => {
  const me = viewer.accountId();
  return me
    ? store.list().filter((scene) => !scene.own || scene.authorId === me)
    : [];
};

export const sceneListing = (
  store: IMemberSceneStore,
  viewer: ISceneViewer,
): IMemberScenesListing => {
  const scenes = visibleScenes(store, viewer);
  return viewer.entitled()
    ? { entitled: true, scenes, locked: [] }
    : { entitled: false, scenes: [], locked: scenes };
};

/** A scene this account may draw, and whether this account made it. */
export interface IVisibleScene {
  pack: IScenePack;
  own: boolean;
}

/**
 * The pack behind a look id, when this account may both see and draw it,
 * and whether this account made it — which decides how it is run wherever
 * it plays, the desktop included (`sceneRules.ts`).
 *
 * The entitlement is checked here and not only where the list is built: a
 * page that kept an id from before a membership ended would otherwise be able
 * to ask for the scene itself.
 */
export const loadVisibleScene = (
  store: IMemberSceneStore,
  viewer: ISceneViewer,
  lookId: unknown,
): IVisibleScene | undefined => {
  const ref =
    typeof lookId === 'string' ? parseMemberLookId(lookId) : undefined;
  if (!ref || !viewer.entitled()) {
    return undefined;
  }
  const seen = visibleScenes(store, viewer).find(
    (scene) => scene.authorId === ref.authorId && scene.packId === ref.packId,
  );
  const pack = seen ? store.load(ref.authorId, ref.packId) : undefined;
  return seen && pack ? { pack, own: seen.own } : undefined;
};
