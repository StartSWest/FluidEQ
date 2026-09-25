/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { IFilter, IFiltersMap } from './constants';
import {
  SAMPLE_FREQUENCIES,
  gainAtFrequency,
  getTFCoefficients,
} from './response';
import { ISmartEqSettings, sanitizeSmartEqSettings } from './smartEq';

/**
 * Turning a solved correction into the layer, and when a running mode may
 * replace the layer it wrote.
 *
 * THERE IS NO STEPPING, BLENDING OR ACCUMULATING HERE ANY MORE, and the
 * reason is the whole design. The measurement is of the source — the sound
 * before FluidEQ touches it — so a solve is a pure function of that source:
 * the same record gives the same answer whatever the layer held before, and
 * writing the answer whole is correct because nothing in it was measured
 * through the previous answer. Everything that used to live here — a
 * deadband, a settle, a step size, a memory over windows, a drift count and a
 * reset — existed to tame a loop that measured its own output and added the
 * residual back on. Take the loop away and every one of those became a
 * memory of where the correction started, which is exactly what a correction
 * must not have.
 */

/**
 * How far this layer may go, per band, in dB.
 *
 * Asymmetric because cutting and boosting are not equally risky. A cut costs
 * nothing but level; a boost costs headroom, and this layer sits under the
 * listener's own bands, a voicing and a driver correction, with the preamp
 * reserving room for the sum of all of them.
 *
 * Bounds on one solve, and therefore on the layer: a solve never adds to
 * what is there, it replaces it.
 */
export const SMART_EQ_MAX_BOOST_DB = 6;
export const SMART_EQ_MAX_CUT_DB = 9;

/**
 * How far a fresh solve has to differ from the layer already written before
 * a running mode writes it, in dB — measured on the layer's curve, not on
 * one band.
 *
 * A running mode solves again at every checkpoint the measurement settles
 * on, and the estimate of a record keeps sharpening as more of it is heard:
 * an intro, then a chorus, then the average of both. Each solve is right for
 * what has been heard so far, and most of them differ from the last by a
 * fraction of a decibel nobody could hear. Writing every one would rewrite
 * the engine's configuration a dozen times a song for nothing audible, and
 * each write is a reload on the engine's side.
 *
 * One decibel is about where a broad change to a curve becomes audible at
 * all. Under it the layer stands; over it the new answer replaces the old
 * whole, and the mode says what changed.
 */
export const SMART_EQ_REWRITE_DB = 1;

/**
 * Turn a solved set of gains into the layer to store.
 *
 * Every band is kept, including the ones that came out at 0 dB: the map is
 * the layer's whole shape, and a band missing from it reads differently from
 * a band at zero to anything comparing two layers. Only the *rendering*
 * drops the neutral ones.
 */
export const buildSmartEqSettings = (
  bands: IFilter[],
  gains: Record<string, number>,
  /**
   * What the measurement found, and the one thing it must not decide.
   *
   * `intensity` is the listener's strength slider, passed through from the
   * layer being replaced. It is not a result and no measurement sets it; it is
   * here so a rebuilt layer does not come back at full strength over one that
   * had been turned down.
   */
  measurement: Pick<
    ISmartEqSettings,
    'status' | 'lowFrequency' | 'highFrequency' | 'intensity'
  > = {},
  /**
   * How far a band may be moved, in either direction.
   *
   * One number rather than a pair, and symmetric, because an asymmetric clamp
   * biases a correction that was centred: the anchor removes the mean and then
   * the tighter side truncates first, so what is applied carries a mean the
   * solver never asked for. See `renderer/utils/correctionLimit` for the
   * measurement that settled it and for why the default is what the old pair
   * allowed upward.
   */
  limitDb: number = SMART_EQ_MAX_BOOST_DB,
): ISmartEqSettings | undefined => {
  const filters: IFiltersMap = {};
  bands.forEach((band) => {
    const solved = gains[band.id];
    const gain = Number.isFinite(solved) ? solved : band.gain;
    filters[band.id] = {
      ...band,
      // Bounded here, so every path that writes this layer is bounded.
      gain: Math.max(-limitDb, Math.min(limitDb, gain)),
    };
  });

  return sanitizeSmartEqSettings({ filters, ...measurement });
};

/**
 * The layer's response at every sample frequency, in dB — what is heard,
 * which is what two layers are compared on.
 */
export const smartEqResponse = (
  bands: IFilter[],
  gains: Record<string, number>,
): number[] => {
  const filters = bands
    .filter((band) => Number.isFinite(gains[band.id]))
    .map((band) => ({ ...band, gain: gains[band.id] }))
    .map((filter) => getTFCoefficients(filter));
  return SAMPLE_FREQUENCIES.map((frequency) =>
    filters.reduce(
      (sum, coefficients) => sum + gainAtFrequency(frequency, coefficients),
      0,
    ),
  );
};

/**
 * Whether a fresh solve is far enough from the written layer to be worth
 * writing — see `SMART_EQ_REWRITE_DB`. Compared as curves, because bells
 * overlap: two bands moving a half decibel each in the same direction is a
 * decibel in the sound, and one band moving a decibel against its neighbour
 * is nearly nothing.
 */
export const isSmartEqRewriteDue = (
  bands: IFilter[],
  written: Record<string, number>,
  solved: Record<string, number>,
  thresholdDb: number = SMART_EQ_REWRITE_DB,
): boolean => {
  const before = smartEqResponse(bands, written);
  const after = smartEqResponse(bands, solved);
  return before.some(
    (level, index) => Math.abs(after[index] - level) >= thresholdDb,
  );
};

/**
 * Scale the whole layer back inside a response limit, immediately.
 *
 * The per-band clamp bounds each band and the CURVE is what the limit line
 * promises: neighbouring bells sum, so two lawful +6 bands can stack +9 into
 * the response. So an out-of-bounds RESPONSE is scaled home in one move.
 * Scaling down is the one intervention that is always safe — it reduces a
 * correction that was already judged too large and can lift nothing — and
 * because every gain shrinks by the same factor, the correction keeps its
 * shape: it gets smaller, not different. Two passes, because a biquad's
 * response is only approximately proportional to its gain.
 */
export const confineSmartEqResponse = (
  gains: Record<string, number>,
  bands: IFilter[],
  limitDb: number,
): Record<string, number> => {
  if (!(limitDb > 0)) {
    return gains;
  }
  let scaled = { ...gains };
  for (let pass = 0; pass < 2; pass += 1) {
    const current = scaled;
    const peak = smartEqResponse(bands, current).reduce(
      (highest, level) => Math.max(highest, Math.abs(level)),
      0,
    );
    if (peak <= limitDb) {
      break;
    }
    const factor = limitDb / peak;
    scaled = Object.fromEntries(
      Object.entries(scaled).map(([id, gain]) => [id, gain * factor]),
    );
  }
  return scaled;
};
