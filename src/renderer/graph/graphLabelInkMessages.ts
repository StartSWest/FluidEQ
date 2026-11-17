/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the page and the label-ink worker say to each other
 * (`graphLabelInk.ts`, `graphLabelInk.worker.ts`).
 */

/**
 * The picture behind a chart's labels, shrunk, and each label's box in its
 * pixels as four numbers — left, top, right, bottom — one label after
 * another.
 */
export interface ILabelInkRequest {
  id: number;
  picture: ImageBitmap;
  boxes: Float32Array;
}

/** The mean relative luminance behind each box, in the request's order. */
export interface ILabelInkReply {
  id: number;
  levels: Float32Array;
}
