import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import type { ISkyFrame } from './terraceValley';

/**
 * The field the Slope form lives in.
 *
 * The form is called a slope field and drew one row of arrows across the
 * middle of a black screen, which is a slope LINE. A slope field is a
 * grid: a short stroke at every point of the plane, each angled by the
 * gradient there, and the shape of the thing being plotted appears out of
 * how the strokes line up. That is what this builds.
 *
 * Every tick takes the spectrum's slope at its own column, turned toward
 * the horizontal the further it sits from the curve — so the field is
 * steep along the trace and settles as it goes away, and the curve reads
 * as the thing bending the field rather than as a line drawn on top of
 * one. Ticks near the curve are brighter; the whole field leans harder on
 * the bass.
 *
 * Motes drift along the field, one step per frame, taking their direction
 * from the tick they are standing on and leaving a short trail. They are
 * what makes it read as flow rather than as wallpaper: treble cracks send
 * a burst of them, and a beat throws a band of light outward from the
 * curve.
 *
 * The field covers the window, not the plot — it is scenery, and only the
 * curve answers the height slider.
 */

interface IMote {
  x: number;
  y: number;
  bornAt: number;
  /** Where it was for the last three steps, for the trail. */
  trail: Projected[];
}

export interface SlopeField {
  motes: IMote[];
  mean: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  /** How long ago the last beat was, in seconds of the field's clock. */
  beatAt: number;
  clock: number;
}

/** How long a mote lives, in seconds. */
export const MOTE_LIFE = 2.6;
const MOTE_LIMIT = 90;
/** How wide the beat's band of light is, as a fraction of the plot. */
const PULSE_LIFE = 0.5;
/** The field's grid: this many ticks across the window at the widest. */
const FIELD_COLUMNS = 40;
const FIELD_ROWS = 17;

export const createSlopeField = (): SlopeField => ({
  motes: [],
  mean: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  beatAt: -1,
  clock: 0,
});

/**
 * The columns with their corners taken off.
 *
 * The arrows sit one to a column and the eye joins them up, so raw FFT
 * columns read as a polygon — a chain of straight runs meeting at points,
 * which is what "eggy" means when it is said about this form. Two passes
 * of a 1-2-1 average round the joins while leaving a peak where a peak
 * is; the field's ticks read the same smoothed line, so the arrows and
 * the grid agree about which way the slope goes.
 */
export const smoothSlopeColumns = (
  columns: readonly Projected[],
): Projected[] => {
  if (columns.length < 3) {
    return columns.map(([x, y]): Projected => [x, y]);
  }
  let ys = columns.map(([, y]) => y);
  for (let pass = 0; pass < 2; pass += 1) {
    const next = ys.slice();
    for (let i = 1; i < ys.length - 1; i += 1) {
      next[i] = (ys[i - 1] + ys[i] * 2 + ys[i + 1]) / 4;
    }
    ys = next;
  }
  return columns.map(([x], index): Projected => [x, ys[index]]);
};

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The curve's height and gradient at an x, from the columns.
 *
 * Shared by the advance and the paths so a mote rides exactly the field
 * that is drawn, rather than a second approximation of it.
 */
const sampler = (columns: readonly Projected[]) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const step = (right - left) / Math.max(1, columns.length - 1);
  const at = (x: number) => {
    const raw = (x - left) / Math.max(1, step);
    const index = Math.max(0, Math.min(columns.length - 1, Math.round(raw)));
    return index;
  };
  return {
    left,
    right,
    step,
    heightAt: (x: number) => columns[at(x)]?.[1] ?? 0,
    /** Rise over run between the two columns either side. */
    slopeAt: (x: number) => {
      const index = at(x);
      const before = columns[Math.max(0, index - 1)];
      const after = columns[Math.min(columns.length - 1, index + 1)];
      if (!before || !after || after[0] === before[0]) {
        return 0;
      }
      return (after[1] - before[1]) / (after[0] - before[0]);
    },
  };
};

export const advanceSlopeField = (
  state: SlopeField,
  columns: readonly Projected[],
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
  frame: ISkyFrame,
) => {
  if (columns.length < 2) {
    return;
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  if (!playing) {
    return;
  }
  state.clock = seconds;
  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const mean =
    levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length);
  const crack = mean - state.mean;
  state.mean = mean;
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const trebleFrom = Math.floor(levels.length * 0.6);
  const treble =
    levels.slice(trebleFrom).reduce((s, v) => s + v, 0) /
    Math.max(1, levels.length - trebleFrom);
  if (crack >= 0.05 && mean >= 0.15) {
    state.thump = 1;
    state.beatAt = seconds;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 160);
  }

  const { left, right, heightAt, slopeAt } = sampler(columns);
  const width = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);

  // A treble crack seeds a handful of motes at the left edge and along
  // the curve, so a bright passage fills the field with traffic.
  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  if (trebleCrack >= 0.02 && relative >= 0.35) {
    const burst = Math.min(8, MOTE_LIMIT - state.motes.length);
    for (let i = 0; i < burst; i += 1) {
      const seed = Math.floor(seconds * 23) * 11 + i;
      const x = left + noise(seed) * width;
      const spread = (noise(seed * 3 + 1) - 0.5) * depth * 0.55;
      const y = heightAt(x) + spread;
      state.motes.push({ x, y, bornAt: seconds, trail: [[x, y]] });
    }
  }

  // Every mote takes a step along the field it is standing in: to the
  // right at a steady pace, up or down by the slope under it, eased
  // toward flat the further it is from the curve.
  const speed = width * 0.11 * (0.7 + state.bass * 0.9);
  state.motes = state.motes.filter((mote) => {
    const away = Math.min(
      1,
      Math.abs(mote.y - heightAt(mote.x)) / (depth * 0.5),
    );
    const lean = slopeAt(mote.x) * (1 - away * 0.75);
    mote.x += speed * dt;
    mote.y += speed * dt * lean;
    mote.trail.push([mote.x, mote.y]);
    if (mote.trail.length > 4) {
      mote.trail.shift();
    }
    return (
      seconds - mote.bornAt < MOTE_LIFE &&
      mote.x < frame.right + width * 0.1 &&
      mote.y > frame.top - depth &&
      mote.y < frame.bottom + depth
    );
  });
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
};

/** One stroke of the field: the ticks that share a brightness. */
export interface IFieldBand {
  path: Path2D;
  alpha: number;
  width: number;
}

export const createSlopeFieldPaths = (
  state: SlopeField,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
  frame: ISkyFrame,
) => {
  const { heightAt, slopeAt } = sampler(columns);
  const depth = Math.max(1, bottom - top);
  const frameWidth = Math.max(1, frame.right - frame.left);
  const frameDepth = Math.max(1, frame.bottom - frame.top);
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));
  const columnStep = frameWidth / FIELD_COLUMNS;
  const rowStep = frameDepth / FIELD_ROWS;
  // A tick is a little under half its cell, so the field reads as marks
  // with air between them rather than as a mesh.
  const tick = Math.min(columnStep, rowStep) * 0.42;

  /**
   * Three brightnesses: on the curve, near it, and away in the field.
   * One stroke each, so the whole grid is three calls.
   */
  /**
   * The trace carries the drawing; the field behind it is texture and
   * stays quiet.
   *
   * Half strength on the middle band read as a second grid competing with
   * the trace — a page of marks with a line somewhere in it. These sit
   * behind it and no further back than that: at a twentieth the screen
   * goes empty again, which is what this form was reported for to begin
   * with.
   */
  const bands: IFieldBand[] = [
    { path: new Path2D(), alpha: 0.4, width: Math.max(1, size * 0.9) },
    { path: new Path2D(), alpha: 0.17, width: Math.max(0.9, size * 0.75) },
    { path: new Path2D(), alpha: 0.09, width: Math.max(0.7, size * 0.6) },
  ];
  const lean = 1 + state.bass * 0.8;
  for (let column = 0; column <= FIELD_COLUMNS; column += 1) {
    const x = frame.left + column * columnStep;
    const curveY = heightAt(x);
    const slope = slopeAt(x);
    for (let row = 0; row <= FIELD_ROWS; row += 1) {
      const y = frame.top + row * rowStep;
      const away = Math.abs(y - curveY) / (depth * 0.5);
      // Steep on the curve, settling toward flat away from it.
      const angle = Math.atan(slope * lean) * Math.max(0, 1 - away * 0.75);
      const dx = Math.cos(angle) * tick;
      const dy = Math.sin(angle) * tick;
      const band = away < 0.16 ? bands[0] : bands[away < 0.7 ? 1 : 2];
      band.path.moveTo(x - dx, y - dy);
      band.path.lineTo(x + dx, y + dy);
      /**
       * A head on the ones you can see one on.
       *
       * The field is made of the same arrow the trace is, only further
       * back — without heads the grid read as dashes and the two did not
       * look like the same drawing. A head is three segments rather than
       * one, though, and putting them on all nine hundred marks cost five
       * milliseconds a frame for two bands drawn at a tenth alpha, where
       * a head is a pixel nobody resolves. The faint band keeps its
       * plain tick.
       */
      if (band !== bands[2]) {
        const wing = tick * 0.5;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        band.path.moveTo(
          x + dx - ux * wing - uy * wing * 0.6,
          y + dy - uy * wing + ux * wing * 0.6,
        );
        band.path.lineTo(x + dx, y + dy);
        band.path.lineTo(
          x + dx - ux * wing + uy * wing * 0.6,
          y + dy - uy * wing - ux * wing * 0.6,
        );
      }
    }
  }

  // The motes, as trails behind a head: two strokes for the whole flock.
  const flow: IFieldBand[] = [
    { path: new Path2D(), alpha: 0.9, width: Math.max(1.4, size * 1.5) },
    { path: new Path2D(), alpha: 0.3, width: Math.max(0.9, size * 0.9) },
  ];
  state.motes.forEach((mote) => {
    const age = (seconds - mote.bornAt) / MOTE_LIFE;
    if (age > 1) {
      return;
    }
    const [head] = mote.trail.slice(-1);
    const previous = mote.trail[mote.trail.length - 2] ?? head;
    flow[0].path.moveTo(previous[0], previous[1]);
    flow[0].path.lineTo(head[0], head[1]);
    for (let i = 1; i < mote.trail.length; i += 1) {
      flow[1].path.moveTo(mote.trail[i - 1][0], mote.trail[i - 1][1]);
      flow[1].path.lineTo(mote.trail[i][0], mote.trail[i][1]);
    }
  });

  /**
   * The beat's band: a ring of light leaving the curve, drawn as the
   * curve offset above and below by how far the pulse has travelled.
   */
  const pulse = new Path2D();
  const since = seconds - state.beatAt;
  let pulseAlpha = 0;
  if (state.beatAt >= 0 && since < PULSE_LIFE) {
    const travelled = (since / PULSE_LIFE) * depth * 0.45;
    pulseAlpha = (1 - since / PULSE_LIFE) ** 1.6 * 0.5;
    // Through the midpoints as quadratics rather than corner to corner:
    // a band leaving the curve is a wave and a chain of straight runs
    // does not read as one, however finely it is sampled.
    [-1, 1].forEach((side) => {
      const row = (index: number) => columns[index][1] + side * travelled;
      pulse.moveTo(columns[0][0], row(0));
      for (let index = 1; index < columns.length - 1; index += 1) {
        const [x] = columns[index];
        const [nextX] = columns[index + 1];
        pulse.quadraticCurveTo(
          x,
          row(index),
          (x + nextX) / 2,
          (row(index) + row(index + 1)) / 2,
        );
      }
      const last = columns.length - 1;
      pulse.lineTo(columns[last][0], row(last));
    });
  }

  return {
    bands,
    flow,
    pulse,
    pulseAlpha,
    bass: state.bass,
    thump: state.thump,
  };
};

export type SlopeFieldPaths = ReturnType<typeof createSlopeFieldPaths>;
