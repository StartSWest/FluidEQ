/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  clampUnit,
  figureInk,
  inkPosition,
  lightInkAt,
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
 * LIGHT BEAMS: a row of lights on the floor, each throwing a beam as high as
 * its band is loud.
 *
 * A beam is a shaft of light that widens as it rises and thins out to
 * nothing at its top, with a white-hot core up its middle and a glowing
 * source where it leaves the floor; the beams are added to each other as
 * light, so where two cross they burn brighter, and a haze lies along the
 * floor. The kick brightens and widens every beam; with Lit peaks a flare
 * marks where each beam reached a moment ago.
 *
 * Pieces is how many beams and Gap the dark between them; Colour by gives
 * each beam the colour of its place in the spectrum, of its height, one
 * colour, or its loudness; Outline draws only the beams' edges at the line
 * width; Opacity is how strong the light is; Glow how far it spills.
 *
 * Each beam is its own gradient — it has to fade to its own top, not to a
 * shared one — which is one fill a beam: a few dozen a frame.
 */

/** A beam never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 6;
/** How much wider a beam is at its top than at its source. */
const SPREAD = 0.7;

export interface ILightBeamsState {
  row: IPieceRow;
  peaks: IPeakHold;
  bloom: ISceneBloom;
}

export const createLightBeamsState = (): ILightBeamsState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  bloom: createSceneBloom(),
});

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: ILightBeamsState,
  bloom: CanvasRenderingContext2D | null,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const { row } = state;
  const width = plot.right - plot.left;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped ? band.top + 4 : band.bottom - 4;
  const reach = band.bottom - band.top - 8;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * reach,
  };
  const strength = clampUnit(0.78 + music.pulse * 0.22) * look.opacity;
  const flares = new Path2D();
  const sources = new Path2D();
  const cores = new Path2D();

  context.save();
  context.globalCompositeOperation = 'lighter';
  // The haze the lights leave along the floor.
  const haze = context.createLinearGradient(
    0,
    floor,
    0,
    floor + up * reach * 0.22,
  );
  haze.addColorStop(0, lightInkAt(colours, 0.5, 0.2, 0.14 + music.bass * 0.12));
  haze.addColorStop(1, lightInkAt(colours, 0.5, 0.2, 0));
  context.fillStyle = haze;
  context.fillRect(
    plot.left,
    Math.min(floor, floor + up * reach * 0.22),
    width,
    reach * 0.22,
  );

  for (let piece = 0; piece < row.count; piece += 1) {
    const left = row.lefts[piece];
    const level = row.levels[piece];
    const height = Math.max(4, level * reach);
    const centre = left + row.body / 2;
    const foot = row.body / 2;
    const crown = foot * (1 + SPREAD + music.pulse * 0.4);
    const head = floor + up * height;
    const along = (centre - plot.left) / width;
    const tint = inkPosition(look.ink, along, level);
    const beam = new Path2D();
    beam.moveTo(centre - foot, floor);
    beam.lineTo(centre - crown, head);
    beam.lineTo(centre + crown, head);
    beam.lineTo(centre + foot, floor);
    beam.closePath();
    // Level colours the beam up its height, like every other level look;
    // the rest give it one colour, fading out toward its top.
    const shaft = context.createLinearGradient(0, floor, 0, head);
    if (look.ink === 'level') {
      shaft.addColorStop(0, lightInkAt(colours, 0, 0.1, 0.6 * strength));
      shaft.addColorStop(
        0.55,
        lightInkAt(colours, level * 0.6, 0.1, 0.32 * strength),
      );
      shaft.addColorStop(1, lightInkAt(colours, level, 0.1, 0));
    } else {
      shaft.addColorStop(0, lightInkAt(colours, tint, 0.1, 0.6 * strength));
      shaft.addColorStop(0.55, lightInkAt(colours, tint, 0.1, 0.3 * strength));
      shaft.addColorStop(1, lightInkAt(colours, tint, 0.1, 0));
    }
    if (look.filled) {
      context.fillStyle = shaft;
      context.fill(beam);
      body?.addPath(beam);
    } else {
      context.strokeStyle = shaft;
      context.lineWidth = look.lineWidth;
      context.stroke(beam);
    }
    const core = Math.max(1, row.body * 0.14);
    cores.rect(
      centre - core / 2,
      Math.min(floor, floor + up * height * 0.85),
      core,
      height * 0.85,
    );
    sources.moveTo(centre + foot * 1.4, floor);
    sources.ellipse(centre, floor, foot * 1.4, foot * 0.45, 0, 0, Math.PI * 2);
    const held = state.peaks.held[piece] * reach;
    if (look.accents && held - height > 4) {
      const y = floor + up * held;
      flares.rect(centre - foot, y - 0.75, foot * 2, 1.5);
    }
  }
  // The cores, white-hot at the source and gone before the top.
  const coreInk = context.createLinearGradient(0, floor, 0, floor + up * reach);
  coreInk.addColorStop(
    0,
    `rgba(255, 255, 255, ${(0.75 * strength).toFixed(3)})`,
  );
  coreInk.addColorStop(
    0.6,
    `rgba(255, 255, 255, ${(0.18 * strength).toFixed(3)})`,
  );
  coreInk.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = coreInk;
  context.fill(cores);
  context.fillStyle = figureInk(context, frame, span, 0.7 * strength, 0.5);
  context.fill(sources);
  context.fillStyle = figureInk(context, frame, span, 0.6, 0.5);
  context.fill(flares);
  context.restore();

  if (bloom) {
    bloom.fillStyle = figureInk(bloom, frame, span, 1);
    bloom.fill(sources);
    bloom.fill(cores);
  }
};

export const drawLightBeams = (
  frame: ISceneFrame,
  state: ILightBeamsState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const bloom = beginBloom(frame, state.bloom);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, bloom, body));
  if (bloom) {
    const { music } = frame;
    endBloom(
      frame,
      state.bloom,
      (0.45 + music.bass * 0.25 + music.pulse * 0.3 + frame.glow * 0.5) *
        frame.look.opacity,
    );
  }
  return { moving: falling && frame.look.accents, body };
};
