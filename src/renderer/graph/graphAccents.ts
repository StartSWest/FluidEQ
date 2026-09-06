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
 * What a lit peak DOES, which is the part a path cannot say.
 *
 * The first attempt at offering a choice here was ten silhouettes — a box, a
 * ring, a chevron — and that is one mark with ten icons rather than ten
 * marks. What separates the wave from the rest is not its outline: it is not
 * a mark at all, it is a curve laid over the whole figure. So these are ten
 * BEHAVIOURS, and six of them cannot be a path at all, because they hang,
 * sink, expand, fly or trail — none of which exists inside one frame.
 *
 * That is why this is a painter with state rather than more geometry in
 * `graphShapes`. The shape module is pure and describes a frame; a peak that
 * falls has to remember where it was.
 *
 * The state is per graph, not per look. Switching mark mid-song should not
 * throw away the peaks already held — it should change what is drawn ON them,
 * which is what makes the choice feel like a setting rather than a restart.
 */

import { IGraphPeak } from 'common/graphShapes';
import { getEaseFactor } from 'common/smoothing';

/**
 * How fast a held peak sinks, in plot-fractions a second.
 *
 * Slow enough to read — the whole point of a held peak is that the eye gets
 * to see a transient the figure has already forgotten — and fast enough that
 * a quiet passage is not haunted by the last loud one.
 */
const FALL_PER_SECOND = 0.32;
const PEAK_HOLD_MS = 180;

/** How long a thrown or expanding mark lives, in seconds. */
const MOTE_LIFE = 1.1;

/** How many motes one peak may have in flight before it stops making more. */
const MAX_MOTES = 90;

/** How quickly the ghost's envelope forgets, in milliseconds to halve. */
const GHOST_RELEASE_MS = 520;

/**
 * A mark in flight: a spark thrown off a peak, or a ripple leaving one.
 *
 * One list for both, because they differ only in how they are drawn — and
 * two lists would be two places to forget to expire something.
 */
interface IMote {
  x: number;
  y: number;
  /** Pixels a second. Zero for a ripple, which grows rather than travels. */
  vx: number;
  vy: number;
  gravity: number;
  /** The mark's own width when it was born. */
  size: number;
  /** 1 at birth, 0 at death. */
  life: number;
}

export interface IAccentState {
  /**
   * The highest each column has been, as a plot fraction, and sinking.
   *
   * Indexed by column rather than by frequency: the count can change under it
   * when Pieces moves, and a held peak that survived a change of density would
   * be reporting a band it no longer stands over.
   */
  held: number[];
  holdRemaining: number[];
  /** The figure's own recent maximum, per column, for the ghost. */
  envelope: number[];
  motes: IMote[];
  emissionLevels: Map<number, { energy: number; armed: boolean }>;
  behaviour?: AccentBehaviour;
}

export const createAccentState = (): IAccentState => ({
  held: [],
  holdRemaining: [],
  envelope: [],
  motes: [],
  emissionLevels: new Map(),
});

/** The ten, by what they do rather than by what they look like. */
export type AccentBehaviour =
  | 'live'
  | 'bead'
  | 'fall'
  | 'ghost'
  | 'ripple'
  | 'sparks'
  | 'beam'
  | 'ceiling'
  | 'comet'
  | 'drip';

export interface IPaintAccentArgs {
  context: CanvasRenderingContext2D;
  behaviour: AccentBehaviour;
  peaks: readonly IGraphPeak[];
  /** Every column's height as a plot fraction, for the marks that use them all. */
  heights: readonly number[];
  /** Every column's x, matching `heights`. */
  positions: readonly number[];
  baseline: number;
  top?: number;
  left: number;
  right: number;
  state: IAccentState;
  /** How heavy the mark is drawn, as a multiple of its own default. */
  weight: number;
  filled?: boolean;
  paint: string | CanvasGradient;
}

/** Keeps a buffer the length of the frame without reallocating it. */
const fit = (buffer: number[], length: number) => {
  if (buffer.length !== length) {
    buffer.length = length;
    buffer.fill(0);
  }
};

/**
 * Advance whatever the chosen mark remembers.
 *
 * Run every frame regardless of which mark is on, so switching between them
 * does not arrive at a cold buffer — a held peak that had to be re-learned
 * every time the setting moved would flash empty on every change.
 */
export const advanceGraphAccent = (
  args: Pick<IPaintAccentArgs, 'heights' | 'state' | 'peaks' | 'behaviour'> & {
    deltaMs: number;
  },
): boolean => {
  const { heights, state, deltaMs, peaks, behaviour } = args;
  if (state.behaviour !== behaviour) {
    state.motes = [];
    state.emissionLevels.clear();
    state.behaviour = behaviour;
  }
  fit(state.held, heights.length);
  fit(state.holdRemaining, heights.length);
  fit(state.envelope, heights.length);
  const forget = getEaseFactor(deltaMs, GHOST_RELEASE_MS);
  for (let index = 0; index < heights.length; index += 1) {
    // Snap up to a new high, sink at a fixed rate — which is a peak hold, and
    // the fixed rate is what makes it readable: an eased fall is fastest when
    // it matters most and crawls once nobody is looking.
    if (heights[index] >= state.held[index]) {
      state.held[index] = heights[index];
      state.holdRemaining[index] = PEAK_HOLD_MS;
    } else {
      const fallingMs = Math.max(0, deltaMs - state.holdRemaining[index]);
      state.holdRemaining[index] = Math.max(
        0,
        state.holdRemaining[index] - deltaMs,
      );
      state.held[index] = Math.max(
        heights[index],
        state.held[index] - (FALL_PER_SECOND * fallingMs) / 1000,
      );
    }
    // The envelope forgets on a half-life instead, because it is a shape
    // rather than a reading and a shape that drops linearly looks cut.
    state.envelope[index] = Math.max(
      heights[index],
      state.envelope[index] - state.envelope[index] * forget,
    );
  }

  const seconds = deltaMs / 1000;
  for (let index = state.motes.length - 1; index >= 0; index -= 1) {
    const mote = state.motes[index];
    mote.x += mote.vx * seconds;
    // Analytic integration gives the same arc at 30, 60 and 144 Hz.
    mote.y += mote.vy * seconds + 0.5 * mote.gravity * seconds * seconds;
    mote.vy += mote.gravity * seconds;
    mote.life -= seconds / MOTE_LIFE;
    if (mote.life <= 0) {
      // Swapped with the last rather than spliced: the order of a cloud of
      // motes means nothing, and splicing shifts the tail on every death.
      state.motes[index] = state.motes[state.motes.length - 1];
      state.motes.pop();
    }
  }
  if (
    behaviour === 'ripple' ||
    behaviour === 'sparks' ||
    behaviour === 'drip'
  ) {
    // Emit on an audible rise, never on a paint. A steady peak previously
    // spawned at monitor refresh rate, twice again when the view was mirrored.
    const present = new Set(peaks.map((peak) => peak.x));
    state.emissionLevels.forEach((_energy, x) => {
      if (!present.has(x)) {
        state.emissionLevels.delete(x);
      }
    });
    peaks.forEach((peak) => {
      const previous = state.emissionLevels.get(peak.x) ?? {
        energy: 0,
        armed: true,
      };
      const rising = previous.armed && peak.energy - previous.energy >= 0.08;
      if (rising) {
        state.emissionLevels.set(peak.x, { energy: peak.energy, armed: false });
      } else if (!previous.armed && previous.energy - peak.energy >= 0.08) {
        state.emissionLevels.set(peak.x, { energy: peak.energy, armed: true });
      } else {
        previous.energy = previous.armed
          ? Math.min(previous.energy, peak.energy)
          : Math.max(previous.energy, peak.energy);
        state.emissionLevels.set(peak.x, previous);
      }
      if (!rising || state.motes.length >= MAX_MOTES) {
        return;
      }
      const seed = ((peak.x * 7919) % 97) / 97;
      state.motes.push({
        x: peak.x,
        y: peak.y,
        vx: behaviour === 'sparks' ? (seed - 0.5) * 60 : 0,
        vy: { sparks: -65 - seed * 90, drip: 28, ripple: 0 }[behaviour],
        gravity: { sparks: 110, drip: 180, ripple: 0 }[behaviour],
        size: peak.size * (behaviour === 'ripple' ? 1 : 0.5),
        life: 1,
      });
    });
  }
  // Holds and ghosts need their final decay drawn even after the FFT settles.
  return (
    state.motes.length > 0 ||
    heights.some(
      (height, index) =>
        ((behaviour === 'fall' || behaviour === 'live') &&
          state.held[index] - height > 0.004) ||
        (behaviour === 'ghost' && state.envelope[index] - height > 0.002),
    )
  );
};

export { default as paintGraphAccent } from './graphAccentPaint';
