/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_DAYLIGHT_PARAM } from 'common/sceneDaylight';
import type { IScenePackParam } from 'common/scenePacks';
import { SCENE_WORLD_PARAM } from 'common/sceneWorldFront';

/**
 * The controls of a scene a slider can move, in the graph's View menu and in
 * the Studio alike. A scene's AI writes them, so a range with no width is
 * possible: it keeps its uniform at its one value, and gets no slider that
 * could only sit still - its readout swept 0-100% while every value landed
 * back on the one the author gave. Two more are FluidEQ's to set, never the
 * listener's: the time of day, which the window's Brightness sets
 * (`sceneDaylight.ts`), and whether the 3D world is drawn in front, which
 * the engine sets (`sceneWorldFront.ts`).
 */
const sceneSliderParams = (params: readonly IScenePackParam[]) =>
  params.filter(
    (param) =>
      param.max - param.min > 0 &&
      param.id !== SCENE_DAYLIGHT_PARAM &&
      param.id !== SCENE_WORLD_PARAM,
  );

export default sceneSliderParams;
