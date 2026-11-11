/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TSceneMaker } from 'common/sceneMaker';
import { createCostLadder, type ICostLadder } from './sceneHealth';
import { createWarmupLadder } from './sceneWarmup';

/**
 * How the engine runs a scene, decided by who made it (`sceneMaker.ts`) and
 * by nothing else: the same on the graph, on the desktop, in the Library's
 * player and on its EQ screen, behind a video, in the gallery, in review and
 * on the Studio's stage.
 *
 * Each of those places used to state these for itself, and they drifted
 * apart. The desktop ran the listener's own scene through a brightness
 * limiter that the Studio's stage and the graph did not, and ghosted it; the
 * previews warmed FluidEQ's own scenes up from below full size where the
 * graph and the desktop drew them whole from the first frame. A place now
 * says where a scene is, how big it is and what it hears; how it is run is
 * decided here and read by the runner (`useSceneRunner.ts`) alone.
 *
 * Resting in silence is not in this list because it is not a choice: every
 * scene, everywhere, eases to thirty frames a second once nothing has been
 * played to it for a while (`sceneRest.ts`).
 */
export interface ISceneRules {
  /**
   * A scene another member made, which nobody here has watched: a GPU reset
   * its own frame causes takes it off at once (`sceneLosses.ts`). FluidEQ's
   * own are watched before release; the listener built theirs and watched it.
   *
   * Never how its picture is drawn. Every scene reaches the screen the same
   * way, frame for frame (Ivan, 2026-11-11: "all scenes need to work the same
   * way"): a member's used to go through the brightness limiter, which blended
   * frames on any fast change of brightness over an area and smeared a camera
   * turn into a blur. Flashing is caught before publication, in review.
   */
  unwatched: boolean;
  /**
   * The size ladder the scene is drawn on. FluidEQ's own start at full size,
   * measured before release (`sceneHealth.ts`). A member's, the listener's
   * included, climbs to it from the listener's floor (`sceneWarmup.ts`): a
   * scene nobody has measured can be heavy enough to reset a display driver
   * for every program on the machine.
   */
  createLadder(top: number, floor: number): ICostLadder;
  /**
   * Compiled ahead while out of sight (`warmSceneProgram`), so it is on
   * screen the moment it is shown. FluidEQ's own only: a member's shader
   * reaches the GPU's compiler when somebody looks at it, never at launch
   * while its place sits on another tab.
   */
  warmWhenUnseen: boolean;
}

const RULES: Readonly<Record<TSceneMaker, ISceneRules>> = {
  fluideq: {
    unwatched: false,
    createLadder: createCostLadder,
    warmWhenUnseen: true,
  },
  listener: {
    unwatched: false,
    createLadder: createWarmupLadder,
    warmWhenUnseen: false,
  },
  member: {
    unwatched: true,
    createLadder: createWarmupLadder,
    warmWhenUnseen: false,
  },
};

export const sceneRulesFor = (madeBy: TSceneMaker): ISceneRules =>
  RULES[madeBy];
