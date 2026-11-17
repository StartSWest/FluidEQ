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
import signedTick from './signedTick';

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
 * None at the sides: the graph reaches both edges and the gain and level
 * scales are drawn over it, just inside them (Ivan, 2026-11-16: "make side
 * numbers inside the graph itself so the graph fills the entire width").
 * Thirty along the bottom for the frequency marks; the top is the handles'
 * headroom.
 */
// A band's handle is a 12px circle when it is selected, drawn centred on
// the curve, and the plot clips at its edge: a band at +20 dB with less
// than that above it lost the top of its handle, and at -20 dB with no
// gutter under it, the bottom. So the vertical inset is never less than the
// handle's radius, in both layouts.
// The halo is 12px across plus its stroke, so 14 keeps every pixel of it.
const HANDLE_INSET = 14;

const GRID_AXIS_PADDING: IMarginLike = {
  left: 0,
  top: HANDLE_INSET,
  /**
   * The level scale is drawn inside the right edge, as the gain scale is
   * inside the left (`Chart.tsx`). It is a scale of its own because two
   * quantities were sharing the left-hand numbers: the EQ response is dB of
   * GAIN, while the live output area behind it is a LEVEL, and a band of the
   * trace on the 0 dB line was read as "0 dB" when it is 20 dB below the
   * programme's own peak.
   */
  right: 0,
  // None: the frequency names stand inside the plot's foot, over the
  // compressed -20 to -60 dB band, as the side scales stand inside its edges
  // (`.chart-axis--inside-bottom`, Ivan 2026-11-16: "too much spacing there").
  // They had a 28px gutter under the plot, and with the divider under that a
  // scene's picture ended 40px above the tabs. A band's handle never reaches
  // the foot: bands stop at -20 dB, a tenth of the plot above it.
  bottom: 0,
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

const NO_PADDING: IMarginLike = { left: 0, top: 0, right: 0, bottom: 0 };

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
  return hasHandles ? NO_AXIS_PADDING : NO_PADDING;
};

/**
 * Gridless with the handles up, the drawing keeps the handles' headroom and
 * stands on the plot's own bottom edge.
 */
const NO_AXIS_DRAWING_PADDING: IMarginLike = {
  ...NO_AXIS_PADDING,
  bottom: 0,
};

/**
 * What the drawing — the live trace, the analysers, a scene — keeps clear
 * of, where `getAxisPadding` is what the EQ's curves and handles keep clear
 * of. The two differ in one place: at the foot of a gridless plot, the
 * handles' inset left the drawing standing 14px above the divider's line, a
 * strip of bare floor between the picture and the bands under it (Ivan,
 * 2026-09-26: "when grid is off remove slider gap"). A handle at -20 dB
 * still needs that inset to stay whole; a bar or a wave does not, and on a
 * plot with no scale the two are not read against each other.
 */
export const getDrawingPadding = (
  isGridHidden: boolean,
  hasHandles = true,
): IMarginLike => {
  if (!isGridHidden) {
    return GRID_AXIS_PADDING;
  }
  return hasHandles ? NO_AXIS_DRAWING_PADDING : NO_PADDING;
};

// Every tick list is a module constant: the grid lines and axes list their
// ticks in an effect's dependencies, and an array rebuilt each render re-ruled
// the whole plot on every render.

/**
 * THE FREQUENCY AXIS AS A PRO ANALYSER DRAWS IT (Ivan, 2026-11-16: "we need
 * to show the frequencies and the distances between them, so it is like the
 * pro ones"). A line at every step of every decade the plot shows — 20, 30
 * … 90, 100, 200 … 900, 1k … — so the log spacing can be seen, the 1-2-5
 * steps a shade stronger, and names on a readable set of them. Built from
 * the range on screen, never a fixed list: the plot spans 10 Hz to 20 kHz now
 * and may be given another span (`graphFrequencyRange`). The plot's own two
 * edges are its border, and draw no line.
 */
export interface IFrequencyGrid {
  /** The 1-2-5 steps, the stronger lines. */
  major: number[];
  /** Every other step of each decade, the fainter lines. */
  minor: number[];
}

const isOneTwoFive = (step: number) => step === 1 || step === 2 || step === 5;

/** Every step of every decade strictly inside `[low, high]`. */
const decadeSteps = (low: number, high: number) => {
  const steps: Array<{ hz: number; step: number }> = [];
  for (
    let decade = 10 ** Math.floor(Math.log10(low));
    decade < high;
    decade *= 10
  ) {
    for (let step = 1; step <= 9; step += 1) {
      // Rounded, or 3 × 10^-x arithmetic leaves 30.000000000000004.
      const hz = Math.round(step * decade * 1e6) / 1e6;
      if (hz > low && hz < high) {
        steps.push({ hz, step });
      }
    }
  }
  return steps;
};

// One grid per span: the rules list their ticks in an effect's dependencies,
// and a list rebuilt each render re-ruled the whole plot on every render.
const grids = new Map<string, IFrequencyGrid>();

export const frequencyGridFor = (low: number, high: number): IFrequencyGrid => {
  const key = `${low}-${high}`;
  const known = grids.get(key);
  if (known) {
    return known;
  }
  const steps = decadeSteps(low, high);
  const grid = {
    major: steps.filter(({ step }) => isOneTwoFive(step)).map(({ hz }) => hz),
    minor: steps.filter(({ step }) => !isOneTwoFive(step)).map(({ hz }) => hz),
  };
  grids.set(key, grid);
  return grid;
};

/**
 * The minor lines, a step under the decades, at the opacity the theme solves
 * for each shade (`--rule-minor`, `themeInk.ts`); a fixed 6% was 1.1:1.
 */
export const MINOR_RULE_INK = 'var(--rule-minor)';

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
  `${signedTick(Number(domainValue) - LIVE_FULL_SCALE_DB)} dB`;

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
 * keeping the same decibel domain, and the wave's height and position then
 * act inside that band: Alpine's aurora grows shorter or lifts within its
 * sky, where the sliders used to be greyed out for a scene that had nowhere
 * else to put its spectrum. With no wave, the gain scale itself.
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
    const band = liveCurve
      ? getWaveTransform(liveCurve, bottomY, topY)
      : { translateY: 0, scaleY: 1 };
    const scale = gain.copy();
    return scale.range(
      scale
        .domain()
        .map(
          (value) =>
            band.translateY +
            band.scaleY *
              (bottomY +
                ((Number(value) - MIN_GAIN) / (MAX_GAIN - MIN_GAIN)) *
                  (topY - bottomY)),
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

/** The gain labels a short plot keeps: its two ends and unity. */
const GAIN_AXIS_ENDS_AND_UNITY = [MIN_GAIN, 0, MAX_GAIN];

/**
 * Pixels an end of the EQ's axis needs before it takes a label of its own:
 * two lines of 0.75rem text and the air between them. At 26 (a 300px graph)
 * "+60 dB" and "+20 dB" read as one smudge; from about 36 they read apart.
 */
const OVERFLOW_LABEL_ROOM = 36;

/**
 * The gain labels down the left, thinned the way the live scale's are above.
 *
 * They were all five at every height, and a graph at its floor — which is
 * where a short window's pages open it (`shortWindowPaneKey`) — printed +20
 * through -20 over one another in a 55px plot while the right-hand scale beside
 * them had already thinned itself to two. Unity is the one label kept to the
 * last: it is the line every curve is read against.
 */
export const gainAxisTicksFor = (
  gain: ScaleLinear<number, number>,
): number[] => {
  const span = Math.abs(Number(gain(MAX_GAIN)) - Number(gain(MIN_GAIN)));
  const inner = (() => {
    if (span < 44) {
      return UNITY_TICKS;
    }
    if (span < 88) {
      return GAIN_AXIS_ENDS_AND_UNITY;
    }
    return GAIN_AXIS_TICKS;
  })();
  // The EQ's axis compresses what lies past ±20 dB into the plot's ends
  // (`eqGainScale`); each end is named by how far it reaches, once it is
  // tall enough to hold a label clear of the ±20 one beside it.
  const domain = gain.domain().map(Number);
  const low = Math.min(...domain);
  const high = Math.max(...domain);
  const reach = Math.abs(Number(gain(high)) - Number(gain(MAX_GAIN)));
  if (
    inner === UNITY_TICKS ||
    high <= MAX_GAIN ||
    reach < OVERFLOW_LABEL_ROOM
  ) {
    return inner;
  }
  return [low, ...inner, high];
};

/**
 * Air between two frequency names, and between a name and a side scale's
 * figure on the same row: a name hard against the next reads as one word
 * ("20 Hz100 Hz"), and one hard against "−80 dB" as one figure.
 */
const FREQUENCY_LABEL_AIR = 12;

/**
 * How far in from the plot's edge a side scale's figures start: d3's tick
 * (6px) and its padding (3px). `Axis` takes the tick line away and the text
 * keeps its place.
 */
export const SIDE_LABEL_INSET = 9;

/**
 * How near the foot a side scale's tick has to be for its figure to share
 * the frequency names' row: the figure stands 3px over its tick and is about
 * 12px tall, so a tick within one line and its air of the floor puts the
 * figure across the names.
 */
export const FOOT_ROW_REACH = 16;

/**
 * What a name's room is judged by: how wide each name is drawn, and how much
 * of the foot's row each side scale's figures already take, from the plot's
 * edge. Measured by the chart in the font on screen (`axisLabelWidth.ts`).
 */
export interface IFrequencyLabelRoom {
  nameWidth: (hz: number) => number;
  reserved: readonly [number, number];
}

/**
 * The room a caller that measures nothing gets: every name forty pixels wide
 * ("10k Hz" at 0.75rem) and forty kept clear at each end, which is the rule
 * the names were placed by before the chart measured them — a name's centre
 * 60px from either edge and 52px from the next. The Studio's paper still
 * places its names by it (`studioPaper.ts`).
 */
const ESTIMATED_ROOM: IFrequencyLabelRoom = {
  nameWidth: () => 40,
  reserved: [40, 40],
};

/**
 * The names along the foot: the 1-2-5 steps first, the series every pro
 * analyser names (Ivan, 2026-09-23: "standard grahp freq numbers" rather than
 * the bands' own), with 16 kHz standing for the top octave wherever 20 kHz is
 * the plot's edge (Ivan, 2026-11-16: "display the 16k instead of 20k"); then
 * the 3s and 4s — 30, 40, 300 — only where the room is there. Thinned by
 * pixels, never by a list per width: a narrow panel ran "20 Hz100 Hz200 Hz"
 * together into one smear; the lines stay on every step, only names go.
 *
 * A name is kept only if its whole box clears the side scales' figures on
 * its row and the names already kept, by `FREQUENCY_LABEL_AIR`; one that
 * cannot is dropped, never squeezed. The edge used to be judged from the
 * name's centre, 60px in, while d3 centres a bottom axis's text on its tick:
 * "16k Hz" reached 40px from the right edge and "−80 dB" took 54, so at
 * 2560px the two ran into each other (Ivan, 2026-11-17: "things not good on
 * those numbers").
 */
export const frequencyLabelTicksFor = (
  frequency: ScaleLogarithmic<number, number>,
  room: IFrequencyLabelRoom = ESTIMATED_ROOM,
): number[] => {
  const [low, high] = frequency.domain().map(Number);
  const [left, right] = frequency.range().map(Number);
  const steps = decadeSteps(low, high);
  const named = steps
    .filter(({ step }) => isOneTwoFive(step))
    .map(({ hz }) => hz);
  if (high <= 20000 && low < 16000) {
    named.push(16000);
  }
  const extra = steps
    .filter(({ step }) => step === 3 || step === 4)
    .map(({ hz }) => hz);
  const boxOf = (hz: number) => {
    const x = Number(frequency(hz));
    const half = room.nameWidth(hz) / 2;
    return { from: x - half, to: x + half };
  };
  const fits = ({ from, to }: { from: number; to: number }) =>
    from - left >= room.reserved[0] + FREQUENCY_LABEL_AIR &&
    right - to >= room.reserved[1] + FREQUENCY_LABEL_AIR;
  const kept: { hz: number; from: number; to: number }[] = [];
  const isClear = ({ from, to }: { from: number; to: number }) =>
    kept.every(
      (other) =>
        from >= other.to + FREQUENCY_LABEL_AIR ||
        to <= other.from - FREQUENCY_LABEL_AIR,
    );
  const offer = (hz: number) => {
    const box = boxOf(hz);
    if (fits(box) && isClear(box)) {
      kept.push({ hz, ...box });
    }
  };
  [...named].sort((a, b) => a - b).forEach(offer);
  extra.forEach(offer);
  return kept.map(({ hz }) => hz).sort((a, b) => a - b);
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
