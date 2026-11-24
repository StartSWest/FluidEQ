/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDynamicsBand } from '../../common/dsp/dynamicsStage';
import dynamicsGainDb, {
  LIFT_FLOOR_DB,
  heardGainDb,
  liftTopDb,
} from './dynamicsCurve';
import { PLOT_LOW_DB, type IDynamicsPlot } from './dynamicsPlot';

/** Each band's curve as the SVG paths that draw it. */
export interface IDynamicsCurveShape {
  /** The curve as heard: the mix included, the make-up taken out. */
  line: string;
  /** The curve's body down to the floor, faint, so it reads as a shape. */
  body: string;
  /** Where the band is lifted, between the curve and the line of unity. */
  lifted: string[];
  /** Where it is held down. */
  held: string[];
  /**
   * The curve the settings draw at a full mix, where the points sit, while
   * the mix lets some of the input through and the heard curve is flatter.
   */
  setting?: string;
}

/** Finer than a pixel of the largest square across the 80 dB it shows. */
const STEP_DB = 0.5;
/** Under this a sample counts as on the line. */
const ON_LINE_DB = 0.01;

type TSample = readonly [levelDb: number, outDb: number];

const pathOf = (plot: IDynamicsPlot, samples: readonly TSample[]) =>
  samples
    .map(
      ([level, out], index) =>
        `${index === 0 ? 'M' : 'L'}${plot.x(level).toFixed(1)} ${plot
          .y(out)
          .toFixed(1)}`,
    )
    .join('');

/** The levels to sample: an even walk, and every corner exactly. */
const levelsOf = (band: IDynamicsBand): number[] => {
  const corners = [
    band.upThresholdDb,
    band.downThresholdDb,
    LIFT_FLOOR_DB,
    LIFT_FLOOR_DB + 6,
    liftTopDb(band) ?? PLOT_LOW_DB,
  ];
  const walk = Array.from(
    { length: Math.round(-PLOT_LOW_DB / STEP_DB) + 1 },
    (_, index) => PLOT_LOW_DB + index * STEP_DB,
  );
  return [...new Set([...walk, ...corners])]
    .filter((level) => level >= PLOT_LOW_DB && level <= 0)
    .sort((a, b) => a - b);
};

/**
 * The stretches where the curve stands off the line on one side, each with
 * the sample either side of it so the shape closes on the line itself.
 */
const stretches = (
  samples: readonly TSample[],
  isInside: (sample: TSample) => boolean,
): TSample[][] => {
  const found: TSample[][] = [];
  let open: TSample[] | undefined;
  samples.forEach((sample, index) => {
    if (isInside(sample)) {
      if (!open) {
        open = index > 0 ? [samples[index - 1]] : [];
        found.push(open);
      }
      open.push(sample);
    } else if (open) {
      open.push(sample);
      open = undefined;
    }
  });
  return found.filter((stretch) => stretch.length > 1);
};

const areaOf = (plot: IDynamicsPlot, stretch: readonly TSample[]) => {
  const back = [...stretch]
    .reverse()
    .map(
      ([level]) => `L${plot.x(level).toFixed(1)} ${plot.y(level).toFixed(1)}`,
    )
    .join('');
  return `${pathOf(plot, stretch)}${back}Z`;
};

export const dynamicsCurveShape = (
  band: IDynamicsBand,
  makeupDb: number,
  mix: number,
  plot: IDynamicsPlot,
): IDynamicsCurveShape => {
  const levels = levelsOf(band);
  const heard: TSample[] = levels.map((level) => [
    level,
    level + heardGainDb(band, level, makeupDb, mix),
  ]);
  const line = pathOf(plot, heard);
  const floor = plot.y(PLOT_LOW_DB).toFixed(1);
  const body = `${line}L${plot.x(0).toFixed(1)} ${floor}L${plot
    .x(PLOT_LOW_DB)
    .toFixed(1)} ${floor}Z`;
  const fullMix = mix >= 0.999;
  return {
    line,
    body,
    lifted: stretches(heard, ([l, o]) => o - l > ON_LINE_DB).map((s) =>
      areaOf(plot, s),
    ),
    held: stretches(heard, ([l, o]) => l - o > ON_LINE_DB).map((s) =>
      areaOf(plot, s),
    ),
    setting: fullMix
      ? undefined
      : pathOf(
          plot,
          levels.map((level) => [level, level + dynamicsGainDb(band, level)]),
        ),
  };
};
