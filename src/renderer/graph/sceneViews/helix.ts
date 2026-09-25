/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  HEAT_STEPS,
  clampUnit,
  hash01,
  heatInk,
  heatStep,
  levelAtX,
  type ISceneDrawn,
  type ISceneFrame,
} from './sceneFrame';
import { mirroredInk } from './sceneInks';
import { createPieceRow, layPieces, type IPieceRow } from './scenePieces';

/**
 * HELIX: two strands twisting across the screen, bound by rungs the
 * spectrum lights.
 *
 * The strands wind round each other like a double helix, turning at the
 * music's pace, and swell apart where the music under them is loud; the
 * half of each strand that passes behind is dimmer and thinner than the half
 * in front, so the twist reads in depth. Between them stand the rungs — one
 * for every piece of the spectrum — each as bright and as solid as its band
 * is loud, with a bead where it meets a strand. The kick throws the strands
 * wider; with Lit peaks the beads in front spark with the treble.
 *
 * Pieces is how many rungs and Gap how slim; Colour by runs the colours
 * across, out from the middle, in one colour, or each rung by its loudness;
 * Outline draws the rungs as lines instead of bars; Opacity is how solid
 * they are; Glow how bright the strands burn.
 */

/** A rung never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 6;
/** Points along each strand, and how many turns the helix makes across. */
const SAMPLES = 160;
const TURNS = 2.5;

export interface IHelixState {
  row: IPieceRow;
}

export const createHelixState = (): IHelixState => ({
  row: createPieceRow(),
});

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IHelixState,
  body: Path2D | undefined,
): void => {
  const { context, plot, xs, levels, colours, music, look } = frame;
  const { row } = state;
  const width = plot.right - plot.left;
  const depth = band.bottom - band.top;
  const middle = (band.top + band.bottom) / 2;
  const reach = depth * 0.46;
  const clock = music.clock * 1.6;
  const swingAt = (x: number) =>
    depth *
    (0.12 + 0.28 * clampUnit(levelAtX(xs, levels, x)) + 0.05 * music.pulse);
  const phaseAt = (x: number) =>
    ((x - plot.left) / width) * TURNS * Math.PI * 2 - clock;

  // The strands, split into the halves in front and the halves behind.
  const front = new Path2D();
  const behind = new Path2D();
  let wasFront: boolean | undefined;
  for (let strand = 0; strand < 2; strand += 1) {
    const sign = strand === 0 ? 1 : -1;
    wasFront = undefined;
    let lastX = 0;
    let lastY = 0;
    for (let step = 0; step <= SAMPLES; step += 1) {
      const x = plot.left + (step / SAMPLES) * width;
      const phase = phaseAt(x);
      const y = middle + sign * swingAt(x) * Math.sin(phase);
      const isFront = sign * Math.cos(phase) > 0;
      if (step > 0) {
        const path = isFront ? front : behind;
        // A strand's first segment starts a line of its own: it used to be
        // remembered from the strand's first point, and when that matched,
        // the segment carried on from the end of the other strand — a
        // straight line drawn right across the helix.
        if (isFront !== wasFront) {
          path.moveTo(lastX, lastY);
        }
        path.lineTo(x, y);
        wasFront = isFront;
      }
      lastX = x;
      lastY = y;
    }
  }

  // The rungs, and a bead where each meets a strand.
  const groups = look.ink === 'heat' ? HEAT_STEPS : 1;
  const rungs: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    rungs.push(new Path2D());
  }
  const beads = new Path2D();
  const sparks = new Path2D();
  for (let piece = 0; piece < row.count; piece += 1) {
    const x = row.lefts[piece] + row.body / 2;
    const level = row.levels[piece];
    const phase = phaseAt(x);
    const swing = swingAt(x) * Math.sin(phase);
    const top = middle - Math.abs(swing);
    const length = Math.abs(swing) * 2;
    const path = rungs[look.ink === 'heat' ? heatStep(level) : 0];
    if (look.filled) {
      // A rung's width is its band's loudness inside its own pitch.
      const thick = row.body * (0.35 + 0.65 * level);
      path.rect(x - thick / 2, top, thick, length);
    } else {
      path.moveTo(x, top);
      path.lineTo(x, top + length);
    }
    const bead = 1.2 + row.body * 0.18 * (0.5 + level);
    beads.moveTo(x + bead, middle + swing);
    beads.arc(x, middle + swing, bead, 0, Math.PI * 2);
    beads.moveTo(x + bead, middle - swing);
    beads.arc(x, middle - swing, bead, 0, Math.PI * 2);
    if (
      look.accents &&
      music.treble > 0.2 &&
      hash01(piece * 2.7 + Math.floor(music.clock * 10)) < music.treble * 0.5
    ) {
      const frontY = Math.cos(phase) > 0 ? middle + swing : middle - swing;
      sparks.moveTo(x + bead * 1.6, frontY);
      sparks.arc(x, frontY, bead * 1.6, 0, Math.PI * 2);
    }
  }

  const strandInk = (alpha: number, whiten: number) =>
    mirroredInk(frame, middle, reach, whiten, alpha);
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const weight = Math.max(1, look.lineWidth);
  context.strokeStyle = strandInk(0.35 * look.opacity, 0);
  context.lineWidth = weight;
  context.stroke(behind);
  rungs.forEach((path, group) => {
    const paint =
      look.ink === 'heat'
        ? heatInk(colours, group, 0.8 * look.opacity)
        : strandInk(0.8 * look.opacity, 0.1);
    if (look.filled) {
      context.fillStyle = paint;
      context.fill(path);
      body?.addPath(path);
    } else {
      context.strokeStyle = paint;
      context.lineWidth = weight;
      context.stroke(path);
    }
  });
  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = strandInk(
    clampUnit(0.22 + frame.glow * 0.25 + music.pulse * 0.15) * look.opacity,
    0,
  );
  context.lineWidth = weight * 4.5;
  context.stroke(front);
  context.strokeStyle = strandInk(look.opacity, 0.35);
  context.lineWidth = weight * 1.6;
  context.stroke(front);
  context.fillStyle = strandInk(0.9 * look.opacity, 0.5);
  context.fill(beads);
  context.fillStyle = 'rgba(255, 255, 255, 0.9)';
  context.fill(sparks);
  context.restore();
};

export const drawHelix = (
  frame: ISceneFrame,
  state: IHelixState,
): ISceneDrawn => {
  layPieces(frame, state.row, MIN_PITCH);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  // It turns on the music's clock; the listener keeps the loop awake while
  // it plays (`hearMusic`).
  return { moving: false, body };
};
