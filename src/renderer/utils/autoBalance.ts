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

import {
  FilterTypeEnum,
  IFilter,
  MAX_GAIN,
  MIN_GAIN,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { IReferenceShape } from 'common/referenceCurve';
import { gainAtFrequency, getTFCoefficients } from 'common/response';
import { clamp } from './utils';
import {
  BALANCE_MAX_FREQUENCY,
  BALANCE_MIN_FREQUENCY,
  EDGE_ROLLOFF_DB,
  MAX_TILT_SPAN_DB,
  MIN_BAND_CONFIDENCE,
  MIN_TRUSTED_OCTAVES,
  ROLLOFF_MIN_DB_PER_OCTAVE,
  SOLVE_HOME,
  SOLVE_RIDGE,
  TRUSTED_HIGH_ANCHOR_HZ,
  TRUSTED_LOW_ANCHOR_HZ,
} from './autoBalanceTuning';

// Re-exported rather than moved out of reach: the tuning is part of this
// module's public surface — the capture tests import the timings, the UI reads
// the listen window — and splitting the file should not make forty call sites
// say where a number now lives.
export * from './autoBalanceTuning';

/** One decimal, which is all Equalizer APO reads and all anybody can hear. */
const roundGains = (gains: Record<string, number>): Record<string, number> =>
  Object.fromEntries(
    Object.entries(gains).map(([id, gain]) => [id, Math.round(gain * 10) / 10]),
  );

export const tiltLevelAt = (
  fit: { slope: number; intercept: number },
  frequency: number,
) => fit.slope * Math.log10(frequency) + fit.intercept;

/*
 * WHY THERE IS NO TOLERANCE CORRIDOR HERE, since it is the obvious idea and was
 * built before being taken back out.
 *
 * The reasoning for one is good. Chasing an exact line leaves a residual at
 * every frequency forever, so there is always something left to do and the
 * gains never stop moving; the one commercial reference worth copying draws its
 * targets as ranges rather than lines, because analysing enough masters shows
 * good records agree on a corridor and not on a curve. Correct only the excess
 * outside it and there is finally a state in which the answer is "nothing".
 *
 * It costs the property this whole feature exists for. A dead band is
 * path-dependent: a correction stops at the edge it happened to approach from,
 * so where it settles depends on where it started, and two records can both be
 * "correct" two decibels apart. Every source arriving at the same signature is
 * the one thing that cannot be traded away for smoothness.
 *
 * And it turned out not to be needed. The wander it was meant to stop was the
 * reference slope being too bright — held to the corrected one, a good modern
 * master draws no correction at all, so there is nothing left to suppress. The
 * continuous stepper's own settle hysteresis covers the rest.
 */

/**
 * How much a frequency counts toward the solve, on top of how well it was
 * heard.
 *
 * Confidence answers "did we hear this", which is not the same question as
 * "does being wrong here matter". Three decibels at three kilohertz and three
 * at forty are the same measurement and nothing like the same mistake, and the
 * solve used to treat them identically — so an unlucky reading at the very
 * bottom or top could pull midrange bands around to satisfy it.
 *
 * A gentle bell rather than a real loudness contour: a proper one is level-
 * dependent and this has no idea how loud anybody is listening. Wide enough
 * that two hundred hertz still counts for most of a midrange point, and floored
 * so the extremes are quietened rather than ignored — they are still the
 * frequencies most likely to be genuinely wrong.
 */
export const AUDIBILITY_CENTRE_HZ = 2000;
export const AUDIBILITY_WIDTH_OCTAVES = 3.5;
export const AUDIBILITY_FLOOR = 0.25;

export const audibilityWeight = (frequency: number): number => {
  if (!(frequency > 0)) {
    return AUDIBILITY_FLOOR;
  }
  const octaves = Math.log2(frequency / AUDIBILITY_CENTRE_HZ);
  const bell = Math.exp(-((octaves / AUDIBILITY_WIDTH_OCTAVES) ** 2));
  return AUDIBILITY_FLOOR + (1 - AUDIBILITY_FLOOR) * bell;
};

/** Where the bass ends, for anchoring: full weight below, none above. */
const BASS_ANCHOR_FULL_HZ = 150;
const BASS_ANCHOR_NONE_HZ = 400;

/**
 * Weight for anchoring on the bottom instead of on loudness.
 *
 * Subtracting a weighted mean of the correction is what stops a run changing
 * the volume, and which frequencies carry the weight decides what is being held
 * still. Weighted by audibility it is the perceived level, which is what nearly
 * everything here wants.
 *
 * Detail does not. It exists to raise the mids and highs, and against a loudness
 * anchor a rise up there is paid for by a cut down here — so the one mode whose
 * whole promise is "without touching the bass" would be the one mode that
 * reliably took a decibel off it. Anchoring on the bass makes the bottom the
 * fixed point instead: it lands at zero and the lift goes upward from there.
 *
 * Flat below 150 Hz and gone by 400, with a raised cosine between, so no band
 * sits on a step and a filter near the boundary contributes part of itself.
 */
export const bassWeight = (frequency: number): number => {
  if (!(frequency > 0) || frequency <= BASS_ANCHOR_FULL_HZ) {
    return 1;
  }
  if (frequency >= BASS_ANCHOR_NONE_HZ) {
    return 0;
  }
  const t =
    Math.log2(frequency / BASS_ANCHOR_FULL_HZ) /
    Math.log2(BASS_ANCHOR_NONE_HZ / BASS_ANCHOR_FULL_HZ);
  return 0.5 * (1 + Math.cos(Math.PI * t));
};

/**
 * How wide to smooth, at a given frequency, in octaves.
 *
 * It was half an octave everywhere, which is wrong at both ends in opposite
 * directions. What goes wrong in a room at the bottom is broad, and the fine
 * detail down there is modal — it moves when you move your head, so correcting
 * it fits the measurement and not the room. What goes wrong at the top is
 * narrower and the ear resolves it better.
 *
 * An octave below the knee, a third of an octave above two kilohertz, and a
 * smooth walk between the two so no band sits on a discontinuity.
 */
export const SMOOTHING_WIDE_BELOW_HZ = 200;
export const SMOOTHING_NARROW_ABOVE_HZ = 2000;

export const smoothingOctavesAt = (frequency: number): number => {
  const wide = 1;
  const narrow = 1 / 3;
  const low = Math.log10(SMOOTHING_WIDE_BELOW_HZ);
  const high = Math.log10(SMOOTHING_NARROW_ABOVE_HZ);
  const x = Math.log10(Math.max(frequency, 1));
  const t = clamp((x - low) / (high - low), 0, 1);
  return wide + (narrow - wide) * t;
};

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
  /**
   * How much of the boost limit a frequency has earned, from 0 to 1.
   *
   * Zero where nothing is playing, so a range that is silent cannot be lifted
   * however long it reports a deficit. Cuts are never scaled by this: a range
   * with no signal has nothing that needs taking away, and it is only boosts
   * that compound against evidence that never arrives.
   *
   * Supplied by whoever owns the capture, since it is built from the live
   * region levels and the lines somebody has set on the plot. Absent means one
   * everywhere, which is how this behaved before there were any lines.
   */
  boostAllowance?: (frequency: number) => number;
  /**
   * Width of the smoothing window used to reject FFT noise, in octaves — one
   * number, or a function of frequency for a width that is not the same at both
   * ends of the range. Defaults to `smoothingOctavesAt`.
   */
  smoothingOctaves?: number | ((frequency: number) => number);
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
  /**
   * What the record is held to, rather than what it is.
   *
   * Empty means the reference is a line fitted to this record, which is the
   * behaviour every caller had before there was a choice. See
   * common/referenceCurve for the three shapes and what each overrides.
   */
  reference?: IReferenceShape;
}

/**
 * The fraction of the measured deviation one pass asks for. It was 0.65.
 *
 * That number was chosen when a run cleared the layer to flat and applied its
 * whole answer at once, where asking for everything really could overshoot with
 * nothing to pull it back. Neither half of that is true now: the layer stays in
 * the measurement, so what a run solves is a residual, and a pass that goes too
 * far is measured as too far and corrected on the next one.
 *
 * The conservatism was costing far more than it bought, and the amount is
 * measurable rather than a matter of taste. At 0.65 a single pass removes about
 * 2.7 dB of an 8 dB resonance — a third of it, which is a correction nobody can
 * see on the plot and few would notice by ear. Records that are genuinely dark,
 * bright or bass-heavy were moved by around a decibel and left there, which is
 * the difference between a feature that works and one that appears not to.
 *
 * A one is not a promise of a full correction, which is the part worth knowing
 * before reaching for something larger: the ridge term in the solve damps the
 * answer as well, so one pass at 1.0 removes about half of the same resonance.
 * The rest arrives over the following passes, which is what a closed loop is
 * for. Everything downstream still bounds it — `SMART_EQ_MAX_BOOST_DB` and its
 * cut, the continuous stepper's own limits, and the deadband.
 *
 * IT STAYS AT ONE, and the reason is worth recording because the received
 * wisdom says otherwise. Practitioners matching a long-term average spectrum
 * report having to back the result off to about half before it sounds like
 * anything but a caricature, and match EQs fit deliberately few bands for the
 * same reason. Both are true, and neither applies here: they describe a static
 * match that computes its whole answer once and commits it, where being wrong
 * is permanent. This re-measures and converges, so a pass that overshoots is
 * seen as an overshoot and taken back.
 *
 * Tried at 0.6 anyway, and measured what it cost. Against a bass shelf and a
 * presence scoop totalling 5.5 dB, a pass at 0.6 corrects 1.4 dB where a pass
 * at 1.0 corrects 2.4. The complaint this feature actually attracts is that it
 * does nothing visible to a curve somebody has plainly bent, and halving the
 * only number that answers that is the wrong direction.
 */
export const DEFAULTS: Required<IAutoBalanceOptions> = {
  strength: 1,
  maxBoost: 6,
  maxCut: 9,
  // Everything is allowed until somebody supplies a reason it is not.
  boostAllowance: () => 1,
  smoothingOctaves: smoothingOctavesAt,
  minConfidence: MIN_BAND_CONFIDENCE,
  relativeToCurrentGain: true,
  targetCurve: [],
  reference: {},
};

export const clamp01 = (value: number) => clamp(value, 0, 1);

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
export const fitSpectralTilt = (
  samples: ISpectrumSample[],
  /**
   * A slope to hold rather than one to find.
   *
   * This is the whole difference between correcting a record's bumps and
   * correcting the record. Fitted, the slope is whatever this music happens to
   * have and is therefore correct by definition, so a dull record stays dull.
   * Held, a record duller than the given slope reads as a deficit and gets
   * lifted — and, crucially, it stays lifted, because the thing it is compared
   * against does not move when the music does.
   *
   * The intercept is fitted either way. Loopback carries whatever the volume
   * knob is set to, so an absolute level here means nothing at all.
   */
  fixedSlope?: number,
) => {
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
  // Held slope: only the level is left to find, and the weighted mean of
  // `level - slope * x` is it.
  if (Number.isFinite(fixedSlope)) {
    const slope = fixedSlope as number;
    return { slope, intercept: (sumY - slope * sumX) / sumW };
  }
  const denominator = sumW * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) {
    return { slope: 0, intercept: sumY / sumW };
  }
  const slope = (sumW * sumXY - sumX * sumY) / denominator;
  return { slope, intercept: (sumY - slope * sumX) / sumW };
};

/**
 * Confidence-weighted fractional-octave smoothing in the log domain.
 *
 * The width may be a function of frequency rather than one number, because the
 * right amount is not the same at both ends — see `smoothingOctavesAt`.
 */
export const smoothSpectrum = (
  samples: ISpectrumSample[],
  octaves: number | ((frequency: number) => number),
): ISpectrumSample[] =>
  samples.map((sample, index) => {
    const width =
      typeof octaves === 'function' ? octaves(sample.frequency) : octaves;
    const halfWidth = Math.log10(2 ** (width / 2));
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
    boostAllowance,
    smoothingOctaves,
    minConfidence,
    relativeToCurrentGain,
    targetCurve,
    reference,
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

  // What this record is being held to.
  //
  // A line fitted to the record itself says its own tonal signature is correct
  // by definition, so only its bumps and dips are corrected. A line at a fixed
  // slope says nothing of the sort, and a record duller than that slope is
  // lifted toward it — and stays lifted, because what it is compared against no
  // longer moves when the music does. The shape on top is the rest of a target
  // curve, when there is one. See `common/referenceCurve`.
  //
  // FITTED TO THE RECORD, NOT TO THE RECORD WITH THIS LAYER ON IT.
  //
  // The measurement is the output, and the output carries the layer being
  // solved for — deliberately, since that is what closes the loop. But a line
  // fitted through the output absorbs whatever straight line the LAYER happens
  // to contribute, slope and level alike, and a slope the fit has absorbed is
  // one the deviation never sees. So a layer that arrived tilted stayed tilted:
  // the same record, measured from a flat start and from a bent one, settled
  // six to seven decibels apart in the fitted modes, and the divergence test
  // recorded the number rather than hiding it. The line is meant to be the
  // programme's own tilt, so it is fitted to the programme — the output with
  // this layer's own response taken back off — and the layer is left inside
  // the deviation, where the correction can see it and undo it.
  //
  // The held-slope modes never had this problem, because a held slope cannot
  // absorb anything; their intercept is fitted the same way for the same
  // reason, which changes nothing they do since the level is centred anyway.
  const ownResponse = relativeToCurrentGain
    ? filters
        .filter(
          (filter) =>
            !NO_GAIN_FILTER_TYPES.includes(filter.type) &&
            Number.isFinite(filter.gain) &&
            filter.gain !== 0,
        )
        .map((filter) => getTFCoefficients(filter))
    : [];
  const programme =
    ownResponse.length > 0
      ? steered.map((sample) => ({
          ...sample,
          level:
            sample.level -
            ownResponse.reduce(
              (total, coefficients) =>
                total + gainAtFrequency(sample.frequency, coefficients),
              0,
            ),
        }))
      : steered;
  const fit = fitSpectralTilt(programme, reference.slope);
  const hasShape = Boolean(reference.shape?.length);
  const deviation = smoothSpectrum(
    steered.map((sample) => ({
      frequency: sample.frequency,
      level:
        sample.level -
        tiltLevelAt(fit, sample.frequency) -
        (hasShape
          ? sampleSpectrumAt(
              reference.shape as ISpectrumSample[],
              sample.frequency,
            )
          : 0),
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

  /*
   * THE RECORD'S OWN ROLLOFF AT THE SPECTRUM EDGES IS NEVER FILLED.
   *
   * Every record falls away steeply below its lowest note and above what its
   * production kept, while a reference line extends straight past both. So at
   * the edges the line demands energy no master has ever had, the solver reads
   * a fifteen-decibel deficit, and the bass bands walk to their limit — a hump
   * at the bottom of the plot that grows to the cap on any record, because it
   * is not a property of the record, it is the line over-promising.
   *
   * Room correction settled this decades ago: dips and rolloffs are never
   * boosted, because the energy is not missing, it was never there. The same
   * asymmetry as everywhere else in this file — an edge with too MUCH energy is
   * still cut, since taking away something real is always safe.
   *
   * Detected from the deviation itself: a contiguous run from either end of the
   * measured span that sits more than EDGE_ROLLOFF_DB under the reference is a
   * rolloff, and its deficit is not a correction target. The run stops the
   * moment the record comes back within range of the line, so a genuine broad
   * dip in the middle of the spectrum is untouched by this.
   */
  const isEdgeRolloff = deviation.map(() => false);
  /*
   * Depth alone does not make a rolloff, and treating it as one broke the
   * mode's whole point: a record twice as dark as the reference sits more than
   * ten decibels under the line across its entire top end, and marking that as
   * "not there" refused the very lift the mode exists to give. What separates a
   * cliff from a dark master is STEEPNESS — a real rolloff falls at twenty-plus
   * decibels an octave, a dark record at three to seven — so a candidate run is
   * only believed if it falls toward the edge that fast.
   */
  const markEdgeRun = (from: number, step: number) => {
    let end = from;
    while (
      end >= 0 &&
      end < deviation.length &&
      deviation[end].level < -EDGE_ROLLOFF_DB
    ) {
      end += step;
    }
    if (end === from) {
      // The first sample already fails the depth test: no run at all.
      return;
    }
    const inner = end - step;
    const octaves = Math.abs(
      Math.log2(deviation[from].frequency / deviation[inner].frequency),
    );
    const drop = deviation[inner].level - deviation[from].level;
    if (octaves < 0.25 || drop / octaves < ROLLOFF_MIN_DB_PER_OCTAVE) {
      return;
    }
    for (let i = from; i !== end; i += step) {
      isEdgeRolloff[i] = true;
    }
  };
  markEdgeRun(0, 1);
  markEdgeRun(deviation.length - 1, -1);

  // Desired correction at every measured frequency, centred so the answer is a
  // change of tone rather than of level.
  // Two weights, and they answer different questions: confidence is whether we
  // heard this frequency, audibility is whether being wrong here matters.
  const targets = deviation.map((sample) => ({
    frequency: sample.frequency,
    weight:
      clamp01(sample.confidence ?? 1) * audibilityWeight(sample.frequency),
    want: -sample.level * strength,
  }));
  // Applied after the map so the index lines up: an edge rolloff may be cut,
  // never filled.
  targets.forEach((point, index) => {
    if (isEdgeRolloff[index] && point.want > 0) {
      point.want = 0;
      // And it carries no weight either, so ten octaves of unfillable deficit
      // cannot drag the level anchor or the joint solve toward the edge.
      point.weight = 0;
    }
  });

  /*
   * And a band that lives inside a rolloff goes HOME, not wherever it was.
   *
   * Removing the target was half the rule and the wrong half on its own: with
   * nothing asking anything of those bands, they simply held their last value —
   * a layer that arrived bent at the bottom stayed bent there forever, which is
   * path dependence in its purest form, and the divergence test measured it at
   * seven decibels.
   *
   * The right resting state for a correction aimed at energy that was never
   * there is no correction. So these bands decay toward zero, which has the one
   * property everything else here keeps fighting for: it is the same
   * destination from every starting point.
   */
  const lowEdgeHz = (() => {
    let last = -Infinity;
    for (let i = 0; i < deviation.length; i += 1) {
      if (!isEdgeRolloff[i]) {
        break;
      }
      last = deviation[i].frequency;
    }
    return last;
  })();
  const highEdgeHz = (() => {
    let first = Infinity;
    for (let i = deviation.length - 1; i >= 0; i -= 1) {
      if (!isEdgeRolloff[i]) {
        break;
      }
      first = deviation[i].frequency;
    }
    return first;
  })();
  const isInRolloff = (frequency: number) =>
    frequency < lowEdgeHz || frequency > highEdgeHz;
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
    // And the pull on the total, which is what lets the layer forget a comb
    // the measurement cannot see. The step is solved for, so pulling the
    // TOTAL toward zero means asking the step to cancel what is already
    // there: the diagonal carries the weight and the right-hand side carries
    // the gain it is applied to. See `SOLVE_HOME` for the measurement.
    const home = meanDiagonal * SOLVE_HOME;
    for (let i = 0; i < n; i += 1) {
      normal[i][i] += ridge + home;
      rhs[i] -= home * (relativeToCurrentGain ? solvable[i].gain : 0);
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

  /*
   * THE CORRECTION IS ANCHORED TO THE MIDRANGE, so it changes the balance and
   * not the volume.
   *
   * This was `const mean = 0` — the remains of an earlier centring — so nothing
   * held the correction's overall level at all. Every write was free to sit a
   * little lower than the last, and over an evening of a continuous mode that
   * is what happened: most music carries more bass than the target asks for, so
   * pass after pass took a little more out, no single step looked wrong, and
   * the sound quietly got smaller. A correction meant to improve the balance
   * was paying for it in loudness.
   *
   * Subtracting the midrange average makes that impossible by construction. It
   * says exactly the same thing about the SHAPE — every band's position
   * relative to every other is untouched — and nothing at all about the level,
   * so no number of passes can accumulate one.
   *
   * WEIGHTED TOWARD THE MIDRANGE, ACROSS THE WHOLE SPECTRUM — not an average of
   * the midrange, which is the version that looks right and is not.
   *
   * A flat average over twenty octaves would let a change in the top one count
   * as much as a change at 1 kHz, and hearing does not work that way: what
   * anybody means by "the volume" is overwhelmingly what the mids are doing.
   * So the average has to lean there.
   *
   * But taking it *only* from a midrange window is worse, and the tests caught
   * it immediately: a resonance at 1 kHz sits inside that window, so the anchor
   * ends up computed from the very fault being corrected, subtracts it from
   * itself, and the correction comes out as nothing. It would have made the
   * feature blind in exactly the region it matters most.
   *
   * `audibilityWeight` is the shape that gets both: a gentle bell around 2 kHz
   * with a floor, so a narrow midrange fault contributes only its own small
   * share of a broad average and is still corrected, while a broad level shift
   * anywhere is removed. Times confidence, so a band nobody has heard cannot
   * drag the anchor and take the whole correction with it.
   *
   * OVER THE SOLVED BANDS ONLY, and that is not a detail.
   *
   * `raw` holds every band; only the solvable ones carry an answer, and the rest
   * sit at a correction of zero because the solver deliberately declined them —
   * outside the trusted span, or below the confidence floor. Averaging those
   * zeroes in pulls the anchor toward nothing, and subtracting the anchor from
   * them moves bands the measurement had explicitly refused to move. On a record
   * whose correction is mostly a bass cut, the anchor is negative, so every band
   * the solver had left alone quietly rose by that much — which reads as the
   * correction doing nothing but lifting the top.
   */
  const anchorWeightOf = (entry: (typeof raw)[number]) =>
    (reference.anchor === 'bass'
      ? bassWeight(entry.filter.frequency)
      : audibilityWeight(entry.filter.frequency)) * entry.confidence;
  /** Read twice — once to decide the anchor, once to bound the gain. */
  const allowanceOf = (entry: (typeof raw)[number]) =>
    boostAllowance ? clamp01(boostAllowance(entry.filter.frequency)) : 1;
  /*
   * A BAND THAT MAY NOT MOVE UP DOES NOT GET A VOTE ON THE LEVEL EITHER, and
   * leaving it one is a ratchet that empties the record.
   *
   * The anchor keeps a correction from changing the volume: subtract the
   * weighted mean and what is left is a change of tone. That holds only while
   * the cuts and the boosts it averages both actually happen. Once the presence
   * gate could refuse a boost, they did not — a silent range asked to come up,
   * the mean went positive, every band had that positive number subtracted, and
   * the boosts that were supposed to pay for it were never applied.
   *
   * So each pass took a little off the whole record and none of it went back.
   * Over an evening the correction slid toward its floor with the shape of a
   * deepening V, which is exactly what it looked like: the ranges that kept
   * playing held their ground while everything intermittent sank.
   *
   * The same rule the declined bands already followed, for the same reason.
   */
  const anchored = raw.filter(
    (entry) => entry.isSolvable && allowanceOf(entry) > 0,
  );
  const anchorWeight = anchored.reduce(
    (total, entry) => total + anchorWeightOf(entry),
    0,
  );
  const mean =
    anchorWeight > 0
      ? anchored.reduce(
          (total, entry) => total + entry.correction * anchorWeightOf(entry),
          0,
        ) / anchorWeight
      : 0;

  /*
   * TWO KINDS OF CORRECTION, AND ONLY ONE OF THEM SHOULD BE ALLOWED TO BE BIG.
   *
   * Flattening a resonance — a narrow bump at 200 Hz, three decibels of it — is
   * almost always right, on any record, in any genre. It is a defect.
   *
   * Imposing a TILT is a different act wearing the same clothes. Holding a
   * record to a fixed slope means any record whose own slope differs gets the
   * whole difference applied to it, and the difference between an old master
   * and a modern one is four or five decibels per decade — which over the
   * audible band is twelve decibels from end to end. That is not correcting a
   * defect, it is rewriting the record, and there is no slope that avoids it:
   * whatever value is chosen, the material furthest from it takes the largest
   * imposition. Measured across three plausible masters, every candidate slope
   * left at least one of them seven to twelve decibels out.
   *
   * Both used to share one limit, so a tilt could quietly spend the whole of
   * it. The per-band ceiling of six decibels permits twelve end to end, which is
   * exactly what it was doing — and why the long-run simulation found the
   * correction saturated against both rails with a band pinned at each.
   *
   * So the tilt is fitted out of the answer and bounded on its own, hard, and
   * what is left over keeps the per-band limit it always had. A record still
   * moves toward the house curve; it just cannot be dragged all the way there.
   *
   * This is the one form of the rule that does not depend on knowing what the
   * music is, which is the property that matters: it bounds how much may be
   * rewritten rather than asserting what is correct.
   */
  const gains: Record<string, number> = Object.fromEntries(
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
      // A band the solver declined holds exactly where it is. The anchor is
      // subtracted only from bands that were actually answered for — applying it
      // to the others would move them on the strength of an average they took no
      // part in, which is a correction nobody measured.
      /*
       * The anchor applies only to the bands that are in it.
       *
       * A gated band was already left out of the mean — it cannot pay its share
       * of a boost it is not allowed to make — and subtracting that mean from it
       * anyway is the same mistake as anchoring a band the solver declined: it
       * moves on the strength of an average it took no part in. When the rest of
       * the spectrum wants lifting, the mean is positive, and a silent range
       * quietly gets cut by that much for no reason anybody measured.
       *
       * Which is a ratchet across records rather than within one, and that is
       * why it survived the first fix and needed a two-hundred-pass simulation
       * to find: during a passage with no bass the bass is trimmed, the next
       * record has to spend its own correction undoing that, and the two never
       * quite cancel. Left running it cost 1.8 dB of level and grew the spread
       * from ten decibels to fourteen.
       *
       * Its own correction still applies, so a range that is quiet AND genuinely
       * too loud for its target is still cut. The gate refuses one direction;
       * it does not make a band untouchable.
       */
      const anchor = allowanceOf(entry) > 0 ? mean : 0;
      // Home, for a band aimed at a rolloff — see `isInRolloff`. Scaled by
      // strength so it relaxes at the same pace everything else corrects.
      if (entry.isSolvable && isInRolloff(entry.filter.frequency)) {
        const relaxed = relativeToCurrentGain
          ? entry.gain * (1 - strength * 0.5)
          : 0;
        return [entry.id, clamp(relaxed, MIN_GAIN, MAX_GAIN)];
      }
      const correction = entry.isSolvable ? entry.correction - anchor : 0;
      /*
       * How much of a boost this band has earned, and cuts are untouched.
       *
       * A range with nothing playing in it reports a deficit forever and
       * nothing ever arrives to contradict it, so a boost there compounds until
       * it hits its limit — which is exactly what a guitar intro did to the
       * bass. A cut has no such failure: taking away something nobody could
       * hear takes away nothing. So the allowance bounds one side only.
       *
       * One at the top of the ramp and zero at its floor, which is what makes
       * the two lines on the plot the whole story. Absent means one, so a
       * caller that knows nothing about presence — every test that predates
       * this, and any synthetic frame — behaves exactly as it did.
       */
      const allowance = allowanceOf(entry);
      const gain =
        base +
        clamp(correction * entry.confidence, -maxCut, maxBoost * allowance);
      return [entry.id, clamp(gain, MIN_GAIN, MAX_GAIN)];
    }),
  );

  /*
   * THE LAYER'S OWN LEVEL IS ZERO, and nothing else makes it so.
   *
   * The reference fits its level to the measurement — rightly, since loopback
   * carries the volume knob — so a uniform offset in the layer disappears into
   * the fitted intercept and is invisible to every correction that follows. The
   * anchor centres each increment, but an inherited level is not an increment.
   * Measured: a layer that started seven decibels low SETTLED seven decibels
   * low, with the shape fully converged around it. Same record, same tone,
   * seven decibels quieter, forever — path dependence as a volume knob.
   *
   * A correction layer is a statement about tone. Level belongs to the preamp.
   * So the weighted mean of the layer is taken out of the layer, under the two
   * protections whose absence sank the first attempt at exactly this: every
   * band stays inside its own correction limits, and a band the presence gate
   * has refused is neither counted nor moved — which is also what stops the
   * gated-band ratchet this would otherwise reintroduce. The clamps mean one
   * pass may not fully centre it; the loop finishes the job, which is what a
   * loop is for.
   *
   * The weights are the anchor's own, so Detail keeps its designed shape: its
   * anchor weighs the bass, a bass-weighted mean of zero pins the bass at zero,
   * and the lift above survives intact.
   */
  const levelled = raw.filter(
    (entry) => entry.isSolvable && allowanceOf(entry) > 0,
  );
  const levelledWeight = levelled.reduce(
    (total, entry) => total + anchorWeightOf(entry),
    0,
  );
  if (levelledWeight > 0) {
    const level =
      levelled.reduce(
        (total, entry) =>
          total + (gains[entry.id] ?? 0) * anchorWeightOf(entry),
        0,
      ) / levelledWeight;
    levelled.forEach((entry) => {
      gains[entry.id] = clamp(
        (gains[entry.id] ?? 0) - level,
        Math.max(MIN_GAIN, -maxCut),
        Math.min(MAX_GAIN, maxBoost * allowanceOf(entry)),
      );
    });
  }

  /*
   * AND THE TILT OF THE RESULT IS BOUNDED, which is not the same as bounding
   * the tilt of one pass and is the version that works.
   *
   * The first attempt fitted the tilt out of the CORRECTION and scaled that.
   * Each pass was then duly gentle and the layer still walked to twelve
   * decibels end to end, because sixty gentle passes in the same direction
   * accumulate exactly as one steep one. What has to be bounded is the thing
   * that persists.
   *
   * The property being defended is worth restating, because it is the only one
   * here that holds for music nobody has heard yet. Flattening a resonance is
   * right on any record: it is a defect. Imposing a tilt is only "right"
   * relative to a slope somebody picked, and the material furthest from that
   * pick takes the largest imposition through no fault of its own — measured
   * across a modern master, an older brighter one and a dark one, every
   * candidate slope left at least one of them seven to twelve decibels out.
   * Choosing better is not on offer. Bounding what the choice may cost is.
   *
   * So the straight line through the layer is fitted and scaled back to its
   * allowance, and everything that is not a straight line survives untouched.
   * A record still moves toward the house curve; it can no longer be dragged
   * the whole way there.
   *
   * Only bands that may move are adjusted, and never upward past where they
   * are: shrinking a downward tilt raises the bottom end, and a range the
   * presence gate has refused to lift must not be lifted by the side effect of
   * a correction to something else.
   */
  const tiltable = raw.filter(
    (entry) => entry.isSolvable && entry.confidence > 0,
  );
  if (tiltable.length < 2) {
    return roundGains(gains);
  }

  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  tiltable.forEach((entry) => {
    const w = anchorWeightOf(entry);
    const x = Math.log10(entry.filter.frequency);
    const y = gains[entry.id] ?? 0;
    sumW += w;
    sumX += w * x;
    sumY += w * y;
    sumXX += w * x * x;
    sumXY += w * x * y;
  });
  const denominator = sumW * sumXX - sumX * sumX;
  if (!(Math.abs(denominator) > 1e-9)) {
    return roundGains(gains);
  }
  const slope = (sumW * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / sumW;

  const decades =
    tiltable.reduce(
      (widest, entry) => Math.max(widest, Math.log10(entry.filter.frequency)),
      -Infinity,
    ) -
    tiltable.reduce(
      (narrowest, entry) =>
        Math.min(narrowest, Math.log10(entry.filter.frequency)),
      Infinity,
    );
  const span = Math.abs(slope * decades);
  if (!(span > MAX_TILT_SPAN_DB)) {
    return roundGains(gains);
  }
  const keep = MAX_TILT_SPAN_DB / span;

  const bounded: Record<string, number> = { ...gains };
  raw.forEach((entry) => {
    if (!entry.isSolvable) {
      return;
    }
    const tilt = slope * Math.log10(entry.filter.frequency) + intercept;
    const next = (gains[entry.id] ?? 0) - tilt * (1 - keep);
    // Inside the caller's own limits, not the axis. These two passes run
    // AFTER the per-band clamp, and bounding them only by ±20 let them push a
    // band past the limit somebody had just drawn on the plot — which is the
    // one thing a line named "limit" must never appear to allow.
    const within = clamp(
      next,
      Math.max(MIN_GAIN, -maxCut),
      Math.min(MAX_GAIN, maxBoost * allowanceOf(entry)),
    );
    // A gated range may be brought down by this and never up.
    bounded[entry.id] =
      allowanceOf(entry) > 0 ? within : Math.min(gains[entry.id] ?? 0, within);
  });

  return roundGains(bounded);
};
