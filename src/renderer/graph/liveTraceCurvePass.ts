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

import { toColumns } from 'common/graphShapes';
import { type Projected, type ResolvedGraphPalette } from 'common/graphStyles';
import { type RefObject } from 'react';
import { heatColour } from './lookColours';
import {
  getWaveTransform,
  type IEuphoriaPaint,
  resolveFigureStroke,
  resolveTracePaint,
  TracePaint,
} from './liveTracePaint';
import createDotPaths from './dotPaths';
import { setAlpha, toCanvasPaint } from './liveTraceStyle';
import {
  type createRainstormPaths,
  type Rainstorm,
  stormShake,
} from './rainstorm';
import {
  paintDashTrails,
  paintEchoWaves,
  paintSawtoothTrace,
  paintScatter,
} from './liveTraceSignalLooks';
import {
  paintCity,
  outlineTowers,
  paintCrystals,
  paintField,
  paintStage,
  strokeCity,
  strokeCrystals,
  strokeStage,
} from './liveTraceTownScenes';
import {
  paintAccentBehind,
  paintFillTexture,
  paintHalo,
  strokeFigure,
} from './liveTraceFigureLayers';
import { paintFence, strokeFence } from './liveTraceFenceScene';
import {
  paintBonfire,
  paintStorm,
  strokeBonfire,
  strokeStorm,
} from './liveTraceWeatherScenes';
import { paintArcade, paintWarp, strokeArcade } from './liveTraceArcadeScenes';
import { paintCave, strokeCave } from './liveTraceCaveScene';
import {
  paintRoadLandscape,
  paintRoadLine,
  strokeRoadLandscape,
  strokeRoadLine,
} from './liveTraceRoadScene';
import { type ILiveCurveData } from './ChartController';
import { type createSlopeFieldPaths } from './slopeField';
import { type createCitySkylinePaths } from './citySkyline';
import { type createCrystalSpikesPaths } from './crystalSpikes';
import { type createBraidStagePaths } from './braidStage';
import { type createCountryFencePaths } from './countryFence';
import { type createBonfirePaths } from './bonfire';
import { type createStoneArcadePaths } from './stoneArcade';
import { type createWarpTunnelPaths } from './warpTunnel';
import { type createCaveDripsPaths } from './caveDrips';
import { type createRoadTripPaths } from './roadTrip';
import { type createEchoWavePaths } from './echoWaves';
import { type ILookTuning } from '../../common/customLooks';
import { type IGraphMotionState } from './graphMotion';
import { type NightSurfaces } from './nightSurfaces';
import { type IGhost, type ISpark } from './sawtoothScope';
import type { ITexturePose } from './textureMotion';

// The live graph's pass over its curves: for each copy of the figure, the
// scenery behind it, the figure itself and whatever the look draws over it,
// in the order they stack. Handed everything the frame has measured and
// built before it; paints and keeps nothing.

interface IPaintCurvesInput {
  curves: ILiveCurveData[];
  baseline: number;
  plot: { left: number; right: number; top: number; bottom: number };
  chosen:
    | 'line'
    | 'area'
    | 'bars'
    | 'dots'
    | 'steps'
    | 'blocks'
    | 'spikes'
    | 'ridge'
    | 'stems'
    | 'dashes'
    | 'scatter'
    | 'caps'
    | 'ribs'
    | 'pillars'
    | 'crown'
    | 'weave'
    | 'contour'
    | 'hatch'
    | 'matrix'
    | 'skyline'
    | 'bezier'
    | 'ribbon'
    | 'feather'
    | 'zipper'
    | 'slope'
    | 'stalactites'
    | 'diamonds'
    | 'sawtooth'
    | 'echo'
    | 'racer'
    | 'starfield'
    | 'candles'
    | 'arches'
    | 'flames'
    | 'barcode'
    | 'rain'
    | 'honeycomb'
    | 'fence'
    | 'braid'
    | 'stitch'
    | 'canyon'
    | 'fluid'
    | 'wave-line'
    | 'wave-filled'
    | 'wave-bars'
    | 'wave-mirror'
    | 'wave-dots'
    | 'wave-ribbon'
    | 'wave-spikes'
    | 'wave-blocks'
    | 'wave-outline'
    | 'wave-lattice';
  projected: [number, number][];
  tuning: ILookTuning;
  /** Where the music has moved the look's texture, where it moves. */
  texturePose: ITexturePose | undefined;
  motionRef: RefObject<IGraphMotionState>;
  isFilled: boolean;
  figure: Path2D;
  context: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  height: number;
  needsOutside: boolean;
  figureStrokeWidth: number;
  sceneBase: number;
  stormPaths: ReturnType<typeof createRainstormPaths> | undefined;
  stormRef: RefObject<Rainstorm>;
  stormClockRef: RefObject<number>;
  overflowsPlot: boolean;
  depth: number;
  paintPalette: ResolvedGraphPalette;
  paintColours: readonly string[];
  scenePlot: { left: number; right: number; top: number; bottom: number };
  energy: number;
  dashTrails: { path: Path2D; opacity: number; width: number }[] | undefined;
  opacity: number;
  strokeWidth: number;
  fieldPaths: ReturnType<typeof createSlopeFieldPaths> | undefined;
  cityPaths: ReturnType<typeof createCitySkylinePaths> | undefined;
  nightRef: RefObject<NightSurfaces>;
  ratio: number;
  sceneTop: number;
  haloPath: Path2D | undefined;
  isSelfColoured: boolean;
  euphoria: IEuphoriaPaint;
  scatterPaths: { primary: Path2D; secondary: Path2D } | undefined;
  stemLayers: { tips: Path2D; lines: Path2D[]; hot: Path2D } | undefined;
  haloCanvasRef: RefObject<HTMLCanvasElement | null>;
  lit: number;
  swell: number;
  paintPeaks: (
    canvasPaint: string | CanvasGradient,
    basePaint: TracePaint,
    paintFor: (paint: TracePaint) => string | CanvasGradient,
  ) => void;
  crystalPaths: ReturnType<typeof createCrystalSpikesPaths> | undefined;
  stagePaths: ReturnType<typeof createBraidStagePaths> | undefined;
  fencePaths: ReturnType<typeof createCountryFencePaths> | undefined;
  fenceOwnColours: boolean;
  stormOwnColours: boolean;
  firePaths: ReturnType<typeof createBonfirePaths> | undefined;
  fireOwnColours: boolean;
  arcadePaths: ReturnType<typeof createStoneArcadePaths> | undefined;
  arcadeOwnColours: boolean;
  warpPaths: ReturnType<typeof createWarpTunnelPaths> | undefined;
  cavePaths: ReturnType<typeof createCaveDripsPaths> | undefined;
  caveOwnColours: boolean;
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  connector: Path2D | undefined;
  blinkingSatellites: boolean | undefined;
  isFluidForm: boolean;
  fluidLeft: number;
  fluidRight: number;
  fluidBarsRef: RefObject<number[]>;
  isEuphoric: boolean;
  fluidOwnColours: boolean;
  piecePaths: { path: Path2D; energy: number }[] | undefined;
  figurePoints: Projected[];
  echoPaths: ReturnType<typeof createEchoWavePaths> | undefined;
  sawTrace: Path2D | undefined;
  sawtoothScopeRef: RefObject<{
    ghosts: IGhost[];
    beatLevel: number;
    trackedAt: number;
    flareAt: number;
    sparks: ISpark[];
  }>;
  isEuphoriaEdge: boolean;
  roadTripRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    flashAt: number;
    glow: number;
    hill: number[];
  }>;
}

/**
 * Every curve of the frame, each painted in its own band: the halo under
 * it, the scene's scenery, the figure, the accents and the
 * look's stroke over it — each layer in the functions named for it.
 */
const paintCurves = ({
  curves,
  baseline,
  plot,
  chosen,
  projected,
  tuning,
  texturePose,
  motionRef,
  isFilled,
  figure,
  context,
  canvas,
  height,
  needsOutside,
  figureStrokeWidth,
  sceneBase,
  stormPaths,
  stormRef,
  stormClockRef,
  overflowsPlot,
  depth,
  paintPalette,
  paintColours,
  scenePlot,
  energy,
  dashTrails,
  opacity,
  strokeWidth,
  fieldPaths,
  cityPaths,
  nightRef,
  ratio,
  sceneTop,
  haloPath,
  isSelfColoured,
  euphoria,
  scatterPaths,
  stemLayers,
  haloCanvasRef,
  lit,
  swell,
  paintPeaks,
  crystalPaths,
  stagePaths,
  fencePaths,
  fenceOwnColours,
  stormOwnColours,
  firePaths,
  fireOwnColours,
  arcadePaths,
  arcadeOwnColours,
  warpPaths,
  cavePaths,
  caveOwnColours,
  roadPaths,
  connector,
  blinkingSatellites,
  isFluidForm,
  fluidLeft,
  fluidRight,
  fluidBarsRef,
  isEuphoric,
  fluidOwnColours,
  piecePaths,
  figurePoints,
  echoPaths,
  sawTrace,
  sawtoothScopeRef,
  isEuphoriaEdge,
  roadTripRef,
}: IPaintCurvesInput) => {
  curves.forEach((curve) => {
    const wave = getWaveTransform(curve, baseline, plot.top);
    const dotPaths =
      chosen === 'dots' && wave.scaleY !== 0
        ? createDotPaths(
            toColumns(projected, tuning.columns),
            baseline,
            plot.top,
            tuning.gap,
            Math.abs(wave.scaleY),
            tuning.connectingLine,
          )
        : undefined;
    const dots = dotPaths;
    const curveFigure = dots?.shape ?? figure;
    // Everything a scene draws is in scene space: the wave's vertical
    // STRETCH undone but its flip kept, so a mirrored curve shows the
    // scene's reflection — cars and towers upside down in the lower
    // half, the way water would show them — rather than a squashed copy
    // or a second landscape.
    const enterSceneSpace = () => {
      context.save();
      context.scale(1, 1 / Math.abs(wave.scaleY));
    };
    /**
     * The whole canvas in this curve's scene space.
     *
     * A scene's sky is scenery, not the figure: it has to reach the top
     * of the window at every height setting, and the plot's own box
     * shrinks with the slider. Inverting this curve's placement gives
     * the rows the screen's edges land on.
     */
    const sceneFrame = (() => {
      const sign = wave.scaleY < 0 ? -1 : 1;
      const a = -wave.translateY / sign;
      const b = (height - wave.translateY) / sign;
      return { top: Math.min(a, b), bottom: Math.max(a, b) };
    })();
    let curveOutside: Path2D | undefined;
    if (needsOutside) {
      const bleed = figureStrokeWidth + 1;
      curveOutside = new Path2D();
      curveOutside.rect(
        plot.left - bleed,
        -bleed,
        plot.right - plot.left + bleed * 2,
        sceneBase + bleed * 2,
      );
      curveOutside.addPath(curveFigure);
    }
    context.save();
    if (stormPaths) {
      // Thunder.
      const shake = stormShake(stormRef.current, stormClockRef.current);
      context.translate(shake.x, shake.y);
    }
    context.translate(0, wave.translateY);
    context.scale(1, wave.scaleY);
    // Clipped in the figure's own space, exactly as the SVG clip path was:
    // it was referenced from inside the same transform, so a half-height
    // wave was already bounded to the half it is drawn in.
    // A scene is never cut off: a firework that bursts above the plot,
    // a spark that flies past its edge, a star in the margin, all of it
    // is allowed to overflow the plot's box. Everything else is clipped
    // to it as the SVG trace always was.
    if (!overflowsPlot) {
      context.beginPath();
      context.rect(plot.left, -depth, plot.right - plot.left, baseline + depth);
      context.clip();
    }

    // One descriptor, built once, so the halo and the tips can be tested
    // against it by identity and reuse the gradient the figure already has.
    const basePaint = resolveTracePaint(
      paintPalette,
      paintColours,
      curve.colour,
      // The scene's own box, because the figure is drawn in scene space:
      // handed the plot's, a level ramp spanned a taller box than the
      // figure filled and a short wave took the colours of the ramp's
      // top end only — every band red at a low height setting.
      scenePlot,
      // Only `heat` reads it, and for that one the loudness IS the colour.
      energy,
    );
    // Flat must stay one colour for Wave forms too. Geometry cannot
    // override the palette that the button and Edit panel report.
    const canvasPaint = toCanvasPaint(context, basePaint);
    const paintFor = (paint: TracePaint) =>
      paint === basePaint ? canvasPaint : toCanvasPaint(context, paint);
    paintDashTrails({
      dashTrails,
      enterSceneSpace,
      context,
      canvasPaint,
      opacity,
      strokeWidth,
    });

    paintField({
      fieldPaths,
      enterSceneSpace,
      context,
      canvasPaint,
      opacity,
      strokeWidth,
    });
    paintCity({
      cityPaths,
      enterSceneSpace,
      context,
      opacity,
      nightRef,
      ratio,
    });
    paintHalo({
      haloPath,
      paintFor,
      basePaint,
      isFilled,
      tuning,
      isSelfColoured,
      euphoria,
      dots,
      scatterPaths,
      stemLayers,
      haloCanvasRef,
      canvas,
      lit,
      strokeWidth,
      swell,
      context,
      overflowsPlot,
      plot,
      depth,
      baseline,
      wave,
      enterSceneSpace,
    });

    paintAccentBehind({
      tuning,
      context,
      wave,
      isFilled,
      chosen,
      plot,
      depth,
      curveFigure,
      paintPeaks,
      canvasPaint,
      basePaint,
      paintFor,
    });
    enterSceneSpace();

    paintCrystals({
      crystalPaths,
      isFilled,
      context,
      sceneBase,
      opacity,
      plot,
    });
    paintStage({
      stagePaths,
      context,
      canvasPaint,
      opacity,
      plot,
      sceneBase,
      figureStrokeWidth,
      figure,
    });
    paintFence({
      fencePaths,
      isFilled,
      context,
      sceneFrame,
      fenceOwnColours,
      opacity,
      canvasPaint,
    });
    paintStorm({
      stormPaths,
      stormOwnColours,
      canvasPaint,
      isFilled,
      context,
      opacity,
      sceneBase,
    });
    paintBonfire({
      firePaths,
      context,
      opacity,
      isFilled,
      sceneBase,
      fireOwnColours,
      canvasPaint,
    });
    paintArcade({
      arcadePaths,
      arcadeOwnColours,
      canvasPaint,
      context,
      opacity,
      isFilled,
      sceneBase,
    });
    paintWarp({ warpPaths, context, opacity, canvasPaint });
    paintCave({
      cavePaths,
      caveOwnColours,
      canvasPaint,
      isFilled,
      context,
      opacity,
      sceneBase,
    });
    paintRoadLine({ roadPaths, isFilled, context, canvasPaint, opacity });
    paintRoadLandscape({
      roadPaths,
      isFilled,
      context,
      opacity,
      canvasPaint,
      baseline,
    });
    if (connector) {
      context.fillStyle = canvasPaint;
      setAlpha(context, opacity * (isFilled ? tuning.fillOpacity : 1));
      context.fill(connector);
    }
    paintScatter({
      scatterPaths,
      context,
      canvasPaint,
      opacity,
      tuning,
      blinkingSatellites,
      stemLayers,
      isFluidForm,
      isFilled,
      fluidLeft,
      sceneTop,
      fluidRight,
      sceneBase,
      fluidBarsRef,
      isEuphoric,
      fluidOwnColours,
      paintPalette,
      paintColours,
      piecePaths,
      curveFigure,
    });
    paintFillTexture({
      isFilled,
      tuning,
      context,
      ratio,
      curveFigure,
      opacity,
      plot,
      texturePose,
    });
    outlineTowers({
      cityPaths,
      isFilled,
      context,
      figurePoints,
      sceneBase,
      sceneTop,
      tuning,
      basePaint,
      heat: piecePaths?.map((piece) => heatColour(paintColours, piece.energy)),
      ratio,
      opacity,
    });
    paintEchoWaves({
      echoPaths,
      context,
      sceneBase,
      opacity,
      plot,
      canvasPaint,
      tuning,
    });
    paintSawtoothTrace({
      sawTrace,
      sawtoothScopeRef,
      motionRef,
      context,
      canvasPaint,
      opacity,
      sceneBase,
      sceneTop,
    });
    strokeCity({ cityPaths, context, sceneBase, opacity, plot, isFilled });
    const figureStroke = resolveFigureStroke(
      basePaint,
      isFilled,
      tuning.border,
      isSelfColoured,
      euphoria,
    );
    strokeFigure({
      figureStroke,
      figureStrokeWidth,
      context,
      opacity,
      paintFor,
      curveOutside,
      curveFigure,
      isEuphoriaEdge,
      strokeWidth,
      canvasPaint,
    });

    strokeCrystals({ crystalPaths, isFilled, context, opacity });
    strokeStage({ stagePaths, context, opacity });
    strokeFence({
      fencePaths,
      fenceOwnColours,
      context,
      opacity,
      isFilled,
    });
    strokeStorm({ stormPaths, context, opacity, plot, sceneFrame });
    strokeBonfire({
      firePaths,
      context,
      opacity,
      isFilled,
      fireOwnColours,
      canvasPaint,
    });
    strokeArcade({
      arcadePaths,
      arcadeOwnColours,
      canvasPaint,
      isFilled,
      context,
      opacity,
    });
    strokeCave({
      cavePaths,
      isFilled,
      context,
      opacity,
      canvasPaint,
      caveOwnColours,
    });
    strokeRoadLine({
      roadPaths,
      isFilled,
      roadTripRef,
      context,
      canvasPaint,
      opacity,
    });
    strokeRoadLandscape({
      roadPaths,
      isFilled,
      roadTripRef,
      context,
      baseline,
      opacity,
      figure,
      canvasPaint,
    });
    if (!tuning.accentBehind) {
      paintPeaks(canvasPaint, basePaint, paintFor);
    }
    context.restore();

    context.restore();
  });
};

export default paintCurves;
