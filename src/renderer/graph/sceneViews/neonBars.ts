/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  figureInk,
  heatInk,
  heatStep,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneSpan,
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
 * NEON BARS: tubes of light standing on a glossy floor.
 *
 * Each bar is a rounded tube, dim at its foot and burning toward its head,
 * with a white-hot filament down its middle; the whole row blooms into the
 * air, and the floor under it is a mirror that holds the row upside down,
 * fading into the dark. A cap floats over every bar at its recent height and
 * drops back (Lit peaks); on the beat the floor line flashes and the bloom
 * swells.
 *
 * Pieces is how many bars and Gap the dark between them; Colour by runs the
 * light across the row bass to treble, up every bar, in one colour, or each
 * bar whole by its loudness; Outline draws the tubes as lines of light at the
 * line width; Opacity is how solid the tubes are; Glow is how much light they
 * throw.
 *
 * Bars of one colour are one path and one fill, their filaments one more, the
 * reflection one more and a shading pass over it; the bloom is drawn small.
 */

/** A bar never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 4;
/** The floor stands this far up the band; the reflection fills below it. */
const REFLECTION = 0.24;
/** How long a reflection is, against the bar that casts it. */
const MIRROR = 0.5;
/** The widest a tube is drawn, in CSS pixels, however few the pieces. */
const MAX_TUBE = 16;

export interface INeonBarsState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
}

export const createNeonBarsState = (): INeonBarsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

/** A tube from the floor, rounded at both ends. */
const tube = (
  path: Path2D,
  left: number,
  floor: number,
  up: number,
  width: number,
  height: number,
) => {
  if (height < 1) {
    return;
  }
  const top = up < 0 ? floor - height : floor;
  path.roundRect(left, top, width, height, Math.min(width / 2, height / 2));
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: INeonBarsState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const depth = band.bottom - band.top;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped
    ? band.top + depth * REFLECTION
    : band.bottom - depth * REFLECTION;
  const reach = depth * (1 - REFLECTION) - 4;
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
  const filaments = new Path2D();
  const mirror = new Path2D();
  const caps = new Path2D();
  // A tube is never wider than a tube: with few pieces the pitch grows and
  // the tube stays slim in the middle of it, where a tube as wide as its
  // pitch read as a row of coins.
  const width = Math.min(row.body, MAX_TUBE);
  const inset = (row.body - width) / 2;
  const filament = Math.max(1, width * 0.22);
  for (let piece = 0; piece < row.count; piece += 1) {
    const left = row.lefts[piece] + inset;
    const level = row.levels[piece];
    // Never quite nothing: an idle bar is a pilot light on the floor.
    const height = Math.max(width * 0.6, level * reach);
    const bar = new Path2D();
    tube(bar, left, floor, up, width, height);
    bars[look.ink === 'heat' ? heatStep(level) : 0].addPath(bar);
    all.addPath(bar);
    if (height > width) {
      const end = width / 2;
      filaments.roundRect(
        left + (width - filament) / 2,
        up < 0 ? floor - height + end : floor + end * 0.6,
        filament,
        Math.max(1, height - end * 1.6),
        filament / 2,
      );
    }
    const shown = height * MIRROR;
    tube(mirror, left, floor - up * 2, -up, width, shown);
    const held = state.peaks.held[piece] * reach;
    if (look.accents && held - height > 3) {
      const capY = floor + up * (held + 3);
      caps.roundRect(left, capY - 1.5, width, 3, Math.min(1.5, width / 2));
    }
  }
  const whole = figureInk(context, frame, span, 1);

  // The reflection first, under everything, fading into the floor.
  context.save();
  context.globalAlpha = look.opacity * 0.32;
  context.fillStyle = whole;
  context.strokeStyle = whole;
  if (look.filled) {
    context.fill(mirror);
  } else {
    context.lineWidth = look.lineWidth;
    context.stroke(mirror);
  }
  context.globalAlpha = 1;
  // The floor's gloss swallows the reflection: erased toward its far end.
  const mirrorEnd = floor - up * reach * MIRROR;
  const fade = context.createLinearGradient(0, floor, 0, mirrorEnd);
  fade.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
  fade.addColorStop(1, 'rgba(0, 0, 0, 1)');
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = fade;
  context.fillRect(
    plot.left,
    Math.min(floor, mirrorEnd),
    plot.right - plot.left,
    Math.abs(mirrorEnd - floor),
  );
  context.restore();

  // The tubes: colour, then the dark at the foot, then the filament.
  context.save();
  context.globalAlpha = look.opacity;
  bars.forEach((path, group) => {
    const paint = look.ink === 'heat' ? heatInk(colours, group, 1) : whole;
    if (look.filled) {
      context.fillStyle = paint;
      context.fill(path);
    } else {
      context.strokeStyle = paint;
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
    body?.addPath(path);
  });
  if (look.filled) {
    const foot = context.createLinearGradient(0, floor, 0, span.head);
    foot.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    foot.addColorStop(0.5, 'rgba(0, 0, 0, 0.1)');
    foot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = foot;
    context.fill(all);
    context.fillStyle = figureInk(context, frame, span, 0.85, 0.7);
    context.fill(filaments);
  }
  context.restore();
  context.fillStyle = figureInk(context, frame, span, 0.95, 0.55);
  context.fill(caps);

  // The floor line, flashing on the beat.
  context.fillStyle = figureInk(
    context,
    frame,
    span,
    0.2 + music.pulse * 0.5,
    0.4,
  );
  context.fillRect(plot.left, floor - 0.5, plot.right - plot.left, 1);

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1);
    bloom.fill(all);
    bloom.fill(caps);
  }
};

export const drawNeonBars = (
  frame: ISceneFrame,
  state: INeonBarsState,
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
      (0.5 + frame.music.pulse * 0.4 + frame.glow * 0.5) * frame.look.opacity,
    );
  }
  return { moving: falling && frame.look.accents, body };
};
