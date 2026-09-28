/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  advanceHold,
  clamp01,
  placeLevel,
  scratch,
  type IAnalysisBand,
  type IAnalysisFrame,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import { asMate } from './channelInk';
import { paintTexture, piecePaint, spectrumInk } from './spectrumPaint';

/**
 * The views drawn as a row of bars with a cap floating over each: the
 * third-octave analyser, the note spectrum and the energy bands.
 *
 * One layout for all three, and for both of their painters — the page's
 * canvas here and the engine's (`engineLooks/barsLook.ts`) — because the
 * three are the same instrument cut three ways: what differs is how the
 * reading is cut into bands, how fast a cap falls and how a bar is shaped,
 * and each view says that in its own `IBarView`.
 *
 * With Left & right chosen every band becomes a PAIR of half-width bars
 * standing side by side, left then right, each with its own cap — which is
 * how a stereo RTA is drawn and the only arrangement in which a band that is
 * louder on one side can be seen at a glance.
 */

/** How one of the three cuts its reading and shapes its bars. */
export interface IBarView {
  /** How many bands, from the look's Pieces. */
  count(pieces: number): number;
  /** `levels` cut into `bands`, as power (`octaveBands.ts`). */
  read(levels: Float64Array, axis: Float64Array, bands: Float64Array): void;
  /** How long a cap hangs, and how fast it falls, in plot depths a second. */
  hangMs: number;
  fall: number;
  /** The least room kept between two bands, in pixels. */
  minGap: number;
  /** The narrowest bar. */
  minWidth: number;
  /** Half the hairline between a pair's two bars. */
  pairInset: number;
  /** How tall a cap is, how far above its bar it floats, how solid. */
  capHeight: number;
  capLift: number;
  capAlpha: number;
  /** A bar no taller than this is not drawn at all. */
  shortest: number;
  /** A bar's corner radius, for its width. */
  radius(width: number): number;
}

/** Where one bar stands across the plot. */
export interface IBarColumn {
  left: number;
  width: number;
}

/** One channel's row. */
export interface IBarRow {
  /** The reading the row is cut from. */
  source: Float64Array;
  bands: Float64Array;
  hold: Float64Array;
  holdMs: Float64Array;
  columnAt(index: number): IBarColumn;
  /** How present the row is: 1 in front, less behind. */
  strength: number;
  /** Painted in the other channel's colours. */
  mate: boolean;
}

export interface IBarFrame {
  /** Back to front: the right channel's row first on a split. */
  rows: IBarRow[];
  /** The loudest cap anywhere, which the heat palette paints every bar in. */
  loudest: number;
}

/** How present the right channel's row is, standing behind the left's. */
export const BARS_BEHIND = 0.92;

/**
 * The rows as they stand, without advancing anything: what the frame is
 * advanced through, and what prints over it afterwards — the energy view's
 * names and numbers.
 */
export const barRowsOf = (
  reading: IAnalysisReading,
  state: IAnalysisState,
  view: IBarView,
): IBarRow[] => {
  const { tuning, plot, split, levels } = reading;
  const count = view.count(Math.round(tuning.columns));
  const span = (plot.right - plot.left) / count;
  const gap = Math.max(view.minGap, span * clamp01(tuning.gap));
  if (split) {
    const [leftBands, leftHold, leftMs, rightBands, rightHold, rightMs] =
      scratch(state, count, 6);
    // Two half-width bars per band with a hairline between them: narrower
    // than a single bar, and still the same total width, so turning Pieces
    // or Gap moves the pair exactly as it moves one.
    const pair = Math.max(view.minWidth, (span - gap) / 2 - view.pairInset);
    const columnAt = (side: number) => (index: number) => ({
      left:
        plot.left + index * span + gap / 2 + side * (pair + view.pairInset * 2),
      width: pair,
    });
    return [
      {
        source: split[1],
        bands: rightBands,
        hold: rightHold,
        holdMs: rightMs,
        columnAt: columnAt(1),
        strength: BARS_BEHIND,
        mate: true,
      },
      {
        source: split[0],
        bands: leftBands,
        hold: leftHold,
        holdMs: leftMs,
        columnAt: columnAt(0),
        strength: 1,
        mate: false,
      },
    ];
  }
  const [bands, hold, holdMs] = scratch(state, count, 3);
  const width = Math.max(view.minWidth, span - gap);
  return [
    {
      source: levels,
      bands,
      hold,
      holdMs,
      columnAt: (index) => ({
        left: plot.left + index * span + gap / 2,
        width,
      }),
      strength: 1,
      mate: false,
    },
  ];
};

/** This frame's bands read and caps advanced, by the reading's time. */
export const advanceBars = (
  reading: IAnalysisReading,
  state: IAnalysisState,
  view: IBarView,
): IBarFrame => {
  const rows = barRowsOf(reading, state, view);
  let loudest = 0;
  rows.forEach((row) => {
    view.read(row.source, reading.axis, row.bands);
    loudest = Math.max(
      loudest,
      advanceHold(
        row.hold,
        row.holdMs,
        row.bands,
        reading.deltaMs,
        view.hangMs,
        view.fall,
      ),
    );
  });
  return { rows, loudest };
};

/** Whether the frame loop has anything left to move. */
export const barsMoving = (bars: IBarFrame): boolean =>
  bars.loudest > STILL_ENOUGH;

/**
 * Where a bar's body and cap stand in `band`: the body from `head` to
 * `foot`, the same row when there is no body, and the cap's top edge when
 * there is a cap.
 */
export const placeBar = (
  band: IAnalysisBand,
  view: IBarView,
  level: number,
  hold: number,
): { head: number; foot: number; capTop: number | undefined } => {
  const foot = band.flipped ? band.top : band.bottom;
  const head = placeLevel(band, level);
  const mark = placeLevel(band, hold);
  let capTop: number | undefined;
  if (hold > 0.004) {
    capTop = band.flipped
      ? mark + view.capLift
      : mark - view.capLift - view.capHeight;
  }
  return {
    head: Math.abs(head - foot) > view.shortest ? head : foot,
    foot,
    capTop,
  };
};

/** One row's bars and caps, as two paths. */
const buildRow = (
  frame: IAnalysisFrame,
  row: IBarRow,
  view: IBarView,
): { bodies: Path2D; caps: Path2D } => {
  const bodies = new Path2D();
  const caps = new Path2D();
  for (let index = 0; index < row.bands.length; index += 1) {
    const { left, width } = row.columnAt(index);
    const { head, foot, capTop } = placeBar(
      frame.band,
      view,
      row.bands[index],
      row.hold[index],
    );
    if (head !== foot) {
      bodies.roundRect(
        left,
        Math.min(head, foot),
        width,
        Math.abs(head - foot),
        view.radius(width),
      );
    }
    if (capTop !== undefined) {
      caps.rect(left, capTop, width, view.capHeight);
    }
  }
  return { bodies, caps };
};

/** The rows on the page's canvas, back to front. */
export const paintBarRows = (
  frame: IAnalysisFrame,
  bars: IBarFrame,
  view: IBarView,
): void => {
  bars.rows.forEach((row) => {
    const painted = row.mate ? asMate(frame) : frame;
    const { context, tuning, band } = painted;
    const { bodies, caps } = buildRow(painted, row, view);
    context.globalAlpha = band.opacity * row.strength;
    if (tuning.filled) {
      /**
       * One gradient for the whole row rather than one per bar: the ramps
       * this graph offers run along the plot's own axes (position across it,
       * level up it), so a per-bar gradient would restart the ramp inside
       * every bar and the row would read as thirty-four copies of the same
       * colour.
       */
      context.fillStyle = piecePaint(
        painted,
        painted.colours,
        bars.loudest,
        tuning.fillOpacity,
      );
      context.fill(bodies);
      paintTexture(painted, bodies, tuning.fillOpacity * row.strength);
    } else {
      context.lineWidth = painted.edge.width;
      context.strokeStyle = spectrumInk(painted, row.bands);
      context.stroke(bodies);
    }
    // The caps in white rather than the look's colour, because their job is
    // to be found and nothing else on the plot is white.
    context.globalAlpha = band.opacity * row.strength * view.capAlpha;
    context.fillStyle = '#fff';
    context.fill(caps);
    context.globalAlpha = 1;
  });
};
