/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { NumberValue, ScaleLinear, ScaleLogarithmic } from 'd3';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import type { ILiveCurveData, IMarginLike } from './ChartController';
import { LIVE_FULL_SCALE_DB } from './liveSpectrumFrames';
import { getWaveTransform } from './liveTracePaint';

/**
 * The graph's paper: where its gutters are, which lines it rules, how its
 * scales read, and where that puts a Plus scene's spectrum.
 *
 * Out of the chart so the Studio can lay the very same grid over a scene on
 * its stage. A second copy of these numbers there would have drifted from the
 * graph the first time either changed, and a grid that measures something
 * other than what the graph shows is worse than no grid.
 */

/**
 * The gutters the scales live in, inside the chart's own box.
 *
 * Fifty pixels down the left for the decibel labels and thirty along the bottom
 * for the frequency marks; the ten at the top is half a line of headroom, since
 * axis labels are centred on their tick and the topmost one (+20 dB) would
 * otherwise be cut in half by the viewport.
 */
// A band's handle is a 12px circle when it is selected, drawn centred on
// the curve, and the plot clips at its edge: a band at +20 dB with less
// than that above it lost the top of its handle, and at -20 dB with no
// gutter under it, the bottom. So the vertical inset is never less than the
// handle's radius, in both layouts.
// The halo is 12px across plus its stroke, so 14 keeps every pixel of it.
const HANDLE_INSET = 14;

const GRID_AXIS_PADDING: IMarginLike = {
  left: 50,
  top: HANDLE_INSET,
  /**
   * The level scale's gutter, and it was 0 while this plot had only one axis.
   *
   * Two quantities were sharing the left-hand numbers: the EQ response is dB
   * of GAIN, while the live output area behind it is a LEVEL, and nothing on
   * screen said so. A band of the trace sitting on the 0 dB line was being
   * read as "0 dB" when it is really 20 dB below the programme's own peak.
   * Wide enough for "-40 dB" at 0.75rem.
   */
  right: 48,
  bottom: 30,
};

/**
 * With the grid off there is nothing in any of the gutters, so the wave runs
 * edge to edge instead.
 */
// Gridless is edge to edge sideways; up and down it still keeps the handles
// whole.
const NO_AXIS_PADDING: IMarginLike = {
  left: 0,
  top: HANDLE_INSET,
  right: 0,
  bottom: HANDLE_INSET,
};

/**
 * The vertical inset exists for one thing: a band handle sitting at +20 or
 * -20 dB is centred on the edge of the plot, and half of it would be cut off.
 * With no handles drawn there is nothing to keep clear, and the inset is a
 * band of empty page along the bottom of a drawing that is meant to reach the
 * edge — most visible in the largest view, where the plot is the window.
 */
export const getAxisPadding = (
  isGridHidden: boolean,
  hasHandles = true,
): IMarginLike => {
  if (!isGridHidden) {
    return GRID_AXIS_PADDING;
  }
  return hasHandles
    ? NO_AXIS_PADDING
    : { left: 0, top: 0, right: 0, bottom: 0 };
};

// Every tick list is a module constant: the grid lines and axes list their
// ticks in an effect's dependencies, and an array rebuilt each render re-ruled
// the whole plot on every render.

/** The decades, labelled along the bottom. */
export const FREQUENCY_MAJOR_TICKS = [20, 100, 200, 1000, 2000, 10000, 20000];

/** Between the decades, at half their ink and unlabelled. */
export const FREQUENCY_MINOR_TICKS = [
  40, 60, 80, 120, 140, 160, 180, 400, 600, 800, 1200, 1400, 1600, 1800, 4000,
  6000, 8000, 12000, 14000, 16000, 18000,
];

/**
 * The minor lines, at half the ink of the decades: the EQ face's ±10 ticks
 * against its ±20.
 */
export const MINOR_RULE_INK = 'rgba(214, 233, 247, 0.06)';

/**
 * Unity gain is a reference, not a measurement, so it reads as a brighter grid
 * line rather than as another coloured curve. It was pink, which put a fourth
 * near-identical magenta on a chart that already had three. The same pale
 * accent, at the same alpha, as the 0 dB rule under the EQ bands; the accent
 * arrives as the drawing's `color`.
 */
export const UNITY_RULE_INK =
  'color-mix(in srgb, currentColor 30%, transparent)';

/** The gain labels down the left. */
export const GAIN_AXIS_TICKS = [MIN_GAIN, -10, 0, 10, MAX_GAIN];

/** The gain rules across; 0 dB is drawn apart, brighter. */
export const GAIN_GRID_TICKS = [MIN_GAIN, -10, 10, MAX_GAIN];

export const UNITY_TICKS = [0];

/**
 * The right-hand scale: dB below the programme's own peak, not dBFS.
 *
 * The difference is the entire reason this is a second axis rather than more
 * numbers on the first. The live trace is peak-referenced — see
 * `writeFrequencyPoints`, which plots `level - trackPeak + LIVE_FULL_SCALE_DB`
 * — so the top gridline IS the loudest bin the track has reached and every
 * value under it is real dB beneath that peak. Referencing it that way is what
 * stops the Windows volume slider from flattening the shape; it is equally
 * what makes an absolute dBFS label on this plot untrue.
 *
 * Module scope, and not a `useMemo`, because `Axis` lists `tickFormat` in its
 * effect dependencies: a function rebuilt each render would restart the axis
 * transition on every frame the graph moves.
 */
export const levelTickFormat = (domainValue: NumberValue) =>
  `${Number(domainValue) - LIVE_FULL_SCALE_DB} dB`;

export type TLiveCurveShape = Pick<
  ILiveCurveData,
  | 'isFlipped'
  | 'isHalfHeight'
  | 'isFromCentre'
  | 'heightScale'
  | 'verticalPosition'
>;

/**
 * The live wave's own scale: the gain scale moved to where the wave is drawn.
 *
 * The live trace is projected through the gain scale and then transformed on
 * the canvas, so its right-hand dB axis takes the same transform and keeps
 * describing the visible trace when its height or position changes. A scene
 * that reserves its own band (`spectrumRange`) moves the ruler there instead,
 * keeping the same decibel domain. With no wave, the gain scale itself.
 */
export const liveLevelScaleFor = ({
  gain,
  spectrumRange,
  liveCurve,
  height,
  marginTop,
}: {
  gain: ScaleLinear<number, number>;
  spectrumRange?: readonly [number, number];
  liveCurve?: TLiveCurveShape;
  /** The whole box the scene fills, gutters included. */
  height: number;
  /** How far down that box the plot's svg starts. */
  marginTop: number;
}): ScaleLinear<number, number> => {
  if (spectrumRange) {
    const [bottom, top] = spectrumRange;
    // A compact panel still needs its toolbar gutter. The authored sky
    // range cannot put 0 dB underneath the controls or crush the ruler.
    const topY = Math.max(
      (1 - top) * height - marginTop,
      Math.min(...gain.range().map(Number)),
    );
    const bottomY = Math.max(
      (1 - bottom) * height - marginTop,
      topY + height * 0.24,
    );
    const scale = gain.copy();
    return scale.range(
      scale
        .domain()
        .map(
          (value) =>
            bottomY +
            ((Number(value) - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)) *
              (topY - bottomY),
        ),
    );
  }
  if (!liveCurve) {
    return gain;
  }
  const range = gain.range().map(Number);
  const plotTop = Math.min(...range);
  const plotBottom = Math.max(...range);
  const { translateY, scaleY } = getWaveTransform(
    liveCurve,
    plotBottom,
    plotTop,
  );
  return gain.copy().range(range.map((value) => translateY + scaleY * value));
};

/**
 * Near-flat waves cannot carry five legible labels. Thin the same scale
 * rather than letting labels overlap; the remaining marks stay exact.
 */
export const liveLevelTicksFor = (
  level: ScaleLinear<number, number>,
): number[] => {
  const span = Math.abs(Number(level(MAX_GAIN)) - Number(level(MIN_GAIN)));
  if (span < 22) {
    return [MAX_GAIN];
  }
  if (span < 44) {
    return [MIN_GAIN, MAX_GAIN];
  }
  if (span < 88) {
    return [MIN_GAIN, 0, MAX_GAIN];
  }
  return GAIN_AXIS_TICKS;
};

/**
 * Room each frequency label needs: "10k Hz" at 0.75rem is about forty pixels,
 * and a label hard against the next one reads as a single word.
 */
const FREQUENCY_LABEL_SPACING = 52;

/**
 * The labelled decades that fit side by side along `frequency`'s width, kept
 * from the left. A narrow panel ran "20 Hz100 Hz200 Hz" together into one
 * smear; the lines stay on every decade, only their names thin out.
 */
export const frequencyLabelTicksFor = (
  frequency: ScaleLogarithmic<number, number>,
): number[] => {
  const kept: number[] = [];
  let last = -Infinity;
  FREQUENCY_MAJOR_TICKS.forEach((tick) => {
    const x = Number(frequency(tick));
    if (x - last >= FREQUENCY_LABEL_SPACING) {
      kept.push(tick);
      last = x;
    }
  });
  return kept.length === FREQUENCY_MAJOR_TICKS.length
    ? FREQUENCY_MAJOR_TICKS
    : kept;
};

/**
 * Where a scene filling the whole box draws its spectrum, `[left, right,
 * bottom, top]` from the bottom-left: the frequency scale's ends and the live
 * scale's quietest and loudest readings, measured in that box. The scene fills
 * the panel while the scales live inside the svg's gutters, so this shares
 * their actual endpoints rather than estimating a second mapping.
 */
export const sceneSpectrumRectFor = ({
  frequency,
  level,
  margins,
  width,
  height,
}: {
  frequency: ScaleLogarithmic<number, number>;
  level: ScaleLinear<number, number>;
  margins: Pick<IMarginLike, 'left' | 'top'>;
  width: number;
  height: number;
}): readonly [number, number, number, number] => {
  const range = frequency.range().map(Number);
  return [
    (margins.left + range[0]) / Math.max(1, width),
    (margins.left + range[1]) / Math.max(1, width),
    1 - (margins.top + Number(level(MIN_GAIN))) / Math.max(1, height),
    1 - (margins.top + Number(level(MAX_GAIN))) / Math.max(1, height),
  ];
};
