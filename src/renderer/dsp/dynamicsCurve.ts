/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDynamicsBand } from '../../common/dsp/dynamicsStage';

/** Under this a band is silence or a noise floor and is never lifted. */
const LIFT_FLOOR_DB = -75;
/** Over this many dB above the floor the lift reaches its full amount. */
const LIFT_FADE_DB = 6;

/**
 * The gain a band asks for at a steady `levelDb`, exactly as the engine's
 * `target_gain_db` in `compander.cpp` computes it — so the picture is the
 * curve the engine plays. Change the two together.
 */
const dynamicsGainDb = (band: IDynamicsBand, levelDb: number): number => {
  let gain = 0;
  if (band.upRatio > 1 && levelDb < band.upThresholdDb) {
    const lift = Math.min(
      band.upMaxDb,
      (band.upThresholdDb - levelDb) * (1 - 1 / band.upRatio),
    );
    const above = levelDb - LIFT_FLOOR_DB;
    gain += lift * Math.min(Math.max(above / LIFT_FADE_DB, 0), 1);
  }
  if (band.downRatio > 1 && levelDb > band.downThresholdDb) {
    gain -= (levelDb - band.downThresholdDb) * (1 - 1 / band.downRatio);
  }
  return gain;
};

export default dynamicsGainDb;
