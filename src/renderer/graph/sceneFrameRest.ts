/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_TAP_AGE_LIMIT_S } from 'common/sceneUniformContract';

/**
 * What a frame reads as where nobody points, taps or turns: the values the
 * shader path (`sceneGl.ts`) and a 3D world (`world/worldInputs.ts`) both
 * hand a scene then. A module of their own because the world is a bundle of
 * its own, and importing them from `sceneGl.ts` carried the whole shader path
 * into it.
 */

/** Where the pointer is taken to be when nobody is pointing: nowhere near. */
export const NO_POINTER: readonly [number, number, number, number] = [
  0.5, 0.5, 0, 0,
];
/** No tap yet: as long ago as a tap is ever said to be. */
export const NO_TAP: readonly [number, number, number, number] = [
  0.5,
  0.5,
  SCENE_TAP_AGE_LIMIT_S,
  0,
];
export const HOME_CAMERA: readonly [number, number, number] = [0, 0, 1];
