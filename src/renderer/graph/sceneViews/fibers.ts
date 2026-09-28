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
import {
  beginBloom,
  createSceneBloom,
  endBloom,
  type ISceneBloom,
} from './sceneBloom';

/**
 * FIBER OPTICS: a dense brush of glass fibres, each lit at its tip.
 *
 * Hundreds of hair-thin fibres rise from the floor, each as tall as its band
 * is loud, dark near the floor and brightening toward a glowing point of
 * light at its end. The fibres sway a little at their tips with the treble,
 * each at its own pace, the tips flare on the kick and throw a soft glow into
 * the air, and with Lit peaks a faint point marks where each tip was a moment
 * ago.
 *
 * Pieces is how many fibres and Gap how fine; Colour by colours the light
 * across the brush, up its height, in one colour, or each fibre by its
 * loudness; Outline leaves the fibres out and shows the tips as rings;
 * Opacity is how strong the light is; Glow how far it spills.
 */

/**
 * A fibre never on a pitch smaller than this, in CSS pixels. Exported with
 * the sway and the functions below for the look's GPU painting
 * (`engineLooks/fibersLook.ts`).
 */
export const MIN_PITCH = 3;
/** How far a tip sways, in CSS pixels, at full treble. */
export const SWAY = 5;

/** Where one copy's brush stands: its floor, which way up, how far it reaches. */
export const fibersStand = (band: IAnalysisBand): ISceneStand => ({
  floor: band.flipped ? band.top : band.bottom,
  up: band.flipped ? 1 : -1,
  reach: (band.bottom - band.top) * 0.92,
});

/** A tip's radius on a fibre of `body`, flaring on the kick. */
export const fibreTip = (body: number, pulse: number): number =>
  Math.max(0.9, body * 0.42) * (1 + pulse * 0.6);

/** A fibre's line width on a piece of `body`. */
export const fibreWidth = (body: number): number => Math.max(0.7, body * 0.3);

/** How far fibre `piece` sways at its tip: at its own pace, harder with the treble. */
export const fibreSway = (
  piece: number,
  level: number,
  music: Pick<ISceneMusic, 'clock' | 'treble'>,
): number =>
  Math.sin(music.clock * (2.2 + hash01(piece) * 2.4) + piece * 1.7) *
  SWAY *
  music.treble *
  level;

/** The tips' bloom for a frame. */
export const fibersBloom = (pulse: number, glow: number, opacity: number) =>
  (0.4 + pulse * 0.4 + glow * 0.5) * opacity;

export interface IFibersState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
}

export const createFibersState = (): IFibersState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IFibersState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const { floor, up, reach } = fibersStand(band);
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const fibres: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    fibres.push(new Path2D());
  }
  const tips = new Path2D();
  const halos = new Path2D();
  const held = new Path2D();
  const tip = fibreTip(row.body, music.pulse);
  for (let piece = 0; piece < row.count; piece += 1) {
    const x = row.lefts[piece] + row.body / 2;
    const level = row.levels[piece];
    const height = Math.max(2, level * reach);
    const topX = x + fibreSway(piece, level, music);
    const topY = floor + up * height;
    const path = fibres[look.ink === 'heat' ? heatStep(level) : 0];
    path.moveTo(x, floor);
    path.quadraticCurveTo(x, floor + up * height * 0.6, topX, topY);
    tips.moveTo(topX + tip, topY);
    tips.arc(topX, topY, tip, 0, Math.PI * 2);
    halos.moveTo(topX + tip * 2.2, topY);
    halos.arc(topX, topY, tip * 2.2, 0, Math.PI * 2);
    const heldHeight = state.peaks.held[piece] * reach;
    if (look.accents && heldHeight - height > 4) {
      const y = floor + up * heldHeight;
      held.moveTo(x + tip * 0.7, y);
      held.arc(x, y, tip * 0.7, 0, Math.PI * 2);
    }
  }
  const whole = figureInk(context, frame, span, 1);

  context.save();
  context.lineCap = 'round';
  if (look.filled) {
    context.globalAlpha = look.opacity;
    fibres.forEach((path, group) => {
      context.strokeStyle =
        look.ink === 'heat' ? heatInk(colours, group, 1) : whole;
      context.lineWidth = fibreWidth(row.body);
      context.stroke(path);
    });
    // Dark near the floor, the light gathering toward the tips: taken out
    // of the fibres themselves so they keep their colour as they fade.
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'destination-out';
    const fade = context.createLinearGradient(0, floor, 0, span.head);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    fade.addColorStop(0.55, 'rgba(0, 0, 0, 0.15)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = fade;
    context.fillRect(
      plot.left - SWAY,
      Math.min(floor, span.head),
      plot.right - plot.left + SWAY * 2,
      Math.abs(floor - span.head),
    );
    context.globalCompositeOperation = 'source-over';
  }
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = figureInk(context, frame, span, 0.12 * look.opacity, 0.2);
  context.fill(halos);
  context.restore();
  if (look.filled) {
    context.fillStyle = figureInk(context, frame, span, look.opacity, 0.55);
    context.fill(tips);
    body?.addPath(tips);
  } else {
    context.strokeStyle = figureInk(context, frame, span, look.opacity, 0.4);
    context.lineWidth = look.lineWidth * 0.6;
    context.stroke(tips);
  }
  context.fillStyle = figureInk(context, frame, span, 0.5, 0.4);
  context.fill(held);

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1, 0.3);
    bloom.fill(halos);
  }
};

export const drawFibers = (
  frame: ISceneFrame,
  state: IFibersState,
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
      fibersBloom(frame.music.pulse, frame.glow, frame.look.opacity),
    );
  }
  return { moving: falling && frame.look.accents, body };
};
