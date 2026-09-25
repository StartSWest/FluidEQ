/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Who made a scene: the one fact about it that decides how the engine runs it
 * (`sceneRules.ts`), and the same fact wherever it plays.
 *
 * - `fluideq`: one of FluidEQ's own, watched before it was released.
 * - `listener`: one this account made, and watched on its own Studio stage.
 * - `member`: one another member made, which reaches this screen with nobody
 *   here having watched it first.
 *
 * In `common` because main states it too. A desktop background is told by
 * main whose scene it shows, and was once told only that a member had made
 * it: the listener's own scene ran there as a stranger's, through the
 * brightness limiter, and ghosted on the desktop while the Studio showed the
 * same scene clean.
 */
export type TSceneMaker = 'fluideq' | 'listener' | 'member';

/**
 * Whose a scene is, from the two things every list of scenes knows about it:
 * whether a member made it rather than FluidEQ, and whether that member is
 * the one looking.
 */
export const sceneMakerOf = (scene: {
  member: boolean;
  own: boolean;
}): TSceneMaker => {
  if (!scene.member) {
    return 'fluideq';
  }
  return scene.own ? 'listener' : 'member';
};
