/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
import {
  figureInk,
  heatInk,
  heatStep,
  inkAt,
  inkGroups,
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

/**
 * FALLING BLOCKS: the spectrum built out of blocks that drop into place.
 *
 * Every band is a stack of square blocks. When the band gets louder, new
 * blocks fall from the top of the screen and land on its stack, one after
 * another, with a flash where they land; when it gets quieter, the top
 * blocks crumble away. Each block is bevelled — lit on its top and left
 * edge, shaded on its bottom and right — like a game's tiles. With Lit peaks
 * an empty frame marks the stack's recent top.
 *
 * Pieces is how many columns, and the blocks stay square; Gap is the seam
 * between blocks; Colour by colours each block by its row, across the
 * screen, in one colour, or each column by its loudness; Outline draws empty
 * frames at the line width; Opacity is how solid they are.
 *
 * Falling and crumbling are counted in the frames' own time, so the stack
 * builds at the same pace at any frame rate.
 */

/** A column never on a pitch smaller than this, in CSS pixels. */
const MIN_PITCH = 8;
/** Gravity on a falling block, in rows a second per second. */
const GRAVITY = 90;
/** How often a column may drop a new block, and lose one, in milliseconds. */
const DROP_EVERY_MS = 38;
const CRUMBLE_EVERY_MS = 110;
/** How long a landing flashes, and a crumbling block takes to go. */
const FLASH_MS = 140;
const CRUMBLE_MS = 160;
/** How much of a row the level has to fill to earn its block, and how
 * little of it may be left before the block goes. */
const ADD_AT = 0.7;
const REMOVE_AT = 0.3;

interface IFalling {
  column: number;
  /** Its height above the floor, in rows, and its speed downward. */
  row: number;
  speed: number;
}

interface ICrumbling {
  column: number;
  row: number;
  age: number;
}

export interface IFallingBlocksState {
  row: IPieceRow;
  peaks: IPeakHold;
  /** Blocks settled in each column, and since each dropped or lost one. */
  stacks: Int32Array;
  sinceDrop: Float64Array;
  sinceCrumble: Float64Array;
  /** Since each column last caught a block, for the flash. */
  sinceLanding: Float64Array;
  falling: IFalling[];
  crumbling: ICrumbling[];
  rows: number;
}

export const createFallingBlocksState = (): IFallingBlocksState => ({
  row: createPieceRow(),
  peaks: createPeakHold(),
  stacks: new Int32Array(0),
  sinceDrop: new Float64Array(0),
  sinceCrumble: new Float64Array(0),
  sinceLanding: new Float64Array(0),
  falling: [],
  crumbling: [],
  rows: 0,
});

/** How many rows the shallowest copy holds, so every copy shows every block. */
const rowsOf = (frame: ISceneFrame, pitch: number): number =>
  Math.max(
    2,
    Math.floor(
      frame.bands.reduce(
        (least, band) => Math.min(least, band.bottom - band.top),
        Number.POSITIVE_INFINITY,
      ) / pitch,
    ),
  );

/** One frame of building: drop, fall, land, crumble. */
const build = (frame: ISceneFrame, state: IFallingBlocksState): boolean => {
  const { row } = state;
  const rows = rowsOf(frame, row.pitch);
  if (state.stacks.length !== row.count || state.rows !== rows) {
    state.rows = rows;
    state.stacks = new Int32Array(row.count);
    state.sinceDrop = new Float64Array(row.count);
    state.sinceCrumble = new Float64Array(row.count);
    state.sinceLanding = new Float64Array(row.count).fill(FLASH_MS);
    state.falling = [];
    state.crumbling = [];
  }
  const { deltaMs } = frame;
  const seconds = Math.min(0.05, deltaMs / 1000);
  const inFlight = new Int32Array(row.count);
  state.falling.forEach((block) => {
    inFlight[block.column] += 1;
  });
  // A stack short of or over its level still has building to do, even
  // between one drop and the next: the drawing must keep going until it
  // stands where the music is.
  let unsettled = false;
  for (let column = 0; column < row.count; column += 1) {
    // A block is added once the level fills most of its row, and taken away
    // only once the level has left most of it: with one threshold, a level
    // sitting on a row's edge dropped and crumbled a block every frame.
    const target = row.levels[column] * rows;
    const built = state.stacks[column] + inFlight[column];
    const wantsMore = target > built + ADD_AT;
    const wantsLess = target < state.stacks[column] - 1 + REMOVE_AT;
    if (wantsMore || wantsLess) {
      unsettled = true;
    }
    state.sinceDrop[column] += deltaMs;
    state.sinceCrumble[column] += deltaMs;
    state.sinceLanding[column] += deltaMs;
    if (wantsMore && state.sinceDrop[column] >= DROP_EVERY_MS) {
      state.sinceDrop[column] = 0;
      state.falling.push({ column, row: rows + 0.5, speed: 6 });
    } else if (wantsLess && state.sinceCrumble[column] >= CRUMBLE_EVERY_MS) {
      state.sinceCrumble[column] = 0;
      state.stacks[column] -= 1;
      state.crumbling.push({ column, row: state.stacks[column], age: 0 });
    }
  }
  state.falling = state.falling.filter((block) => {
    block.speed += GRAVITY * seconds;
    block.row -= block.speed * seconds;
    const top = state.stacks[block.column];
    if (block.row <= top) {
      state.stacks[block.column] = Math.min(rows, top + 1);
      state.sinceLanding[block.column] = 0;
      return false;
    }
    return true;
  });
  state.crumbling = state.crumbling.filter((block) => {
    block.age += deltaMs;
    return block.age < CRUMBLE_MS;
  });
  return unsettled || state.falling.length > 0 || state.crumbling.length > 0;
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  state: IFallingBlocksState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, look } = frame;
  const { row, rows } = state;
  const up = band.flipped ? 1 : -1;
  const floor = band.flipped ? band.top : band.bottom;
  const { pitch } = row;
  const cell = row.body;
  const inset = (pitch - cell) / 2;
  const span: ISceneSpan = {
    left: plot.left,
    right: plot.right,
    floor,
    head: floor + up * rows * pitch,
  };
  const groups = inkGroups(look.ink, rows);
  const blocks: Path2D[] = [];
  for (let group = 0; group < groups; group += 1) {
    blocks.push(new Path2D());
  }
  const lit = new Path2D();
  const shade = new Path2D();
  const flashes = new Path2D();
  const held = new Path2D();
  const bevel = Math.max(1, cell * 0.14);
  /** Where a block `rowUp` rows above the floor sits in this copy. */
  const topOf = (rowUp: number) =>
    up < 0
      ? floor - (rowUp + 1) * pitch + inset
      : floor + rowUp * pitch + inset;
  const addBlock = (column: number, rowUp: number, group: number) => {
    const x = row.lefts[column];
    const y = topOf(rowUp);
    blocks[group].rect(x, y, cell, cell);
    lit.rect(x, y, cell, bevel);
    lit.rect(x, y + bevel, bevel, cell - bevel);
    shade.rect(x + bevel, y + cell - bevel, cell - bevel, bevel);
    shade.rect(x + cell - bevel, y + bevel, bevel, cell - bevel * 2);
  };
  const groupOf = (column: number, rowUp: number): number => {
    if (look.ink === 'level') {
      return Math.min(rows - 1, Math.max(0, Math.floor(rowUp)));
    }
    return look.ink === 'heat' ? heatStep(row.levels[column]) : 0;
  };
  for (let column = 0; column < row.count; column += 1) {
    const stack = state.stacks[column];
    for (let rowUp = 0; rowUp < stack; rowUp += 1) {
      addBlock(column, rowUp, groupOf(column, rowUp));
    }
    if (stack > 0 && state.sinceLanding[column] < FLASH_MS) {
      const y = topOf(stack - 1);
      flashes.rect(row.lefts[column], y, cell, cell);
    }
    const heldRow = Math.round(state.peaks.held[column] * rows) - 1;
    if (look.accents && heldRow >= stack && heldRow < rows) {
      held.rect(
        row.lefts[column] + 0.5,
        topOf(heldRow) + 0.5,
        cell - 1,
        cell - 1,
      );
    }
  }
  // A falling block wears the colour of the row it will land in, so it
  // does not change colour on its way down.
  const landing = Int32Array.from(state.stacks);
  state.falling.forEach((block) => {
    const at = Math.min(rows - 1, landing[block.column]);
    landing[block.column] += 1;
    addBlock(block.column, block.row, groupOf(block.column, at));
  });
  const crumbs = new Path2D();
  state.crumbling.forEach((block) => {
    const shrink = (block.age / CRUMBLE_MS) * cell * 0.5;
    const x = row.lefts[block.column] + shrink;
    const y = topOf(block.row) + shrink;
    crumbs.rect(x, y, cell - shrink * 2, cell - shrink * 2);
  });

  const whole = figureInk(context, frame, span, 1);
  const paintOf = (group: number): string | CanvasGradient => {
    if (look.ink === 'level') {
      return inkAt(colours, rows > 1 ? group / (rows - 1) : 1, 1);
    }
    return look.ink === 'heat' ? heatInk(colours, group, 1) : whole;
  };
  context.save();
  context.globalAlpha = look.opacity;
  blocks.forEach((path, group) => {
    if (look.filled) {
      context.fillStyle = paintOf(group);
      context.fill(path);
      body?.addPath(path);
    } else {
      context.strokeStyle = paintOf(group);
      context.lineWidth = look.lineWidth;
      context.stroke(path);
    }
  });
  if (look.filled) {
    context.fillStyle = 'rgba(255, 255, 255, 0.3)';
    context.fill(lit);
    context.fillStyle = 'rgba(0, 0, 0, 0.3)';
    context.fill(shade);
  }
  context.globalAlpha = look.opacity * 0.6;
  context.fillStyle = figureInk(context, frame, span, 1, 0.3);
  context.fill(crumbs);
  context.restore();
  context.fillStyle = 'rgba(255, 255, 255, 0.5)';
  context.fill(flashes);
  context.strokeStyle = figureInk(context, frame, span, 0.8, 0.5);
  context.lineWidth = 1;
  context.stroke(held);
};

export const drawFallingBlocks = (
  frame: ISceneFrame,
  state: IFallingBlocksState,
): ISceneDrawn => {
  const row = layPieces(frame, state.row, MIN_PITCH);
  const falling = holdPeaks(state.peaks, row.levels, row.count, frame.deltaMs);
  const building = build(frame, state);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band) => drawCopy(frame, band, state, body));
  return { moving: building || (falling && frame.look.accents), body };
};
