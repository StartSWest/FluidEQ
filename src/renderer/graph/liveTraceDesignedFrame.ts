/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { type GraphStyle, type ResolvedGraphPalette } from 'common/graphStyles';
import { type RefObject } from 'react';
import {
  getWaveTransform,
  type IEuphoriaPaint,
  resolveFigureStroke,
  resolveTracePaint,
  type TracePaint,
} from './liveTracePaint';
import {
  designedShake,
  stepDesignedLook,
  type TDesignedScene,
} from './engineLooks/designed/designedLooks';
import { toCanvasPaint } from './liveTraceStyle';
import { hasGraphAmbientMotion } from './graphMotion';
import { type ILiveCurveData } from './ChartController';
import { type IEngineLookInput } from './engineLooks/engineLookInput';
import { type GraphLookTransition } from './graphLookTransition';
import { type ILookTuning } from '../../common/customLooks';

// A designed look's frame on the live graph: its layers painted in their
// own order over the page, then the frame ends.

interface IDrawDesignedFrameInput {
  designed: TDesignedScene;
  paintPalette: ResolvedGraphPalette;
  paintColours: readonly string[];
  curves: ILiveCurveData[];
  scenePlot: { left: number; right: number; top: number; bottom: number };
  energy: number;
  engineInputFor: (style: GraphStyle) => IEngineLookInput;
  chosen: GraphStyle;
  width: number;
  height: number;
  plot: { left: number; right: number; top: number; bottom: number };
  baseline: number;
  depth: number;
  sceneTop: number;
  sceneBase: number;
  isFilled: boolean;
  tuning: ILookTuning;
  isSelfColoured: boolean;
  euphoria: IEuphoriaPaint;
  opacity: number;
  strokeWidth: number;
  haloPath: Path2D | undefined;
  lit: number;
  swell: number;
  isHanding: boolean;
  context: CanvasRenderingContext2D;
  paintPeaks: (
    canvasPaint: string | CanvasGradient,
    basePaint: TracePaint,
    paintFor: (paint: TracePaint) => string | CanvasGradient,
  ) => void;
  transitionRef: RefObject<GraphLookTransition>;
  now: number;
  blankRef: RefObject<boolean>;
  moving: boolean;
  isEuphoric: boolean;
}

/**
 * A designed look's layers for this frame, when the look is one: what the
 * frame returns, or undefined for any other look.
 */
const drawDesignedFrame = ({
  designed,
  paintPalette,
  paintColours,
  curves,
  scenePlot,
  energy,
  engineInputFor,
  chosen,
  width,
  height,
  plot,
  baseline,
  depth,
  sceneTop,
  sceneBase,
  isFilled,
  tuning,
  isSelfColoured,
  euphoria,
  opacity,
  strokeWidth,
  haloPath,
  lit,
  swell,
  isHanding,
  context,
  paintPeaks,
  transitionRef,
  now,
  blankRef,
  moving,
  isEuphoric,
}: IDrawDesignedFrameInput) => {
  const basePaint = resolveTracePaint(
    paintPalette,
    paintColours,
    curves[0].colour,
    scenePlot,
    energy,
  );
  const input = engineInputFor(chosen);
  const shake = designedShake(designed);
  stepDesignedLook(
    {
      window: { width, height },
      plot,
      baseline,
      depth,
      sceneTop,
      sceneBase,
      copies: curves.map((curve) =>
        getWaveTransform(curve, baseline, plot.top),
      ),
      shake,
      paint: basePaint,
      glowPaint:
        resolveFigureStroke(
          basePaint,
          isFilled,
          tuning.border,
          isSelfColoured,
          euphoria,
        ) ?? basePaint,
      opacity,
      strokeWidth,
      filled: isFilled,
      fillOpacity: tuning.fillOpacity,
      lit: haloPath ? lit : 0,
      swell,
    },
    designed,
    input,
  );
  if (isHanding) {
    // Kept going until the engine shows a frame of this layout.
    return true;
  }
  // The lit peaks over the engine's picture, in each copy's scene
  // space, as the curve loop below paints them over the page's.
  if (tuning.accents) {
    curves.forEach((curve) => {
      const wave = getWaveTransform(curve, baseline, plot.top);
      if (wave.scaleY === 0) {
        return;
      }
      const curvePaint = resolveTracePaint(
        paintPalette,
        paintColours,
        curve.colour,
        scenePlot,
        energy,
      );
      context.save();
      context.translate(shake.x, shake.y + wave.translateY);
      context.scale(1, wave.scaleY / Math.abs(wave.scaleY));
      const curveInk = toCanvasPaint(context, curvePaint);
      paintPeaks(curveInk, curvePaint, (paint) =>
        paint === curvePaint ? curveInk : toCanvasPaint(context, paint),
      );
      context.restore();
    });
  }
  const settling = transitionRef.current.paint(context, now);
  blankRef.current = !settling && !tuning.accents;
  return (
    settling ||
    moving ||
    hasGraphAmbientMotion(chosen) ||
    (isEuphoric && tuning.border)
  );
};

export default drawDesignedFrame;
