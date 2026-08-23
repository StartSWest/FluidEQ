/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, NO_GAIN_FILTER_TYPES } from '../../common/constants';
import {
  IDspSettings,
  IEqBandSettings,
  IEqSettings,
  TEqModel,
} from '../../common/dsp/chain';
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

/**
 * Eight times the fit's grid, for finding a peak rather than matching a shape.
 *
 * A fit is judged everywhere at once and 256 points is ample for it. A maximum
 * is a single point, and whatever falls between two samples is simply not seen:
 * the graph lays its own grid down at one point per few pixels, so on a wide
 * window it was sampling places the trim's 256 never visited and finding the
 * curve a few hundredths higher there. Small, and enough to paint a warning
 * that read "0.0 dB over" — a contradiction the user had to look at.
 */
const PEAK_POINTS = 2_048;

const logFrequencies = (points: number): number[] => {
  const low = Math.log2(FIT_LOW_HZ);
  const step = (Math.log2(FIT_HIGH_HZ) - low) / (points - 1);
  return Array.from({ length: points }, (_, i) => 2 ** (low + i * step));
};

const fitFrequencies = (): number[] => logFrequencies(FIT_POINTS);

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
  model: TEqModel = 'clean',
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
        model,
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
  // Fitted through the same processing the rack will be heard through: the
  // models have different shapes, so a fit done against the cookbook would be
  // solving for a curve nobody is listening to.
  model: TEqModel = 'clean',
): readonly IEqBandSettings[] => {
  const movable = target.filter(canCarryGain);
  if (source.length === 0 || movable.length === 0) {
    return target;
  }
  const frequencies = fitFrequencies();
  const wanted = curveResponseDb(source, frequencies, sampleRate, model);

  const bandResponse = (band: IEqBandSettings, gainDb: number): number[] => {
    const coefficients = biquadCoefficients(
      {
        type: band.type as FilterTypeEnum,
        frequency: band.frequency,
        gainDb,
        quality: band.quality,
      },
      sampleRate,
      model,
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
    const current = curveResponseDb(
      withGains(),
      frequencies,
      sampleRate,
      model,
    );
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

/**
 * The loudest point of the whole rack, in dB, preamp excluded.
 *
 * Measured on the same terms the graph draws on — the subsonic filter at the
 * base rate, the bands at the design rate — so the figure the trim uses and the
 * shape on screen can never disagree about where the curve peaks.
 *
 * Zero when nothing boosts: a rack that only cuts needs no room made for it.
 */
export const eqChainPeakDb = (eq: IEqSettings, sampleRate: number): number => {
  const designRate = sampleRate * Math.max(1, eq.oversample);
  const frequencies = logFrequencies(PEAK_POINTS);
  // A dynamic band is measured at its WORST, which is not the same end for a
  // boost as for a cut. A dynamic boost is worst fully engaged, so it counts in
  // full. A dynamic cut is worst at rest — it spends most of the record doing
  // nothing — so counting it would reserve headroom against an attenuation
  // that is usually absent, and leave the curve clipping whenever it was.
  const worstCase = eq.bands.map((band) =>
    band.dynamic ? { ...band, gainDb: Math.max(0, band.gainDb) } : band,
  );
  const response = curveResponseDb(
    worstCase,
    frequencies,
    designRate,
    eq.model,
  );
  if (eq.subsonicHz > 0) {
    const subsonic = biquadCoefficients(
      {
        type: FilterTypeEnum.HPQ,
        frequency: eq.subsonicHz,
        gainDb: 0,
        quality: 0.707,
      },
      sampleRate,
      eq.model,
    );
    frequencies.forEach((frequency, index) => {
      response[index] += biquadMagnitudeDb(subsonic, frequency, sampleRate);
    });
  }
  return Math.max(0, ...response);
};

/**
 * The loudest the WHOLE chain can get, in dB, above what came in.
 *
 * The EQ is not the only stage with gain in it, and the preamp is in front of
 * all of them, so regulating for the bands alone left the other two to clip
 * past it. Signal order decides what counts:
 *
 *  - **The exciter runs BEFORE the worklet** — `source → exciter → worklet` —
 *    so its boost arrives at the preamp already applied. It is parallel, dry
 *    plus `mix` times the shaped highs, and the shaper is normalised to span
 *    exactly ±1 at every drive, so the worst case in its band is the two at
 *    full agreement: `1 + mix`.
 *  - **The compressor's makeup runs after the bands**, so trimming the input
 *    is what buys it room. The crossover splits the spectrum, so at any one
 *    frequency a single band is in charge — the worst case is the largest
 *    makeup, not the sum of the three.
 *  - **The maximizer is excluded on purpose.** It only ever reduces, and its
 *    ceiling is the chain's output guarantee rather than another thing to make
 *    room for.
 *
 * The three are added rather than combined per frequency, which is worse than
 * the truth whenever their peaks land in different places — conservative by
 * construction, which is the right direction for a safety trim and the wrong
 * one for a loudness control. It costs at most a decibel or two of level in
 * the case where all three stages are running at once.
 */
/**
 * Room beyond what the magnitude response asks for, in dB, whenever the rack
 * is shaping at all.
 *
 * The response peak is a STEADY-STATE guarantee: it says no continuous tone
 * comes out louder than it went in. It does not bound a transient. A filter
 * rings, and a sharp edge through a bank of them can leave a sample peak above
 * anything the magnitude plot predicts — worst in the treble, where the edges
 * are. On top of that sits the reconstruction: a signal legal at every sample
 * can still reconstruct above full scale between them, which is why broadcast
 * has used a decibel of true-peak margin for decades.
 *
 * 1.5 dB covers both. Not applied to a rack that is not shaping anything: a
 * flat EQ must be transparent, and taking a decibel and a half from it would
 * make switching the whole stage on audibly quieter for no reason.
 */
export const TRIM_MARGIN_DB = 1.5;

/** Whether anything in the chain is actually altering the signal. */
const isShaping = (settings: IDspSettings): boolean =>
  settings.eq.bands.some((band) => band.enabled && band.gainDb !== 0) ||
  settings.eq.subsonicHz > 0 ||
  settings.eq.fuzzAmount > 0 ||
  settings.exciter.enabled ||
  settings.compressor.enabled;

export const chainPeakDb = (
  settings: IDspSettings,
  sampleRate: number,
): number => {
  const bands = eqChainPeakDb(settings.eq, sampleRate);
  const exciter = settings.exciter.enabled
    ? 20 * Math.log10(1 + settings.exciter.mix)
    : 0;
  const makeup = settings.compressor.enabled
    ? Math.max(0, ...settings.compressor.bands.map((band) => band.makeupDb))
    : 0;
  return Math.max(0, bands + exciter + makeup);
};

/**
 * The chain with its input regulated to whatever it needs, end to end.
 *
 * Applied where every change passes through rather than in each control that
 * could move the figure — a band drag, a preset, an import, a change of
 * character or of oversampling, the exciter's mix, a compressor makeup — and
 * any of them left out would be a setting that silently clips.
 *
 * Only `trimDb` moves. The preamp beside it is the user's offset and is never
 * written from here, so their zero keeps meaning "exactly what the chain needs
 * and not a decibel more".
 *
 * Rounded to a tenth because that is what gets displayed: a regulator reading
 * -6.1 while holding -6.0837 invites the question of which one is true. UP to
 * the next tenth, never to the nearest one — rounding to nearest left as much
 * as 0.05 dB of the peak uncovered, so the curve still finished fractionally
 * past unity and the graph dutifully shaded it. A twentieth of a decibel of
 * level is worth nothing; a warning that fires when nothing is wrong costs the
 * warning.
 */
export const withInputTrim = (
  settings: IDspSettings,
  sampleRate: number,
): IDspSettings => {
  const margin = isShaping(settings) ? TRIM_MARGIN_DB : 0;
  const trim =
    -Math.ceil((chainPeakDb(settings, sampleRate) + margin) * 10) / 10;
  return trim === settings.eq.trimDb
    ? settings
    : { ...settings, eq: { ...settings.eq, trimDb: trim } };
};
