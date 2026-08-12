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

/**
 * Pulling the hits out of whatever is playing.
 *
 * The game's trace is the real signal, not a drawn heartbeat — but the whole
 * signal is no use to jump, because a sustained chord is as loud as a snare and
 * would draw as a plateau. What is wanted is the percussion: the moments the
 * sound CHANGES, not the moments it is loud.
 */

/**
 * Spectral flux — the sum of how much each frequency bin ROSE since the last
 * frame.
 *
 * Only the rises are counted, and that is the entire trick. A held note barely
 * moves between frames and contributes nothing; a drum hit lights up many bins
 * at once and produces a spike. Summing absolute differences instead would make
 * every note ENDING look exactly like a hit, and the trace would spike twice per
 * note in a way no one could play against.
 */
export const getSpectralFlux = (
  current: readonly number[],
  previous: readonly number[],
) => {
  const length = Math.min(current.length, previous.length);
  let flux = 0;
  for (let index = 0; index < length; index += 1) {
    const rise = current[index] - previous[index];
    if (rise > 0) {
      flux += rise;
    }
  }
  return flux;
};

/**
 * Below this there is nothing playing worth measuring, and dividing by it would
 * turn room tone into a full-scale trace.
 */
const SILENCE_FLOOR = 0.5;

/**
 * How many recent frames the running average covers.
 *
 * Roughly a second and a half at this frame rate. Long enough to average over a
 * bar or so, short enough to follow a track getting louder.
 */
const MEAN_WINDOW = 32;

export interface IPercussionState {
  /** Bins from the previous frame, for the next difference. */
  previous: readonly number[];
  /**
   * Recent raw flux values, for the running average.
   *
   * The average is the whole basis of the detector. Music changes constantly,
   * so flux is never near zero even between hits — normalising against a
   * running maximum, which is what this did first, cannot tell a hit from the
   * floor it sits on. A hit is flux standing well ABOVE its own recent
   * average, and that is what gets measured.
   */
  recentFlux: readonly number[];
  /** Smoothed level, which is what gets drawn. */
  level: number;
  /** Newest last. Bounded — this runs for as long as the dialog is open. */
  history: readonly IPercussionSample[];
  /** When the last accepted peak was, so one hit is not counted three times. */
  lastPeakMs: number;
}

export interface IPercussionSample {
  timeMs: number;
  /** 0 to 1, after normalising. */
  level: number;
  isPeak: boolean;
}

export const createPercussionState = (): IPercussionState => ({
  previous: [],
  recentFlux: [],
  level: 0,
  history: [],
  lastPeakMs: -Infinity,
});

/**
 * How far above its own recent average the flux must stand to be a hit.
 *
 * Set high on purpose. Just above average finds every hi-hat, every string
 * squeak and every consonant, and a trace with nine spikes a second is not
 * something anyone can play — it is noise with a score attached. What is wanted
 * is the pulse you would tap your foot to, so only the loud transients qualify.
 */
const PEAK_RATIO = 1.7;

/**
 * How far above average counts as full height on the drawn line.
 *
 * Lower than the peak ratio, so ordinary playing still moves the trace and the
 * player can see the music breathing between the hits they are aiming at. A
 * line that only moves on a scoring hit gives no sense of the song at all.
 */
const DRAW_RATIO = 1.2;

/**
 * The shortest gap between two hits that can both count.
 *
 * 320ms is about 185bpm, which is faster than the root pulse of nearly anything
 * and slower than the subdivisions on top of it. That is the whole point: the
 * kick and the snare get through, the hats between them do not.
 */
const REFRACTORY_MS = 320;

/**
 * Envelope smoothing, so the DRAWN line is a pulse rather than a scribble.
 *
 * Fast attack keeps the leading edge of a hit exactly where it happened —
 * smoothing that would move the thing the player is aiming at. Slow release
 * gives each hit a visible tail instead of a one-frame spike that is gone
 * before the eye finds it.
 */
const ENVELOPE_ATTACK = 0.6;
const ENVELOPE_RELEASE = 0.14;

export interface IPercussionOptions {
  /** How much history to keep, in milliseconds. */
  windowMs: number;
}

/**
 * Fold one frame of spectrum into the state.
 *
 * Pure: the caller owns the state and the clock. That is what makes the
 * behaviour testable, and this is exactly the kind of code that is confidently
 * wrong when it is only ever watched rather than checked.
 */
export const pushPercussionFrame = (
  state: IPercussionState,
  bins: readonly number[],
  timeMs: number,
  options: IPercussionOptions,
): IPercussionState => {
  const flux = state.previous.length
    ? getSpectralFlux(bins, state.previous)
    : 0;

  const recentFlux = [...state.recentFlux, flux].slice(-MEAN_WINDOW);
  const mean =
    recentFlux.reduce((total, value) => total + value, 0) / recentFlux.length;

  // How far this frame stands above the recent average, as a ratio. 1 is
  // ordinary, well over 1 is something happening. The average is what makes
  // this work at any volume: turn the music up and both flux and mean rise
  // together, so the ratio — and every threshold below — is unchanged.
  const ratio = mean > SILENCE_FLOOR ? flux / mean : 0;
  const raw = Math.max(0, Math.min(1, (ratio - 1) / (DRAW_RATIO - 1 + 1e-9)));

  // Smoothed for the eye, unsmoothed for the decision. Peak picking has to run
  // on the raw ratio or the envelope's own tail re-triggers as the next hit,
  // and every beat would arrive as a pair.
  const level =
    raw > state.level
      ? state.level + (raw - state.level) * ENVELOPE_ATTACK
      : state.level + (raw - state.level) * ENVELOPE_RELEASE;

  const sincePeak = timeMs - state.lastPeakMs;
  const isPeak = ratio >= PEAK_RATIO && sincePeak >= REFRACTORY_MS;

  const history = [...state.history, { timeMs, level, isPeak }].filter(
    (sample) => timeMs - sample.timeMs <= options.windowMs,
  );

  return {
    previous: bins,
    recentFlux,
    level,
    history,
    lastPeakMs: isPeak ? timeMs : state.lastPeakMs,
  };
};

/**
 * The peak nearest a given moment, which is what a tap is graded against.
 *
 * Returns undefined when nothing has been detected — tapping into silence must
 * not score, and there is genuinely nothing to have hit.
 */
export const getNearestPeakMs = (
  state: IPercussionState,
  timeMs: number,
): number | undefined => {
  let nearest: number | undefined;
  let best = Infinity;
  state.history.forEach((sample) => {
    if (!sample.isPeak) {
      return;
    }
    const distance = Math.abs(sample.timeMs - timeMs);
    if (distance < best) {
      best = distance;
      nearest = sample.timeMs;
    }
  });
  return nearest;
};
