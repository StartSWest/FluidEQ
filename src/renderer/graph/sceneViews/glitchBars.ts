/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  figureInk,
  hash01,
  heatInk,
  heatStep,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneMusic,
  type ISceneSpan,
  type ISceneStand,
} from './sceneFrame';
import {
  createPeakHold,
  createPieceRow,
  holdPeaks,
  layPieces,
  type IPeakHold,
  type IPieceRow,
} from './scenePieces';

/**
 * GLITCH BARS: a spectrum coming through a broken signal.
 *
 * The bars are drawn three times — a cyan ghost to one side, a magenta one
 * to the other, the true bars over both — and the split widens on the kick
 * and shivers with the treble. Every beat tears a few strips of the picture
 * sideways for a moment, and scanlines run across every bar. With Lit peaks
 * a split cap is held over each bar and falls back.
 *
 * Pieces is how many bars and Gap the space between them; Colour by colours
 * the true bars across the row, up their height, in one colour, or each by
 * its loudness (the ghosts stay the signal's own cyan and magenta); Outline
 * draws the bars as lines at the line width; Opacity is how solid they are;
 * Glow how bright the ghosts burn.
 */

/**
 * A bar never on a pitch smaller than this, in CSS pixels. Exported with the
 * functions below for the look's GPU painting (`engineLooks/glitchBarsLook.ts`).
 */
export const MIN_PITCH = 4;
/** How long a torn strip stays torn, and how many a beat tears. */
const TEAR_MS = 170;
const TEARS_PER_BEAT = 3;

export interface ITear {
  /** Where the strip is, as shares of the band, and how far it is pushed. */
  from: number;
  depth: number;
  shift: number;
  age: number;
}

export interface IGlitchBarsState {
  row: IPieceRow;
  peaks: IPeakHold;
  tears: ITear[];
  seed: number;
  scanlines?: CanvasPattern | null;
}

export const createGlitchBarsState = (): IGlitchBarsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  tears: [],
  seed: 0,
});

/** One dark line every three pixels, as a pattern to fill bars with. */
const scanlinePattern = (
  context: CanvasRenderingContext2D,
): CanvasPattern | null => {
  const tile = document.createElement('canvas');
  tile.width = 1;
  tile.height = 3;
  const tileContext = tile.getContext('2d');
  if (!tileContext) {
    return null;
  }
  tileContext.fillStyle = 'rgba(0, 0, 0, 0.42)';
  tileContext.fillRect(0, 2, 1, 1);
  return context.createPattern(tile, 'repeat');
};

/** Where one copy's row stands: its floor, which way up, how far a bar reaches. */
export const glitchStand = (band: IAnalysisBand): ISceneStand => ({
  floor: band.flipped ? band.top : band.bottom,
  up: band.flipped ? 1 : -1,
  reach: (band.bottom - band.top) * 0.9,
});

/** How far the ghosts split, wider on the kick and shivering with the treble. */
export const glitchSplit = (music: Pick<ISceneMusic, 'pulse' | 'treble'>) =>
  1.5 + music.pulse * 7 + music.treble * 2.5;

/** How bright the ghosts burn. */
export const ghostLight = (glow: number): number => 0.5 + glow * 0.35;

/** The signal's own ghost colours, the cyan one to the left. */
export const GHOST_LEFT: readonly [number, number, number] = [0, 240, 255];
export const GHOST_RIGHT: readonly [number, number, number] = [255, 0, 200];

/** A beat tears a few strips; a tear lasts a moment and heals. */
export const tearSignal = (
  state: IGlitchBarsState,
  music: Pick<ISceneMusic, 'onBeat' | 'bass'>,
  deltaMs: number,
): void => {
  if (music.onBeat) {
    for (let tear = 0; tear < TEARS_PER_BEAT; tear += 1) {
      state.seed += 1;
      state.tears.push({
        from: hash01(state.seed * 1.9) * 0.9,
        depth: 0.015 + 0.06 * hash01(state.seed * 3.3),
        shift: (hash01(state.seed * 5.1) - 0.5) * 60 * (0.4 + music.bass),
        age: 0,
      });
    }
  }
  state.tears = state.tears.filter((tear) => {
    tear.age += deltaMs;
    return tear.age < TEAR_MS;
  });
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IGlitchBarsState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const depth = band.bottom - band.top;
  const { floor, up, reach } = glitchStand(band);
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const bars: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    bars.push(new Path2D());
  }
  const all = new Path2D();
  const caps = new Path2D();
  for (let piece = 0; piece < row.count; piece += 1) {
    const level = row.levels[piece];
    const height = Math.max(2, level * reach);
    const bar = new Path2D();
    bar.rect(
      row.lefts[piece],
      up < 0 ? floor - height : floor,
      row.body,
      height,
    );
    bars[look.ink === 'heat' ? heatStep(level) : 0].addPath(bar);
    all.addPath(bar);
    const held = state.peaks.held[piece] * reach;
    if (look.accents && held - height > 3) {
      caps.rect(row.lefts[piece], floor + up * held - 1.5, row.body, 3);
    }
  }
  const whole = figureInk(context, frame, span, 1);
  const split = glitchSplit(music);
  const ghost = ghostLight(frame.glow);

  /** The whole picture once, pushed `shift` pixels sideways. */
  const paint = (shift: number) => {
    context.save();
    context.translate(shift, 0);
    context.globalCompositeOperation = 'lighter';
    context.globalAlpha = look.opacity * ghost;
    const drawGhost = (x: number, colour: string, shape: Path2D) => {
      context.save();
      context.translate(x, 0);
      if (look.filled) {
        context.fillStyle = colour;
        context.fill(shape);
      } else {
        context.strokeStyle = colour;
        context.lineWidth = look.lineWidth;
        context.stroke(shape);
      }
      context.restore();
    };
    const left = `rgb(${GHOST_LEFT.join(', ')})`;
    const right = `rgb(${GHOST_RIGHT.join(', ')})`;
    drawGhost(-split, left, all);
    drawGhost(split, right, all);
    drawGhost(-split, left, caps);
    drawGhost(split, right, caps);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = look.opacity;
    bars.forEach((path, group) => {
      const fill = look.ink === 'heat' ? heatInk(colours, group, 1) : whole;
      if (look.filled) {
        context.fillStyle = fill;
        context.fill(path);
      } else {
        context.strokeStyle = fill;
        context.lineWidth = look.lineWidth;
        context.stroke(path);
      }
    });
    context.fillStyle = figureInk(context, frame, span, 1, 0.55);
    context.fill(caps);
    if (look.filled && state.scanlines) {
      context.fillStyle = state.scanlines;
      context.fill(all);
    }
    context.restore();
  };

  paint(0);
  if (look.filled) {
    body?.addPath(all);
  }
  // The torn strips: cut out and put back pushed sideways.
  state.tears.forEach((tear) => {
    const top = band.top + tear.from * depth;
    const strip = tear.depth * depth;
    context.save();
    context.beginPath();
    context.rect(plot.left - 40, top, plot.right - plot.left + 80, strip);
    context.clip();
    context.clearRect(plot.left - 40, top, plot.right - plot.left + 80, strip);
    paint(tear.shift);
    context.restore();
  });
};

export const drawGlitchBars = (
  frame: ISceneFrame,
  state: IGlitchBarsState,
): ISceneDrawn => {
  const { music, context } = frame;
  if (state.scanlines === undefined) {
    state.scanlines = scanlinePattern(context);
  }
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  tearSignal(state, music, frame.deltaMs);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  return {
    moving: state.tears.length > 0 || (falling && frame.look.accents),
    body,
  };
};
