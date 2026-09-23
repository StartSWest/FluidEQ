/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the Exciter graph prints each band's two edges, in hertz.
 *
 * Centred on their edges, the readouts printed over each other wherever two
 * bands met — the low band's top edge and the mid band's bottom edge are
 * often a few hertz apart, and "296" and "298" became one smudge — and the
 * edge at 20 kHz ran off the plot. So a band names its edges just inside its
 * own span, a readout that would still land on another drops a row, and every
 * readout stays between the plot's edges.
 */

/** Between a readout and its edge, and between two readouts on one row. */
export const READOUT_GAP = 4;

/** An edge as the dials would say it: whole hertz, then kilohertz. */
export const formatEdge = (hz: number): string =>
  hz < 1_000
    ? String(Math.round(hz))
    : `${(hz / 1_000).toFixed(hz < 10_000 ? 1 : 0)}k`;

/** One enabled band's span on the plot, and what its edges read. */
export interface IEdgeSpan {
  /** Which band, so the readout wears the band's colour. */
  index: number;
  lowX: number;
  highX: number;
  lowText: string;
  highText: string;
}

/** One readout as it is printed: its text, its extent and its row. */
export interface IEdgeReadout {
  index: number;
  text: string;
  left: number;
  right: number;
  row: number;
}

/** The first row on which `left`..`right` overprints nothing already placed. */
const freeRow = (
  placed: readonly IEdgeReadout[],
  left: number,
  right: number,
): number => {
  const taken = new Set(
    placed
      .filter(
        (other) =>
          left < other.right + READOUT_GAP && right > other.left - READOUT_GAP,
      )
      .map((other) => other.row),
  );
  let row = 0;
  while (taken.has(row)) {
    row += 1;
  }
  return row;
};

/**
 * Every readout, placed.
 *
 * A span too narrow to hold its two readouts — a narrow band on a narrow
 * window — names them outside its edges only while it is the band being
 * worked (`focusedIndex`); otherwise it says nothing rather than overprint
 * its neighbours.
 */
export const placeEdgeReadouts = (
  spans: readonly IEdgeSpan[],
  measure: (text: string) => number,
  plotLeft: number,
  plotRight: number,
  focusedIndex: number | undefined,
): IEdgeReadout[] =>
  spans.reduce<IEdgeReadout[]>((placed, span) => {
    const lowWidth = measure(span.lowText);
    const highWidth = measure(span.highText);
    const isInside =
      lowWidth + highWidth + READOUT_GAP * 3 <= span.highX - span.lowX;
    if (!isInside && span.index !== focusedIndex) {
      return placed;
    }
    const wanted = isInside
      ? [
          {
            text: span.lowText,
            left: span.lowX + READOUT_GAP,
            size: lowWidth,
          },
          {
            text: span.highText,
            left: span.highX - READOUT_GAP - highWidth,
            size: highWidth,
          },
        ]
      : [
          {
            text: span.lowText,
            left: span.lowX - READOUT_GAP - lowWidth,
            size: lowWidth,
          },
          {
            text: span.highText,
            left: span.highX + READOUT_GAP,
            size: highWidth,
          },
        ];
    return wanted.reduce<IEdgeReadout[]>((sofar, { text, left, size }) => {
      const from = Math.max(plotLeft, Math.min(plotRight - size, left));
      return [
        ...sofar,
        {
          index: span.index,
          text,
          left: from,
          right: from + size,
          row: freeRow(sofar, from, from + size),
        },
      ];
    }, placed);
  }, []);
