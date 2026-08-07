/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import {
  FilterTypeEnum,
  IFilter,
  MAX_GAIN,
  MIN_GAIN,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { SMART_EQ_MAX_FREQUENCY, SMART_EQ_MIN_FREQUENCY } from 'common/smartEq';
import { clamp } from './utils';

/**
 * Auto balance: measure what is actually reaching the speakers, then flatten
 * the peaks and dips while leaving the music's own spectral tilt alone.
 *
 * Everything in this file is pure — plain numbers and typed arrays, no Web
 * Audio, no wall clock. The hook owns the audio plumbing and feeds frames in;
 * every decision about whether we have heard enough is made here, so it can be
 * driven by synthetic frames in a test.
 */

/* -------------------------------------------------------------------------
 * Correctable range
 * ---------------------------------------------------------------------- */

/**
 * Frequencies outside this band are left alone. Below it the capture is
 * dominated by the room and by content that simply is not there; above it the
 * measurement is mostly dither and codec noise. Correcting either produces
 * confident-looking nonsense.
 *
 * Owned by the Smart EQ layer rather than declared here, because the layer's
 * band centres are cropped to exactly this range: two copies of the number
 * would drift apart and leave the layer with bands the measurement refuses to
 * trust.
 */
export const BALANCE_MIN_FREQUENCY = SMART_EQ_MIN_FREQUENCY;
export const BALANCE_MAX_FREQUENCY = SMART_EQ_MAX_FREQUENCY;

/**
 * Nine roughly-octave regions spanning exactly the correctable band, so
 * coverage and the range we are willing to correct agree by construction.
 * Coverage is tracked per region rather than per point because "have we heard
 * the treble yet" is a question about a region, and because a label per region
 * is what lets the UI say *why* it is still listening.
 */
export const BALANCE_REGION_EDGES = [
  35, 70, 140, 280, 560, 1120, 2240, 4480, 8960, 15000,
];

export const BALANCE_REGION_LABELS = [
  'deep bass',
  'bass',
  'low mids',
  'mids',
  'upper mids',
  'presence',
  'treble',
  'high treble',
  'air',
];

/* -------------------------------------------------------------------------
 * Frame acceptance
 * ---------------------------------------------------------------------- */

/** Nominal spacing between analyser frames, used to bound a stalled tick. */
export const BALANCE_FRAME_INTERVAL_MS = 45;

/**
 * Frame peak below which a frame contributes nothing, and the peak at which it
 * counts fully. Fade-outs, reverb tails and room tone have spectra nothing like
 * the program, and admitting them is the direct cause of "six seconds of a
 * quiet intro produced a confident, wrong correction". The 25 dB ramp keeps the
 * weighting continuous so material hovering near the gate does not make the
 * estimate jump between two populations.
 */
export const FRAME_MIN_PEAK_DBFS = -60;
export const FRAME_FULL_PEAK_DBFS = -35;

/**
 * A region sitting this low is on the analyser's own -100 dB clamp. Averaging
 * clamped values manufactures a flat noise shelf that reads as a real treble
 * deficit, so those regions are skipped rather than measured.
 */
export const ABS_FLOOR_DBFS = -85;

/**
 * A region more than this far below the frame peak carries no information.
 * Music's own tilt already spans ~25 dB across the band, so a tighter gate
 * would falsely reject the air of acoustic material. The ramp avoids a hard
 * threshold, which would make a marginal region accumulate in bursts and
 * contaminate its own variance estimate with the gating.
 */
export const REGION_FLOOR_DB = 45;
export const REGION_FLOOR_RAMP_DB = 10;

/**
 * Power averaging is outlier-sensitive by design; this bounds what a single
 * leaked full-scale bin can do to a point.
 */
export const LEVEL_CLAMP_LO = -80;
export const LEVEL_CLAMP_HI = 30;

/* -------------------------------------------------------------------------
 * Coverage and stopping
 * ---------------------------------------------------------------------- */

/** Weighted fully-excited frames a region needs for full evidence (~2 s). */
export const REGION_TARGET_WEIGHT = 44;

/**
 * Standard error at which a region is precise enough. The correction is scaled
 * by `strength`, so 1.5 dB of level error is ~1 dB of gain error — about the
 * just-noticeable difference for a broad band. Tightening it multiplies
 * listening time for an inaudible gain.
 */
export const REGION_SE_TARGET_DB = 1.5;

/**
 * Effective-sample-size factor. Analyser frames are not independent: the
 * analyser smooths with a 0.62 time constant and we hop 45 ms into an ~85 ms
 * window, giving a lag-1 correlation around 0.75. Deliberately pessimistic —
 * underestimating the correlation is what makes a capture stop early on data
 * that only looks settled.
 */
export const EFFECTIVE_FRAME_RATIO = 0.15;

/** Confidence at which a region counts as heard. */
export const REGION_COVERED_CONFIDENCE = 0.9;

/** Floor no convergence test can bypass, and the hard ceiling. Both measure
 * *listened* time, so silence never counts against the user. */
export const MIN_LISTEN_MS = 4000;
export const MAX_LISTEN_MS = 25000;

/** One convergence checkpoint per second of listened time. */
export const CONVERGENCE_CHECK_MS = 1000;

/**
 * Maximum drift of the smoothed, tilt-removed residual between checkpoints.
 * 0.4 dB moves a band by about 0.26 dB after `strength` — below audibility. If
 * another second of listening cannot move a band further than that, more
 * listening is pointless.
 */
export const CONVERGENCE_TOLERANCE_DB = 0.4;
export const CONVERGENCE_HOLDS = 3;

/**
 * How long BOTH the weakest region and the mean must fail to improve before we
 * accept the source is genuinely band-limited. Requiring both matters: during a
 * quiet intro the weakest region sits still while everything else fills in, and
 * a single-signal rule would reproduce exactly the fixed-timer bug.
 */
export const STALL_GRACE_MS = 8000;
export const STALL_IMPROVEMENT = 0.02;

/* -------------------------------------------------------------------------
 * Correction limits
 * ---------------------------------------------------------------------- */

/** Below this confidence a band holds its current gain instead of guessing. */
export const MIN_BAND_CONFIDENCE = 0.4;

/**
 * The tilt fit needs leverage. Below a four-octave trusted span straddling the
 * midrange, a sloped program and a broad resonance are not separable — the fit
 * absorbs the resonance and every band inherits a fabricated slope.
 */
/**
 * Ridge weight for the joint gain solve, as a fraction of the mean diagonal.
 * Overlapping bands make the system near-singular; without this the exact
 * least-squares answer is a large alternating comb of boosts and cuts that
 * fits the curve on paper, sounds terrible, and wastes headroom.
 */
export const SOLVE_RIDGE = 0.08;

export const MIN_TRUSTED_OCTAVES = 4;
export const TRUSTED_LOW_ANCHOR_HZ = 560;
export const TRUSTED_HIGH_ANCHOR_HZ = 1120;

/* -------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------- */

/** One averaged point of the measured output spectrum. */
export interface ISpectrumSample {
  frequency: number;
  /** Level in dB, relative to the loudest part of the same measurement. */
  level: number;
  /**
   * 0..1 trust in `level`. Absent means fully trusted, which is what
   * hand-built spectra construct.
   */
  confidence?: number;
}

export interface IAutoBalanceOptions {
  /** Fraction of the measured deviation that is corrected. */
  strength?: number;
  /** Boosting a dip costs headroom, so it is limited harder than a cut. */
  maxBoost?: number;
  maxCut?: number;
  /** Width of the smoothing window used to reject FFT noise. */
  smoothingOctaves?: number;
  /** Bands below this confidence hold their current gain instead of guessing. */
  minConfidence?: number;
  /**
   * The capture measures the already-corrected output, so the result is a
   * residual. Adding it to the current gain makes repeated runs converge
   * instead of undoing each other.
   */
  relativeToCurrentGain?: boolean;
  /**
   * What everything deliberate below this correction already does, in dB.
   *
   * Not a wish: those layers are already written into the config and already
   * inside the capture. Naming them here is what stops the measurement reading
   * them as error and cancelling them out, and it is what turns the answer into
   * the residual it claims to be — the correction ends up steering toward
   * `the program's tilt + target` rather than toward flat.
   *
   * Followed by its shape, not by its slope. A straight line in log-frequency
   * is exactly what the tilt fit removes from the measurement, so a target is
   * followed only as far as it departs from one — see the fit below for why
   * anything else cannot converge.
   */
  targetCurve?: ISpectrumSample[];
}

const DEFAULTS: Required<IAutoBalanceOptions> = {
  strength: 0.65,
  maxBoost: 6,
  maxCut: 9,
  smoothingOctaves: 0.5,
  minConfidence: MIN_BAND_CONFIDENCE,
  relativeToCurrentGain: true,
  targetCurve: [],
};

const clamp01 = (value: number) => clamp(value, 0, 1);

const weightOf = (sample: ISpectrumSample) => sample.confidence ?? 1;

/* -------------------------------------------------------------------------
 * Spectrum maths
 * ---------------------------------------------------------------------- */

/**
 * Normalised dB shape of one filter at unit gain.
 *
 * Setting every band to the deviation measured at its own centre is only
 * correct when the bands do not overlap — and they always do. A Q of 1 is
 * roughly 1.4 octaves wide, so a 31-band layout on 1/3-octave centres stacks
 * three or four bells over every point and the summed correction lands two to
 * three times too strong. Knowing each filter's shape is what lets the gains
 * be solved together instead of guessed one at a time.
 *
 * This is the small-signal shape, which is what makes the problem linear and
 * therefore solvable.
 */
export const filterShapeAt = (
  filter: Pick<IFilter, 'type' | 'frequency' | 'quality'>,
  frequency: number,
): number => {
  if (
    NO_GAIN_FILTER_TYPES.includes(filter.type) ||
    filter.frequency <= 0 ||
    frequency <= 0
  ) {
    // These types carry no gain, so there is nothing to solve for.
    return 0;
  }

  const ratio = frequency / filter.frequency;
  if (filter.type === FilterTypeEnum.LSC) {
    return 1 / (1 + ratio ** 2);
  }
  if (filter.type === FilterTypeEnum.HSC) {
    return 1 / (1 + (1 / ratio) ** 2);
  }
  const detune = Math.max(0.05, filter.quality) * (ratio - 1 / ratio);
  return 1 / (1 + detune ** 2);
};

/**
 * Solve `A x = b` by Gaussian elimination with partial pivoting. The system is
 * at most MAX_NUM_FILTERS square, so a direct O(n^3) solve costs far less than
 * the FFT that produced the data.
 */
const solveLinearSystem = (
  matrix: number[][],
  vector: number[],
): number[] | undefined => {
  const n = vector.length;
  const a = matrix.map((row, index) => [...row, vector[index]]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(a[pivot][col]) < 1e-9) {
      // Singular even after regularisation; refuse rather than emit NaNs.
      return undefined;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];

    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / a[col][col];
      if (factor !== 0) {
        for (let k = col; k <= n; k += 1) {
          a[row][k] -= factor * a[col][k];
        }
      }
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = a[row][n];
    for (let col = row + 1; col < n; col += 1) {
      sum -= a[row][col] * x[col];
    }
    x[row] = sum / a[row][row];
  }
  return x.every((value) => Number.isFinite(value)) ? x : undefined;
};

/**
 * Confidence-weighted least-squares fit of
 * `level = slope * log10(frequency) + intercept`.
 *
 * This line is the program material's own spectral tilt. Music is not flat —
 * its long-term average falls with frequency — so flattening the measurement
 * outright would strip the life out of it. Correcting only the *deviation*
 * from the fitted tilt removes resonances, boom and honk while leaving the
 * natural balance of the recording intact.
 */
export const fitSpectralTilt = (samples: ISpectrumSample[]) => {
  const usable = samples.filter(
    ({ frequency, level }) =>
      frequency > 0 && Number.isFinite(level) && Number.isFinite(frequency),
  );
  if (usable.length < 2) {
    return { slope: 0, intercept: 0 };
  }

  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  usable.forEach((sample) => {
    const w = weightOf(sample);
    const x = Math.log10(sample.frequency);
    sumW += w;
    sumX += w * x;
    sumY += w * sample.level;
    sumXY += w * x * sample.level;
    sumXX += w * x * x;
  });

  if (sumW <= 0) {
    return { slope: 0, intercept: 0 };
  }
  const denominator = sumW * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) {
    return { slope: 0, intercept: sumY / sumW };
  }
  const slope = (sumW * sumXY - sumX * sumY) / denominator;
  return { slope, intercept: (sumY - slope * sumX) / sumW };
};

/** Confidence-weighted fractional-octave smoothing in the log domain. */
export const smoothSpectrum = (
  samples: ISpectrumSample[],
  octaves: number,
): ISpectrumSample[] => {
  const halfWidth = Math.log10(2 ** (octaves / 2));
  return samples.map((sample, index) => {
    const centre = Math.log10(sample.frequency);
    let total = 0;
    let count = 0;
    for (let offset = index; offset >= 0; offset -= 1) {
      if (
        Math.abs(Math.log10(samples[offset].frequency) - centre) > halfWidth
      ) {
        break;
      }
      const w = weightOf(samples[offset]);
      total += w * samples[offset].level;
      count += w;
    }
    for (let offset = index + 1; offset < samples.length; offset += 1) {
      if (
        Math.abs(Math.log10(samples[offset].frequency) - centre) > halfWidth
      ) {
        break;
      }
      const w = weightOf(samples[offset]);
      total += w * samples[offset].level;
      count += w;
    }
    return {
      frequency: sample.frequency,
      level: count > 0 ? total / count : sample.level,
      confidence: sample.confidence,
    };
  });
};

/** Linear interpolation of a spectrum field at an arbitrary frequency. */
export const sampleSpectrumAt = (
  samples: ISpectrumSample[],
  frequency: number,
  field: 'level' | 'confidence' = 'level',
): number => {
  const read = (sample: ISpectrumSample) =>
    field === 'confidence' ? weightOf(sample) : sample.level;

  if (samples.length === 0) {
    return 0;
  }
  if (frequency <= samples[0].frequency) {
    return read(samples[0]);
  }
  const last = samples[samples.length - 1];
  if (frequency >= last.frequency) {
    return read(last);
  }

  const upperIndex = samples.findIndex(
    (sample) => sample.frequency >= frequency,
  );
  const upper = samples[upperIndex];
  const lower = samples[upperIndex - 1] ?? upper;
  const span = Math.log10(upper.frequency) - Math.log10(lower.frequency);
  if (span <= 0) {
    return read(upper);
  }
  const position = (Math.log10(frequency) - Math.log10(lower.frequency)) / span;
  return read(lower) + (read(upper) - read(lower)) * position;
};

/**
 * Turn a measured spectrum into a gain for each band.
 *
 * The result is the inverse of the smoothed deviation from the program's own
 * tilt, scaled back by `strength` so the correction is a nudge rather than a
 * hard flattening, and centred so it changes tone rather than loudness. Bands
 * whose region was never heard well enough are left exactly where they are.
 */
export const buildBalancedGains = (
  spectrum: ISpectrumSample[],
  filters: IFilter[],
  options: IAutoBalanceOptions = {},
): Record<string, number> => {
  const {
    strength,
    maxBoost,
    maxCut,
    smoothingOctaves,
    minConfidence,
    relativeToCurrentGain,
    targetCurve,
  } = { ...DEFAULTS, ...options };

  const usable = spectrum
    .filter(
      ({ frequency, level }) =>
        Number.isFinite(level) &&
        frequency >= BALANCE_MIN_FREQUENCY &&
        frequency <= BALANCE_MAX_FREQUENCY,
    )
    .sort((left, right) => left.frequency - right.frequency);

  if (usable.length < 8 || filters.length === 0) {
    return {};
  }

  // The span gate only engages for real measurements. A hand-built spectrum
  // carries no confidence and is taken at face value.
  const hasConfidence = spectrum.some(
    (sample) => typeof sample.confidence === 'number',
  );
  if (hasConfidence) {
    const trusted = usable.filter(
      (sample) => weightOf(sample) >= minConfidence,
    );
    if (trusted.length === 0) {
      return {};
    }
    const low = trusted[0].frequency;
    const high = trusted[trusted.length - 1].frequency;
    if (
      Math.log2(high / low) < MIN_TRUSTED_OCTAVES ||
      low > TRUSTED_LOW_ANCHOR_HZ ||
      high < TRUSTED_HIGH_ANCHOR_HZ
    ) {
      return {};
    }
  }

  // The deliberate layers come off BEFORE the tilt is fitted, not after.
  //
  // The fitted line is meant to be the program material's own slope, and it is
  // the one thing here that is deliberately never corrected. A measurement
  // still carrying a bass shelf reads part of that shelf as slope, so fitting
  // first and subtracting the target afterwards leaves the target's own tilt
  // standing as a deviation — a constant drive that no gain can ever satisfy,
  // because a layer shaped like a straight line contributes nothing to the
  // residual it is supposed to cancel. Each run then adds another slice of it
  // and the correction walks off in a straight line until it hits the clamps.
  // Taking the layers out first makes the fit an estimate of the program alone,
  // which is what it always claimed to be.
  const hasTarget = targetCurve.length > 0;
  const steered = usable.map((sample) => ({
    frequency: sample.frequency,
    level:
      sample.level -
      (hasTarget ? sampleSpectrumAt(targetCurve, sample.frequency) : 0),
    confidence: sample.confidence,
  }));

  const { slope, intercept } = fitSpectralTilt(steered);
  const deviation = smoothSpectrum(
    steered.map((sample) => ({
      frequency: sample.frequency,
      level: sample.level - (slope * Math.log10(sample.frequency) + intercept),
      confidence: sample.confidence,
    })),
    smoothingOctaves,
  );

  const raw = filters.map((filter) => {
    const inBand =
      filter.frequency >= BALANCE_MIN_FREQUENCY &&
      filter.frequency <= BALANCE_MAX_FREQUENCY;
    // The per-band floor is applied here, not only by filtering the input: it
    // is what stops sampleSpectrumAt clamping an unmeasured band to the
    // nearest measured one at the edge of coverage.
    const measured = inBand
      ? clamp01(sampleSpectrumAt(deviation, filter.frequency, 'confidence'))
      : 0;
    const confidence = measured >= minConfidence ? measured : 0;
    return {
      id: filter.id,
      gain: filter.gain,
      confidence,
      // Solvable only if the band is trusted AND its type actually has a gain.
      isSolvable: confidence > 0 && !NO_GAIN_FILTER_TYPES.includes(filter.type),
      filter,
      correction: 0,
    };
  });

  // Desired correction at every measured frequency, centred so the answer is a
  // change of tone rather than of level.
  const targets = deviation.map((sample) => ({
    frequency: sample.frequency,
    weight: clamp01(sample.confidence ?? 1),
    want: -sample.level * strength,
  }));
  const totalWeight = targets.reduce((total, point) => total + point.weight, 0);
  const wantMean =
    totalWeight > 0
      ? targets.reduce((total, point) => total + point.want * point.weight, 0) /
        totalWeight
      : 0;

  // Solve every band's gain at once against the whole measured curve, so
  // overlapping bells share the correction instead of each applying it in
  // full. This is what keeps a 31-band layout smooth rather than tripling the
  // intended boost.
  const solvable = raw.filter((entry) => entry.isSolvable);
  if (solvable.length > 0 && totalWeight > 0) {
    const n = solvable.length;
    const shapes = solvable.map((entry) =>
      targets.map((point) => filterShapeAt(entry.filter, point.frequency)),
    );

    const normal: number[][] = Array.from({ length: n }, () =>
      new Array<number>(n).fill(0),
    );
    const rhs = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      for (let j = i; j < n; j += 1) {
        let sum = 0;
        for (let k = 0; k < targets.length; k += 1) {
          sum += targets[k].weight * shapes[i][k] * shapes[j][k];
        }
        normal[i][j] = sum;
        normal[j][i] = sum;
      }
      let sum = 0;
      for (let k = 0; k < targets.length; k += 1) {
        sum += targets[k].weight * shapes[i][k] * (targets[k].want - wantMean);
      }
      rhs[i] = sum;
    }

    // Ridge term. Heavily overlapping bands make the system near-singular, and
    // the unregularised answer is a huge alternating +/- comb that sums to the
    // right curve but sounds awful and eats headroom. This biases towards the
    // smallest set of gains that fits.
    const meanDiagonal =
      normal.reduce((total, row, index) => total + row[index], 0) / n;
    const ridge = Math.max(meanDiagonal * SOLVE_RIDGE, 1e-6);
    for (let i = 0; i < n; i += 1) {
      normal[i][i] += ridge;
    }

    const solved = solveLinearSystem(normal, rhs);
    if (solved) {
      solved.forEach((gain, index) => {
        solvable[index].correction = gain;
      });
    } else {
      // Fall back to the per-band reading rather than applying nothing.
      solvable.forEach((entry) => {
        entry.correction =
          -sampleSpectrumAt(deviation, entry.filter.frequency) * strength;
      });
    }
  }

  const mean = 0;

  return Object.fromEntries(
    raw.map((entry) => {
      // Clamp the correction, then clamp the total. The correction limit is
      // what stops one run swinging a band further than a measurement can
      // justify; the total limit is what Equalizer APO will build.
      //
      // Both now bound the Smart EQ layer alone rather than the user's band
      // plus a correction, because the bands handed in are the layer's own.
      // A band and the layer above it can therefore add up to more than ±20 dB
      // between them, which is safe: the preamp is sized from the peak of the
      // whole written chain, layers included, so the headroom follows.
      const base = relativeToCurrentGain ? entry.gain : 0;
      const gain =
        base +
        clamp((entry.correction - mean) * entry.confidence, -maxCut, maxBoost);
      return [entry.id, Math.round(clamp(gain, MIN_GAIN, MAX_GAIN) * 10) / 10];
    }),
  );
};

/* -------------------------------------------------------------------------
 * FFT cells
 * ---------------------------------------------------------------------- */

/** Inclusive FFT bin range backing one point of the analysis axis. */
export interface IAxisCell {
  firstBin: number;
  lastBin: number;
}

/**
 * Map each axis point to every FFT bin inside its cell.
 *
 * Reading a single nearest bin per point — which is fine for a display trace —
 * looks at barely a tenth of the spectrum: at 48 kHz with a 4096-point FFT the
 * 1536 bins between 2 kHz and 20 kHz are represented by ~107 single-bin
 * samples, so ~93% of the treble energy is never seen and what is left is a
 * noisy lottery. Averaging the whole cell is what makes the treble reading
 * stable enough to drive an EQ.
 */
export const createAxisCells = (
  axis: readonly number[],
  sampleRate: number,
  fftSize: number,
): IAxisCell[] => {
  const binWidth = sampleRate / fftSize;
  const maxBin = Math.max(1, fftSize / 2 - 1);

  return axis.map((frequency, index) => {
    // Cell edges are the geometric midpoints to the neighbouring points, so
    // cells tile the axis without gaps or overlap.
    const lower =
      index === 0 ? frequency : Math.sqrt(axis[index - 1] * frequency);
    const upper =
      index === axis.length - 1
        ? frequency
        : Math.sqrt(frequency * axis[index + 1]);

    // Bin 0 is DC and carries no musical information.
    const firstBin = clamp(Math.round(lower / binWidth), 1, maxBin);
    const lastBin = clamp(Math.round(upper / binWidth), firstBin, maxBin);
    return { firstBin, lastBin };
  });
};

/**
 * Power mean of each cell, in absolute dBFS. Writes into `out` to avoid
 * allocating a new array on every analyser frame.
 */
export const readAbsoluteLevels = (
  frequencyData: Float32Array,
  cells: IAxisCell[],
  out: Float64Array,
): Float64Array => {
  cells.forEach((cell, index) => {
    let power = 0;
    let count = 0;
    const last = Math.min(cell.lastBin, frequencyData.length - 1);
    for (let bin = cell.firstBin; bin <= last; bin += 1) {
      const level = frequencyData[bin];
      if (Number.isFinite(level)) {
        power += 10 ** (level / 10);
        count += 1;
      }
    }
    out[index] = count > 0 ? 10 * Math.log10(power / count) : -Infinity;
  });
  return out;
};

/* -------------------------------------------------------------------------
 * Capture accumulator
 * ---------------------------------------------------------------------- */

export interface IBalanceRegion {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  /** Inclusive axis-index range. */
  firstIndex: number;
  lastIndex: number;
  /** Geometric centre, used for the confidence curve and convergence probe. */
  centreFrequency: number;
}

/** One analyser frame, in absolute dBFS. */
export interface IBalanceFrame {
  levels: Float64Array;
  /** Loudest finite bin of the frame, in dBFS. */
  peakDb: number;
  /** Monotonic clock in ms, supplied by the caller. */
  timestampMs: number;
}

/** Weighted Welford state for one region's level. */
export interface IBalanceRegionState {
  weight: number;
  mean: number;
  m2: number;
}

export interface IBalanceCaptureState {
  axis: number[];
  regions: IBalanceRegion[];
  /** Sum of weight * linear power per axis point, relative to the frame's own
   * mean level. */
  power: Float64Array;
  weight: Float64Array;
  regionStates: IBalanceRegionState[];
  frames: number;
  acceptedFrames: number;
  listenedMs: number;
  lastTimestampMs: number;
  checkpoint:
    { probe: Float64Array; holds: number; atListenedMs: number } | undefined;
  bestWeakest: number;
  bestWeakestAtMs: number;
  bestMean: number;
  bestMeanAtMs: number;
}

export interface IBalanceRegionReport {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  weight: number;
  standardErrorDb: number;
  confidence: number;
  isCovered: boolean;
}

export type BalanceCaptureStatus = 'listening' | 'ready' | 'partial';

export interface IBalanceReport {
  samples: ISpectrumSample[];
  regions: IBalanceRegionReport[];
  /** Confidence of the WEAKEST region — "all frequencies heard" is a minimum,
   * not an average, and showing the minimum explains why it is still going. */
  coverage: number;
  /** Mean region confidence. Used only for stall detection. */
  meanCoverage: number;
  weakest: IBalanceRegionReport | undefined;
  listenedMs: number;
  frames: number;
  isConverged: boolean;
  isStalled: boolean;
  status: BalanceCaptureStatus;
}

export interface IBalanceResult {
  samples: ISpectrumSample[];
  status: 'ready' | 'partial';
  lowFrequency: number;
  highFrequency: number;
}

/** Per-region coverage, for drawing the measurement onto the response graph. */
export interface IBalanceProgressRegion {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  confidence: number;
  isCovered: boolean;
}

export interface IBalanceProgress {
  /** 0..100, monotone; never reaches 100 until the capture is done. */
  percent: number;
  weakestLabel: string;
  isSettling: boolean;
  isSilent: boolean;
  isPaused: boolean;
  listenedMs: number;
  /** Ordered low to high, so the graph can draw them along its x axis. */
  regions: IBalanceProgressRegion[];
}

/** Regions clipped to the axis. Regions holding no axis point are dropped. */
export const createBalanceRegions = (
  axis: readonly number[],
): IBalanceRegion[] => {
  const regions: IBalanceRegion[] = [];

  for (let index = 0; index < BALANCE_REGION_EDGES.length - 1; index += 1) {
    const lowFrequency = BALANCE_REGION_EDGES[index];
    const highFrequency = BALANCE_REGION_EDGES[index + 1];
    let firstIndex = -1;
    let lastIndex = -1;

    axis.forEach((frequency, axisIndex) => {
      const isLast = index === BALANCE_REGION_EDGES.length - 2;
      const inRegion =
        frequency >= lowFrequency &&
        (isLast ? frequency <= highFrequency : frequency < highFrequency);
      if (!inRegion) {
        return;
      }
      if (firstIndex === -1) {
        firstIndex = axisIndex;
      }
      lastIndex = axisIndex;
    });

    if (firstIndex !== -1) {
      regions.push({
        label: BALANCE_REGION_LABELS[index],
        lowFrequency,
        highFrequency,
        firstIndex,
        lastIndex,
        centreFrequency: Math.sqrt(lowFrequency * highFrequency),
      });
    }
  }

  return regions;
};

export const createBalanceCaptureState = (
  axis: readonly number[],
): IBalanceCaptureState => {
  const regions = createBalanceRegions(axis);
  return {
    axis: [...axis],
    regions,
    power: new Float64Array(axis.length),
    weight: new Float64Array(axis.length),
    regionStates: regions.map(() => ({ weight: 0, mean: 0, m2: 0 })),
    frames: 0,
    acceptedFrames: 0,
    listenedMs: 0,
    lastTimestampMs: 0,
    checkpoint: undefined,
    bestWeakest: 0,
    bestWeakestAtMs: 0,
    bestMean: 0,
    bestMeanAtMs: 0,
  };
};

/** Power mean of `levels` over an inclusive index range, in dB. */
const regionLevelDb = (
  levels: Float64Array,
  firstIndex: number,
  lastIndex: number,
): number => {
  let power = 0;
  let count = 0;
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    const level = levels[index];
    if (Number.isFinite(level)) {
      power += 10 ** (level / 10);
      count += 1;
    }
  }
  return count > 0 ? 10 * Math.log10(power / count) : Number.NaN;
};

/**
 * Fold one frame into the state. Mutates and returns `state` so a test can
 * drive it with `Array.reduce` over synthetic frames.
 *
 * Energy is accumulated in the power domain, not in dB. An arithmetic mean of
 * dB values is the logarithm of the *geometric* mean, which under-reads
 * variable content — exactly the material this feature exists for.
 */
export const accumulateBalanceFrame = (
  state: IBalanceCaptureState,
  frame: IBalanceFrame,
): IBalanceCaptureState => {
  const w = clamp01(
    (frame.peakDb - FRAME_MIN_PEAK_DBFS) /
      (FRAME_FULL_PEAK_DBFS - FRAME_MIN_PEAK_DBFS),
  );

  state.frames += 1;
  const rawDelta = frame.timestampMs - state.lastTimestampMs;
  // A starved renderer must not be able to claim minutes of listening from one
  // late tick.
  const dt =
    state.frames === 1 ? 0 : clamp(rawDelta, 0, BALANCE_FRAME_INTERVAL_MS * 3);
  state.lastTimestampMs = frame.timestampMs;

  if (w <= 0) {
    // Silence buys no listened time.
    return state;
  }

  // The frame's own mean-power level is the reference. It is the
  // minimum-variance choice, and the tilt fit plus centring absorb the
  // constant, so using it changes nothing downstream except the noise.
  let refPower = 0;
  let refCount = 0;
  for (let index = 0; index < frame.levels.length; index += 1) {
    const level = frame.levels[index];
    if (Number.isFinite(level)) {
      refPower += 10 ** (level / 10);
      refCount += 1;
    }
  }
  if (refCount === 0) {
    return state;
  }
  const refDb = 10 * Math.log10(refPower / refCount);
  if (!Number.isFinite(refDb)) {
    return state;
  }

  state.listenedMs += dt;
  state.acceptedFrames += 1;

  state.regions.forEach((region, regionIndex) => {
    const absDb = regionLevelDb(
      frame.levels,
      region.firstIndex,
      region.lastIndex,
    );
    if (!Number.isFinite(absDb) || absDb < ABS_FLOOR_DBFS) {
      return;
    }

    const e = clamp01(
      (absDb - (frame.peakDb - REGION_FLOOR_DB)) / REGION_FLOOR_RAMP_DB,
    );
    if (e <= 0) {
      return;
    }
    const ww = w * e;

    // Weighted Welford, so the standard error is available without keeping
    // every frame.
    const x = clamp(absDb - refDb, LEVEL_CLAMP_LO, LEVEL_CLAMP_HI);
    const s = state.regionStates[regionIndex];
    s.weight += ww;
    const delta = x - s.mean;
    s.mean += (ww / s.weight) * delta;
    s.m2 += ww * delta * (x - s.mean);

    for (let index = region.firstIndex; index <= region.lastIndex; index += 1) {
      const level = frame.levels[index];
      if (Number.isFinite(level)) {
        const rel = clamp(level - refDb, LEVEL_CLAMP_LO, LEVEL_CLAMP_HI);
        state.power[index] += ww * 10 ** (rel / 10);
        state.weight[index] += ww;
      }
    }
  });

  return state;
};

/** True when enough listened time has passed to re-evaluate. */
export const isBalanceCheckDue = (state: IBalanceCaptureState): boolean =>
  state.checkpoint === undefined
    ? state.listenedMs > 0
    : state.listenedMs - state.checkpoint.atListenedMs >= CONVERGENCE_CHECK_MS;

/**
 * How long a capture may listen for, when the caller wants something other
 * than the defaults.
 *
 * Continuous EQ is the reason this is a parameter. It takes short looks rather
 * than one long one, so that a frequency range heard clearly in the first few
 * seconds is corrected in the first few seconds instead of waiting on a range
 * that needs twenty — the solver already leaves an untrusted band exactly where
 * it is, so a short look corrects what it heard and says nothing about the
 * rest. Over several looks the ranges come in as they are heard, which is what
 * makes the correction arrive across the spectrum in parallel rather than all
 * at the end.
 */
export interface IBalanceListenBounds {
  minListenMs?: number;
  maxListenMs?: number;
}

/**
 * Score the capture so far: per-region confidence, the averaged spectrum, and
 * whether we can stop. Mutates the convergence bookkeeping on `state`.
 */
export const evaluateBalanceCapture = (
  state: IBalanceCaptureState,
  {
    minListenMs = MIN_LISTEN_MS,
    maxListenMs = MAX_LISTEN_MS,
  }: IBalanceListenBounds = {},
): IBalanceReport => {
  const regions: IBalanceRegionReport[] = state.regions.map((region, index) => {
    const s = state.regionStates[index];
    const variance = s.weight > 0 ? s.m2 / s.weight : 0;
    const standardErrorDb = Math.sqrt(
      variance / Math.max(s.weight * EFFECTIVE_FRAME_RATIO, 1),
    );
    const evidence = clamp01(s.weight / REGION_TARGET_WEIGHT);
    // Two observations cannot support a variance estimate, so a region with
    // less than that is untrusted regardless of how it looks.
    const precision =
      s.weight >= 2
        ? clamp01(REGION_SE_TARGET_DB / Math.max(standardErrorDb, 1e-6))
        : 0;
    const confidence = Math.min(evidence, precision);
    return {
      label: region.label,
      lowFrequency: region.lowFrequency,
      highFrequency: region.highFrequency,
      weight: s.weight,
      standardErrorDb,
      confidence,
      isCovered: confidence >= REGION_COVERED_CONFIDENCE,
    };
  });

  const confidenceCurve: ISpectrumSample[] = state.regions.map(
    (region, index) => ({
      frequency: region.centreFrequency,
      level: regions[index].confidence,
    }),
  );

  const samples: ISpectrumSample[] = state.axis.map((frequency, index) => {
    const weight = state.weight[index];
    return {
      frequency,
      // A point with no weight still has to stay in the array with a finite
      // level: dropping it would let sampleSpectrumAt clamp a never-heard band
      // to the nearest measured one.
      level: weight > 0 ? 10 * Math.log10(state.power[index] / weight) : 0,
      confidence:
        weight > 0 ? clamp01(sampleSpectrumAt(confidenceCurve, frequency)) : 0,
    };
  });

  const coverage =
    regions.length > 0
      ? regions.reduce(
          (lowest, region) => Math.min(lowest, region.confidence),
          1,
        )
      : 0;
  const meanCoverage =
    regions.length > 0
      ? regions.reduce((total, region) => total + region.confidence, 0) /
        regions.length
      : 0;
  const weakest = regions.reduce<IBalanceRegionReport | undefined>(
    (lowest, region) =>
      lowest === undefined || region.confidence < lowest.confidence
        ? region
        : lowest,
    undefined,
  );

  // Convergence is judged on the quantity that actually becomes the gains. A
  // section change shifts the whole tilt, which the fit removes entirely, so
  // testing the raw spectrum would refuse to ever settle on real music.
  const usable = samples.filter(
    (sample) =>
      sample.frequency >= BALANCE_MIN_FREQUENCY &&
      sample.frequency <= BALANCE_MAX_FREQUENCY,
  );
  const { slope, intercept } = fitSpectralTilt(usable);
  const deviation = smoothSpectrum(
    usable.map((sample) => ({
      frequency: sample.frequency,
      level: sample.level - (slope * Math.log10(sample.frequency) + intercept),
      confidence: sample.confidence,
    })),
    DEFAULTS.smoothingOctaves,
  );
  const probe = new Float64Array(state.regions.length);
  state.regions.forEach((region, index) => {
    probe[index] = sampleSpectrumAt(deviation, region.centreFrequency);
  });

  let holds = 0;
  if (state.checkpoint) {
    const covered = regions
      .map((region, index) => ({ region, index }))
      .filter((entry) => entry.region.isCovered);
    const drift =
      covered.length > 0
        ? covered.reduce(
            (highest, entry) =>
              Math.max(
                highest,
                Math.abs(
                  probe[entry.index] -
                    (state.checkpoint as { probe: Float64Array }).probe[
                      entry.index
                    ],
                ),
              ),
            0,
          )
        : Infinity;
    holds = drift <= CONVERGENCE_TOLERANCE_DB ? state.checkpoint.holds + 1 : 0;
  }
  state.checkpoint = { probe, holds, atListenedMs: state.listenedMs };
  const isConverged = holds >= CONVERGENCE_HOLDS;

  if (coverage > state.bestWeakest + STALL_IMPROVEMENT) {
    state.bestWeakest = coverage;
    state.bestWeakestAtMs = state.listenedMs;
  }
  if (meanCoverage > state.bestMean + STALL_IMPROVEMENT) {
    state.bestMean = meanCoverage;
    state.bestMeanAtMs = state.listenedMs;
  }
  const isStalled =
    state.listenedMs >= minListenMs &&
    coverage < REGION_COVERED_CONFIDENCE &&
    state.listenedMs - state.bestWeakestAtMs >= STALL_GRACE_MS &&
    state.listenedMs - state.bestMeanAtMs >= STALL_GRACE_MS;

  // Order matters. The goal is tested before the ceiling so a capture that
  // reaches full coverage on its very last allowed frame is reported as the
  // good measurement it is, rather than being downgraded by the backstop.
  const meetsGoal = isConverged && coverage >= REGION_COVERED_CONFIDENCE;
  let status: BalanceCaptureStatus;
  if (state.listenedMs < minListenMs) {
    status = 'listening';
  } else if (meetsGoal) {
    status = 'ready';
  } else if (state.listenedMs >= maxListenMs) {
    status = 'partial';
  } else if (isConverged && isStalled) {
    // Only a settled measurement may be declared band-limited; otherwise a
    // quiet passage would masquerade as a missing frequency range.
    status = 'partial';
  } else {
    status = 'listening';
  }

  return {
    samples,
    regions,
    coverage,
    meanCoverage,
    weakest,
    listenedMs: state.listenedMs,
    frames: state.frames,
    isConverged,
    isStalled,
    status,
  };
};

export const shouldFinishBalanceCapture = (report: IBalanceReport): boolean =>
  report.status !== 'listening';

export const buildBalanceResult = (report: IBalanceReport): IBalanceResult => {
  const covered = report.regions.filter((region) => region.isCovered);
  return {
    samples: report.samples,
    status: report.status === 'ready' ? 'ready' : 'partial',
    lowFrequency: covered[0]?.lowFrequency ?? 0,
    highFrequency: covered[covered.length - 1]?.highFrequency ?? 0,
  };
};

export const buildBalanceProgress = (
  report: IBalanceReport,
  previousPercent: number,
  flags: { isSilent: boolean; isPaused: boolean },
): IBalanceProgress => {
  const isSettling =
    report.coverage >= REGION_COVERED_CONFIDENCE && !report.isConverged;
  return {
    // Monotone: coverage can dip when a new region starts contributing, and a
    // progress number that goes backwards reads as a malfunction.
    percent:
      report.status !== 'listening'
        ? 100
        : Math.min(
            99,
            Math.max(previousPercent, Math.round(report.coverage * 100)),
          ),
    weakestLabel: isSettling ? '' : (report.weakest?.label ?? ''),
    isSettling,
    isSilent: flags.isSilent,
    isPaused: flags.isPaused,
    listenedMs: report.listenedMs,
    regions: report.regions.map((region) => ({
      label: region.label,
      lowFrequency: region.lowFrequency,
      highFrequency: region.highFrequency,
      confidence: region.confidence,
      isCovered: region.isCovered,
    })),
  };
};

export const formatBalanceFrequency = (frequency: number): string =>
  frequency >= 1000
    ? `${Math.round(frequency / 100) / 10} kHz`
    : `${Math.round(frequency)} Hz`;

export const describeBalanceProgress = (progress: IBalanceProgress): string => {
  if (progress.isPaused) {
    return 'Paused - resume to finish';
  }
  if (progress.isSilent) {
    return 'Paused - no sound playing';
  }
  if (progress.isSettling) {
    return `Listening ${progress.percent}% - settling`;
  }
  if (!progress.weakestLabel) {
    return `Listening ${progress.percent}%`;
  }
  return `Listening ${progress.percent}% - needs ${progress.weakestLabel}`;
};

export const describeBalanceResult = (result: IBalanceResult): string => {
  if (result.status === 'ready') {
    return 'Balanced - full range';
  }
  return `Balanced - ${formatBalanceFrequency(
    result.lowFrequency,
  )} to ${formatBalanceFrequency(result.highFrequency)} only`;
};
