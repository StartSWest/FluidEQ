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
  IProgrammePoint,
  SMART_HEADROOM_REGION_EDGES,
} from '../../common/smartHeadroom';
import { ABS_FLOOR_DBFS, FRAME_MIN_PEAK_DBFS } from './autoBalanceTuning';

/**
 * What the music itself is doing, per frequency range, over a listening
 * session.
 *
 * DELIBERATELY NOT `autoBalanceCapture`, and the reason is one word: this keeps
 * a MAXIMUM and that one keeps a MEAN. Smart EQ asks what a range usually
 * sounds like, and a weighted mean is the right answer to that. Auto-normalize
 * asks how loud a range has ever got, because reserving headroom for the
 * average passage is reserving it for the wrong passage — the chorus arrives
 * after the quiet intro and the average is no defence against it.
 *
 * Everything else is shared: the same analyser, the same axis cells, the same
 * `measured - chain` reconstruction. Only the statistic differs, and it differs
 * all the way down, which is why this is a separate accumulator rather than a
 * flag on that one.
 */

/**
 * How fast a range forgets how loud it once was, in dB per second of LISTENED
 * time.
 *
 * A maximum that never decays is pinned forever by one cymbal crash, and the
 * measurement stops describing the record within about a minute of starting it.
 * A maximum that decays quickly tracks the passage playing now, which is the
 * failure the maximum was chosen to avoid in the first place.
 *
 * A tenth of a decibel a second is six a minute: a chorus twelve decibels above
 * the verse still counts for a full two minutes after it ends, so a correction
 * is never decided on one passage, while a change of record is reflected inside
 * a few minutes.
 *
 * In listened time, like every other clock in the capture, so an evening with
 * the music paused does not quietly hand back headroom that the next track will
 * want.
 */
export const HEADROOM_RELEASE_DB_PER_S = 0.1;

/**
 * How long the capture listens before it is speaking entirely for itself.
 *
 * NOT A GATE, AND IT USED TO BE ONE. The estimate was withheld for ten seconds
 * and then handed over whole, so the preamp sat at the worst case and then
 * moved to the measured value in a single write — eight or nine decibels of
 * level, at once, with nothing to attribute it to. That is a step change in
 * loudness in the middle of somebody's music, which is what this feature exists
 * to avoid, arriving from the feature itself.
 *
 * So confidence grows with the listening instead. The reported programme is
 * blended from "flat at the loudest region", which reproduces the worst case
 * exactly, towards what was actually measured — see `readHeadroomProgramme`.
 * Every intermediate answer is a legal programme, so the safety bound holds all
 * the way along it, and the preamp glides rather than jumps.
 *
 * TWO minutes of LISTENED time, and the second one buys the whole point of the
 * exercise. The step somebody hears is the ramp divided by how many config
 * writes carry it, and the writes are floored at one per two seconds — so the
 * settling time IS the step size. Simulated against the real push rule on a
 * chain recovering 9.58 dB: sixty seconds gives thirty writes of 0.79 dB, which
 * is still a change you can point at; a hundred and twenty gives fifty-nine of
 * 0.41 dB, which is not. Three minutes reaches 0.28 dB and buys nothing audible
 * for another twenty-seven writes.
 *
 * Paused music does not spend it, like every other clock here.
 */
export const HEADROOM_SETTLE_MS = 120000;

/** Bound on one frame's contribution, so a stalled renderer cannot claim time. */
const MAX_FRAME_DELTA_MS = 250;

export interface IHeadroomRegion {
  lowFrequency: number;
  highFrequency: number;
  /** Geometric centre, which is the frequency the region's level is filed at. */
  centreFrequency: number;
  firstIndex: number;
  lastIndex: number;
}

/** One analyser frame, in absolute dBFS on the shared axis. */
export interface IHeadroomFrame {
  levels: Float64Array;
  timestampMs: number;
}

export interface IHeadroomCaptureState {
  axis: number[];
  regions: IHeadroomRegion[];
  /** Decaying maximum of the programme's level per region. -Infinity = unheard. */
  holdDb: Float64Array;
  /**
   * What the whole applied chain is doing at each axis point, in dB, written by
   * the owner before each frame.
   *
   * The loopback is post-APO — a 1 kHz tone sent at -26.02 dBFS came back at
   * -32.37 against a -9.5 dB preamp — so what arrives here is the record with
   * everything already done to it. Subtracting the chain is what turns it back
   * into the record. Getting the sign wrong makes the loop chase its own tail.
   *
   * Unlike Smart EQ's version this removes EVERYTHING, preamp included. That
   * loop wants to hear its own correction so it can verify it; this one wants
   * the music as it was written, because the question is what the chain will do
   * to it next.
   */
  chainGainDb?: number[];
  /** Scratch for the reconstruction, reused rather than allocated per frame. */
  sourceLevels?: Float64Array;
  listenedMs: number;
  lastTimestampMs: number;
  frames: number;
}

export const createHeadroomRegions = (
  axis: readonly number[],
): IHeadroomRegion[] => {
  const regions: IHeadroomRegion[] = [];
  for (
    let index = 0;
    index < SMART_HEADROOM_REGION_EDGES.length - 1;
    index += 1
  ) {
    const lowFrequency = SMART_HEADROOM_REGION_EDGES[index];
    const highFrequency = SMART_HEADROOM_REGION_EDGES[index + 1];
    const isLast = index === SMART_HEADROOM_REGION_EDGES.length - 2;
    let firstIndex = -1;
    let lastIndex = -1;
    axis.forEach((frequency, axisIndex) => {
      const inside = isLast
        ? frequency >= lowFrequency && frequency <= highFrequency
        : frequency >= lowFrequency && frequency < highFrequency;
      if (inside) {
        if (firstIndex < 0) {
          firstIndex = axisIndex;
        }
        lastIndex = axisIndex;
      }
    });
    if (firstIndex >= 0) {
      regions.push({
        lowFrequency,
        highFrequency,
        centreFrequency: Math.sqrt(lowFrequency * highFrequency),
        firstIndex,
        lastIndex,
      });
    }
  }
  return regions;
};

export const createHeadroomCaptureState = (
  axis: number[],
): IHeadroomCaptureState => {
  const regions = createHeadroomRegions(axis);
  const holdDb = new Float64Array(regions.length);
  holdDb.fill(Number.NEGATIVE_INFINITY);
  return {
    axis,
    regions,
    holdDb,
    listenedMs: 0,
    lastTimestampMs: 0,
    frames: 0,
  };
};

/** Power mean across a region, in the same units as the levels handed in. */
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
  return count > 0 ? 10 * Math.log10(power / count) : Number.NEGATIVE_INFINITY;
};

/**
 * Fold one frame into the state. Mutates and returns it, so a test can drive it
 * with `Array.reduce` over synthetic frames.
 */
export const accumulateHeadroomFrame = (
  state: IHeadroomCaptureState,
  frame: IHeadroomFrame,
): IHeadroomCaptureState => {
  const { levels } = frame;
  state.frames += 1;
  const rawDelta = frame.timestampMs - state.lastTimestampMs;
  const dt =
    state.frames === 1
      ? 0
      : Math.min(Math.max(rawDelta, 0), MAX_FRAME_DELTA_MS);
  state.lastTimestampMs = frame.timestampMs;

  /*
   * Reconstruction is not resurrection. A point already on the analyser's floor
   * carries no information, and adding the chain's cut back onto it would
   * manufacture a spectrum out of dither — so those points are dropped rather
   * than compensated.
   */
  let source = levels;
  if (state.chainGainDb) {
    if (!state.sourceLevels || state.sourceLevels.length !== levels.length) {
      state.sourceLevels = new Float64Array(levels.length);
    }
    const reconstructed = state.sourceLevels;
    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index];
      reconstructed[index] =
        !Number.isFinite(level) || level < ABS_FLOOR_DBFS
          ? Number.NaN
          : level - (state.chainGainDb[index] ?? 0);
    }
    source = reconstructed;
  }

  let framePeak = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < source.length; index += 1) {
    const level = source[index];
    if (Number.isFinite(level) && level > framePeak) {
      framePeak = level;
    }
  }
  // Asked of the record rather than of the output, so a chain that has turned
  // everything down does not read as silence and stall the measurement.
  if (!Number.isFinite(framePeak) || framePeak < FRAME_MIN_PEAK_DBFS) {
    return state;
  }

  state.listenedMs += dt;
  const release = (dt / 1000) * HEADROOM_RELEASE_DB_PER_S;
  state.regions.forEach((region, index) => {
    const held = state.holdDb[index];
    const decayed = Number.isFinite(held) ? held - release : held;
    const level = regionLevelDb(source, region.firstIndex, region.lastIndex);
    state.holdDb[index] =
      Number.isFinite(level) && level >= ABS_FLOOR_DBFS
        ? Math.max(decayed, level)
        : decayed;
  });

  return state;
};

/**
 * How far the capture is towards speaking for itself, from 0 to 1.
 *
 * Read by the owner as well, to know whether the estimate is still converging
 * and therefore worth reporting promptly — see `shouldPushMeasurement`.
 */
export const headroomConfidence = (state: IHeadroomCaptureState): number =>
  Math.min(1, Math.max(0, state.listenedMs / HEADROOM_SETTLE_MS));

/**
 * The measured programme, as the preamp maths wants it.
 *
 * A region that has heard nothing is reported at the loudest level heard
 * anywhere rather than left out. Leaving it out would let the interpolation
 * span the gap with whatever its neighbours happened to say, and a quiet
 * neighbour would then pay for a boost sitting in the silence — the same
 * mistake the out-of-band rule exists to prevent, one region further in.
 *
 * A FLAT PROGRAMME IS THE WORST CASE, EXACTLY. That identity is what makes the
 * confidence blend below safe rather than merely gentle: if every region reports
 * the same level L then the programme's peak is L and its peak through the chain
 * is L plus the chain's own peak, so the excess is the chain peak and the preamp
 * is the number that shipped. Reporting `loudest` everywhere and reporting
 * nothing at all are therefore the same answer, and every mixture of the flat
 * programme with the measured one lies between the two — never louder than the
 * measurement says is safe, never quieter than the worst case.
 *
 * So a young capture is not silent, it is unconfident, and it walks from one to
 * the other as it listens. An empty array is kept for the one case that is
 * genuinely no answer: nothing finite heard anywhere, which is a silent room.
 */
export const readHeadroomProgramme = (
  state: IHeadroomCaptureState,
): IProgrammePoint[] => {
  let loudest = Number.NEGATIVE_INFINITY;
  state.holdDb.forEach((level) => {
    if (Number.isFinite(level) && level > loudest) {
      loudest = level;
    }
  });
  if (!Number.isFinite(loudest)) {
    return [];
  }
  const confidence = headroomConfidence(state);
  return state.regions.map((region, index) => {
    const held = state.holdDb[index];
    const measured = Number.isFinite(held) ? held : loudest;
    return {
      frequency: region.centreFrequency,
      // `measured` is never above `loudest`, so this only ever walks downwards
      // from the flat answer towards the measured one.
      gain: loudest - confidence * (loudest - measured),
    };
  });
};

/* -------------------------------------------------------------------------
 * Reporting
 * ---------------------------------------------------------------------- */

/**
 * The floor on how often the APO config may be rewritten WHILE THE ESTIMATE IS
 * STILL CONVERGING, in ms. Every report ends in a config file being written and
 * APO reloading it.
 *
 * It had no effect at all until the settling ramp needed it: the only other
 * floor is fifteen seconds and this one was tested with `||` against it, so the
 * longer of the two always won. Now it is the one that runs while the estimate
 * converges, and its whole job is to let the recovery arrive as sixty small
 * steps rather than eight large ones.
 */
export const MIN_PUSH_INTERVAL_MS = 2000;

/**
 * The floor for a supervisor pull-down, in ms.
 *
 * Far shorter than the ordinary one, because the two protect against different
 * things. The ordinary floor protects the config file from a measurement that
 * drifts; this one only has to stop a single transient from writing on
 * consecutive frames, and everything it delays is audible.
 */
export const URGENT_PUSH_INTERVAL_MS = 200;

/**
 * The floor once the estimate has settled, in ms.
 *
 * Long, because a settled capture still wanders: the hold decays at a tenth of
 * a decibel a second and jumps back up on the next chorus, so a moving
 * measurement is the normal condition of an evening's listening and reporting
 * each wobble would rewrite the config every few seconds all night. Nothing is
 * lost by waiting — a settled estimate that has drifted a third of a decibel is
 * not urgent, and anything that IS urgent is a pull-down, which has its own
 * floor two orders of magnitude shorter.
 */
export const IDLE_PUSH_INTERVAL_MS = 15000;

/** Movement worth a config write, in dB. */
export const PUSH_DEADBAND_DB = 0.3;

export interface IPushDecision {
  sincePushMs: number;
  trimDb: number;
  lastPushedTrimDb: number;
  /** Largest per-region move since the last report, in dB. */
  programmeDeltaDb: number;
  /**
   * Whether the estimate is still walking up from the worst case.
   *
   * The two floors answer different questions. A settled capture that has
   * drifted a third of a decibel can wait a quarter of a minute; a capture
   * still handing back the reserve it has proved unnecessary is walking the
   * level somewhere, and how often it reports IS the step size of that walk.
   */
  isSettling?: boolean;
}

/**
 * Whether what has been measured is worth a config write yet.
 *
 * URGENCY IS DECIDED BEFORE THE RATE LIMIT, NOT AFTER IT, and that ordering is
 * the whole of this function. With the two-second floor applied first, the
 * supervisor's attack was ornamental: the trim reached the right value inside a
 * second and then sat in the renderer waiting for the floor. A chorus arriving
 * a fifth of a second after a report spent nearly two seconds above the ceiling
 * with the correction already computed and unsent — which is the limiter
 * engaging, for exactly as long as the rate limit said so.
 *
 * A pull-down therefore gets its own much shorter floor. It still has one,
 * because the supervisor moves at six decibels a second and would otherwise
 * write on consecutive frames.
 */
export const shouldPushMeasurement = ({
  sincePushMs,
  trimDb,
  lastPushedTrimDb,
  programmeDeltaDb,
  isSettling = false,
}: IPushDecision): boolean => {
  const isUrgent =
    lastPushedTrimDb - trimDb >= PUSH_DEADBAND_DB &&
    sincePushMs >= URGENT_PUSH_INTERVAL_MS;
  if (isUrgent) {
    return true;
  }
  const floorMs = isSettling ? MIN_PUSH_INTERVAL_MS : IDLE_PUSH_INTERVAL_MS;
  if (sincePushMs < floorMs) {
    return false;
  }
  return (
    programmeDeltaDb >= PUSH_DEADBAND_DB ||
    Math.abs(trimDb - lastPushedTrimDb) >= PUSH_DEADBAND_DB
  );
};

/* -------------------------------------------------------------------------
 * The sample peak supervisor
 * ---------------------------------------------------------------------- */

/**
 * Where the true output peak is held, in dBFS.
 *
 * THE NUMBER IS CAudioLimiter'S, NOT ONE WE CHOSE. Windows ends every output
 * path with a limiter — CAudioLimiter, right before the conversion to integer —
 * and the documented figure is that "the effects of CAudioLimiter are negligible
 * on signals whose peak value is below approx. -0.1 dBFS". That is the whole
 * specification: at -0.1 the limiter starts working, and the limiter working IS
 * the distortion this mode exists to prevent.
 *
 * Two tenths of margin under it, and no more. THE FIRST ATTEMPT USED -3 dBFS,
 * on the reasoning that -1 was already inside the limiter's region. It is not:
 * mastered music peaks between -0.1 and -1 dBFS as a matter of course, so a
 * ceiling at -3 is BELOW ordinary programme material and the supervisor read
 * "too loud" on every track, forever. In the real window it walked the preamp
 * from -4.36 dB to the -20 dB clamp in about three minutes and never came back.
 * The mechanism was sound; the threshold was roughly three decibels into the
 * music itself.
 *
 * Measured where the limiter measures. The loopback sits after the volume APO —
 * Windows inserts that "right before the samples are converted to integer",
 * after Equalizer APO — so what this capture reads is what CAudioLimiter is
 * about to be handed, volume knob included. That is the point of taking it from
 * the capture rather than computing it: the arithmetic upstream cannot see the
 * volume, and the volume is half of whether the limiter fires.
 */
export const SUPERVISOR_CEILING_DBFS = -0.3;

/**
 * Down fast, up slowly, and the asymmetry is the whole point.
 *
 * Being wrong downward costs a little volume for a few seconds. Being wrong
 * upward costs distortion, on somebody's music, with no way for them to know
 * why. Six decibels a second gets out of trouble inside a syllable; a fifth of
 * a decibel a second takes a minute to give a single decibel back, so the
 * recovery can never outrun the evidence that it is safe.
 */
export const SUPERVISOR_ATTACK_DB_PER_S = 6;
export const SUPERVISOR_RELEASE_DB_PER_S = 0.2;

/**
 * The standing correction the supervisor is applying, in dB. Never positive.
 *
 * This is the closed-loop half of the feature, and it exists because everything
 * else in it is open-loop: the excess is computed from a model of the filters
 * and a measurement of the spectrum, and neither can see its own error. Error
 * in the filter model, in the chain subtraction, in the analyser's own
 * response, in the crest factor of material nobody has heard yet — all of it
 * lands as output level, and this is the only thing here that measures output
 * level directly.
 */
export const advanceSupervisorTrimDb = (
  trimDb: number,
  peakDbfs: number,
  deltaMs: number,
): number => {
  const dt = Math.min(Math.max(deltaMs, 0), MAX_FRAME_DELTA_MS) / 1000;
  const current = Number.isFinite(trimDb) ? Math.min(0, trimDb) : 0;
  if (dt <= 0 || !Number.isFinite(peakDbfs)) {
    return current;
  }
  const over = peakDbfs - SUPERVISOR_CEILING_DBFS;
  if (over > 0) {
    // Never further than the overshoot itself: the supervisor's job is to put
    // the peak on the ceiling, not to duck under it and crawl back.
    const step = Math.min(over, SUPERVISOR_ATTACK_DB_PER_S * dt);
    return current - step;
  }
  if (current >= 0) {
    return 0;
  }
  return Math.min(0, current + SUPERVISOR_RELEASE_DB_PER_S * dt);
};
