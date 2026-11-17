/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The title bar meter, flat, in all twenty-one styles (Ivan, 2026-11-16: "do
 * all of them, flat and the 10 new ones", from the mockup of 11-15).
 *
 * Flat means the Library's language on a meter: one thin line where there is
 * a line (1.25 to 1.75 px), one quiet tint where there is a body (14 to 18%),
 * pieces on whole device pixels with even gaps and softly rounded ends, and
 * the pale accent only where something peaks — a held tick, the top cell, a
 * bead. Nothing is drawn twice, nothing glows.
 *
 * Painted straight onto the canvas at the pane's real size rather than built
 * as path data in the shape module's fixed box: a gap is only even when it is
 * counted in device pixels, and a stretched box cannot say how wide one is.
 * The EQ graph's own forms still come from `createWaveformShape`.
 */
import type {
  IFlatMeterInput,
  TFlatWaveformStyle,
  TPainter,
} from './waveformFlatKit';
import CLASSIC_PAINTERS from './waveformFlatClassic';
import NEW_PAINTERS from './waveformFlatNew';

const PAINTERS: Record<TFlatWaveformStyle, TPainter> = {
  ...CLASSIC_PAINTERS,
  ...NEW_PAINTERS,
};

/** One frame of the meter in its style. Leaves the context's alpha at 1. */
const paintFlatMeter = (
  context: CanvasRenderingContext2D,
  input: IFlatMeterInput,
): void => {
  context.globalAlpha = 1;
  PAINTERS[input.style](context, input);
  context.globalAlpha = 1;
};

export default paintFlatMeter;
