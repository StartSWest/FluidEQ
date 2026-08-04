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
 * How hard the trace is allowed to be driven by its own noise floor.
 *
 * Without this, a running maximum decaying toward zero in a quiet room ends up
 * normalising room tone to full scale, and the player is handed a frantic trace
 * of nothing at all.
 */
const SILENCE_FLOOR = 1e-4;

/** How fast the reference level forgets a loud passage. */
const PEAK_DECAY = 0.995;

export interface IPercussionState {
  /** Bins from the previous frame, for the next difference. */
  previous: readonly number[];
  /** Running reference the raw flux is scaled against. */
  reference: number;
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
  reference: 0,
  level: 0,
  history: [],
  lastPeakMs: -Infinity,
});

/**
 * A hit has to clear this share of the running reference to count.
 *
 * Set high on purpose. A low threshold finds every hi-hat, every string
 * squeak and every consonant, and a trace with nine spikes a second is not
 * something anyone can play — it is noise with a score attached. What is wanted
 * is the pulse you would tap your foot to, so only the loud transients qualify.
 */
const PEAK_THRESHOLD = 0.55;

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

  // Instant attack, slow release. The reference has to jump to a new loud
  // passage immediately or the first few hits of a chorus all clip to 1, and it
  // has to come down slowly or a single crash swallows the next ten seconds.
  const reference = Math.max(flux, state.reference * PEAK_DECAY);
  const raw = reference > SILENCE_FLOOR ? Math.min(1, flux / reference) : 0;

  // Smoothed for the eye, raw for the decision. Peak picking has to run on the
  // unsmoothed value or the envelope's own tail re-triggers as the next hit,
  // and every beat would arrive as a pair.
  const level =
    raw > state.level
      ? state.level + (raw - state.level) * ENVELOPE_ATTACK
      : state.level + (raw - state.level) * ENVELOPE_RELEASE;

  const sincePeak = timeMs - state.lastPeakMs;
  const isPeak = raw >= PEAK_THRESHOLD && sincePeak >= REFRACTORY_MS;

  const history = [...state.history, { timeMs, level, isPeak }].filter(
    (sample) => timeMs - sample.timeMs <= options.windowMs,
  );

  return {
    previous: bins,
    reference,
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
