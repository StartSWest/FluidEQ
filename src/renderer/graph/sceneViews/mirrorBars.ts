/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  clampUnit,
  heatInk,
  heatStep,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneMusic,
} from './sceneFrame';
import { mirroredInk } from './sceneInks';
import {
  createPeakHold,
  createPieceRow,
  holdPeaks,
  layPieces,
  type IPeakHold,
  type IPieceRow,
} from './scenePieces';
import {
  beginBloom,
  createSceneBloom,
  endBloom,
  type ISceneBloom,
} from './sceneBloom';

/**
 * MIRROR BARS: the spectrum as rounded bars standing out both ways from a
 * middle line, the way a modern player draws a track — tall where the music
 * is loud, a pill where it is quiet.
 *
 * Each bar carries a gloss across its middle and throws a soft glow that the
 * bass and the beat open; the whole row breathes a little on the kick, and
 * with Lit peaks a cap is held above and below every bar and settles back,
 * brighter with the treble.
 *
 * Pieces is how many bars and Gap the space between them; Colour by runs the
 * colours across the row, out from the middle line, in one colour, or each
 * bar by its loudness; Outline draws the bars as lines at the line width;
 * Opacity is how solid they are; Glow is how much light they throw.
 */

/**
 * A bar never on a pitch smaller than this, in CSS pixels. Exported with the
 * functions below for the look's GPU painting (`engineLooks/mirrorBarsLook.ts`).
 */
export const MIN_PITCH = 3;
/** How far a bar reaches from the middle line, as a share of half the band. */
const REACH = 0.94;

export interface IMirrorBarsState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
}

export const createMirrorBarsState = (): IMirrorBarsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

/** Where one copy's row stands: its middle line, and how far a bar reaches. */
export const mirrorStand = (band: IAnalysisBand) => ({
  middle: (band.top + band.bottom) / 2,
  reach: ((band.bottom - band.top) / 2) * REACH,
});

/** How much the row breathes on the kick. */
export const mirrorBreath = (pulse: number): number => 1 + pulse * 0.06;

/** The middle line's light, and the caps', from the beat and the treble. */
export const mirrorLineAlpha = (pulse: number): number => 0.18 + pulse * 0.3;
export const mirrorCapAlpha = (treble: number): number =>
  clampUnit(0.75 + treble * 0.25);

/** The row's bloom for a frame, which the bass and the beat open. */
export const mirrorBloom = (
  music: Pick<ISceneMusic, 'bass' | 'pulse'>,
  glow: number,
  opacity: number,
) => (0.24 + music.bass * 0.22 + music.pulse * 0.3 + glow * 0.45) * opacity;

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IMirrorBarsState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const { middle, reach } = mirrorStand(band);
  const breath = mirrorBreath(music.pulse);
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const bars: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    bars.push(new Path2D());
  }
  const all = new Path2D();
  const caps = new Path2D();
  const radius = row.body / 2;
  for (let piece = 0; piece < row.count; piece += 1) {
    const left = row.lefts[piece];
    const level = row.levels[piece];
    // Never less than a pill: a quiet band still stands on the line.
    const half = Math.max(radius, level * reach * breath);
    const bar = new Path2D();
    bar.roundRect(
      left,
      middle - half,
      row.body,
      half * 2,
      Math.min(radius, half),
    );
    bars[look.ink === 'heat' ? heatStep(level) : 0].addPath(bar);
    all.addPath(bar);
    const held = state.peaks.held[piece] * reach * breath;
    if (look.accents && held - half > 3) {
      caps.roundRect(left, middle - held - 3, row.body, 2.5, 1.2);
      caps.roundRect(left, middle + held + 0.5, row.body, 2.5, 1.2);
    }
  }
  const paint = mirroredInk(frame, middle, reach, 0, 1);

  context.save();
  context.globalAlpha = look.opacity;
  bars.forEach((path, group) => {
    const fill = look.ink === 'heat' ? heatInk(colours, group, 1) : paint;
    if (look.filled) {
      context.fillStyle = fill;
      context.fill(path);
    } else {
      context.strokeStyle = fill;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
  });
  if (look.filled) {
    body?.addPath(all);
    // A gloss across the middle of every bar, where light would catch a
    // rounded surface, fading out toward its ends.
    const gloss = context.createLinearGradient(
      0,
      middle - reach * 0.7,
      0,
      middle + reach * 0.7,
    );
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gloss.addColorStop(0.5, 'rgba(255, 255, 255, 0.24)');
    gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gloss;
    context.fill(all);
  }
  context.restore();

  // The middle line the row stands on.
  context.fillStyle = mirroredInk(
    frame,
    middle,
    reach,
    0.5,
    mirrorLineAlpha(music.pulse),
  );
  context.fillRect(plot.left, middle - 0.5, plot.right - plot.left, 1);

  context.fillStyle = mirroredInk(
    frame,
    middle,
    reach,
    0.55,
    mirrorCapAlpha(music.treble),
  );
  context.fill(caps);

  if (bloom) {
    bloom.fillStyle = mirroredInk(frame, middle, reach, 0, 1);
    bloom.fill(all);
  }
};

export const drawMirrorBars = (
  frame: ISceneFrame,
  state: IMirrorBarsState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const bloom = beginBloom(frame, state.bloom);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, bloom, body));
  if (bloom) {
    endBloom(
      frame,
      state.bloom,
      mirrorBloom(frame.music, frame.glow, frame.look.opacity),
    );
  }
  return { moving: falling && frame.look.accents, body };
};
