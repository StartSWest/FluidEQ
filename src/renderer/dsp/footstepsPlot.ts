/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GRAPH_FONT, IPlotBox } from './deEsserPlot';

/**
 * Footsteps' picture: the last eight seconds of a game, with every step the
 * stage brought up standing out of its band in violet, the background it
 * leaves alone as a dashed line, and the rumble it calmed in amber. Pure
 * drawing — the card's graph owns the history and the loop.
 */

/** What the strip holds, oldest first through `at`. */
export interface IFootstepsHistory {
  /** The whole signal's loudest reading, dB; NaN where nothing was measured. */
  level: Float32Array;
  /** The steps band's loudest reading, dB. */
  cue: Float32Array;
  /** The steps band's learnt floor, dB. */
  bed: Float32Array;
  /** The largest lift of any band, dB, never negative. */
  lift: Float32Array;
  /** The rumble's deepest cut, dB, never positive. */
  calm: Float32Array;
  /** Ring index to display order. */
  at: (index: number) => number;
}

/** The inks, as `r, g, b` for the canvas to add its alpha to. */
export interface IFootstepsInks {
  level: string;
  cue: string;
  lifted: string;
  calmed: string;
  /** A CSS colour: the page's faint text, which the axis is written in. */
  text: string;
}

/**
 * The level axis. A game's steps sit 30 to 50 dB under its gunfire, and the
 * bed lower still, so the strip reaches 84 dB down: high enough to show a
 * blast whole and low enough that the rain under the steps is on it.
 */
const TOP_DB = 0;
const BOTTOM_DB = -84;
const GRID_DB = [-20, -40, -60];
/** Lifts and calms smaller than this are not drawn: they are not heard. */
const VISIBLE_DB = 0.3;

const clampDb = (db: number) => Math.max(BOTTOM_DB, Math.min(TOP_DB, db));

export const drawFootsteps = (
  context: CanvasRenderingContext2D,
  box: IPlotBox,
  history: IFootstepsHistory,
  columns: number,
  /** 0 to 1: how far into the next column time has gone. */
  phase: number,
  isolate: boolean,
  inks: IFootstepsInks,
  nowLabel: string,
) => {
  const { x, y, width, height } = box;
  const yOf = (db: number) =>
    y + ((TOP_DB - clampDb(db)) / (TOP_DB - BOTTOM_DB)) * height;
  const step = width / Math.max(1, columns - 1);
  const xOf = (index: number) => x + (index - phase) * step;
  const columnAt = (index: number) => history.at(index);
  const measured = (index: number) =>
    !Number.isNaN(history.level[columnAt(index)]);
  // Under Isolate only the lift is heard, so only the lift is drawn bright.
  const dim = isolate ? 0.35 : 1;

  context.font = GRAPH_FONT;
  context.textBaseline = 'middle';
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(255,255,255,0.05)';
  context.fillStyle = inks.text;
  context.textAlign = 'left';
  GRID_DB.forEach((db) => {
    const at = Math.round(yOf(db)) + 0.5;
    context.beginPath();
    context.moveTo(x, at);
    context.lineTo(x + width, at);
    context.stroke();
    context.fillText(`${db}`, x + 2, at - 7);
  });

  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();

  // Everything, as a faint mass: where the blasts and the shots are.
  context.fillStyle = `rgba(${inks.level}, ${0.1 * dim})`;
  context.strokeStyle = `rgba(${inks.level}, ${0.26 * dim})`;
  let runStart = -1;
  const closeRun = (end: number) => {
    if (runStart < 0) {
      return;
    }
    context.beginPath();
    context.moveTo(xOf(runStart), y + height);
    for (let index = runStart; index <= end; index += 1) {
      context.lineTo(xOf(index), yOf(history.level[columnAt(index)]));
    }
    context.lineTo(xOf(end), y + height);
    context.closePath();
    context.fill();
    context.beginPath();
    for (let index = runStart; index <= end; index += 1) {
      const at = yOf(history.level[columnAt(index)]);
      if (index === runStart) {
        context.moveTo(xOf(index), at);
      } else {
        context.lineTo(xOf(index), at);
      }
    }
    context.stroke();
    runStart = -1;
  };
  for (let index = 0; index < columns; index += 1) {
    if (measured(index)) {
      if (runStart < 0) {
        runStart = index;
      }
    } else {
      closeRun(index - 1);
    }
  }
  closeRun(columns - 1);

  // What Calm took off the rumble, hanging from the top of that mass.
  const bar = Math.max(2, step * 0.8);
  context.fillStyle = `rgba(${inks.calmed}, ${0.55 * dim})`;
  for (let index = 0; index < columns; index += 1) {
    const column = columnAt(index);
    const calm = history.calm[column];
    if (measured(index) && calm <= -VISIBLE_DB) {
      const top = yOf(history.level[column]);
      const bottom = yOf(history.level[column] + calm);
      context.fillRect(
        xOf(index) - bar / 2,
        top,
        bar,
        Math.max(1, bottom - top),
      );
    }
  }

  // The background the stage leaves alone: rain, wind, music.
  context.setLineDash([4, 4]);
  context.strokeStyle = `rgba(255,255,255,${0.45 * dim})`;
  context.beginPath();
  let drawing = false;
  for (let index = 0; index < columns; index += 1) {
    const column = columnAt(index);
    if (!measured(index) || history.bed[column] <= BOTTOM_DB) {
      drawing = false;
    } else if (drawing) {
      context.lineTo(xOf(index), yOf(history.bed[column]));
    } else {
      context.moveTo(xOf(index), yOf(history.bed[column]));
      drawing = true;
    }
  }
  context.stroke();
  context.setLineDash([]);

  // The steps band as it arrives.
  context.strokeStyle = `rgba(${inks.cue}, ${0.85 * dim})`;
  context.lineWidth = 1.5;
  context.beginPath();
  drawing = false;
  for (let index = 0; index < columns; index += 1) {
    const column = columnAt(index);
    if (!measured(index)) {
      drawing = false;
    } else if (drawing) {
      context.lineTo(xOf(index), yOf(history.cue[column]));
    } else {
      context.moveTo(xOf(index), yOf(history.cue[column]));
      drawing = true;
    }
  }
  context.stroke();

  // Every step brought up: the band's reading, and above it as far as the
  // lift took it, in the violet the rack draws what a stage did in.
  for (let index = 0; index < columns; index += 1) {
    const column = columnAt(index);
    const lift = history.lift[column];
    if (measured(index) && lift >= VISIBLE_DB) {
      const base = yOf(history.cue[column]);
      const top = yOf(history.cue[column] + lift);
      const left = xOf(index) - bar / 2;
      const fill = context.createLinearGradient(0, top, 0, base);
      fill.addColorStop(0, `rgba(${inks.lifted}, 0.95)`);
      fill.addColorStop(1, `rgba(${inks.lifted}, 0.35)`);
      context.fillStyle = fill;
      context.fillRect(left, top, bar, Math.max(1, base - top));
      context.fillStyle = `rgba(${inks.lifted}, 1)`;
      context.fillRect(left, top - 1, bar, 2);
    }
  }
  context.restore();

  // Under the strip's right edge, where nothing the strip draws can be.
  context.fillStyle = inks.text;
  context.textAlign = 'right';
  context.fillText(nowLabel, x + width - 2, y + height + 11);
};
