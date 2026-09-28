/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseCssColour } from '../../../utils/oklab';
import type { IAnalysisPlot } from '../../analysis/analysisFrame';
import { rampAt } from '../../lookColours';
import { isTraceGradient, type TracePaint } from '../../liveTracePaint';
import { LOOK_INKS, type IEngineLookInput } from '../engineLookInput';
import { setLookVector } from '../lookInput';

/**
 * What the page hands the engine for a designed scene, beside the scene's
 * own layout: where the drawing stands and how it is painted, exactly as the
 * page's canvas would paint it this frame (`LiveTraceCanvas`).
 */

/** One copy of the drawing: the wave's placement of it. */
export interface IDesignedCopy {
  translateY: number;
  scaleY: number;
}

export interface IDesignedFrame {
  window: { width: number; height: number };
  plot: IAnalysisPlot;
  baseline: number;
  depth: number;
  /** The plot's floor and ceiling in scene space. */
  sceneTop: number;
  sceneBase: number;
  copies: readonly IDesignedCopy[];
  /** Where the whole scene is shaken to this frame, in pixels. */
  shake: { x: number; y: number };
  /** The look's paint and the halo's, as the page resolves them. */
  paint: TracePaint;
  glowPaint: TracePaint;
  /** The trace's presence and width, eased as the page eases them. */
  opacity: number;
  strokeWidth: number;
  filled: boolean;
  fillOpacity: number;
  /** The halo's light and swell; no light, no halo. */
  lit: number;
  swell: number;
}

/** A paint's ramp — its kind, where it starts and ends — and its stops. */
const writePaint = (
  paint: TracePaint,
  inks: Float32Array,
): { vector: [number, number, number]; count: number } => {
  const stops = isTraceGradient(paint)
    ? paint.stops.map(({ colour }) => colour)
    : [paint];
  const count = Math.max(1, Math.min(LOOK_INKS, stops.length));
  for (let stop = 0; stop < count; stop += 1) {
    const [red, green, blue] = parseCssColour(stops[stop])?.rgb ?? [1, 1, 1];
    inks[stop * 3] = red;
    inks[stop * 3 + 1] = green;
    inks[stop * 3 + 2] = blue;
  }
  if (!isTraceGradient(paint) || count < 2) {
    return { vector: [0, 0, 1], count };
  }
  // Level runs up the plot, the rest across it (`resolveTracePaint`).
  return paint.x1 === paint.x2
    ? { vector: [2, paint.y1, paint.y2], count }
    : { vector: [1, paint.x1, paint.x2], count };
};

/**
 * A paint's colour at one point, 0..1 channels: what a sprite takes where
 * the page would have filled its shape with the paint.
 */
export const paintAt = (
  paint: TracePaint,
  x: number,
  y: number,
): [number, number, number] => {
  if (!isTraceGradient(paint)) {
    const [red, green, blue] = parseCssColour(paint)?.rgb ?? [1, 1, 1];
    return [red, green, blue];
  }
  const up = paint.x1 === paint.x2;
  const span = up ? paint.y2 - paint.y1 : paint.x2 - paint.x1;
  const along = up ? y - paint.y1 : x - paint.x1;
  const t = span === 0 ? 0 : Math.max(0, Math.min(1, along / span));
  const [red, green, blue] = rampAt(
    paint.stops.map(({ colour }) => colour),
    t,
  );
  return [red / 255, green / 255, blue / 255];
};

/** Where a copy's scene-space point lands on the screen, shaken. */
export const sceneToScreen = (
  frame: IDesignedFrame,
  copy: IDesignedCopy,
  x: number,
  y: number,
): { x: number; y: number } => ({
  x: x + frame.shake.x,
  y: copy.translateY + (copy.scaleY < 0 ? -y : y) + frame.shake.y,
});

export const readDesignedInput = (
  input: IEngineLookInput,
  frame: IDesignedFrame,
): void => {
  const { plot, window, copies } = frame;
  input.spriteCount = 0;
  input.spritesUnder = 0;
  input.bloom = 0;
  setLookVector(input, 0, window.width, window.height, 0, 0);
  setLookVector(input, 1, plot.left, plot.right, plot.top, plot.bottom);
  [0, 1].forEach((copy) => {
    const placed = copies[copy];
    setLookVector(
      input,
      2 + copy,
      placed?.translateY ?? 0,
      placed?.scaleY ?? 1,
      placed ? 1 : 0,
      0,
    );
  });
  const look = writePaint(frame.paint, input.inks);
  input.inkCount = look.count;
  setLookVector(input, 4, ...look.vector, frame.fillOpacity);
  const glow = writePaint(frame.glowPaint, input.mateInks);
  input.mateInkCount = glow.count;
  setLookVector(input, 5, ...glow.vector, frame.filled ? 1 : 0);
  setLookVector(
    input,
    6,
    frame.opacity,
    frame.strokeWidth,
    frame.lit,
    frame.swell,
  );
  setLookVector(
    input,
    7,
    frame.shake.x,
    frame.shake.y,
    frame.sceneBase,
    frame.sceneTop,
  );
};
