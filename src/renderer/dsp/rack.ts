/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, NO_GAIN_FILTER_TYPES } from '../../common/constants';
import { IEqBandSettings } from '../../common/dsp/chain';
import { biquadCoefficients, biquadMagnitudeDb } from './biquad';

/**
 * Moving a curve from one rack to another without changing what it sounds like.
 *
 * The first attempt at this interpolated the GAIN VALUES between bands, and it
 * was wrong for a reason no round-trip test could show: a parametric curve's
 * response at a frequency is not the gain of the nearest band. It is the sum of
 * every filter's contribution there, and Q decides how far each one reaches. An
 * imported curve with Qs from 0.7 to 6 has a response that the piecewise line
 * through its gain values does not resemble — so switching band count changed
 * the sound even when the numbers were carried across perfectly.
 *
 * What is preserved here is the response itself. The source rack is evaluated
 * as filters, and the target rack's gains are then solved for so that its own
 * summed response matches. That is the only definition of "the same curve" that
 * survives a change of band count, because the bands are what changed.
 */

/** Where the fit is judged. Log-spaced, because that is how the ear and the
 * graph both read frequency, and dense enough that a narrow band cannot slip
 * between two points and be fitted as though it were not there. */
const FIT_POINTS = 256;
const FIT_LOW_HZ = 20;
const FIT_HIGH_HZ = 20_000;

const fitFrequencies = (): number[] => {
  const low = Math.log2(FIT_LOW_HZ);
  const step = (Math.log2(FIT_HIGH_HZ) - low) / (FIT_POINTS - 1);
  return Array.from({ length: FIT_POINTS }, (_, i) => 2 ** (low + i * step));
};

const canCarryGain = (band: IEqBandSettings): boolean =>
  band.enabled && !NO_GAIN_FILTER_TYPES.includes(band.type as never);

/**
 * The combined response of a rack, in dB, at each frequency asked for.
 *
 * Cascaded filters multiply their magnitudes, so in dB they add — which is why
 * this is a sum and not something more careful.
 */
export const curveResponseDb = (
  bands: readonly IEqBandSettings[],
  frequencies: readonly number[],
  sampleRate: number,
): number[] => {
  const response = new Array<number>(frequencies.length).fill(0);
  bands
    .filter((band) => band.enabled)
    .forEach((band) => {
      const coefficients = biquadCoefficients(
        {
          type: band.type as FilterTypeEnum,
          frequency: band.frequency,
          gainDb: band.gainDb,
          quality: band.quality,
        },
        sampleRate,
      );
      frequencies.forEach((frequency, index) => {
        response[index] += biquadMagnitudeDb(
          coefficients,
          frequency,
          sampleRate,
        );
      });
    });
  return response;
};

/**
 * Solve `(AᵀA + λI) x = Aᵀb` by Gaussian elimination with partial pivoting.
 *
 * λ is a small ridge term and it is not optional. Neighbouring bands in a
 * 31-band rack overlap almost completely, which makes `AᵀA` nearly singular:
 * without it the solver answers with enormous equal-and-opposite gains that
 * cancel to roughly the right curve and clip the moment anything moves.
 */
const solveRidge = (
  columns: number[][],
  targetDb: readonly number[],
  lambda: number,
): number[] => {
  const n = columns.length;
  const normal: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let sum = 0;
      for (let k = 0; k < targetDb.length; k += 1) {
        sum += columns[i][k] * columns[j][k];
      }
      normal[i][j] = sum + (i === j ? lambda : 0);
    }
    let rhs = 0;
    for (let k = 0; k < targetDb.length; k += 1) {
      rhs += columns[i][k] * targetDb[k];
    }
    normal[i][n] = rhs;
  }

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(normal[row][col]) > Math.abs(normal[pivot][col])) {
        pivot = row;
      }
    }
    // A pivot this small means a band with no influence anywhere on the grid.
    // Nothing to solve for, and dividing by it would poison every gain after.
    if (Math.abs(normal[pivot][col]) >= 1e-12) {
      [normal[col], normal[pivot]] = [normal[pivot], normal[col]];
      for (let row = 0; row < n; row += 1) {
        if (row !== col) {
          const factor = normal[row][col] / normal[col][col];
          for (let k = col; k <= n; k += 1) {
            normal[row][k] -= factor * normal[col][k];
          }
        }
      }
    }
  }

  return Array.from({ length: n }, (_, i) =>
    Math.abs(normal[i][i]) < 1e-12 ? 0 : normal[i][n] / normal[i][i],
  );
};

/** The dial's own limit — a solved gain outside it cannot be stored anyway. */
const MAX_GAIN_DB = 24;

/**
 * `target`'s bands, re-gained so the rack sounds like `source` did.
 *
 * Only the gains move. Type, frequency and Q belong to the rack being moved to,
 * or it is not that rack any more.
 */
export const rackMatchingCurveOf = (
  target: readonly IEqBandSettings[],
  source: readonly IEqBandSettings[],
  sampleRate: number,
): readonly IEqBandSettings[] => {
  const movable = target.filter(canCarryGain);
  if (source.length === 0 || movable.length === 0) {
    return target;
  }
  const frequencies = fitFrequencies();
  const wanted = curveResponseDb(source, frequencies, sampleRate);

  const bandResponse = (band: IEqBandSettings, gainDb: number): number[] => {
    const coefficients = biquadCoefficients(
      {
        type: band.type as FilterTypeEnum,
        frequency: band.frequency,
        gainDb,
        quality: band.quality,
      },
      sampleRate,
    );
    return frequencies.map((frequency) =>
      biquadMagnitudeDb(coefficients, frequency, sampleRate),
    );
  };

  /**
   * Solved by repeated correction rather than in one shot, because a bell is
   * not linear in its own gain.
   *
   * A cookbook peaking filter BROADENS as it is turned up: its response at
   * +12 dB is not twelve times its response at +1 dB, it is wider as well as
   * taller. Fitting against a single fixed shape therefore lands close and
   * stops, which measured 2.68 dB of worst-case error on a real published
   * curve — better than interpolating gains, and still audible.
   *
   * Each pass measures what the rack currently does, asks the solver only for
   * the DIFFERENCE that remains, and re-measures each band's slope at the gain
   * it now holds. That is a Gauss-Newton step with a numerical Jacobian, and
   * three or four of them are plenty.
   */
  const gains = new Array<number>(movable.length).fill(0);
  const withGains = (): IEqBandSettings[] => {
    let next = 0;
    return target.map((band) => {
      if (!canCarryGain(band)) {
        return band;
      }
      const gainDb = gains[next];
      next += 1;
      return { ...band, gainDb };
    });
  };

  for (let pass = 0; pass < 5; pass += 1) {
    const current = curveResponseDb(withGains(), frequencies, sampleRate);
    const residual = wanted.map((value, index) => value - current[index]);
    const columns = movable.map((band, index) => {
      const base = bandResponse(band, gains[index]);
      const bumped = bandResponse(band, gains[index] + 1);
      return bumped.map((value, at) => value - base[at]);
    });
    const delta = solveRidge(columns, residual, 1e-3);
    let largest = 0;
    for (let index = 0; index < gains.length; index += 1) {
      gains[index] = Math.max(
        -MAX_GAIN_DB,
        Math.min(MAX_GAIN_DB, gains[index] + delta[index]),
      );
      largest = Math.max(largest, Math.abs(delta[index]));
    }
    if (largest < 0.01) {
      break;
    }
  }

  let next = 0;
  return target.map((band) => {
    if (!canCarryGain(band)) {
      return band;
    }
    const gain = gains[next];
    next += 1;
    return { ...band, gainDb: Math.round(gain * 100) / 100 };
  });
};
