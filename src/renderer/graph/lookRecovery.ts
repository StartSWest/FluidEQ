/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isMemberLookId } from 'common/memberScenes';
import type { IScenePack } from 'common/scenePacks';
import { getGraphLookId, setGraphLook } from '../utils/graphStyle';
import {
  getUsableMemberScene,
  refreshMemberScenes,
} from '../utils/memberScenes';
import { refuseLook } from './lookRefusal';

/**
 * A member's look whose code would not build is put right before anything is
 * said about it (Ivan, 2026-11-11: "if it fails it recovers"). Main looks
 * for a better copy - the maker's own Studio project, then the gallery's
 * (`main/memberScenes/sceneRecovery.ts`) - and when it keeps one the look is
 * chosen again by itself, unless the listener chose something else
 * meanwhile. Only when no copy is left does the graph say the look could not
 * play (`lookRefusal.ts`), whose Try again runs all of this once more.
 *
 * Only a build failure is recovered from. A look too heavy for the machine,
 * no graphics to draw with, a driver that stopped: another copy of the same
 * scene changes none of those.
 */

/** True when main kept a better copy and this window is offered the look. */
const recovered = async (lookId: string): Promise<boolean> => {
  const outcome = await window.electron?.ipcRenderer
    ?.recoverMemberScene?.(lookId)
    .catch(() => undefined);
  if (!outcome?.recovered) {
    return false;
  }
  // The looks changed in main: read them here before the look is chosen
  // again, or it is chosen while this window still holds it set aside.
  await refreshMemberScenes();
  return getUsableMemberScene(lookId) !== undefined;
};

/**
 * `lookId` would not build and has just been set aside, so the graph's
 * choice now stands on its fallback form: recovered and chosen again, or
 * refused in words.
 */
export const memberLookWouldNotBuild = async (
  lookId: string,
  names: IScenePack['names'],
): Promise<void> => {
  const landed = getGraphLookId();
  if (!(await recovered(lookId).catch(() => false))) {
    refuseLook(lookId, names, 'compile');
    return;
  }
  if (getGraphLookId() === landed) {
    setGraphLook(lookId);
  }
};

/**
 * The compact player's scene would not build, and the free look stands in
 * there (`PlayerAmp`). A member's is put right from a better copy, which
 * the player then draws by itself: a kept copy is a new revision, so a new
 * scene to it. No copy, or one of FluidEQ's own, and the graph's notice
 * says why (`lookRefusal.ts`), as it would have had the graph drawn it.
 */
export const playerLookWouldNotBuild = async (
  lookId: string,
  names: IScenePack['names'],
): Promise<void> => {
  if (
    !isMemberLookId(lookId) ||
    !(await recovered(lookId).catch(() => false))
  ) {
    refuseLook(lookId, names, 'compile');
  }
};

/**
 * A new version would not build while an earlier one plays on: put right
 * behind the picture, and nothing is said - the scene is playing.
 */
export const memberVersionWouldNotBuild = async (
  lookId: string,
): Promise<void> => {
  await recovered(lookId).catch(() => false);
};
