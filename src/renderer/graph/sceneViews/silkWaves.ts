/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  clampUnit,
  hash01,
  levelAtX,
  lightInkAt,
  rampAlong,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneReading,
} from './sceneFrame';

/**
 * SILK WAVES: ribbons of light flowing across the middle of the screen.
 *
 * Five strands, each a wave of its own length rolling at its own speed at
 * the music's pace, woven through each other. How far a strand swings at any
 * point is the spectrum there — a quiet treble leaves the strands nearly
 * still on the right while the bass throws them wide on the left — and each
 * strand leans on its own part of the music (the widest on the bass, the
 * tightest on the treble), so the five never move as one. Every strand is a
 * sheer ribbon between its crest and a thinner echo of itself, edged with a
 * bright line, and all of it is added as light, so where strands cross they
 * burn brighter. The kick swells them all at once.
 *
 * Colour by runs the colours out from the middle line to the strands'
 * furthest swing, across bass to treble, in one colour, or each strand by how
 * loud its part of the music is; Outline leaves the edges alone, at the line
 * width; Opacity is how sheer the ribbons are; Lit peaks puts sparks on the
 * crests when the treble is up; Glow widens the lines' light. The strands
 * are not pieces, so Pieces and Gap have nothing here to move.
 */

/**
 * Points along each strand. Exported with the functions below for the look's
 * GPU painting (`engineLooks/silkWavesLook.ts`), which paints the strands
 * these trace.
 */
export const SAMPLES = 96;
/**
 * The five strands: waves across the width, speed at the music's pace,
 * where each starts, how wide it swings against the others, which part of
 * the music it leans on, and how thin its echo is.
 */
const STRANDS: readonly {
  cycles: number;
  speed: number;
  phase: number;
  swing: number;
  lean: 'bass' | 'mid' | 'treble';
  echo: number;
}[] = [
  { cycles: 1.3, speed: 0.9, phase: 0, swing: 1, lean: 'bass', echo: 0.3 },
  { cycles: 1.9, speed: -1.2, phase: 1.7, swing: 0.8, lean: 'bass', echo: 0.4 },
  { cycles: 2.6, speed: 1.5, phase: 3.1, swing: 0.66, lean: 'mid', echo: 0.35 },
  { cycles: 3.4, speed: -1.9, phase: 4.4, swing: 0.52, lean: 'mid', echo: 0.5 },
  {
    cycles: 4.5,
    speed: 2.4,
    phase: 5.6,
    swing: 0.4,
    lean: 'treble',
    echo: 0.45,
  },
];

/** How many strands, and a treble spark's radius on a crest. */
export const STRAND_COUNT = STRANDS.length;
export const SPARK_RADIUS = 1.6;

export interface ISilkWavesState {
  /** The spectrum along the width, as read and then smoothed. */
  raw: Float64Array;
  shape: Float64Array;
  /** The strand being drawn, traced into these rather than fresh ones. */
  traced: IStrandTrace;
}

export const createSilkWavesState = (): ISilkWavesState => ({
  raw: new Float64Array(SAMPLES + 1),
  shape: new Float64Array(SAMPLES + 1),
  traced: { xs: [], crest: [], echo: [] },
});

/** A smooth path through points, by the midpoints between them. */
const through = (
  path: Path2D,
  xs: readonly number[],
  ys: readonly number[],
  reverse: boolean,
) => {
  const count = xs.length;
  const at = (index: number) => (reverse ? count - 1 - index : index);
  if (reverse) {
    path.lineTo(xs[at(0)], ys[at(0)]);
  } else {
    path.moveTo(xs[at(0)], ys[at(0)]);
  }
  for (let index = 1; index < count - 1; index += 1) {
    const here = at(index);
    const next = at(index + 1);
    path.quadraticCurveTo(
      xs[here],
      ys[here],
      (xs[here] + xs[next]) / 2,
      (ys[here] + ys[next]) / 2,
    );
  }
  path.lineTo(xs[at(count - 1)], ys[at(count - 1)]);
};

/** A strand's paint, as Colour by says. */
const strandInk = (
  frame: ISceneFrame,
  middle: number,
  swing: number,
  loudness: number,
  whiten: number,
  alpha: number,
): string | CanvasGradient => {
  const { context, colours, look, plot } = frame;
  if (look.ink === 'flat') {
    return lightInkAt(colours, 0.5, whiten, alpha);
  }
  if (look.ink === 'heat') {
    return lightInkAt(colours, loudness, whiten, alpha);
  }
  if (look.ink === 'frequency') {
    return rampAlong(
      context,
      colours,
      [plot.left, 0],
      [plot.right, 0],
      whiten,
      alpha,
    );
  }
  // Level: the middle line the floor of the ramp, the furthest swing either
  // way its top.
  const out = context.createLinearGradient(
    0,
    middle - swing,
    0,
    middle + swing,
  );
  const stops = 9;
  for (let stop = 0; stop < stops; stop += 1) {
    const at = stop / (stops - 1);
    out.addColorStop(
      at,
      lightInkAt(colours, Math.abs(at * 2 - 1), whiten, alpha),
    );
  }
  return out;
};

/** Where one copy's strands run: the band's middle, and their widest swing. */
export const silkStand = (band: IAnalysisBand) => ({
  middle: (band.top + band.bottom) / 2,
  swing: (band.bottom - band.top) * 0.46,
});

/** How loud a strand's own part of the music is, 0..1. */
export const strandLoudness = (
  index: number,
  music: ISceneReading['music'],
): number =>
  clampUnit(
    0.35 * music[STRANDS[index].lean] + 0.65 * music.energy + music.pulse * 0.2,
  );

/** A strand's line: its weight from its loudness, and its glow's light. */
export const strandWeight = (lineWidth: number, loudness: number): number =>
  lineWidth * (0.7 + loudness * 0.6);
export const strandGlow = (glow: number) => ({
  alpha: clampUnit(0.18 + glow * 0.2),
  widen: 3.5 + glow * 3,
});

/** A strand traced across the plot: each sample's x, crest and echo. */
export interface IStrandTrace {
  xs: number[];
  crest: number[];
  echo: number[];
}

/**
 * Traces strand `index` of the copy standing in `band` into `out`, sample by
 * sample, and hands `spark` every crest the treble lights (Lit peaks).
 */
export const traceStrand = (
  reading: Pick<ISceneReading, 'plot' | 'music' | 'look'>,
  band: IAnalysisBand,
  state: ISilkWavesState,
  index: number,
  out: IStrandTrace,
  spark: (x: number, y: number) => void,
): void => {
  const { plot, music, look } = reading;
  const strand = STRANDS[index];
  const width = plot.right - plot.left;
  const { middle, swing } = silkStand(band);
  const lean = music[strand.lean];
  const kick = 1 + music.pulse * 0.35;
  out.xs.length = 0;
  out.crest.length = 0;
  out.echo.length = 0;
  for (let step = 0; step <= SAMPLES; step += 1) {
    const along = step / SAMPLES;
    // Tapered to nothing at both ends, like silk held at its edges.
    const taper = Math.sin(along * Math.PI) ** 0.6;
    const height =
      swing *
      strand.swing *
      taper *
      kick *
      (0.12 + 0.88 * clampUnit(state.shape[step] * (0.6 + lean * 0.8)));
    const wave = Math.sin(
      along * strand.cycles * Math.PI * 2 +
        strand.phase +
        music.clock * strand.speed,
    );
    const x = plot.left + along * width;
    const crest = middle + wave * height;
    out.xs.push(x);
    out.crest.push(crest);
    out.echo.push(middle + wave * height * strand.echo);
    if (
      look.accents &&
      music.treble > 0.25 &&
      Math.abs(wave) > 0.96 &&
      hash01(step * 3.3 + index * 17 + Math.floor(music.clock * 8)) <
        music.treble * 0.5
    ) {
      spark(x, crest);
    }
  }
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: ISilkWavesState,
  body: Path2D | undefined,
): void => {
  const { context, music, look } = frame;
  const { middle, swing } = silkStand(band);
  const sparks = new Path2D();
  const { traced } = state;

  context.save();
  context.globalCompositeOperation = 'lighter';
  context.lineJoin = 'round';
  STRANDS.forEach((_, index) => {
    const loudness = strandLoudness(index, music);
    traceStrand(frame, band, state, index, traced, (x, y) => {
      sparks.moveTo(x + SPARK_RADIUS, y);
      sparks.arc(x, y, SPARK_RADIUS, 0, Math.PI * 2);
    });
    const { xs, crest, echo } = traced;
    const edge = new Path2D();
    through(edge, xs, crest, false);
    if (look.filled) {
      const ribbon = new Path2D();
      through(ribbon, xs, crest, false);
      through(ribbon, xs, echo, true);
      ribbon.closePath();
      context.globalAlpha = look.opacity * 0.24;
      context.fillStyle = strandInk(frame, middle, swing, loudness, 0, 1);
      context.fill(ribbon);
      body?.addPath(ribbon);
    }
    const weight = strandWeight(look.lineWidth, loudness);
    const light = strandGlow(frame.glow);
    context.globalAlpha = light.alpha * look.opacity;
    context.strokeStyle = strandInk(frame, middle, swing, loudness, 0, 1);
    context.lineWidth = weight * light.widen;
    context.stroke(edge);
    context.globalAlpha = 0.9;
    context.strokeStyle = strandInk(frame, middle, swing, loudness, 0.25, 1);
    context.lineWidth = weight;
    context.stroke(edge);
  });
  context.globalAlpha = 1;
  context.fillStyle = 'rgba(255, 255, 255, 0.85)';
  context.fill(sparks);
  context.restore();
};

/**
 * The spectrum along the width, smoothed over a few neighbours so a strand
 * swells like cloth rather than following every band's edge.
 */
export const shapeSilk = (
  reading: Pick<ISceneReading, 'plot' | 'xs' | 'levels'>,
  state: ISilkWavesState,
): void => {
  const { plot, xs, levels } = reading;
  const width = plot.right - plot.left;
  const { raw } = state;
  for (let step = 0; step <= SAMPLES; step += 1) {
    raw[step] = levelAtX(xs, levels, plot.left + (step / SAMPLES) * width);
  }
  const reach = 4;
  for (let step = 0; step <= SAMPLES; step += 1) {
    let total = 0;
    let count = 0;
    for (
      let near = Math.max(0, step - reach);
      near <= Math.min(SAMPLES, step + reach);
      near += 1
    ) {
      total += raw[near];
      count += 1;
    }
    state.shape[step] = total / count;
  }
};

export const drawSilkWaves = (
  frame: ISceneFrame,
  state: ISilkWavesState,
): ISceneDrawn => {
  shapeSilk(frame, state);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  // The strands roll on the music's clock; the listener keeps the loop awake
  // while it plays (`hearMusic`).
  return { moving: false, body };
};
