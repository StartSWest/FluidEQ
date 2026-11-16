/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the meter's styles remember from one frame to the next, beyond the
 * bands themselves: each band's held peak, the last moments of the spectrum,
 * and the two channels' levels with their held peaks.
 *
 * Kept as one object the frame loop advances by the time that passed, so a
 * style that draws the past (Echo, Waterfall) or a held mark (Peaks, Level)
 * moves at the same speed at 30 frames a second as at 144.
 */

/** How many past frames are kept, newest first. */
export const FLAT_HISTORY_LENGTH = 10;
/** How often a past frame is taken: ten of them cover 0.7 s of music. */
const HISTORY_STEP_MS = 70;
/** A held peak falls this share of the pane per second once let go. */
const PEAK_FALL_PER_SECOND = 0.55;
/** A channel's held peak falls slower: it is read as a number. */
const LEVEL_PEAK_FALL_PER_SECOND = 0.3;
/** The channel bars' own ballistics, a level meter's rather than a bar's. */
const LEVEL_ATTACK_MS = 12;
const LEVEL_RELEASE_MS = 300;
/** The scale the Level style is drawn on, in dB below full scale. */
export const LEVEL_FLOOR_DB = -48;

export interface IFlatMeterState {
  /** Each band's held peak, 0..1. */
  peaks: number[];
  /** Past frames of the bands, newest first. */
  history: number[][];
  /** Left and right on the Level scale, 0..1. */
  levels: [number, number];
  levelPeaks: [number, number];
}

export const createFlatMeterState = (): IFlatMeterState => ({
  peaks: [],
  history: [],
  levels: [0, 0],
  levelPeaks: [0, 0],
});

/** A linear sample amplitude on the Level scale. */
export const levelOf = (amplitude: number): number => {
  if (!(amplitude > 0)) {
    return 0;
  }
  const db = 20 * Math.log10(amplitude);
  return Math.max(0, Math.min(1, 1 - db / LEVEL_FLOOR_DB));
};

const ease = (deltaMs: number, halfLifeMs: number) =>
  1 - 0.5 ** (deltaMs / Math.max(1, halfLifeMs));

/**
 * One frame on: peaks follow the bands up at once and fall slowly, a past
 * frame is taken every `HISTORY_STEP_MS`, the channels ease toward `channel`
 * (each channel's loudest sample, linear). Answers whether anything here is
 * still moving, so the loop keeps drawing until the held marks and the past
 * frames have caught up with a still spectrum.
 */
export const advanceFlatMeter = (
  state: IFlatMeterState,
  bands: readonly number[],
  channels: readonly [number, number],
  deltaMs: number,
  sinceHistoryMs: { value: number },
): boolean => {
  let moving = false;
  const { peaks } = state;
  if (peaks.length !== bands.length) {
    peaks.length = bands.length;
    peaks.fill(0);
  }
  const fall = (PEAK_FALL_PER_SECOND * deltaMs) / 1000;
  for (let index = 0; index < bands.length; index += 1) {
    const next = Math.max(bands[index], peaks[index] - fall);
    if (next > bands[index] + 0.002) {
      moving = true;
    }
    peaks[index] = next;
  }

  sinceHistoryMs.value += deltaMs;
  if (sinceHistoryMs.value >= HISTORY_STEP_MS || state.history.length === 0) {
    sinceHistoryMs.value = 0;
    state.history.unshift(Array.from(bands));
    if (state.history.length > FLAT_HISTORY_LENGTH) {
      state.history.length = FLAT_HISTORY_LENGTH;
    }
  }
  // The past is still catching up while any kept frame differs from now.
  const newest = state.history[0];
  moving =
    moving ||
    state.history.some((frame) =>
      frame.some((value, index) => Math.abs(value - newest[index]) > 0.002),
    );

  const levelFall = (LEVEL_PEAK_FALL_PER_SECOND * deltaMs) / 1000;
  for (let side = 0; side < 2; side += 1) {
    const target = levelOf(channels[side]);
    const current = state.levels[side];
    const rate = ease(
      deltaMs,
      target > current ? LEVEL_ATTACK_MS : LEVEL_RELEASE_MS,
    );
    const next =
      Math.abs(target - current) < 0.002
        ? target
        : current + (target - current) * rate;
    state.levels[side] = next;
    state.levelPeaks[side] = Math.max(next, state.levelPeaks[side] - levelFall);
    if (next !== target || state.levelPeaks[side] > next + 0.002) {
      moving = true;
    }
  }
  return moving;
};
