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
 * How long the capture must have heard before its estimate is worth applying.
 *
 * Below this the answer is "no opinion", which the preamp reads as the
 * worst case — the same number that shipped. Ten seconds is long enough to have
 * seen a chorus and short enough that somebody who turns the mode on hears it
 * do something while still looking at it.
 */
export const HEADROOM_MIN_LISTENED_MS = 10000;

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
 * The measured programme, as the preamp maths wants it.
 *
 * A region that has heard nothing is reported at the loudest level heard
 * anywhere rather than left out. Leaving it out would let the interpolation
 * span the gap with whatever its neighbours happened to say, and a quiet
 * neighbour would then pay for a boost sitting in the silence — the same
 * mistake the out-of-band rule exists to prevent, one region further in.
 *
 * An empty array means "no opinion yet", which the preamp reads as the worst
 * case. That is what a cold start is, and it is also what a silent room is.
 */
export const readHeadroomProgramme = (
  state: IHeadroomCaptureState,
): IProgrammePoint[] => {
  if (state.listenedMs < HEADROOM_MIN_LISTENED_MS) {
    return [];
  }
  let loudest = Number.NEGATIVE_INFINITY;
  state.holdDb.forEach((level) => {
    if (Number.isFinite(level) && level > loudest) {
      loudest = level;
    }
  });
  if (!Number.isFinite(loudest)) {
    return [];
  }
  return state.regions.map((region, index) => {
    const held = state.holdDb[index];
    return {
      frequency: region.centreFrequency,
      gain: Number.isFinite(held) ? held : loudest,
    };
  });
};

/* -------------------------------------------------------------------------
 * Reporting
 * ---------------------------------------------------------------------- */

/**
 * The floor on how often the APO config may be rewritten, in ms. Every report
 * ends in a config file being written and APO reloading it.
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

/** How often a settled measurement is reported anyway, in ms. */
export const IDLE_PUSH_INTERVAL_MS = 15000;

/** Movement worth a config write, in dB. */
export const PUSH_DEADBAND_DB = 0.3;

export interface IPushDecision {
  sincePushMs: number;
  trimDb: number;
  lastPushedTrimDb: number;
  /** Largest per-region move since the last report, in dB. */
  programmeDeltaDb: number;
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
}: IPushDecision): boolean => {
  const isUrgent =
    lastPushedTrimDb - trimDb >= PUSH_DEADBAND_DB &&
    sincePushMs >= URGENT_PUSH_INTERVAL_MS;
  if (isUrgent) {
    return true;
  }
  if (
    sincePushMs < MIN_PUSH_INTERVAL_MS ||
    sincePushMs < IDLE_PUSH_INTERVAL_MS
  ) {
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
 * NOT ZERO, AND NOT ANYWHERE NEAR IT. Since Vista the Windows audio engine runs
 * a limiter that will not let the output rail: at +20 dB of preamp, with the
 * sound audibly breaking up, not one sample in 143,360 reached full scale and
 * the peak sat between -0.1 and -1 dBFS. A ceiling at 0 is unreachable, and a
 * ceiling at -1 is inside the region where the limiter is already working and
 * the measurement has stopped meaning anything.
 *
 * Three decibels down is the last honest reading. Holding the peak there keeps
 * the signal in the linear region where what the analyser reports is what the
 * endpoint received, and — the actual goal — keeps the limiter from ever
 * engaging, because the limiter engaging IS the distortion.
 */
export const SUPERVISOR_CEILING_DBFS = -3;

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
