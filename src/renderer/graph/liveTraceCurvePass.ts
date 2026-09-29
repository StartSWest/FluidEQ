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
import { type RefObject } from 'react';
import {
  getWaveTransform,
  type IEuphoriaPaint,
  resolveFigureStroke,
  resolveTracePaint,
  TracePaint,
} from './liveTracePaint';
import createBubblePaths from './bubblePaths';
import createDotPaths from './dotPaths';
import { SEA_SCALE } from './figureGlow';
import { setAlpha, toCanvasPaint } from './liveTraceStyle';
import { bubbleShake, type IBolt } from './bubbleStorm';
import { type createPulsePaths, type IEcho, pulseShake } from './pulseMonitor';
import {
  type createRainstormPaths,
  type Rainstorm,
  stormShake,
} from './rainstorm';
import { invasionShake, type SpaceInvasion } from './spaceInvasion';
import {
  paintBubbles,
  paintDashTrails,
  paintEchoWaves,
  paintPulseBeam,
  paintPulseGrid,
  paintSawtoothTrace,
  paintScatter,
} from './liveTraceSignalLooks';
import {
  paintCity,
  paintCrystals,
  paintField,
  paintStage,
  paintValley,
  strokeCity,
  strokeCrystals,
  strokeStage,
  strokeValley,
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
import { paintInvasion, strokeInvasion } from './liveTraceInvasionScene';
import { paintCave, strokeCave } from './liveTraceCaveScene';
import { paintTrussScenery, strokeTrussBridge } from './liveTraceTrussScene';
import {
  paintRoadLandscape,
  paintRoadLine,
  strokeRoadLandscape,
  strokeRoadLine,
} from './liveTraceRoadScene';
import { paintTerraceJumper } from './terraceJumper';
import { type ILiveCurveData } from './ChartController';
import { type createSpaceInvasionPaths } from './spaceInvasionLayout';
import { type createBubbleMotePaths } from './bubbleMotes';
import { type createSlopeFieldPaths } from './slopeField';
import { type createCitySkylinePaths } from './citySkyline';
import { type createTerraceValleyPaths } from './terraceValley';
import { type createCrystalSpikesPaths } from './crystalSpikes';
import { type createBraidStagePaths } from './braidStage';
import { type createCountryFencePaths } from './countryFence';
import { type createBonfirePaths } from './bonfire';
import { type createStoneArcadePaths } from './stoneArcade';
import { type createWarpTunnelPaths } from './warpTunnel';
import { type createCaveDripsPaths } from './caveDrips';
import { type createTrussBridgePaths } from './trussBridgeLayout';
import { type createRoadTripPaths } from './roadTrip';
import { type createEchoWavePaths } from './echoWaves';
import { type ILookTuning } from '../../common/customLooks';
import { type IGraphMotionState } from './graphMotion';
import { type ResolvedGraphPalette } from '../../common/graphStyles';
import { type NightSurfaces } from './terraceNight';
import { type IGhost, type ISpark } from './sawtoothScope';

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
    | 'terrace'
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
    | 'truss'
    | 'zipper'
    | 'slope'
    | 'stalactites'
    | 'bubbles'
    | 'diamonds'
    | 'sawtooth'
    | 'ecg'
    | 'echo'
    | 'racer'
    | 'invaders'
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
  motionRef: RefObject<IGraphMotionState>;
  isFilled: boolean;
  bubbleStormRef: RefObject<{
    levels: number[];
    beatLevel: number;
    trackedAt: number;
    pops: Map<number, number>;
    bolts: IBolt[];
    shakeAt: number;
    shakeStrength: number;
  }>;
  figure: Path2D;
  context: CanvasRenderingContext2D;
  seaCanvasRef: RefObject<HTMLCanvasElement | null>;
  canvas: HTMLCanvasElement;
  height: number;
  needsOutside: boolean;
  figureStrokeWidth: number;
  sceneBase: number;
  pulsePaths: ReturnType<typeof createPulsePaths> | undefined;
  pulseMonitorRef: RefObject<{
    beatLevel: number;
    trackedAt: number;
    thumpAt: number;
    thumpStrength: number;
    echoes: IEcho[];
  }>;
  stormPaths: ReturnType<typeof createRainstormPaths> | undefined;
  stormRef: RefObject<Rainstorm>;
  stormClockRef: RefObject<number>;
  invasionPaths: ReturnType<typeof createSpaceInvasionPaths> | undefined;
  invasionRef: RefObject<SpaceInvasion>;
  invasionClockRef: RefObject<number>;
  overflowsPlot: boolean;
  depth: number;
  paintPalette: ResolvedGraphPalette;
  paintColours: readonly string[];
  scenePlot: { left: number; right: number; top: number; bottom: number };
  energy: number;
  dashTrails: { path: Path2D; opacity: number; width: number }[] | undefined;
  opacity: number;
  strokeWidth: number;
  pulseGrid: { fine: Path2D; heavy: Path2D } | undefined;
  motePaths: ReturnType<typeof createBubbleMotePaths> | undefined;
  fieldPaths: ReturnType<typeof createSlopeFieldPaths> | undefined;
  cityPaths: ReturnType<typeof createCitySkylinePaths> | undefined;
  nightRef: RefObject<NightSurfaces>;
  ratio: number;
  valleyPaths: ReturnType<typeof createTerraceValleyPaths> | undefined;
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
  shelterPath: Path2D | undefined;
  cavePaths: ReturnType<typeof createCaveDripsPaths> | undefined;
  caveOwnColours: boolean;
  trussPaths: ReturnType<typeof createTrussBridgePaths> | undefined;
  roadPaths: ReturnType<typeof createRoadTripPaths> | undefined;
  connector: Path2D | undefined;
  blinkingSatellites: boolean | undefined;
  terraceTiers: { body: Path2D; edge: Path2D; opacity: number }[] | undefined;
  isFluidForm: boolean;
  fluidLeft: number;
  fluidRight: number;
  fluidBarsRef: RefObject<number[]>;
  isEuphoric: boolean;
  fluidOwnColours: boolean;
  piecePaths: { path: Path2D; energy: number }[] | undefined;
  echoPaths: ReturnType<typeof createEchoWavePaths> | undefined;
  sawTrace: Path2D | undefined;
  sawtoothScopeRef: RefObject<{
    ghosts: IGhost[];
    beatLevel: number;
    trackedAt: number;
    flareAt: number;
    sparks: ISpark[];
  }>;
  terraceJumper: { x: number; y: number; direction: number } | undefined;
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
 * Every curve of the frame, each painted in its own band: the sea and the
 * halo under it, the scene's scenery, the figure, the accents and the
 * look's stroke over it — each layer in the functions named for it.
 */
const paintCurves = ({
  curves,
  baseline,
  plot,
  chosen,
  projected,
  tuning,
  motionRef,
  isFilled,
  bubbleStormRef,
  figure,
  context,
  seaCanvasRef,
  canvas,
  height,
  needsOutside,
  figureStrokeWidth,
  sceneBase,
  pulsePaths,
  pulseMonitorRef,
  stormPaths,
  stormRef,
  stormClockRef,
  invasionPaths,
  invasionRef,
  invasionClockRef,
  overflowsPlot,
  depth,
  paintPalette,
  paintColours,
  scenePlot,
  energy,
  dashTrails,
  opacity,
  strokeWidth,
  pulseGrid,
  motePaths,
  fieldPaths,
  cityPaths,
  nightRef,
  ratio,
  valleyPaths,
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
  shelterPath,
  cavePaths,
  caveOwnColours,
  trussPaths,
  roadPaths,
  connector,
  blinkingSatellites,
  terraceTiers,
  isFluidForm,
  fluidLeft,
  fluidRight,
  fluidBarsRef,
  isEuphoric,
  fluidOwnColours,
  piecePaths,
  echoPaths,
  sawTrace,
  sawtoothScopeRef,
  terraceJumper,
  isEuphoriaEdge,
  roadTripRef,
}: IPaintCurvesInput) => {
  curves.forEach((curve, curveIndex) => {
    const wave = getWaveTransform(curve, baseline, plot.top);
    const bubblePaths =
      chosen === 'bubbles' && wave.scaleY !== 0
        ? createBubblePaths(
            toColumns(projected, tuning.columns),
            plot.top,
            baseline,
            Math.abs(wave.scaleY),
            motionRef.current.travel[0] ?? 0,
            tuning.gap,
            isFilled,
            bubbleStormRef.current,
          )
        : undefined;
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
    const dots = bubblePaths ?? dotPaths;
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
     * Paint something big and soft at a third of the resolution.
     *
     * A screen of translucent fill is what these scenes cost to
     * raster — the bridge's sea and the echo's rows of water each held
     * their look at three times the frame budget on a 1440p display
     * while the profile showed the script idle. Painted on a surface a
     * third the size under the same transform and stretched back over
     * this one, the blending is a ninth of the pixels and the result
     * is water, which has no edges to lose. Without a surface (a
     * context lost, a canvas that will not give one) the caller's own
     * drawing runs here at full cost.
     */
    const paintLowRes = (draw: (target: CanvasRenderingContext2D) => void) => {
      const scale = SEA_SCALE;
      const surface = seaCanvasRef.current ?? document.createElement('canvas');
      seaCanvasRef.current = surface;
      const surfaceWidth = Math.max(1, Math.ceil(canvas.width * scale));
      const surfaceHeight = Math.max(1, Math.ceil(canvas.height * scale));
      if (surface.width !== surfaceWidth || surface.height !== surfaceHeight) {
        surface.width = surfaceWidth;
        surface.height = surfaceHeight;
      }
      const surface2d = surface.getContext('2d');
      if (!surface2d) {
        draw(context);
        return;
      }
      const base = context.getTransform();
      surface2d.setTransform(1, 0, 0, 1, 0, 0);
      surface2d.clearRect(0, 0, surfaceWidth, surfaceHeight);
      surface2d.save();
      surface2d.setTransform(
        base.a * scale,
        base.b * scale,
        base.c * scale,
        base.d * scale,
        base.e * scale,
        base.f * scale,
      );
      draw(surface2d);
      surface2d.restore();
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.imageSmoothingEnabled = true;
      setAlpha(context, 1);
      context.drawImage(surface, 0, 0, canvas.width, canvas.height);
      context.restore();
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
    if (chosen === 'bubbles') {
      const shake = bubbleShake(
        bubbleStormRef.current,
        motionRef.current.travel[0] ?? 0,
      );
      context.translate(shake.x, shake.y);
    }
    if (pulsePaths) {
      const shake = pulseShake(
        pulseMonitorRef.current,
        motionRef.current.travel[0] ?? 0,
      );
      context.translate(shake.x, shake.y);
    }
    if (stormPaths) {
      // Thunder.
      const shake = stormShake(stormRef.current, stormClockRef.current);
      context.translate(shake.x, shake.y);
    }
    if (invasionPaths) {
      // A bolt landing on the ship rocks the whole screen.
      const shake = invasionShake(
        invasionRef.current,
        invasionClockRef.current,
      );
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

    paintPulseGrid({
      pulseGrid,
      curveIndex,
      pulseMonitorRef,
      motionRef,
      context,
      canvasPaint,
      opacity,
      pulsePaths,
      plot,
      height,
    });
    if (motePaths) {
      // Small dots drifting up over the whole screen, in the look's
      // own colour. Nothing is painted behind them.
      enterSceneSpace();
      context.fillStyle = canvasPaint;
      motePaths.bands.forEach((band) => {
        setAlpha(context, opacity * band.alpha);
        context.fill(band.path);
      });
      context.restore();
    }
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
    paintValley({
      valleyPaths,
      isFilled,
      enterSceneSpace,
      context,
      opacity,
      nightRef,
      ratio,
      plot,
      sceneBase,
      sceneTop,
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
    paintInvasion({
      invasionPaths,
      context,
      opacity,
      isFilled,
      shelterPath,
      canvasPaint,
    });
    paintCave({
      cavePaths,
      caveOwnColours,
      canvasPaint,
      isFilled,
      context,
      opacity,
      sceneBase,
    });
    paintTrussScenery({
      trussPaths,
      context,
      opacity,
      canvasPaint,
      strokeWidth,
      plot,
      paintLowRes,
      isFilled,
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
      terraceTiers,
      valleyPaths,
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
      trussPaths,
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
    });
    paintBubbles({ bubblePaths, context, canvasPaint, opacity });
    paintEchoWaves({
      echoPaths,
      context,
      sceneBase,
      opacity,
      plot,
      canvasPaint,
      tuning,
    });
    paintPulseBeam({
      pulsePaths,
      motionRef,
      pulseMonitorRef,
      depth,
      context,
      canvasPaint,
      opacity,
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
    strokeValley({ valleyPaths, context, opacity });
    if (terraceJumper) {
      setAlpha(context, opacity);
      paintTerraceJumper(context, terraceJumper, plot.right - plot.left, depth);
    }
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
      pulsePaths,
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
    strokeInvasion({ invasionPaths, context, opacity });
    strokeCave({
      cavePaths,
      isFilled,
      context,
      opacity,
      canvasPaint,
      caveOwnColours,
    });
    strokeTrussBridge({
      trussPaths,
      context,
      opacity,
      figure,
      isFilled,
      canvasPaint,
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
