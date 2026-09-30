/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IChartPointData } from './ChartController';
import { PREVIEW_REACHED_DB } from './liveTraceStyle';

/**
 * The trace's drawn copy, eased one frame toward the frame measured, in
 * place: each level by `rise` going up and by `fall` coming down, and each
 * point's place on the axis taken as it is.
 *
 * `moving` while any level has yet to arrive, which keeps the frame loop
 * running; `rising` while any is still more than `PREVIEW_REACHED_DB` short,
 * which is what holds a look preview until it has been painted in full.
 */
const easeTraceToward = (
  eased: IChartPointData[],
  data: readonly IChartPointData[],
  rise: number,
  fall: number,
): { moving: boolean; rising: boolean } => {
  let moving = false;
  let rising = false;
  for (let index = 0; index < eased.length; index += 1) {
    // Where a point is on the axis is the frame's, never eased: the copy
    // used to keep the frequencies of the points it was first made from
    // and was rebuilt only when their number changed, so after a look
    // preview laid out on another axis the whole spectrum was drawn at
    // the preview's frequencies — squeezed into 20 Hz to 20 kHz.
    eased[index].x = data[index].x;
    const distance = data[index].y - eased[index].y;
    if (distance > PREVIEW_REACHED_DB) {
      rising = true;
    }
    // In decibels, and a twentieth of one is far below what a pixel on
    // this graph can show. Tighter than this and the loop never settles:
    // something among three hundred points is always drifting, so it
    // would redraw sixty times a second through silence.
    if (distance > 0.05 || distance < -0.05) {
      eased[index].y += distance * (distance > 0 ? rise : fall);
      moving = true;
    } else {
      eased[index].y = data[index].y;
    }
  }
  return { moving, rising };
};

export default easeTraceToward;
