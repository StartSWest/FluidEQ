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

import { isDiscreteGraphStyle } from 'common/graphStyles';
import { type RefObject } from 'react';
import {
  type IEuphoriaPaint,
  type IWaveTransform,
  resolveFigureStroke,
  type TracePaint,
} from './liveTracePaint';
import { GLOW_LAYERS, HALO_SCALE } from './figureGlow';
import { setAlpha } from './liveTraceStyle';
import {
  fillTexturePattern,
  PICTURE_ALPHA,
  TEXTURE_ALPHA,
} from './fillTextures';
import { type createPulsePaths } from './pulseMonitor';
import { type ILookTuning } from '../../common/customLooks';

// The layers every form of the live graph shares: the beat-driven halo,
// the accent behind the figure, the fill's texture, and the figure's own
// stroke.

interface IPaintHaloInput {
  haloPath: Path2D | undefined;
  paintFor: (paint: TracePaint) => string | CanvasGradient;
  basePaint: TracePaint;
  isFilled: boolean;
  tuning: ILookTuning;
  isSelfColoured: boolean;
  euphoria: IEuphoriaPaint;
  dots: { beads: Path2D; shape: Path2D } | undefined;
  scatterPaths: { primary: Path2D; secondary: Path2D } | undefined;
  stemLayers: { tips: Path2D; lines: Path2D[]; hot: Path2D } | undefined;
  haloCanvasRef: RefObject<HTMLCanvasElement | null>;
  canvas: HTMLCanvasElement;
  lit: number;
  strokeWidth: number;
  swell: number;
  context: CanvasRenderingContext2D;
  overflowsPlot: boolean;
  plot: { left: number; right: number; top: number; bottom: number };
  depth: number;
  baseline: number;
  wave: IWaveTransform;
  enterSceneSpace: () => void;
}

/**
 * The beat-driven glow behind the figure, gated by Rainbow mode.
 */
export const paintHalo = ({
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
}: IPaintHaloInput) => {
  // One beat-driven glow for every form, gated by Rainbow mode. Keeping
  // wave shadows separate made Glow work while its slider was disabled.
  if (haloPath) {
    // Painted on the low-resolution surface under the same transform
    // and the same clip as this context, then stretched over it. See
    // HALO_SCALE. Without a surface (a context lost, a canvas that
    // will not give one) it is painted here at full cost.
    // The glow is the line's own colour: whatever the figure is stroked
    // with, or its paint when it has no stroke. It used to take the
    // rainbow sweep on a look with no colours of its own, so a green
    // line sat in a hue that was not green.
    const glowPaint = paintFor(
      resolveFigureStroke(
        basePaint,
        isFilled,
        tuning.border,
        isSelfColoured,
        euphoria,
      ) ?? basePaint,
    );
    const glowShape =
      dots?.beads ?? scatterPaths?.primary ?? stemLayers?.tips ?? haloPath;
    const haloCanvas =
      haloCanvasRef.current ?? document.createElement('canvas');
    haloCanvasRef.current = haloCanvas;
    const haloWidth = Math.max(1, Math.ceil(canvas.width * HALO_SCALE));
    const haloHeight = Math.max(1, Math.ceil(canvas.height * HALO_SCALE));
    if (haloCanvas.width !== haloWidth || haloCanvas.height !== haloHeight) {
      haloCanvas.width = haloWidth;
      haloCanvas.height = haloHeight;
    }
    const halo2d = haloCanvas.getContext('2d');
    const paintGlow = (target: CanvasRenderingContext2D) => {
      target.strokeStyle = glowPaint;
      target.lineCap = 'round';
      target.lineJoin = 'round';
      GLOW_LAYERS.forEach((layer) => {
        setAlpha(target, layer.opacity * lit);
        target.lineWidth = strokeWidth + layer.widen * swell;
        target.stroke(glowShape);
      });
    };
    if (halo2d) {
      const base = context.getTransform();
      halo2d.setTransform(1, 0, 0, 1, 0, 0);
      halo2d.clearRect(0, 0, haloWidth, haloHeight);
      halo2d.save();
      halo2d.setTransform(
        base.a * HALO_SCALE,
        base.b * HALO_SCALE,
        base.c * HALO_SCALE,
        base.d * HALO_SCALE,
        base.e * HALO_SCALE,
        base.f * HALO_SCALE,
      );
      if (!overflowsPlot) {
        halo2d.beginPath();
        halo2d.rect(
          plot.left,
          -depth,
          plot.right - plot.left,
          baseline + depth,
        );
        halo2d.clip();
      }
      halo2d.scale(1, 1 / Math.abs(wave.scaleY));
      paintGlow(halo2d);
      halo2d.restore();
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      setAlpha(context, 1);
      context.drawImage(haloCanvas, 0, 0, canvas.width, canvas.height);
      context.restore();
    } else {
      enterSceneSpace();
      paintGlow(context);
      context.restore();
    }
  }
};

interface IPaintAccentBehindInput {
  tuning: ILookTuning;
  context: CanvasRenderingContext2D;
  wave: IWaveTransform;
  isFilled: boolean;
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
  plot: { left: number; right: number; top: number; bottom: number };
  depth: number;
  curveFigure: Path2D;
  paintPeaks: (
    canvasPaint: string | CanvasGradient,
    basePaint: TracePaint,
    paintFor: (paint: TracePaint) => string | CanvasGradient,
  ) => void;
  canvasPaint: string | CanvasGradient;
  basePaint: TracePaint;
  paintFor: (paint: TracePaint) => string | CanvasGradient;
}

/**
 * The look's accent, painted behind the figure.
 */
export const paintAccentBehind = ({
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
}: IPaintAccentBehindInput) => {
  if (tuning.accentBehind) {
    // BEHIND MEANS HIDDEN BY THE FIGURE, not merely painted first.
    //
    // Painting the marks under the figure was the whole of "behind",
    // and on a filled form it was not enough: a fill is translucent, so
    // a wave mark under LED blocks showed straight through every cell
    // and read as being in front. The marks are clipped to the plot
    // OUTSIDE the figure's body — the same even-odd cut the euphoria
    // edge uses — so under a block they are gone and between blocks
    // they show, which is what behind looks like. A form made of pieces
    // — bars, cells, dots — hides them even when stroked: an outlined
    // LED is still an LED. A stroked continuous line has no body, so
    // it is left as it was.
    const cover = new Path2D();
    context.save();
    context.scale(1, 1 / Math.abs(wave.scaleY));
    if (isFilled || isDiscreteGraphStyle(chosen)) {
      const span = plot.right - plot.left;
      cover.rect(plot.left - span * 2, -depth * 4, span * 5, depth * 8);
      cover.addPath(curveFigure);
      context.clip(cover, 'evenodd');
    }
    paintPeaks(canvasPaint, basePaint, paintFor);
    context.restore();
  }
};

interface IPaintFillTextureInput {
  isFilled: boolean;
  tuning: ILookTuning;
  context: CanvasRenderingContext2D;
  ratio: number;
  curveFigure: Path2D;
  opacity: number;
  plot: { left: number; right: number; top: number; bottom: number };
}

/**
 * The texture over a filled figure.
 */
export const paintFillTexture = ({
  isFilled,
  tuning,
  context,
  ratio,
  curveFigure,
  opacity,
  plot,
}: IPaintFillTextureInput) => {
  /**
   * The pattern inside the fill, printed on the glass.
   *
   * Clipped to the figure in the figure's own space and then filled in
   * the window's, so a tile stays square whatever the height slider is
   * doing — the same lesson the ECG paper taught, where ruling inside
   * the curve's transform turned every cell into a rectangle and made
   * the horizontal strokes heavier than the vertical ones.
   *
   * `overlay` is what lets one tile serve every colour: it darkens and
   * lightens the fill beneath it rather than laying a colour of its
   * own over it. A dropped picture goes on flat, because somebody who
   * chose a picture chose its colours too.
   */
  if (isFilled && tuning.texture !== 'none') {
    const pattern = fillTexturePattern(context, {
      texture: tuning.texture,
      image: tuning.textureImage,
      scale: ratio,
    });
    if (pattern) {
      context.save();
      context.clip(curveFigure);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.globalCompositeOperation =
        tuning.texture === 'image' ? 'source-atop' : 'overlay';
      setAlpha(
        context,
        opacity * (tuning.texture === 'image' ? PICTURE_ALPHA : TEXTURE_ALPHA),
      );
      context.fillStyle = pattern;
      context.fillRect(
        plot.left,
        plot.top,
        plot.right - plot.left,
        plot.bottom - plot.top,
      );
      context.restore();
    }
  }
};

interface IStrokeFigureInput {
  figureStroke: TracePaint | undefined;
  figureStrokeWidth: number;
  pulsePaths: ReturnType<typeof createPulsePaths> | undefined;
  context: CanvasRenderingContext2D;
  opacity: number;
  paintFor: (paint: TracePaint) => string | CanvasGradient;
  curveOutside: Path2D | undefined;
  curveFigure: Path2D;
  isEuphoriaEdge: boolean;
  strokeWidth: number;
  canvasPaint: string | CanvasGradient;
}

/**
 * The figure's own outline, where the look draws one.
 */
export const strokeFigure = ({
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
}: IStrokeFigureInput) => {
  // Stroked must draw Fluid too; excluding it erased the bars while
  // the designer continued offering Weight and Border controls.
  // The monitor's beam IS its outline: stroking the figure as well
  // painted the whole trace bright over the sweep and hid it.
  if (figureStroke !== undefined && figureStrokeWidth > 0 && !pulsePaths) {
    setAlpha(context, opacity);
    context.strokeStyle = paintFor(figureStroke);
    if (curveOutside) {
      // A painted form: the border goes round the outside of the fill,
      // double weight through the mask built above. See the note there.
      context.save();
      context.clip(curveOutside, 'evenodd');
      context.lineWidth = figureStrokeWidth * 2;
      context.stroke(curveFigure);
      context.restore();
    } else if (isEuphoriaEdge) {
      /**
       * A stroked form: the border goes AROUND the line, never over it.
       *
       * There is no fill to clip against on a figure that is only a
       * line, so the border is a casing laid under it — stroked first,
       * wide enough that `figureStrokeWidth` of it stands proud on each
       * side, and then the look's own paint over the top at its own
       * weight. The line stays the colour it was and the travelling hue
       * runs outside it, which is what a border is.
       *
       * This used to require the look to have colours of its own, on
       * the reasoning that only those had something to lose. They were
       * not the only ones: a flat look's line is still a line, and
       * replacing its colour is not bordering it — it is painting over
       * it, which is what `echo` and every other stroked form were
       * getting while their Rainbow border box did the asking.
       */
      context.lineWidth = strokeWidth + figureStrokeWidth * 2;
      context.stroke(curveFigure);
      context.strokeStyle = canvasPaint;
      context.lineWidth = strokeWidth;
      context.stroke(curveFigure);
    } else {
      // Either the look's own edge, or a trace with no colours of its own
      // for the sweep to take away. Centred, as it has always been.
      context.lineWidth = figureStrokeWidth;
      context.stroke(curveFigure);
    }
  }
};
