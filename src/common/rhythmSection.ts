/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { getEaseFactor } from './smoothing';

/**
 * Where the song is (`sceneRhythm.ts`): how intense this part is against the
 * rest of it - the chorus a ballad sings out in, the drop of a dance track -
 * whether it is building towards something, and whether a drop just landed.
 *
 * All of it from the song's loudness in decibels, from the rhythm bands,
 * which are absolute. Judged from the music's
 * level instead - its place between the quietest and loudest it had lately
 * been - every phrase a singer swelled read as a build: a ballad sat
 * "building" 0.2 to 0.9 through whole verses, and three drops were counted
 * in a minute of Say You Won't Let Go.
 *
 * - A build is a rise kept up in the upper bands, from 1.1 kHz, where a
 *   riser sweeps and a snare roll crowds - the low end often thins out as a
 *   build goes: both halves of the last four seconds, in half-second blocks,
 *   climbing by at least BUILD_SLOPE_DB_S. A step - an intro giving way to a
 *   verse - climbs in one half and not the other, and a phrase swells and
 *   falls back within one. Quarter-second blocks jumped 6 dB with whether a
 *   kick fell inside them. Two averages of different lengths
 *   compared, as this was first measured, cannot tell a step from a ramp:
 *   the long one lags either way, and every song's first minute read as a
 *   build from the silence before it.
 * - A drop is the song arriving after a build: its low end - the kick and the
 *   bass, which a build takes away, if only for its last bar - coming back:
 *   a half-second block DROP_RETURN_DB over the two seconds before it, near
 *   the song's loudest, with a kick in it. Judged on averages a third of a
 *   second long, every kick inside a build moved the low end 4 dB and fired
 *   a drop; without the kick, a piano ballad's left hand landing after a
 *   crescendo was a drop two or three times a minute. Without a build before it nothing drops: a
 *   ballad's chorus arriving is the song lifting, and says so as intensity.
 * - Intensity is the loudness over the last second and a half placed between
 *   the quietest and loudest the song has been, kept over about a minute.
 *
 * Nothing is measured until something is heard, and the first thing heard
 * sets every level; for the first WARM_UP_MS the song's range follows the
 * music both ways within seconds, so a song fading in out of silence does
 * not keep that silence as its quietest for a minute.
 */

/** A drop's envelope halves every this many milliseconds. */
export const DROP_HALF_LIFE_MS = 700;

/** How long a block of loudness is, and how many are kept. */
const BLOCK_MS = 500;
const BLOCKS_KEPT = 12;
/** The blocks a build is judged over: four seconds, as two halves. */
const BUILD_WINDOW_BLOCKS = 8;
/** The upper bands a build is heard in: 1.1 to 12 kHz. */
const UPPER_FROM_BAND = 14;
/** How long the song's range follows the music quickly, after it starts. */
const WARM_UP_MS = 10_000;
/** How fast both halves have to climb, in dB a second, and where it is all a build. */
const BUILD_SLOPE_DB_S = 0.5;
const BUILD_FULL_DB_S = 1.2;
/**
 * How far the low end has to come back, at once, for a drop: a build whose
 * pads and riser keep some low end under its kickless last bar came back by
 * only 5.4 dB, and was missed at 6.
 */
const DROP_RETURN_DB = 4;
/** How much of a build has to have just been heard for a drop to follow it. */
const DROP_AFTER_BUILD = 0.5;
/** How near the song's loudest a drop lands. */
const DROP_NEAR_TOP_DB = 5;
/** No drop within this long of the last. */
const DROP_GAP_MS = 8_000;
/** The song's range is never taken as narrower than this. */
const MIN_RANGE_DB = 8;

export interface ISectionState {
  /** The block being filled: its powers summed (upper bands, low end, all), and how long it has run. */
  blockUpper: number;
  blockLow: number;
  blockAll: number;
  blockMs: number;
  /** The last blocks' loudness in dB, oldest first: upper bands, low end, all. */
  blocks: number[];
  lowBlocks: number[];
  allBlocks: number[];
  /** Loudness in dB over 1.5 s. */
  mid: number;
  /** How long the song has been heard, for the range's warm-up. */
  heardMs: number;
  /** The quietest and loudest the song has lately been. */
  floor: number;
  ceiling: number;
  build: number;
  /** The last build, remembered for a moment, for the drop that ends it. */
  buildMemory: number;
  drop: number;
  dropSerial: number;
  sinceDropMs: number;
  /** Whether anything has been heard yet: the first thing heard sets every level. */
  started: boolean;
}

export const createSectionState = (): ISectionState => ({
  blockUpper: 0,
  blockLow: 0,
  blockAll: 0,
  blockMs: 0,
  blocks: [],
  lowBlocks: [],
  allBlocks: [],
  mid: -100,
  heardMs: 0,
  floor: -100,
  ceiling: -100,
  build: 0,
  buildMemory: 0,
  drop: 0,
  dropSerial: 0,
  sinceDropMs: DROP_GAP_MS,
  started: false,
});

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** The mean power of bands (0..1 over 100 dB) from `from` to `to`, linear. */
const powerOf = (bands: readonly number[], from: number, to: number) => {
  let power = 0;
  for (let at = from; at <= to; at += 1) {
    power += 10 ** (((bands[at] ?? 0) * 100 - 100) / 10);
  }
  return power / (to - from + 1);
};

const toDb = (power: number) => 10 * Math.log10(Math.max(1e-10, power));

/** The least-squares slope of `values` (one a block), in dB a second. */
const slopeOf = (values: readonly number[]) => {
  const count = values.length;
  const middle = (count - 1) / 2;
  let top = 0;
  let bottom = 0;
  let mean = 0;
  values.forEach((value) => {
    mean += value / count;
  });
  values.forEach((value, at) => {
    top += (at - middle) * (value - mean);
    bottom += (at - middle) ** 2;
  });
  return bottom > 0 ? top / bottom / (BLOCK_MS / 1_000) : 0;
};

/**
 * One step, from the rhythm bands (24, 0..1 over 100 dB). `audible` false is
 * a rest inside the music: the song's levels hold, and nothing is started.
 * `kicked` says a kick was heard in the last half second.
 */
export const followSection = (
  state: ISectionState,
  bands: readonly number[],
  stepMs: number,
  audible: boolean,
  kicked: boolean,
) => {
  const power = powerOf(bands, 0, bands.length - 1);
  if (!state.started) {
    if (!audible) {
      return;
    }
    const loudness = toDb(power);
    state.mid = loudness;
    state.floor = loudness;
    state.ceiling = loudness;
    state.started = true;
  }
  state.mid += (toDb(power) - state.mid) * getEaseFactor(stepMs, 1_500);
  // The song's range: out to a new extreme within a second, back in over
  // most of a minute, so one quiet break does not make the rest loud.
  state.heardMs += stepMs;
  const inward = state.heardMs < WARM_UP_MS ? 2_000 : 60_000;
  state.ceiling +=
    (state.mid - state.ceiling) *
    getEaseFactor(stepMs, state.mid > state.ceiling ? 1_000 : inward);
  state.floor +=
    (state.mid - state.floor) *
    getEaseFactor(stepMs, state.mid < state.floor ? 1_000 : inward);

  state.blockUpper +=
    powerOf(bands, UPPER_FROM_BAND, bands.length - 1) * stepMs;
  // The kick's and the bass's bands, to 165 Hz.
  state.blockLow += powerOf(bands, 0, 6) * stepMs;
  state.blockAll += power * stepMs;
  state.blockMs += stepMs;
  let blockDone = false;
  if (state.blockMs >= BLOCK_MS) {
    const keep = (list: number[], value: number) => {
      list.push(toDb(value / state.blockMs));
      if (list.length > BLOCKS_KEPT) {
        list.shift();
      }
    };
    keep(state.blocks, state.blockUpper);
    keep(state.lowBlocks, state.blockLow);
    keep(state.allBlocks, state.blockAll);
    state.blockUpper = 0;
    state.blockLow = 0;
    state.blockAll = 0;
    state.blockMs = 0;
    blockDone = true;
  }
  let building = 0;
  if (state.blocks.length >= BUILD_WINDOW_BLOCKS) {
    const window = state.blocks.slice(-BUILD_WINDOW_BLOCKS);
    const half = BUILD_WINDOW_BLOCKS / 2;
    const climb = Math.min(
      slopeOf(window.slice(0, half)),
      slopeOf(window.slice(half)),
    );
    building =
      clamp01(
        (climb - BUILD_SLOPE_DB_S) / (BUILD_FULL_DB_S - BUILD_SLOPE_DB_S),
      ) *
      (1 - state.drop);
  }
  state.build += (building - state.build) * getEaseFactor(stepMs, 400);
  state.buildMemory = Math.max(
    state.build,
    state.buildMemory * 2 ** (-stepMs / 2_000),
  );

  state.sinceDropMs += stepMs;
  // The newest block's low end against the two seconds before it, the block
  // just before it left out: a drop can land partway through a block.
  const lows = state.lowBlocks;
  const arriving =
    blockDone &&
    lows.length >= 6 &&
    lows[lows.length - 1] -
      toDb(
        lows.slice(-6, -2).reduce((sum, db) => sum + 10 ** (db / 10), 0) / 4,
      ) >
      DROP_RETURN_DB &&
    (state.allBlocks[state.allBlocks.length - 1] ?? -100) >
      state.ceiling - DROP_NEAR_TOP_DB;
  if (
    arriving &&
    kicked &&
    state.buildMemory > DROP_AFTER_BUILD &&
    state.sinceDropMs > DROP_GAP_MS
  ) {
    state.drop = 1;
    state.dropSerial = (state.dropSerial + 1) % 4096;
    state.sinceDropMs = 0;
    state.buildMemory = 0;
  } else {
    state.drop *= 2 ** (-stepMs / DROP_HALF_LIFE_MS);
  }
};

/** Nothing heard: a build and a drop fade as a paused song's picture holds. */
export const quietSection = (
  state: ISectionState,
  quietMs: number,
  keep: number,
) => {
  state.build *= keep;
  state.drop *= 2 ** (-quietMs / DROP_HALF_LIFE_MS);
};

/**
 * How far past what has been heard a song's range is taken to reach while
 * little of it has been: UP_MARGIN_DB above its loudest yet and
 * DOWN_MARGIN_DB below its quietest, fading over MARGIN_FADE_MS of the song.
 */
const UP_MARGIN_DB = 18;
const DOWN_MARGIN_DB = 9;
const MARGIN_FADE_MS = 30_000;

/**
 * How intense this part is, 0..1, between the quietest and loudest lately. A
 * song whose quietest and loudest are closer than MIN_RANGE_DB is taken to
 * span that much around its own middle: one that never changes is neither
 * quiet nor loud against itself. Measured from the bottom of so narrow a
 * range instead, the floor followed a steady song up to its own level, and
 * Stayin' Alive read 0.00 through the whole of its chorus.
 *
 * Early in a song everything heard is the loudest yet, so the range is taken
 * to reach further than the song has gone, more above than below: songs
 * mostly grow from their start. Measured on 23 songs against each one's
 * strength judged once it had played through (`songMap.ts`): without the
 * margins uSong.x read 0.81 through their first minutes where they stood at
 * 0.41, and followed whole songs at a correlation of 0.51; with them, 0.58
 * and 0.70. Margin above alone did better still at a song's start and read a
 * chorus resumed after a pause - which begins the range again
 * (`startSong`) - at 0.28 where it stood at 0.65; the margin below holds
 * that to 0.25 of error, from 0.20.
 *
 * Nothing heard yet is no song at all: its range, every end of it at the
 * silence, read a third of full with the margins alone, and a scene danced
 * a third of the way up before the music had started.
 */
export const intensityOf = (state: ISectionState) => {
  if (!state.started) {
    return 0;
  }
  const fade = Math.exp(-state.heardMs / MARGIN_FADE_MS);
  const ceiling = state.ceiling + UP_MARGIN_DB * fade;
  const lowest = state.floor - DOWN_MARGIN_DB * fade;
  const range = ceiling - lowest;
  const floor =
    range >= MIN_RANGE_DB ? lowest : (lowest + ceiling) / 2 - MIN_RANGE_DB / 2;
  return clamp01((state.mid - floor) / Math.max(MIN_RANGE_DB, range));
};
