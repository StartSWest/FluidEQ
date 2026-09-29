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
  BALANCE_MAX_FREQUENCY,
  BALANCE_MIN_FREQUENCY,
  CONVERGENCE_HOLDS,
  CONVERGENCE_TOLERANCE_DB,
  EFFECTIVE_FRAME_RATIO,
  MAX_LISTEN_MS,
  MIN_LISTEN_MS,
  REGION_COVERED_CONFIDENCE,
  REGION_SE_TARGET_DB,
  REGION_TARGET_WEIGHT,
  STALL_GRACE_MS,
  STALL_IMPROVEMENT,
} from './autoBalanceTuning';
import {
  DEFAULTS,
  ISpectrumSample,
  clamp01,
  fitSpectralTilt,
  sampleSpectrumAt,
  smoothSpectrum,
} from './autoBalance';
import type {
  BalanceCaptureStatus,
  IBalanceCaptureState,
  IBalanceProgress,
  IBalanceRegionReport,
  IBalanceReport,
  IBalanceResult,
} from './autoBalanceCapture';

// What a capture says once it has listened: each region judged, whether
// it is done, the result it hands over and the progress drawn while it
// runs. autoBalanceCapture.ts re-exports all of it.

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
      centreFrequency: region.centreFrequency,
      levelDb: s.mean,
      liveDb: state.liveDb[index],
      typicalDb: state.typicalDb[index],
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
    isBandLimited: state.fullBand.isHolding,
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
    regions: report.regions,
  };
};

export const buildBalanceProgress = (
  report: IBalanceReport,
  previousPercent: number,
  flags: { isSilent: boolean; isPaused: boolean; isContinuous?: boolean },
): IBalanceProgress => {
  const isSettling =
    report.coverage >= REGION_COVERED_CONFIDENCE && !report.isConverged;
  // The weakest region for a one-shot, the average of them for a continuous
  // mode, and the difference is not cosmetic.
  //
  // "All frequencies heard" is a minimum, and a measurement that has to finish
  // is right to report the range holding it up. Nine ranges running
  // independently have nothing holding them up: each is corrected the moment it
  // alone has been heard. Reporting the minimum there hands the whole readout to
  // whichever range the music never reaches — one quiet top end and it says 0%
  // for the evening while everything else fills, corrects, and fills again.
  const heard = Math.round(
    (flags.isContinuous ? report.meanCoverage : report.coverage) * 100,
  );
  // Monotone for the one-shot: coverage dips when a new region starts
  // contributing, and a progress bar that counts backwards on its way to an
  // answer reads as a malfunction.
  //
  // NOT monotone for the continuous modes, where the same rule froze the
  // readout. Coverage there is a live state and not a journey: correcting a
  // range clears its evidence deliberately, and the half-life takes the rest
  // back when the music stops feeding it. Both are the number falling for a
  // good reason. Clamped, it reached 100 within a minute of the first track and
  // stayed there for the evening, over a row of full bars, next to the words
  // "needs deep bass" — a readout that was wrong, stuck, and arguing with itself
  // at the same time.
  const percent = (() => {
    if (flags.isContinuous) {
      return heard;
    }
    if (report.status !== 'listening') {
      return 100;
    }
    return Math.min(99, Math.max(previousPercent, heard));
  })();
  return {
    percent,
    // Named only while it is actually short. A covered region is not something
    // the measurement still needs, and saying it needed one at 100% was the
    // contradiction on screen.
    weakestLabel:
      isSettling || report.weakest?.isCovered
        ? ''
        : (report.weakest?.label ?? ''),
    isSettling,
    isSilent: flags.isSilent,
    isPaused: flags.isPaused,
    isBandLimited: report.isBandLimited,
    listenedMs: report.listenedMs,
    regions: report.regions.map((region) => ({
      label: region.label,
      lowFrequency: region.lowFrequency,
      highFrequency: region.highFrequency,
      confidence: region.confidence,
      isCovered: region.isCovered,
      weight: region.weight,
      liveDb: region.liveDb,
      typicalDb: region.typicalDb,
      centreFrequency: region.centreFrequency,
    })),
  };
};

/**
 * The progress republished between checkpoints, when only a flag has moved.
 *
 * Silence, a pause and a band-limited hold are all surfaced the moment they
 * flip rather than at the next checkpoint, so the bubble does not sit on a
 * stale "Listening 40%" while nothing is playing. THE RANGES STAY. This used
 * to publish an empty region list, and the coverage overlay reads an empty
 * list as "the measurement is over" — so the nine columns, their presence
 * lines and the bars along the foot faded out on every flip and came back on
 * the next checkpoint. The record dropping its bass for a bar is a flip; so is
 * three seconds of quiet between tracks. Under the continuous modes that was
 * the bands blinking in and out all evening, and during a band-limited hold,
 * which stops the checkpoints outright, they stayed gone for the whole of it.
 *
 * Nothing about the ranges has changed at a flip, so everything but the three
 * flags and the listened time is carried from the last full progress. Before
 * there has been one there is nothing to carry, and an empty list is the
 * truthful answer.
 */
export const flipBalanceProgress = (
  last: IBalanceProgress | undefined,
  flags: {
    isSilent: boolean;
    isPaused: boolean;
    isBandLimited: boolean;
    listenedMs: number;
    percent: number;
  },
): IBalanceProgress => ({
  ...(last ?? {
    percent: flags.percent,
    weakestLabel: '',
    isSettling: false,
    regions: [],
  }),
  isSilent: flags.isSilent,
  isPaused: flags.isPaused,
  isBandLimited: flags.isBandLimited,
  listenedMs: flags.listenedMs,
});
