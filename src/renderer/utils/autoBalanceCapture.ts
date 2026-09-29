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

import { clamp } from './utils';
import {
  ABS_FLOOR_DBFS,
  BALANCE_FRAME_INTERVAL_MS,
  BALANCE_REGION_EDGES,
  BALANCE_REGION_LABELS,
  CONVERGENCE_CHECK_MS,
  FRAME_FULL_PEAK_DBFS,
  FRAME_MIN_PEAK_DBFS,
  LEVEL_CLAMP_HI,
  LEVEL_CLAMP_LO,
  PRESENCE_FULL_SCALE_DB,
  PRESENCE_LEVEL_RELEASE_DB_PER_S,
  PRESENCE_RELEASE_DB_PER_S,
  PRESENCE_SILENT_DB,
  PRESENCE_TYPICAL_DB_PER_S,
  REGION_FLOOR_DB,
  REGION_FLOOR_RAMP_DB,
} from './autoBalanceTuning';
import { ISpectrumSample, clamp01 } from './autoBalance';
import {
  IFullBandState,
  advanceFullBandGate,
  createFullBandState,
} from './fullBandGate';

export {
  buildBalanceProgress,
  buildBalanceResult,
  evaluateBalanceCapture,
  flipBalanceProgress,
  shouldFinishBalanceCapture,
} from './autoBalanceReport';
export type { IBalanceListenBounds } from './autoBalanceReport';

/**
 * Listening: turning a stream of live frames into something worth solving.
 *
 * Eleven hundred lines that run while the user plays music. Frames arrive forty
 * times a second, each is judged loud enough to use or not, the regions fill up
 * at their own pace, and the whole thing decides when it has heard enough — or
 * when it has been listening too long to a source that will never cover the
 * spectrum.
 *
 * Separate from the solver because they answer different questions. This half
 * asks "do we know enough yet"; the other asks "given what we know, what should
 * the gains be". The second is a pure function of the first's output, which is
 * exactly why the first can be a state machine and the second cannot.
 */
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
  /** Set only for a capture that never ends. See CONTINUOUS_HALF_LIFE_MS. */
  halfLifeMs?: number;
  regions: IBalanceRegion[];
  /** Sum of weight * linear power per axis point, relative to the frame's own
   * mean level. */
  power: Float64Array;
  weight: Float64Array;
  regionStates: IBalanceRegionState[];
  /**
   * The record's own recent peak in dBFS, followed the way the plot follows it.
   *
   * Instant attack, about a decibel a second of release — which is exactly what
   * `useLiveOutputSpectrum` does for the trace it draws. That is not tidiness.
   * Somebody sets the presence lines by looking at the trace, so the number the
   * detector compares against those lines has to be the number they were
   * looking at. Two followers with different time constants would put a line in
   * one place on screen and another in the maths, and the disagreement would
   * only ever surface as the correction doing something with no visible reason.
   */
  trackReferenceDb?: number;
  /**
   * What each range is doing right now, on the plot's own axis.
   *
   * Deliberately not accumulated. Coverage and confidence answer "have we heard
   * enough of this range to correct it", which is a question about the whole
   * session. This answers "is anything playing here at the moment", which is a
   * question about this second — and averaging it would defeat the entire
   * purpose, because a bass guitar that stops for a verse is precisely the
   * thing being detected.
   */
  liveDb: Float64Array;
  /**
   * How much each range is believed at this instant, from 0 to 1.
   *
   * Written by the owner of the capture rather than computed here, for the same
   * reason `chainGainDb` is: it depends on where somebody has dragged that
   * range's presence lines, which is a preference rather than a property of the
   * measurement. The accumulator multiplies its frame weight by it and asks no
   * questions.
   *
   * THIS IS WHY MOVING A LINE CHANGES HOW FAST A RANGE FILLS. The lines used to
   * bound only the boost, so dragging one changed what a range was ALLOWED and
   * not what was HEARD — and a coverage bar sitting under a line that plainly
   * did not feed it explains less than no bar at all. Evidence gathered while a
   * range is silent is evidence about silence, so it now counts for as little
   * as the boost it would have justified.
   *
   * Absent means one everywhere, which is how every synthetic frame and every
   * test predating this behaves.
   */
  presenceGate?: Float64Array;
  /**
   * Whether the record is showing its whole spectrum at this moment.
   *
   * The presence gate above decides what ONE range may teach and may be given.
   * This decides whether the frame is worth hearing at all, because a range
   * dropping out deforms what every other range reads — see `fullBandGate`.
   */
  fullBand: IFullBandState;
  /**
   * What each range TYPICALLY does on this record, on the plot own axis.
   *
   * Where the presence lines place themselves from. Distinct from liveDb, which
   * is this second: this one moves at a tenth of a decibel a second, so it
   * describes the album rather than the bar. See PRESENCE_TYPICAL_DB_PER_S for
   * why that rate is the whole point.
   */
  typicalDb: Float64Array;
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
  /** Geometric centre, which is where the region's level is taken to apply. */
  centreFrequency: number;
  /**
   * What this range came out at, in dB relative to the frame's own mean level.
   *
   * The whole range as one number: a weighted mean over every frame that had
   * energy here, with `standardErrorDb` saying how much to believe it.
   *
   * Nothing corrects from these — see the note above `buildBalanceResult` for
   * why that was tried and undone. They are here because a report describing a
   * range without saying what it came out at is a report missing its answer,
   * and because the panel and the tests read them.
   */
  levelDb: number;
  /**
   * What this range is doing right now, on the plot's own axis.
   *
   * Not a session average like `levelDb` — this is the last second or so, which
   * is the only timescale on which "the bass guitar has stopped playing" is a
   * meaningful statement. Compared against the presence lines somebody has set
   * on the graph, and expressed the way the graph expresses everything so the
   * comparison means what it looks like.
   */
  liveDb: number;
  /** The same level followed slowly, which is where the lines place
   * themselves from. See PRESENCE_TYPICAL_DB_PER_S. */
  typicalDb: number;
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
  /**
   * The record is missing an end of its spectrum and the capture is waiting for
   * it — see `fullBandGate`. Nothing is being heard while this is true, so a
   * caller that acts on reports should sit this one out rather than act on an
   * estimate that has deliberately stopped moving.
   */
  isBandLimited: boolean;
  status: BalanceCaptureStatus;
}

export interface IBalanceResult {
  samples: ISpectrumSample[];
  status: 'ready' | 'partial';
  lowFrequency: number;
  highFrequency: number;
  /**
   * The ranges as they stood when the measurement finished.
   *
   * Carried so a one-shot can be held to the same presence rule as the
   * continuous modes. A single press is if anything MORE exposed to it: there
   * is no second pass to notice that a range was silent and take the boost back
   * again, so whatever it decides during a quiet intro is what somebody lives
   * with until they press it again.
   */
  regions: IBalanceRegionReport[];
}

/** Per-region coverage, for drawing the measurement onto the response graph. */
export interface IBalanceProgressRegion {
  label: string;
  lowFrequency: number;
  highFrequency: number;
  centreFrequency: number;
  confidence: number;
  isCovered: boolean;
  /**
   * What this range is doing right now, on the plot's own axis.
   *
   * Carried into the picture so the presence rule can be SHOWN rather than
   * explained. Two lines on their own describe a rule and leave somebody to
   * imagine where the sound is in relation to them; a mark at this level, drawn
   * between them, is the same rule with nothing left to imagine.
   */
  liveDb: number;
  /**
   * The same level followed slowly, which is where this range's lines place
   * themselves from. See `PRESENCE_TYPICAL_DB_PER_S`.
   */
  typicalDb: number;
  /** How much evidence this range holds — see `REGION_ACTIVE_WEIGHT` for the
   * one thing the readout does with it. */
  weight: number;
}

export interface IBalanceProgress {
  /**
   * 0..100. Monotone during a one-shot, where it is progress toward an answer
   * and must never count backwards; live under the continuous modes, where it
   * is the state of nine independent ranges and has no destination.
   */
  percent: number;
  weakestLabel: string;
  isSettling: boolean;
  isSilent: boolean;
  isPaused: boolean;
  /**
   * Waiting for the record to show its whole spectrum again.
   *
   * Its own flag rather than folded into `isSilent`, because it is the opposite
   * situation and the difference is the only useful thing to say: there is
   * plenty of sound, and that is precisely the problem with it.
   */
  isBandLimited: boolean;
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
  /**
   * How long evidence keeps its full weight, for a capture that never ends.
   * Absent means never forget, which is right for a measurement that stops of
   * its own accord — see `CONTINUOUS_HALF_LIFE_MS`.
   */
  halfLifeMs?: number,
): IBalanceCaptureState => {
  const regions = createBalanceRegions(axis);
  return {
    axis: [...axis],
    halfLifeMs,
    regions,
    power: new Float64Array(axis.length),
    weight: new Float64Array(axis.length),
    regionStates: regions.map(() => ({ weight: 0, mean: 0, m2: 0 })),
    // Starts below anything real, so a range is absent until a frame says
    // otherwise rather than being trusted before it has been heard at all.
    liveDb: new Float64Array(regions.length).fill(PRESENCE_SILENT_DB),
    typicalDb: new Float64Array(regions.length).fill(PRESENCE_SILENT_DB),
    fullBand: createFullBandState(),
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

/**
 * Forget what one region has heard.
 *
 * Nothing in the ordinary run of a measurement calls this any more: the
 * capture measures the source, a correction changes nothing about the
 * source, and so correcting a range leaves everything heard in it exactly as
 * true as it was. It stays for the one thing that does make a range's
 * evidence wrong — a caller that knows the source itself changed under a
 * range — and for the tests that drive the accumulator by hand.
 *
 * The convergence probe goes too. It is sampled across the whole axis, so it is
 * stale the moment any part of the axis is.
 */
export const resetBalanceRegion = (
  state: IBalanceCaptureState,
  regionIndex: number,
): void => {
  const region = state.regions[regionIndex];
  if (!region) {
    return;
  }
  for (let index = region.firstIndex; index <= region.lastIndex; index += 1) {
    state.power[index] = 0;
    state.weight[index] = 0;
  }
  state.regionStates[regionIndex] = { weight: 0, mean: 0, m2: 0 };
  state.checkpoint = undefined;
};

/**
 * How long evidence takes to lose half its weight, for a capture that never
 * ends.
 *
 * THE ACCUMULATOR WAS BUILT FOR A MEASUREMENT THAT STOPS. Four to twenty-five
 * seconds, everything weighted equally, and at the end an answer — for which
 * adding weight forever is not merely acceptable but correct.
 *
 * Continuous EQ then ran the same accumulator for hours, and the arithmetic
 * turns against it: after a few minutes the summed weight is so large that a
 * new frame moves the average by almost nothing. The measurement freezes at
 * whatever it heard early on and stops responding to the room, the record, or
 * anything else. Corrected ranges are cleared and recover; ranges that were
 * already right are never cleared, so they never recover — and once everything
 * is inside the deadband, nothing is cleared again and the whole thing is stuck
 * for good, still reporting confidently.
 *
 * A half-life fixes it in one line of arithmetic: old evidence fades, so the
 * estimate is always of roughly the last couple of minutes rather than of
 * everything since the mode was switched on. Confidence fades with it, which is
 * the right second-order effect — a range that stops being heard stops being
 * correctable rather than staying trusted on the strength of an old
 * measurement.
 *
 * Forty-five seconds, against a couple of seconds to reach coverage and twenty
 * between corrections: long enough that a correction is decided on far more
 * than one passage, short enough that a change of record is reflected within a
 * few minutes.
 *
 * Measured in LISTENED time, like every other clock here, so an evening with
 * the music paused does not age anything.
 */
export const CONTINUOUS_HALF_LIFE_MS = 45000;

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
  /*
   * THE RECORD, AND NOTHING ELSE.
   *
   * Every frame here is of the source: the sound before FluidEQ processes it,
   * taken from the Library host's own input tap or from a process loopback,
   * which Windows delivers ahead of the endpoint's effects (`rawSource.ts`).
   * Not the bands, not a voicing, not the rack, not the Smart EQ layer — none
   * of it is in what arrives, so none of it has to be excused or subtracted,
   * and nothing measured here can ever be a measurement of the correction's
   * own doing.
   *
   * This file used to receive the endpoint's loopback and take a model of the
   * chain back off it. The model never covered the rack — a compressor, a
   * maximizer, an exciter and the room all reshape the output by several
   * decibels, level-dependently — so what the solver saw as "the record" was
   * the record plus the rack's colouring, and it corrected the colouring;
   * and the one layer the model left in on purpose, this one, made every run
   * an accumulation onto the last, so the same record landed in different
   * places depending on what had been played before it. Measuring the source
   * is what makes the answer a property of the record.
   *
   * EVERYTHING BELOW MEASURES THE RECORD — the gate, the presence followers,
   * the reference level and the accumulated spectrum alike.
   */
  const recordLevels = frame.levels;
  const recordPeakDb = frame.peakDb;

  // Loud enough to trust, asked of the record.
  const w = clamp01(
    (recordPeakDb - FRAME_MIN_PEAK_DBFS) /
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

  /*
   * IS THE WHOLE RECORD PLAYING — asked before anything is believed.
   *
   * A frame missing a whole end of the spectrum is a measurement of an effect
   * rather than of the record, and it is wrong about the ranges that ARE
   * playing, not merely silent about the one that is not: the reference below
   * is the frame's own mean power, so a range dropping out lifts everything
   * left against it. See `fullBandGate` for the five seconds of a breakdown
   * that this exists to throw away.
   *
   * Held frames still drive the level followers below — the gate has to see the
   * music come back, and it can only see that through them — but they buy no
   * listened time, age nothing, and teach nothing.
   */
  const isLearning = advanceFullBandGate(
    state.fullBand,
    state.presenceGate,
    dt,
  );

  // The frame's own mean-power level is the reference. It is the
  // minimum-variance choice, and the tilt fit plus centring absorb the
  // constant, so using it changes nothing downstream except the noise.
  let refPower = 0;
  let refCount = 0;
  for (let index = 0; index < recordLevels.length; index += 1) {
    const level = recordLevels[index];
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

  // Age what is already here before adding to it.
  //
  // Everything is scaled by the same factor, so every mean is untouched and
  // only the confidence behind it shrinks — which is exactly the claim being
  // made: the estimate still says what it said, it is simply less sure of it
  // than it was a minute ago. See `CONTINUOUS_HALF_LIFE_MS`.
  if (isLearning && state.halfLifeMs && dt > 0) {
    const keep = 0.5 ** (dt / state.halfLifeMs);
    for (let index = 0; index < state.power.length; index += 1) {
      state.power[index] *= keep;
      state.weight[index] *= keep;
    }
    state.regionStates.forEach((region) => {
      /* eslint-disable no-param-reassign -- decayed in place: a new object per region per frame is the allocation this loop exists to avoid */
      region.weight *= keep;
      region.m2 *= keep;
      /* eslint-enable no-param-reassign */
    });
  }

  if (isLearning) {
    state.listenedMs += dt;
    state.acceptedFrames += 1;
  }

  /*
   * IS THIS RANGE PLAYING AT ALL — a different question from every other one
   * here, and the one that was missing.
   *
   * A range is measured if it sits within 45 dB of the frame peak, which a solo
   * passage clears easily. So a guitar intro with no bass instrument in it reads
   * as a record with no bass and the correction answers by boosting: measured on
   * a synthetic solo guitar, every mode drove 40 Hz and 50 Hz to their +6 dB
   * limit, where the same material inside a full mix is CUT by two to four.
   *
   * That gate cannot simply be tightened, because music's own tilt spans about
   * 25 dB and a threshold tight enough to catch a missing bass guitar throws
   * away the real air of acoustic material. No single number against the frame
   * peak separates "quiet because nothing is playing there" from "quiet because
   * that is what this range does".
   *
   * So each range is followed on its own, against the record's recent peak, and
   * expressed exactly as the plot expresses it — see `PRESENCE_FULL_SCALE_DB`.
   * Which is what makes the lines on the graph mean what they appear to mean.
   */
  // The record's peak, not the output's, for the same reason the levels below
  // are the record's: a reference that contains the correction moves when the
  // correction does, and everything referenced to it moves with it.
  const peak = recordPeakDb;
  if (Number.isFinite(peak)) {
    const released =
      state.trackReferenceDb === undefined
        ? peak
        : state.trackReferenceDb - (dt / 1000) * PRESENCE_RELEASE_DB_PER_S;
    state.trackReferenceDb = Math.max(peak, released);
  }
  const reference = state.trackReferenceDb;

  state.regions.forEach((region, regionIndex) => {
    /*
     * THE PRESENCE LINE ASKS ABOUT THE RECORD, NOT ABOUT WHAT WE DID TO IT.
     *
     * Taken from the output, this measured itself. Boost a range, its level in
     * the output rises, its typical level follows, its floor rises with it, and
     * more boost fits underneath — a loop with the correction inside it, which
     * on screen is a red line drifting up and down for no reason anybody can
     * point at. That is the report this fixes, and it is the same fault the
     * evidence gate a few lines below was already written to avoid.
     *
     * So it reads the reconstructed source, exactly as that gate does: the
     * question "is anything playing here" is about the music, and the chain is
     * not the music.
     */
    const sourceDb = regionLevelDb(
      recordLevels,
      region.firstIndex,
      region.lastIndex,
    );

    // Followed whether or not the range is accumulated below. A range under the
    // absolute floor has not stopped existing — it has gone quiet, which is the
    // single most important thing this is here to notice, and returning early
    // before recording it would leave the detector believing whatever it last
    // saw for as long as the silence lasted.
    if (reference !== undefined) {
      const chartDb = Number.isFinite(sourceDb)
        ? sourceDb - reference + PRESENCE_FULL_SCALE_DB
        : PRESENCE_SILENT_DB;
      const previous = state.liveDb[regionIndex];
      // Straight up, and down at a rate. A transient reaches its true height
      // whatever its length, which is what stops the top of the spectrum being
      // read fifteen decibels low — see `PRESENCE_LEVEL_RELEASE_DB_PER_S`.
      const live =
        previous <= PRESENCE_SILENT_DB || chartDb >= previous
          ? chartDb
          : Math.max(
              chartDb,
              previous - (dt / 1000) * PRESENCE_LEVEL_RELEASE_DB_PER_S,
            );
      state.liveDb[regionIndex] = live;

      /*
       * And the same level again, followed far more slowly.
       *
       * The lines place themselves from this rather than from the live value,
       * which is the difference between "this range is quiet on this record"
       * and "this range is quiet in this bar". Only the first is a reason to
       * move a threshold; acting on the second is how a follower talks itself
       * into believing silence.
       *
       * Rate-limited rather than smoothed, so the bound is a real one: a
       * passage of any length can move this by at most a tenth of a decibel
       * per second of it, and no amount of loudness or quiet can move it faster
       * than that. An exponential average has no such guarantee — a long enough
       * extreme drags it anywhere.
       *
       * Silence does not pull it down. A range at the silent floor says nothing
       * about what the record typically does there; it says the instrument
       * stopped, which is the one case this must not learn from.
       *
       * And frozen outright while the record is not showing its whole
       * spectrum, which is not tidiness — it is what stops the gate above
       * talking itself out of a hold. The presence lines place themselves from
       * this, so following a range that has just dropped out would walk that
       * range's floor down to meet it, call it present again, and end the hold
       * on the strength of the silence that started it. The same loop, slower,
       * is how a filtered intro became what the record "typically" does.
       */
      const typical = state.typicalDb[regionIndex];
      if (isLearning && live > PRESENCE_SILENT_DB) {
        const step = (dt / 1000) * PRESENCE_TYPICAL_DB_PER_S;
        state.typicalDb[regionIndex] =
          typical <= PRESENCE_SILENT_DB
            ? live
            : typical + clamp(live - typical, -step, step);
      }
    }

    // Everything above this line is a follower and has to keep running through
    // a hold. Everything below it is evidence, and a held frame is not any.
    if (!isLearning) {
      return;
    }

    if (!Number.isFinite(sourceDb) || sourceDb < ABS_FLOOR_DBFS) {
      return;
    }

    /*
     * Whether this range has enough music in it to teach anything, asked of the
     * record for the reason the header gives: asked of the output it is
     * self-concealing. Cut 6.5 kHz by 20 dB and the evidence that the cut is
     * wrong goes down with it, so the range never gathers enough to act on and
     * the measurement waits on it for the rest of the evening. The louder the
     * mistake, the more completely it hides.
     */
    const e = clamp01(
      (sourceDb - (recordPeakDb - REGION_FLOOR_DB)) / REGION_FLOOR_RAMP_DB,
    );
    if (e <= 0) {
      return;
    }
    // What this range has earned the right to teach, which is the same number
    // that bounds what it may be given. A silent range now fills its evidence
    // as slowly as it would have been corrected — see `presenceGate`.
    const gate = state.presenceGate
      ? clamp01(state.presenceGate[regionIndex])
      : 1;
    if (gate <= 0) {
      return;
    }
    const ww = w * e * gate;

    // Weighted Welford, so the standard error is available without keeping
    // every frame.
    const x = clamp(sourceDb - refDb, LEVEL_CLAMP_LO, LEVEL_CLAMP_HI);
    const s = state.regionStates[regionIndex];
    s.weight += ww;
    const delta = x - s.mean;
    s.mean += (ww / s.weight) * delta;
    s.m2 += ww * delta * (x - s.mean);

    for (let index = region.firstIndex; index <= region.lastIndex; index += 1) {
      const level = recordLevels[index];
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

/*
 * THE MEASUREMENT AS NINE NUMBERS, AND WHY IT IS NOT HERE ANY MORE.
 *
 * There was a `buildRegionSpectrum` in this spot, turning the report into one
 * point per frequency range so the continuous modes could correct a range's
 * overall level rather than the detail inside it. Sturdier by construction: a
 * range level is a weighted mean over every frame that had energy in it, where
 * a point of the smoothed curve is one FFT bin averaged with its neighbours.
 *
 * It was also too blind to be useful. A resonance sits *inside* a range, so the
 * average smears it into that range's own level and there is nothing left to
 * correct — and the difference turned out to be audible, with the one-shot
 * measurement, which never used ranges, the one people prefer the sound of.
 *
 * The regions still decide WHEN a range may be corrected, through coverage and
 * confidence. They no longer decide what the correction is.
 */

/**
 * What the continuous modes are doing, which is several things at once.
 *
 * Its own describer rather than the one-shot's, because the two measurements
 * have a different shape and the sentence has to match. A one-shot converges as
 * a whole and is over when it is over, so naming the single range holding it up
 * is exactly the useful thing to say. The continuous modes never converge and
 * never finish: every range fills at its own rate, is corrected the moment it
 * alone has been heard, and is cleared on its own so it can start again while
 * its neighbours carry on undisturbed. At any moment several are mid-flight and
 * the rest are covered.
 *
 * Borrowing the one-shot's sentence for it named one of those and implied it was
 * the only one, and — because `weakest` is the least confident region rather
 * than a short one — went on naming it after everything was covered, so the
 * bubble asked for deep bass while nothing anywhere was moving.
 *
 * Ranges still filling, all of them, capped so it stays a sentence. Empty when
 * none are, which is the ordinary steady state: everything heard, nothing far
 * enough out to touch, still listening.
 */
/*
 * -------------------------------------------------------------------------
 * Saying it, in the language the app is in
 * -------------------------------------------------------------------------
 *
 * EVERY SENTENCE BELOW IS BUILT FROM PARTS, AND NONE OF THEM IS BUILT FROM
 * TRANSLATED PARTS.
 *
 * The difference is the whole reason this section exists. "Lifted air, eased
 * bass" is a verb, a range name and a separator, and the obvious way to
 * translate it — look up the verb, look up the noun, put a space between them —
 * produces a sentence that is wrong in most languages and in a way nobody who
 * only reads English will ever see. Spanish and Italian make the participle
 * agree with the noun's gender; German and Russian want it in a case the noun
 * is not in; Japanese puts the verb last. There is no ordering of two
 * separately-translated fragments that is right in all ten.
 *
 * So the clause is the unit. `eq.smart.shape.lifted` is a whole phrase with the
 * range in a placeholder, and each dictionary decides where the range goes and
 * what surrounds it — several of them deliberately phrase it as a label with a
 * colon so the noun can stay in its dictionary form, because a placeholder
 * cannot be declined.
 *
 * The range names are still their own keys, because they are also said alone,
 * in a list, after "waiting on". Even the comma is a key: a list of nouns is
 * separated by an ideographic comma in Chinese and Japanese.
 *
 * `t` is passed in rather than reached for. These functions are pure — a test
 * drives them with a translator bound to whatever locale it wants to assert
 * against — and the caller is a component that already has one.
 */
