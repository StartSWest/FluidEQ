/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import {
  isPremiumLookId,
  packIdOfLook,
  type IScenePack,
} from 'common/scenePacks';
import { useSelectedLookId } from '../utils/graphStyle';
import {
  getEntitledMemberScene,
  loadMemberScene,
  subscribeMemberScenes,
} from '../utils/memberScenes';
import {
  getEntitledScene,
  loadScenePack,
  subscribeScenePacks,
} from '../utils/scenePacks';

/**
 * The Plus look the desk lights play: the one the member chose for the graph.
 *
 * Chosen, not drawable. The lamps used to take the graph's own answer
 * (`useSceneLook`), which is null whenever the graph cannot draw the scene
 * this moment — set aside for the session after a slow stretch or a context
 * it could not have, a look draft open — and every such moment put the desk
 * out and started it again from nothing: a new worker, the scene linked
 * again, seconds of a dark desk. The lamps draw in a worker of their own and
 * have their own answer for a scene they cannot draw (its colours), so what
 * the graph can do right now is not theirs to follow. They go out only when
 * the member's look is not a Plus one, or the account cannot play it.
 */

export interface ILampScene {
  /** The look the frames are stamped with; its lighting profile is kept under it. */
  lookId: string;
  /** The look at the content it is at now: a new version is loaded when this moves. */
  identity: string;
  /** Its colours, for the frames it cannot be drawn for. */
  swatch: readonly string[];
  /** Somebody's own scene, drawn through the flash limiter. */
  guarded: boolean;
}

const subscribeListings = (listener: () => void) => {
  const stopPacks = subscribeScenePacks(listener);
  const stopMembers = subscribeMemberScenes(listener);
  return () => {
    stopPacks();
    stopMembers();
  };
};

/** The last answer, handed back unchanged while nothing it reads has moved. */
let last: ILampScene | null = null;

const lampSceneOf = (lookId: string): ILampScene | null => {
  let summary:
    { version: number; revision?: string; swatch: string[] } | undefined;
  if (isPremiumLookId(lookId)) {
    summary = getEntitledScene(packIdOfLook(lookId));
  } else if (isMemberLookId(lookId)) {
    summary = getEntitledMemberScene(lookId);
  }
  if (!summary) {
    return null;
  }
  const identity = `${lookId}@${summary.revision ?? summary.version}`;
  if (
    last?.identity === identity &&
    last.swatch.join() === summary.swatch.join()
  ) {
    return last;
  }
  last = {
    lookId,
    identity,
    swatch: summary.swatch,
    guarded: isMemberLookId(lookId),
  };
  return last;
};

export const useLampScene = (): ILampScene | null => {
  const lookId = useSelectedLookId();
  return useSyncExternalStore(
    subscribeListings,
    () => lampSceneOf(lookId),
    () => null,
  );
};

/** The whole pack, from the main process; nothing when it cannot be had. */
export const loadLampScene = (
  scene: ILampScene,
): Promise<IScenePack | undefined> =>
  isMemberLookId(scene.lookId)
    ? loadMemberScene(scene.lookId)
    : loadScenePack(packIdOfLook(scene.lookId));
