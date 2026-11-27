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

import { STEM_FADE_LEVELS } from 'common/graphStems';
import { type RefObject } from 'react';
import { setAlpha } from './liveTraceStyle';
import { isLightWindow } from '../utils/windowSide';
import { markFill, sheenFill } from './sceneViews/sceneFrame';
import {
  paintSpectrumBars,
  SPECTRUM_HUE_BY_PALETTE,
  SPECTRUM_HUE_FLAT,
} from '../waveformPaint';
import { tintedSpectrumHue } from '../utils/sceneAccentRamp';
import { createFluidBarPaint, heatColour } from './lookColours';
import {
  createSparkPath,
  ghostGlow,
  type IGhost,
  type ISpark,
  sawtoothFlare,
} from './sawtoothScope';
import { type createEchoWavePaths } from './echoWaves';
import { type IGraphMotionState } from './graphMotion';
import { type ILookTuning } from '../../common/customLooks';
import { type ResolvedGraphPalette } from '../../common/graphStyles';

// The live graph's instrument looks: the sawtooth scope, the echo waves,
// the dash trails and the scatter plot.

interface IPaintDashTrailsInput {
  dashTrails: { path: Path2D; opacity: number; width: number }[] | undefined;
  enterSceneSpace: () => void;
  context: CanvasRenderingContext2D;
  canvasPaint: string | CanvasGradient;
  opacity: number;
  strokeWidth: number;
}

/**
 * The trails the dashes leave behind them.
 */
export const paintDashTrails = ({
  dashTrails,
  enterSceneSpace,
  context,
  canvasPaint,
  opacity,
  strokeWidth,
}: IPaintDashTrailsInput) => {
  if (dashTrails) {
    // In scene space, where they are built, as the figure they trail
    // is: in the wave's they were squashed by the height slider a
    // second time and fell away from the marks below 100%.
    enterSceneSpace();
    context.strokeStyle = canvasPaint;
    dashTrails.forEach((trail) => {
      setAlpha(context, opacity * trail.opacity);
      context.lineWidth = strokeWidth * trail.width;
      context.stroke(trail.path);
    });
    context.restore();
  }
};

interface IPaintScatterInput {
  scatterPaths: { primary: Path2D; secondary: Path2D } | undefined;
  context: CanvasRenderingContext2D;
  canvasPaint: string | CanvasGradient;
  opacity: number;
  tuning: ILookTuning;
  blinkingSatellites: boolean | undefined;
  stemLayers: { tips: Path2D; lines: Path2D[]; hot: Path2D } | undefined;
  isFluidForm: boolean;
  isFilled: boolean;
  fluidLeft: number;
  sceneTop: number;
  fluidRight: number;
  sceneBase: number;
  fluidBarsRef: RefObject<number[]>;
  isEuphoric: boolean;
  fluidOwnColours: boolean;
  paintPalette: ResolvedGraphPalette;
  paintColours: readonly string[];
  piecePaths: { path: Path2D; energy: number }[] | undefined;
  curveFigure: Path2D;
}

/**
 * The scatter plot's points.
 */
export const paintScatter = ({
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
}: IPaintScatterInput) => {
  if (scatterPaths) {
    context.fillStyle = canvasPaint;
    setAlpha(context, opacity * tuning.fillOpacity * 0.38);
    if (!blinkingSatellites) {
      context.fill(scatterPaths.secondary);
    }
    setAlpha(context, opacity * tuning.fillOpacity);
    context.fill(scatterPaths.primary);
  } else if (stemLayers) {
    context.fillStyle = canvasPaint;
    stemLayers.lines.forEach((path, level) => {
      const fade = 1 - (level + 0.5) / STEM_FADE_LEVELS;
      setAlpha(
        context,
        opacity * tuning.fillOpacity * (0.03 + 0.48 * fade * fade),
      );
      context.fill(path);
    });
    // The heads glow in their own colour, and the ones on the beat
    // flare: a wider halo and a white core that the fill cannot give.
    context.strokeStyle = canvasPaint;
    context.lineJoin = 'round';
    context.lineWidth = 5;
    setAlpha(context, opacity * 0.28);
    context.stroke(stemLayers.tips);
    context.lineWidth = 14;
    setAlpha(context, opacity * 0.5);
    context.stroke(stemLayers.hot);
    setAlpha(context, opacity * tuning.fillOpacity);
    context.fill(stemLayers.tips);
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.85);
    context.fill(stemLayers.hot);
  } else if (isFluidForm && isFilled) {
    // The titlebar's own bars, from the titlebar's own painter. The hue
    // sweep is the form's own fill — it is what makes this drawing this
    // drawing — but WHETHER it is filled, and how solidly, are settings
    // like anywhere else.
    setAlpha(context, opacity * tuning.fillOpacity);
    paintSpectrumBars(
      context,
      {
        x: fluidLeft,
        y: sceneTop,
        width: fluidRight - fluidLeft,
        height: sceneBase - sceneTop,
      },
      fluidBarsRef.current,
      isEuphoric,
      /**
       * Under Auto these are the titlebar's bars in the titlebar's own
       * colour — the short cyan-to-violet sweep it was drawn with, and
       * the accent's tint over it where the window is tinted. Not one
       * of the palettes: the fluid is the titlebar's drawing, and run
       * through the rainbow map its bars came out as a second spectrum
       * competing with the wave over them.
       *
       * Choose a palette and it is honoured, as everywhere else: the
       * hue then comes from position or from the bar's own loudness.
       */
      fluidOwnColours
        ? tintedSpectrumHue(SPECTRUM_HUE_FLAT)
        : SPECTRUM_HUE_BY_PALETTE[paintPalette],
      tuning.gap,
      // Level is a meter: the ramp is pinned to the plot and each bar
      // shows its own slice of it, so a colour is a decibel.
      fluidOwnColours
        ? undefined
        : createFluidBarPaint(
            context,
            paintPalette,
            paintColours,
            sceneTop,
            sceneBase,
          ),
    );
  } else if (isFilled && piecePaths) {
    /**
     * A colour per piece, for the palette that has one to give.
     *
     * Heat's colour is how loud a thing is, and on a form made of
     * pieces the thing is the piece — so one fill for the whole figure
     * answers a question nobody asked and lights every bar at once.
     * That is the difference the fluid always had over the rest, and
     * it had it only because it is painted rather than pathed.
     *
     * Asked for only here, and only for this palette: the other three
     * colour by POSITION, which a gradient over one path already does
     * correctly and far more cheaply.
     */
    setAlpha(context, opacity * tuning.fillOpacity);
    piecePaths.forEach((piece) => {
      context.fillStyle = heatColour(paintColours, piece.energy);
      context.fill(piece.path);
    });
  } else if (isFilled) {
    // The fill and the stroke are composited separately here, where SVG
    // composited the element as a group. The only place the two differ is
    // the sliver where a translucent stroke sits over its own fill, and
    // buying that back would mean an offscreen layer per frame.
    setAlpha(context, opacity * tuning.fillOpacity);
    context.fillStyle = canvasPaint;
    context.fill(curveFigure);
  }
};

interface IPaintEchoWavesInput {
  echoPaths: ReturnType<typeof createEchoWavePaths> | undefined;
  context: CanvasRenderingContext2D;
  sceneBase: number;
  opacity: number;
  plot: { left: number; right: number; top: number; bottom: number };
  canvasPaint: string | CanvasGradient;
  tuning: ILookTuning;
}

/**
 * The echo waves, each fainter than the one before it.
 */
export const paintEchoWaves = ({
  echoPaths,
  context,
  sceneBase,
  opacity,
  plot,
  canvasPaint,
  tuning,
}: IPaintEchoWavesInput) => {
  if (echoPaths) {
    // The plane the waves roll across: rails to the vanishing point,
    // fading out as they reach it, so the distance the projection
    // describes is something you can see rather than infer.
    const rails = context.createLinearGradient(
      0,
      echoPaths.horizon,
      0,
      sceneBase,
    );
    rails.addColorStop(0, markFill(0));
    rails.addColorStop(1, markFill(0.16));
    context.strokeStyle = rails;
    context.lineWidth = 1;
    setAlpha(context, opacity * (0.5 + echoPaths.bass * 0.5));
    context.stroke(echoPaths.rails);
    // The bloom on the horizon, swelling with the bass, and a haze
    // above it so the far half of the scene is sky and not a void.
    const bloom = context.createLinearGradient(
      0,
      echoPaths.horizon - echoPaths.bloom,
      0,
      echoPaths.horizon + echoPaths.bloom * 0.5,
    );
    // None on a light window, where it is daylight already and drawn in
    // ink it read as a smudge across the plot.
    const hazeAlpha = isLightWindow() ? 0 : 0.14;
    bloom.addColorStop(0, markFill(0));
    bloom.addColorStop(0.66, markFill(hazeAlpha));
    bloom.addColorStop(1, markFill(0));
    context.fillStyle = bloom;
    setAlpha(context, opacity * (0.55 + echoPaths.bass * 0.45));
    context.fillRect(
      plot.left,
      echoPaths.horizon - echoPaths.bloom,
      plot.right - plot.left,
      echoPaths.bloom * 1.5,
    );
    // The horizon the waves roll toward: a faint line, brightest
    // in the middle where they converge.
    const glow = context.createLinearGradient(plot.left, 0, plot.right, 0);
    glow.addColorStop(0, markFill(0));
    glow.addColorStop(0.5, markFill(0.35));
    glow.addColorStop(1, markFill(0));
    context.strokeStyle = glow;
    context.lineWidth = 1;
    setAlpha(context, opacity);
    const horizon = new Path2D();
    horizon.moveTo(plot.left, echoPaths.horizon);
    horizon.lineTo(plot.right, echoPaths.horizon);
    context.stroke(horizon);
    // Back to front: each past row dimmer and thinner with depth, a
    // beat's row heavier and brighter all the way back. Drawn here at
    // full resolution — the steps are the geometry's own, so nothing
    // is gained by rasterising them coarsely and the edges stay hard.
    ((target: CanvasRenderingContext2D) => {
      echoPaths.waves.forEach((wave) => {
        const remaining = (1 - wave.depth) ** 1.5;
        if (wave.body) {
          target.fillStyle = canvasPaint;
          setAlpha(target, opacity * tuning.fillOpacity * 0.14 * remaining);
          target.fill(wave.body);
        }
        target.strokeStyle = canvasPaint;
        target.lineWidth = 1 + wave.strength * 1.6;
        setAlpha(target, opacity * remaining * (0.45 + wave.strength * 0.5));
        target.stroke(wave.line);
        if (wave.strength > 0.3) {
          target.strokeStyle = sheenFill(1);
          target.lineWidth = 0.8;
          setAlpha(target, opacity * remaining * wave.strength * 0.6);
          target.stroke(wave.line);
        }
      });
    })(context);
  }
};

interface IPaintSawtoothTraceInput {
  sawTrace: Path2D | undefined;
  sawtoothScopeRef: RefObject<{
    ghosts: IGhost[];
    beatLevel: number;
    trackedAt: number;
    flareAt: number;
    sparks: ISpark[];
  }>;
  motionRef: RefObject<IGraphMotionState>;
  context: CanvasRenderingContext2D;
  canvasPaint: string | CanvasGradient;
  opacity: number;
  sceneBase: number;
  sceneTop: number;
}

/**
 * The sawtooth scope's trace.
 */
export const paintSawtoothTrace = ({
  sawTrace,
  sawtoothScopeRef,
  motionRef,
  context,
  canvasPaint,
  opacity,
  sceneBase,
  sceneTop,
}: IPaintSawtoothTraceInput) => {
  if (sawTrace) {
    const scope = sawtoothScopeRef.current;
    const clock = motionRef.current.travel[0] ?? 0;
    const flare = sawtoothFlare(scope, clock);
    // Phosphor: the last few beams, oldest faintest, so a moving wave
    // has a tail behind it.
    context.strokeStyle = canvasPaint;
    context.lineWidth = 1.4;
    scope.ghosts.forEach((ghost) => {
      setAlpha(context, opacity * 0.3 * ghostGlow(ghost, clock));
      context.stroke(ghost.path);
    });
    // The beam: the look's colour wide and faint, white thin and bright
    // on top, both swelling on a beat.
    context.strokeStyle = canvasPaint;
    context.lineWidth = 3 + flare * 5;
    setAlpha(context, opacity * (0.35 + flare * 0.4));
    context.stroke(sawTrace);
    context.strokeStyle = '#fff';
    context.lineWidth = 1.1 + flare * 1.4;
    setAlpha(context, opacity * (0.85 + flare * 0.15));
    context.stroke(sawTrace);
    // Sparks off the tips.
    context.fillStyle = '#fff';
    setAlpha(context, opacity * 0.9);
    context.fill(createSparkPath(scope, clock, sceneBase, sceneTop));
  }
};
