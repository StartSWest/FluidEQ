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
const FALL_PER_SECOND = 0.55;

/** How long a thrown or expanding mark lives, in seconds. */
const MOTE_LIFE = 0.9;

/** How far a ripple has grown by the time it dies, in mark widths. */
const RIPPLE_REACH = 5;

/** How many motes one peak may have in flight before it stops making more. */
const MAX_MOTES = 90;

/** How quickly the ghost's envelope forgets, in milliseconds to halve. */
const GHOST_RELEASE_MS = 900;

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
  /** The figure's own recent maximum, per column, for the ghost. */
  envelope: number[];
  motes: IMote[];
}

export const createAccentState = (): IAccentState => ({
  held: [],
  envelope: [],
  motes: [],
});

/** The ten, by what they do rather than by what they look like. */
export type AccentBehaviour =
  | 'bead'
  | 'fall'
  | 'ghost'
  | 'ripple'
  | 'sparks'
  | 'beam'
  | 'ceiling'
  | 'comet'
  | 'drip';

interface IPaintAccentArgs {
  context: CanvasRenderingContext2D;
  behaviour: AccentBehaviour;
  peaks: readonly IGraphPeak[];
  /** Every column's height as a plot fraction, for the marks that use them all. */
  heights: readonly number[];
  /** Every column's x, matching `heights`. */
  positions: readonly number[];
  baseline: number;
  left: number;
  right: number;
  state: IAccentState;
  deltaMs: number;
  /** How heavy the mark is drawn, as a multiple of its own default. */
  weight: number;
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
const advance = (args: IPaintAccentArgs) => {
  const { heights, state, deltaMs } = args;
  fit(state.held, heights.length);
  fit(state.envelope, heights.length);
  const fall = (FALL_PER_SECOND * deltaMs) / 1000;
  const forget = getEaseFactor(deltaMs, GHOST_RELEASE_MS);
  for (let index = 0; index < heights.length; index += 1) {
    // Snap up to a new high, sink at a fixed rate — which is a peak hold, and
    // the fixed rate is what makes it readable: an eased fall is fastest when
    // it matters most and crawls once nobody is looking.
    state.held[index] = Math.max(heights[index], state.held[index] - fall);
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
    mote.y += mote.vy * seconds;
    mote.life -= seconds / MOTE_LIFE;
    if (mote.life <= 0) {
      // Swapped with the last rather than spliced: the order of a cloud of
      // motes means nothing, and splicing shifts the tail on every death.
      state.motes[index] = state.motes[state.motes.length - 1];
      state.motes.pop();
    }
  }
};

/** A circle as a subpath, in the same `d` syntax everything else here uses. */
const circle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) => {
  context.beginPath();
  context.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
};

/**
 * Draw the chosen mark, and move whatever it remembers.
 *
 * Returns whether anything is still moving, so the frame loop can keep
 * running while a spark is in the air after the music has stopped.
 */
export const paintGraphAccent = (args: IPaintAccentArgs): boolean => {
  const {
    context,
    behaviour,
    peaks,
    heights,
    positions,
    baseline,
    left,
    right,
    state,
    weight,
    paint,
  } = args;
  advance(args);
  const depth = Math.max(1, baseline);
  const rowOf = (fraction: number) => baseline - fraction * depth;

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.fillStyle = paint;
  context.strokeStyle = paint;

  switch (behaviour) {
    case 'bead': {
      // The plain one, kept because a drawing that says only "this one" is
      // sometimes exactly what is wanted.
      peaks.forEach((peak) => {
        const size = peak.size * weight;
        context.fillRect(peak.x - size / 2, peak.y - size / 2, size, size);
      });
      break;
    }

    case 'fall': {
      /**
       * The classic peak hold: a rule that catches the highest each column
       * has been and sinks from there.
       *
       * Every column rather than only the marked peaks, because what this
       * shows is the SHAPE of what has just happened — a row of hanging
       * rules is a picture of the last second, and a handful of them is a
       * picture of nothing.
       */
      const step = positions.length > 1 ? (right - left) / positions.length : 0;
      const bar = Math.max(1, step * 0.7);
      for (let index = 0; index < positions.length; index += 1) {
        const row = rowOf(state.held[index]);
        // Only where it is standing clear of the figure. A held peak drawn
        // on top of the bar it came from is invisible and costs a fill.
        if (state.held[index] - heights[index] > 0.004) {
          context.fillRect(
            positions[index] - bar / 2,
            row - 1.5 * weight,
            bar,
            3 * weight,
          );
        }
      }
      break;
    }

    case 'ghost': {
      /**
       * The figure's own recent maximum, behind it.
       *
       * Not a mark on a peak at all — it is the whole envelope of the last
       * second or so, which is the one treatment here that shows what the
       * music WAS rather than pointing at what it is.
       */
      context.globalAlpha *= 0.32;
      context.beginPath();
      context.moveTo(left, baseline);
      for (let index = 0; index < positions.length; index += 1) {
        context.lineTo(positions[index], rowOf(state.envelope[index]));
      }
      context.lineTo(right, baseline);
      context.closePath();
      context.fill();
      break;
    }

    case 'ripple': {
      // A ring leaving each peak and fading as it goes.
      peaks.forEach((peak) => {
        if (state.motes.length < MAX_MOTES) {
          state.motes.push({
            x: peak.x,
            y: peak.y,
            vx: 0,
            vy: 0,
            size: peak.size,
            life: 1,
          });
        }
      });
      context.lineWidth = 1.4 * weight;
      state.motes.forEach((mote) => {
        context.globalAlpha = mote.life * 0.7;
        circle(
          context,
          mote.x,
          mote.y,
          mote.size * (1 + (1 - mote.life) * RIPPLE_REACH),
        );
        context.stroke();
      });
      break;
    }

    case 'sparks': {
      // Thrown upward and outward, and gone in under a second.
      peaks.forEach((peak) => {
        if (state.motes.length >= MAX_MOTES) {
          return;
        }
        // Seeded from the peak's own position rather than from a random
        // number, so a peak that holds still throws the same spray instead
        // of boiling — the rule the starfield learned the hard way.
        const seed = ((peak.x * 7919) % 97) / 97;
        state.motes.push({
          x: peak.x,
          y: peak.y,
          vx: (seed - 0.5) * 60,
          vy: -40 - seed * 70,
          size: peak.size * 0.4,
          life: 1,
        });
      });
      state.motes.forEach((mote) => {
        context.globalAlpha = mote.life;
        circle(context, mote.x, mote.y, mote.size * mote.life * weight);
        context.fill();
      });
      break;
    }

    case 'beam': {
      // A shaft from the peak to the ceiling, brightest at its foot.
      peaks.forEach((peak) => {
        const shaft = context.createLinearGradient(0, peak.y, 0, 0);
        shaft.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        shaft.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = shaft;
        const wide = peak.size * 0.5 * weight;
        context.fillRect(peak.x - wide / 2, 0, wide, peak.y);
      });
      break;
    }

    case 'ceiling': {
      /**
       * One rule for the whole frame, at the loudest band there is.
       *
       * The only mark here that is not per peak. What it answers is "how
       * loud is the loudest thing right now", which every other mark says
       * several times over and none of them says as a number you can read
       * against the axis.
       */
      let highest = 0;
      for (let index = 0; index < heights.length; index += 1) {
        if (heights[index] > highest) {
          highest = heights[index];
        }
      }
      if (highest > 0.01) {
        context.globalAlpha *= 0.85;
        context.fillRect(
          left,
          rowOf(highest) - 1 * weight,
          right - left,
          2 * weight,
        );
      }
      break;
    }

    case 'comet': {
      // A streak trailing back from the peak, the way something moving fast
      // is drawn as where it has been.
      peaks.forEach((peak) => {
        const tail = peak.size * 6;
        const streak = context.createLinearGradient(
          peak.x,
          0,
          peak.x - tail,
          0,
        );
        streak.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        streak.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = streak;
        const thick = peak.size * 0.55 * weight;
        context.fillRect(peak.x - tail, peak.y - thick / 2, tail, thick);
      });
      break;
    }

    case 'drip': {
      // The peak lets go and falls away, which is the opposite of holding it.
      peaks.forEach((peak) => {
        if (state.motes.length < MAX_MOTES) {
          state.motes.push({
            x: peak.x,
            y: peak.y,
            vx: 0,
            vy: 55,
            size: peak.size * 0.5,
            life: 1,
          });
        }
      });
      state.motes.forEach((mote) => {
        context.globalAlpha = mote.life * 0.9;
        circle(context, mote.x, mote.y, mote.size * weight);
        context.fill();
      });
      break;
    }

    default:
      break;
  }

  context.restore();
  // A mote still in the air is motion the loop has to keep drawing, and so is
  // a held peak that has not finished sinking.
  return state.motes.length > 0;
};
