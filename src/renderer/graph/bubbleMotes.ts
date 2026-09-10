import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import type { ISkyFrame } from './terraceValley';

/**
 * The specks the Bubbles form rises through.
 *
 * The bubbles are one to a band and they live wherever the height slider
 * puts them, which left most of the window empty. These fill it: small
 * dots drifting up over the whole screen, faster when the music is loud,
 * a few of them catching the light on the treble.
 *
 * Nothing is painted behind them. There was a surface, shafts of light
 * and weed along the floor here — a whole underwater scene — and all of
 * it was thrown out: the form has lightning between its bubbles, and
 * water with a storm in it reads as two pictures at once.
 *
 * The dots cover the window rather than the plot, because they are
 * scenery; only the bubbles answer the height slider.
 */

interface IMote {
  /** Across the window, 0 to 1. */
  x: number;
  /** Up the window, 0 at the floor and 1 at the top. */
  phase: number;
  seed: number;
}

export interface BubbleMotes {
  motes: IMote[];
  bass: number;
  treble: number;
  clock: number;
}

const MOTES = 150;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createBubbleMotes = (): BubbleMotes => ({
  motes: [],
  bass: 0,
  treble: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceBubbleMotes = (
  state: BubbleMotes,
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  if (!playing) {
    return;
  }
  state.clock = seconds;
  if (state.motes.length === 0) {
    for (let i = 0; i < MOTES; i += 1) {
      state.motes.push({
        x: noise(i * 3 + 1),
        phase: noise(i * 3 + 2),
        seed: i,
      });
    }
  }
  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const trebleFrom = Math.floor(levels.length * 0.6);
  const treble =
    levels.slice(trebleFrom).reduce((s, v) => s + v, 0) /
    Math.max(1, levels.length - trebleFrom);
  state.treble += (treble - state.treble) * getEaseFactor(elapsedMs, 40);
  // They rise, faster when the music is loud, and wrap at the top.
  const rise = dt * (0.02 + state.bass * 0.06);
  state.motes.forEach((mote) => {
    mote.phase = (mote.phase + rise) % 1;
  });
};

export interface IMoteBand {
  path: Path2D;
  alpha: number;
}

export const createBubbleMotePaths = (
  state: BubbleMotes,
  seconds: number,
  sizeHeight: number,
  frame: ISkyFrame,
) => {
  const { left } = frame;
  const width = Math.max(1, frame.right - frame.left);
  const deep = Math.max(1, frame.bottom - frame.top);
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));

  // Two bands: a few bright ones that answer the treble, and the rest
  // holding the screen. One fill each, whatever the count.
  const bands: IMoteBand[] = [
    { path: new Path2D(), alpha: 0.45 + state.treble * 0.45 },
    { path: new Path2D(), alpha: 0.16 },
  ];
  state.motes.forEach((mote) => {
    const x =
      left +
      mote.x * width +
      Math.sin(seconds * 0.5 + mote.seed) * width * 0.014;
    const y = frame.bottom - mote.phase * deep;
    const bright = noise(mote.seed * 11) > 0.74;
    const r = size * (bright ? 1 : 0.6);
    bands[bright ? 0 : 1].path.rect(x - r, y - r, r * 2, r * 2);
  });

  return { bands, bass: state.bass };
};

export type BubbleMotePaths = ReturnType<typeof createBubbleMotePaths>;
