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
 * apart. The desktop ran the listener's own scene through the brightness
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
   * Drawn through the brightness limiter (`sceneFlashGuard.ts`): a scene
   * another member made, which nobody here has watched. FluidEQ's own are
   * watched before release; the listener built theirs and watched it.
   */
  limited: boolean;
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
    limited: false,
    createLadder: createCostLadder,
    warmWhenUnseen: true,
  },
  listener: {
    limited: false,
    createLadder: createWarmupLadder,
    warmWhenUnseen: false,
  },
  member: {
    limited: true,
    createLadder: createWarmupLadder,
    warmWhenUnseen: false,
  },
};

export const sceneRulesFor = (madeBy: TSceneMaker): ISceneRules =>
  RULES[madeBy];
