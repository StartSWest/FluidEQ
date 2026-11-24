/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDynamicsBand } from '../../common/dsp/dynamicsStage';

/** Under this a band is silence or a noise floor and is never lifted. */
export const LIFT_FLOOR_DB = -75;
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

/** Whether a band lifts anything, as the engine's `band_does_something`. */
export const bandLifts = (band: IDynamicsBand) =>
  band.upRatio > 1 && band.upMaxDb > 0;

export const bandHolds = (band: IDynamicsBand) => band.downRatio > 1;

/**
 * A band's gain as the engine reports it: its own gain and the make-up on
 * the processed sound, summed with the dry input by `mix` in amplitude —
 * `feq_compander_block_report`, and the `x + mix * (processed - x)` of
 * `feq_compander_process` taken one band at a time, which is exact because
 * the three bands sum back to the input.
 */
export const mixedGainDb = (
  gainDb: number,
  makeupDb: number,
  mix: number,
): number => 20 * Math.log10(1 - mix + mix * 10 ** ((gainDb + makeupDb) / 20));

/**
 * What make-up alone does at the given mix: the reported gain of a band the
 * curve leaves untouched. Taken out of both the curve and the dot, so the
 * dashed line of unity is "untouched" whatever the make-up, and a profile's
 * make-up does not read as every band lifting.
 */
const makeupShareDb = (makeupDb: number, mix: number): number =>
  mixedGainDb(0, makeupDb, mix);

/**
 * What a band does to a steady `levelDb` as it is heard — the mix included,
 * the make-up taken out. At a mix of one it is `dynamicsGainDb` exactly.
 */
export const heardGainDb = (
  band: IDynamicsBand,
  levelDb: number,
  makeupDb: number,
  mix: number,
): number =>
  mixedGainDb(dynamicsGainDb(band, levelDb), makeupDb, mix) -
  makeupShareDb(makeupDb, mix);

/**
 * The engine's reported gain on the same footing as `heardGainDb`, so the
 * dot of a band at a steady level lands on its curve.
 */
export const reportedToHeardDb = (
  reportedDb: number,
  makeupDb: number,
  mix: number,
): number => reportedDb - makeupShareDb(makeupDb, mix);

/**
 * The input level where a band's lift stops growing and reaches `upMaxDb`:
 * the top of the lift, which the curve shows as a filled point. Undefined
 * for a band that lifts nothing.
 */
export const liftTopDb = (band: IDynamicsBand): number | undefined =>
  bandLifts(band)
    ? band.upThresholdDb - (band.upMaxDb * band.upRatio) / (band.upRatio - 1)
    : undefined;
