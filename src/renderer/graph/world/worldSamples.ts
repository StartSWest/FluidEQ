/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneWorld } from 'common/sceneWorld';

/** Pixels past which the world skips multisampling: it is supersampled. */
export const MULTISAMPLE_LIMIT = 3840 * 2160;

/**
 * How many samples a pixel of the world's picture is drawn with: four, the
 * edge smoothing FSR asks its input to have, unless the world says it has
 * no hard edge to smooth (`ISceneWorld.multisample`, a world of glows) or
 * the frame is so large it is supersampled instead.
 */
const worldSamples = (
  world: Pick<ISceneWorld, 'multisample'>,
  width: number,
  height: number,
  maxSamples: number,
): number =>
  world.multisample && width * height <= MULTISAMPLE_LIMIT
    ? Math.min(4, maxSamples)
    : 0;

export default worldSamples;
