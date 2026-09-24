/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface ITraceStretch {
  /** The pixel the trace's visible part starts at, drawn at the plot's left. */
  from: number;
  /** How much wider the visible part is drawn; 1 draws it where measured. */
  scale: number;
}

const AS_MEASURED: ITraceStretch = { from: 0, scale: 1 };

/**
 * How a trace alone on a gridless card is widened to fill it: only the part
 * inside the plot counts, and only a part that stops short of an edge is
 * widened.
 *
 * The trace is measured from 10 Hz to 24 kHz and runs past both edges of the
 * gridless picture's 20 Hz to 16 kHz. Stretched from its own first point to
 * its last, it squeezed all of that back in, and the trim to 16 kHz vanished
 * full screen (Ivan, 2026-09-23). What is left to fill is an output whose top
 * is below the picture's: a headset at 24 kHz has nothing above 12 kHz, and
 * there the trace would end in a strip of empty card.
 */
export const traceStretch = (
  plotLeft: number,
  plotRight: number,
  firstPx: number,
  lastPx: number,
): ITraceStretch => {
  const from = Math.max(plotLeft, firstPx);
  const span = Math.min(plotRight, lastPx) - from;
  const width = plotRight - plotLeft;
  return span > 0 && span < width ? { from, scale: width / span } : AS_MEASURED;
};
