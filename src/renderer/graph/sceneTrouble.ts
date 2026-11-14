/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useSyncExternalStore } from 'react';
import { isMemberLookId } from 'common/memberScenes';
import { packIdOfLook, type IScenePack } from 'common/scenePacks';
import { useSceneLook, useSelectedSceneLookId } from '../utils/graphStyle';
import {
  getMemberSceneSummary,
  isMemberSceneBlocked,
  isMemberSceneListingLoaded,
  subscribeMemberScenes,
} from '../utils/memberScenes';
import {
  getScenePackListing,
  getScenePackSummary,
  isSceneBlocked,
  isScenePackListingLoaded,
  subscribeScenePacks,
} from '../utils/scenePacks';
import { useLookRefusal, type TLookRefusal } from './lookRefusal';
import { isSceneRenderingAvailable } from './sceneHealth';

/**
 * Why the scene the graph's selection names is not drawn right now:
 * `waiting` while its list has not arrived or a better copy of it is being
 * looked for (`lookRecovery.ts`), `gone` when this account no longer has it,
 * and otherwise the reason it was set aside here (`lookRefusal.ts`).
 */
export type TSceneTrouble = 'waiting' | 'gone' | TLookRefusal;

export interface ISceneTrouble {
  lookId: string;
  /** Its names, where any list on this computer still has them. */
  names?: IScenePack['names'];
  /** Its picker colours, for its icon in the state shown in its place. */
  swatch: readonly string[];
  reason: TSceneTrouble;
}

// Every change in either list, counted: the one snapshot both stores move.
let moves = 0;
const subscribeLists = (listener: () => void) => {
  const moved = () => {
    moves += 1;
    listener();
  };
  const stopPacks = subscribeScenePacks(moved);
  const stopMembers = subscribeMemberScenes(moved);
  return () => {
    stopPacks();
    stopMembers();
  };
};
const listMoves = () => moves;

const summaryOf = (lookId: string) => {
  if (isMemberLookId(lookId)) {
    return getMemberSceneSummary(lookId);
  }
  const packId = packIdOfLook(lookId);
  return (
    getScenePackSummary(packId) ??
    getScenePackListing().locked.find((entry) => entry.id === packId)
  );
};

/**
 * What the graph shows in place of the scene its selection names while that
 * scene cannot be drawn - undefined while it is drawn, and for a standard
 * look. A scene is only ever shown as itself or as this: never a standard
 * look standing in for it (Ivan, 2026-11-14: "we cannot have fallbacks ...
 * code it so only the full scene can show, always").
 */
export const useSceneTrouble = (): ISceneTrouble | undefined => {
  const lookId = useSelectedSceneLookId();
  const scene = useSceneLook();
  const refusal = useLookRefusal();
  useSyncExternalStore(subscribeLists, listMoves, listMoves);
  if (lookId === undefined || scene !== null) {
    return undefined;
  }
  const member = isMemberLookId(lookId);
  const summary = summaryOf(lookId);
  const said = refusal?.lookId === lookId ? refusal : undefined;
  const base = {
    lookId,
    names: said?.names ?? summary?.names,
    swatch: summary?.swatch ?? [],
  };
  if (said) {
    return { ...base, reason: said.reason };
  }
  // No graphics to draw any scene with: the lists offer none, and that is
  // the reason to give, never "gone".
  if (!isSceneRenderingAvailable()) {
    return { ...base, reason: 'unavailable' };
  }
  const loaded = member
    ? isMemberSceneListingLoaded()
    : isScenePackListingLoaded();
  // Set aside with nothing said yet: a better copy is being looked for, and
  // the scene either comes back by itself or is refused in words.
  const setAside = member
    ? isMemberSceneBlocked(lookId)
    : isSceneBlocked(packIdOfLook(lookId));
  return { ...base, reason: !loaded || setAside ? 'waiting' : 'gone' };
};
