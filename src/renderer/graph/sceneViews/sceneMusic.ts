/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { easeToward, type ISceneMusic } from './sceneFrame';

/**
 * The music as a scene hears it: bass, middle and treble read separately,
 * and the beat found where it lives, in the bass.
 *
 * Read from the reading AS IT ARRIVED, not the eased one the figure is drawn
 * from: a look's release is a matter of taste, and a beat read through a slow
 * one arrives a quarter of a second late and twice as soft.
 *
 * The beat is a rise in the bass over its own recent average — the same test
 * a light desk makes — so it follows a quiet ballad and a loud club track
 * alike instead of firing only above a fixed loudness. After one lands the
 * next is not believed for a fifth of a second, the length of a sixteenth at
 * 75 BPM, which is as dense as anybody's kick drum gets.
 */

/** The three regions, in hertz. */
const BASS: readonly [number, number] = [30, 150];
const MID: readonly [number, number] = [300, 2500];
const TREBLE: readonly [number, number] = [4000, 14000];

/** Quick to rise and slower to fall, like a meter needle: in milliseconds. */
const RISE_MS = 18;
const FALL_MS = 160;
/** The bass's recent average a beat has to clear. */
const AVERAGE_MS = 900;
/** How far over that average a beat has to reach, as a share of the plot. */
const BEAT_MARGIN = 0.035;
/** How much the bass has to have jumped since the last frame. */
const BEAT_JUMP = 0.012;
/** No second beat inside this. */
const BEAT_REST_MS = 200;
/** The flash after a beat halves every this many milliseconds. */
const PULSE_HALF_LIFE_MS = 120;
/** Below this the pulse is over, so the scene may stop drawing. */
const PULSE_GONE = 0.004;

export interface ISceneMusicState extends ISceneMusic {
  /** The bass as it arrived last frame, for the jump. */
  lastBass: number;
  /** The bass's slow average. */
  bassAverage: number;
  /** Milliseconds since the last beat. */
  sinceBeatMs: number;
}

export const createSceneMusic = (): ISceneMusicState => ({
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
  pulse: 0,
  onBeat: false,
  clock: 0,
  step: 0,
  lastBass: 0,
  bassAverage: 0,
  sinceBeatMs: BEAT_REST_MS,
});

const meanBetween = (
  live: Float64Array,
  axis: Float64Array,
  [low, high]: readonly [number, number],
): number => {
  let total = 0;
  let count = 0;
  for (let index = 0; index < axis.length; index += 1) {
    const hertz = axis[index];
    if (hertz >= low && hertz <= high) {
      total += live[index];
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
};

const follow = (current: number, target: number, deltaMs: number) =>
  current +
  (target - current) *
    easeToward(deltaMs, target > current ? RISE_MS : FALL_MS);

/**
 * One frame of listening. Returns whether anything is still moving, so a
 * scene in silence lets the graph's loop go to sleep.
 */
export const hearMusic = (
  state: ISceneMusicState,
  live: Float64Array,
  axis: Float64Array,
  deltaMs: number,
  playing: boolean,
): boolean => {
  const bassNow = playing ? meanBetween(live, axis, BASS) : 0;
  const midNow = playing ? meanBetween(live, axis, MID) : 0;
  const trebleNow = playing ? meanBetween(live, axis, TREBLE) : 0;
  let total = 0;
  for (let index = 0; index < live.length; index += 1) {
    total += live[index];
  }
  const energyNow = playing && live.length > 0 ? total / live.length : 0;

  state.bass = follow(state.bass, bassNow, deltaMs);
  state.mid = follow(state.mid, midNow, deltaMs);
  state.treble = follow(state.treble, trebleNow, deltaMs);
  state.energy = follow(state.energy, energyNow, deltaMs);

  state.sinceBeatMs += deltaMs;
  const jump = bassNow - state.lastBass;
  state.onBeat =
    playing &&
    state.sinceBeatMs >= BEAT_REST_MS &&
    jump > BEAT_JUMP &&
    bassNow > state.bassAverage + BEAT_MARGIN;
  if (state.onBeat) {
    state.sinceBeatMs = 0;
    state.pulse = 1;
  } else {
    state.pulse *= 1 - easeToward(deltaMs, PULSE_HALF_LIFE_MS);
    if (state.pulse < PULSE_GONE) {
      state.pulse = 0;
    }
  }
  state.bassAverage +=
    (bassNow - state.bassAverage) * easeToward(deltaMs, AVERAGE_MS);
  state.lastBass = bassNow;

  // Music time: still in silence, and from a steady walk at a whisper to
  // twice that at full level.
  state.step = playing ? (deltaMs / 1000) * (0.35 + state.energy * 1.3) : 0;
  state.clock += state.step;

  return (
    state.pulse > 0 ||
    state.step > 0 ||
    state.bass > PULSE_GONE ||
    state.treble > PULSE_GONE
  );
};
