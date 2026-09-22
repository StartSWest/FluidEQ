/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ColorEnum } from '../styles/color';
import type { TWaveOrientation } from '../utils/graphViewSettings';
import type { ILiveCurveData } from './ChartController';

interface ILiveTraceWave {
  orientation: TWaveOrientation;
  /** How much of its depth the wave uses, and where its baseline stands. */
  height: number;
  position: number;
  opacity: number;
}

/**
 * How to draw the live trace — the copies of it and which way up each is —
 * for the graph and for anything else that draws the graph's look, so a
 * mirrored wave is mirrored the same way everywhere it is drawn.
 */
const liveTraceCurves = ({
  orientation,
  height,
  position,
  opacity,
}: ILiveTraceWave): ILiveCurveData[] => {
  const isHalfHeight = orientation === 'mirrored' || orientation === 'centred';
  const copy = {
    isHalfHeight,
    isFromCentre: orientation === 'centred',
    heightScale: height,
    verticalPosition: position,
    colour: ColorEnum.ANALOGOUS2,
    opacity,
  };
  return [
    // Hanging from the top, or mirrored below as well. Drawn first so the
    // upright copy lands over it.
    ...(isHalfHeight ? [{ ...copy, isFlipped: true }] : []),
    { ...copy, isFlipped: orientation === 'down' },
  ];
};

export default liveTraceCurves;
