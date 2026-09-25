/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useMemo } from 'react';
import * as d3 from 'd3';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { SelectionMode } from 'common/bandSelection';
import { Color } from 'renderer/styles/color';

/**
 * The frequency range the plot covers with its grid on, which is wider than
 * the audible band at both ends so the 20Hz and 20kHz marks are not sitting on
 * the frame.
 *
 * A whole octave below 20 Hz, as professional equalisers draw it (Pro-Q starts
 * at 10 Hz), and not the matched pair it was. 16 Hz and 25 kHz put 20 Hz and
 * 20 kHz the same distance from their edges, which balanced the drawing; the
 * Tone panel's low cut then did its work in the third of an octave left below
 * 20 Hz, and Ivan asked to see the whole spectrum down there (2026-09-23: "can
 * we show 0 hz in the grahp too ... so we see the full espectrum"). A log axis
 * never reaches 0 Hz; an octave below 20 Hz shows the cut's slope, the
 * analyser's measurement of it, and the rumble it takes out. The top stays at
 * 25 kHz: above an output's Nyquist, 24 kHz at 48 kHz, there is nothing to
 * draw.
 */
export const GRAPH_START = 10;
export const GRAPH_END = 25000;

/**
 * The range with the grid off, when the plot is a picture drawn edge to edge:
 * trimmed to where records have sound (Ivan, 2026-09-23: "when grap grid is
 * off I like to show grahp 16k so we dont show empty space on the right when
 * showing the grahp in full screen no grid", "I mean trim the sides"). Most
 * masters, and every MP3, are empty above 16 kHz, and nothing below 20 Hz is
 * heard.
 */
export const PICTURE_START = 20;
export const PICTURE_END = 16000;

const FULL_RANGE = [GRAPH_START, GRAPH_END] as const;
const PICTURE_RANGE = [PICTURE_START, PICTURE_END] as const;

/**
 * The frequencies the plot spans, as one of two constants: a range rebuilt
 * each render would rebuild the scale, and every axis handed it would restart
 * its transition.
 */
export const graphFrequencyRange = (
  isGridHidden: boolean,
): readonly [number, number] => (isGridHidden ? PICTURE_RANGE : FULL_RANGE);

export const INIT_ANIMATE_DURATION = 750;
export const GRAPH_ANIMATE_DURATION = 100;

export interface IMarginLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface IChartPointData {
  x: number;
  y: number;
}

export interface IChartGradientStop {
  offset: number;
  color: string;
}

export interface IChartLineDataPointsById {
  [id: string]: IChartPointData[];
}

export interface IChartCurveData {
  id: string;
  name: string;
  line: {
    color: Color;
    strokeWidth: number;
    points: IChartPointData[];
    gradientStops?: IChartGradientStop[];
    gradientId?: string;
    glow?: boolean;
    /**
     * How present the curve is. Defaults to full.
     *
     * The layers beneath the response being edited are context for reading it,
     * so they are drawn back rather than competing with it.
     */
    opacity?: number;
  };
  controlPoint?: IChartPointData;
}

/**
 * A live trace, described rather than handed over.
 *
 * The points are deliberately not in here, and that absence is the point. They
 * are replaced about twenty-two times a second, so everything they pass through
 * re-renders at that rate — which for the response graph meant a fourteen
 * hundred line component and every d3 effect beneath it, all so that a canvas at
 * the bottom of the tree could read one array. What travels down instead is the
 * trace's *configuration*: which way up it is drawn, in what colour, how
 * present. That changes when somebody chooses something, which is rare, and
 * `LiveTraceCanvas` subscribes to the frames itself.
 *
 * Separate from `IChartCurveData` rather than a variant of it, because the two
 * are drawn by different renderers with almost nothing in common — the band
 * curves are SVG paths with hit testing and transitions, this is pixels. One
 * shared type meant every band curve carrying four fields only the live trace
 * could use, and a `points` array the canvas no longer wants.
 */
export interface ILiveCurveData {
  /**
   * Draw this copy upside down.
   *
   * A reflection of the rendered geometry, not of the data. The distinction
   * matters: every style draws upward from a baseline, so negating the values
   * gives the *negative* of the wave, tall where it was short, rather than the
   * same wave hanging from the ceiling.
   */
  isFlipped?: boolean;
  /**
   * Draw this copy into half the plot, anchored at the middle.
   *
   * For the mirrored orientation, where two copies share the height rather than
   * both taking all of it — at full height they are two full-size waves drawn
   * over each other, which is a tangle rather than a reflection.
   */
  isHalfHeight?: boolean;
  /**
   * With `isHalfHeight`, grow out of the middle instead of in from the edge.
   *
   * The difference between a waveform as an editor draws one — silence a flat
   * line across the centre, a loud frame reaching both edges — and two spectrum
   * analysers facing each other, which is what growing inward looks like.
   */
  isFromCentre?: boolean;
  /**
   * How much of its available depth this copy uses. 1 by default.
   *
   * Separate from `isHalfHeight`, which is about how two copies *share* the
   * plot. This is about how tall the wave is drawn inside whatever share it
   * has, and it scales about the edge the orientation anchors to — so at 0.5 an
   * upright wave runs along the bottom of the screen at half its height rather
   * than moving to the middle.
   */
  heightScale?: number;
  /**
   * How far the wave's baseline moves from its outer edge toward the centre.
   * Zero keeps an upright wave on the bottom; one puts its baseline on the
   * middle row. Inverted and mirrored copies make the symmetric move from
   * their own edge.
   */
  verticalPosition?: number;
  /** What to paint with when the look brings no colours of its own. */
  colour: Color;
  /**
   * How present the trace is.
   *
   * Held back while it is one of several layers under the response being
   * edited, full strength when solo has taken the others away.
   */
  opacity: number;
}

export interface IEditableChartPoint {
  id: string;
  name: string;
  color: string;
  mutedColor: string;
  data: IChartPointData;
  selected: boolean;
  hovered: boolean;
  /**
   * Whether the band is in the chain. A switched-off band keeps its handle —
   * it is still draggable and still the way back on — but contributes no curve,
   * so the handle has to say so or the graph looks like it lost a band.
   */
  isEnabled: boolean;
  /**  is where the press landed, in chart units — see the drag state. */
  onSelect: (mode: SelectionMode, grab: IChartPointData) => void;
  onChange: (data: IChartPointData) => void;
  onCommit: () => void;
  onQualityWheel: (direction: number) => void;
  onHover: (isHovered: boolean) => void;
}

/** The curve that adds the whole chain up, preamp included. */
export const OUTPUT_CURVE_ID = 'Total Response';

/** The voicing layer's own line, a preset's tone among them. */
export const VOICING_CURVE_ID = 'Voicing';

/**
 * A gain the output curve is moved by after it is built, read and watched
 * outside React — the FluidEQ Engine's automatic preamp (`liveEnginePreamp`).
 */
export interface IChartLiveOffset {
  read: () => number;
  subscribe: (listener: () => void) => () => void;
}

interface IChartControllerProps {
  width: number;
  height: number;
  padding: IMarginLike;
  /** From `graphFrequencyRange`, so its identity holds between renders. */
  frequencyRange: readonly [number, number];
}

/**
 * The plot's frequency axis across a box `width` wide, inside its gutters,
 * over the grid's whole spectrum unless `range` trims it.
 */
export const frequencyScale = (
  width: number,
  left: number,
  right: number,
  range: readonly [number, number] = FULL_RANGE,
) =>
  d3
    .scaleLog()
    .domain([...range])
    .range([left, width - right]);

/**
 * The plot's gain axis down a box `height` tall: the EQ's ±20 dB, fixed.
 *
 * It used to stretch to hold any curve past ±20 dB, and the live preamp's
 * offset with it, so every band, every handle and the analyser's scale beside
 * them moved whenever a total or a preamp crossed the edge. With the analyser
 * on a scale of its own on the right (`liveGraphBand.ts`), both scales hold
 * still, the way a professional equaliser's do (Ivan, 2026-09-23: "it can be
 * fixed we just have two scales one on the left for EQ and one on the right
 * for the grhps"). A curve past the edge runs off the plot.
 */
export const gainScale = (height: number, top: number, bottom: number) =>
  d3
    .scaleLinear()
    .domain([MIN_GAIN, MAX_GAIN])
    .range([height - bottom, top]);

/**
 * How far past ±20 dB the EQ's own drawing reaches: the preamp's floor, which
 * the output curve can be carried down to (`PREAMP_MIN_GAIN`).
 */
export const EQ_GAIN_REACH = 60;

/**
 * The share of the plot's height each end gives to what lies past ±20 dB.
 *
 * The output curve is every layer plus the preamp, and the preamp reaches
 * -60 dB; under Auto normalize a curve cut by 10 dB and levelled by 12 lies
 * at -22 and below. On the plain ±20 scale that part of the curve was cut off
 * flat at the plot's floor (Ivan, 2026-09-25: "why the curves in graph get
 * cut like that, it needs to draw completely"). The scale still does not move
 * — he asked for scales that hold still, 2026-09-23 — so instead the last
 * tenth at each end holds everything from 20 to 60 dB, compressed rather
 * than cut: what the compact player's screen already does past its range
 * (`eqCurvePaint.ts`, 2026-09-22), and the way the preamp dial compresses
 * its -60 side and keeps 0 in the middle (Ivan, 2026-09-24: "center 0 on
 * top ... make 60 some how compress").
 */
const EQ_OVERFLOW_SHARE = 0.1;

/**
 * How the overflow is compressed: `ln(1 + dB/k)`, with `k` chosen so the
 * slope where it leaves ±20 dB is the slope inside — a curve crossing the
 * line bends into the overflow instead of kinking at it. Solved once here
 * for `k·ln(1 + reach/k) = share·40 / (1 − 2·share)` by bisection: the left
 * side grows with `k`.
 */
const EQ_OVERFLOW_KNEE = (() => {
  const inner = MAX_GAIN - MIN_GAIN;
  const reach = EQ_GAIN_REACH - MAX_GAIN;
  const wanted = (EQ_OVERFLOW_SHARE * inner) / (1 - 2 * EQ_OVERFLOW_SHARE);
  let low = 1e-3;
  let high = reach;
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2;
    if (middle * Math.log(1 + reach / middle) < wanted) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return (low + high) / 2;
})();

/**
 * Where the compressed ends are drawn, as decibels past ±20: denser near the
 * line, where a curve usually is, so the straight pieces between these
 * stops follow the logarithm to well under a pixel.
 */
const EQ_OVERFLOW_STOPS = [0, 0.5, 1, 2, 3.5, 5, 7.5, 10, 15, 20, 30, 40];

/** Of the overflow's share, how much `beyond` decibels past ±20 takes. */
const overflowFraction = (beyond: number) =>
  Math.log(1 + beyond / EQ_OVERFLOW_KNEE) /
  Math.log(1 + (EQ_GAIN_REACH - MAX_GAIN) / EQ_OVERFLOW_KNEE);

/**
 * The EQ's gain axis: ±20 dB across the middle eight tenths, exactly as
 * linear as it always was, and ±20 to ±60 compressed into the tenth at each
 * end. Beyond ±60 it clamps, so nothing is ever drawn off the plot.
 *
 * Only the EQ's own drawing uses it — its curves, handles, gain grid and
 * labels. The analyser and every scene keep `gainScale`, whose ±20 fills the
 * plot: the live wave is projected through that one (`liveLevelScaleFor`),
 * and compressing it would shrink every visualizer by a fifth.
 */
export const eqGainScale = (height: number, top: number, bottom: number) => {
  const plotBottom = height - bottom;
  const span = plotBottom - top;
  const inner = span * (1 - 2 * EQ_OVERFLOW_SHARE);
  const edge = span * EQ_OVERFLOW_SHARE;
  const lowZero = plotBottom - edge;
  const highZero = top + edge;
  const below = [...EQ_OVERFLOW_STOPS].reverse().slice(0, -1);
  const domain = [
    ...below.map((beyond) => MIN_GAIN - beyond),
    MIN_GAIN,
    MAX_GAIN,
    ...EQ_OVERFLOW_STOPS.slice(1).map((beyond) => MAX_GAIN + beyond),
  ];
  const range = [
    ...below.map((beyond) => lowZero + edge * overflowFraction(beyond)),
    lowZero,
    lowZero - inner,
    ...EQ_OVERFLOW_STOPS.slice(1).map(
      (beyond) => highZero - edge * overflowFraction(beyond),
    ),
  ];
  return d3.scaleLinear().domain(domain).range(range).clamp(true);
};

/**
 * The same axis with every value moved by `offsetDb` before it is placed —
 * the output curve under the engine's live preamp. A translation of the
 * drawn curve stopped being exact once the axis compressed its ends.
 */
export const offsetGainScale = (
  scale: d3.ScaleLinear<number, number>,
  offsetDb: number,
) =>
  offsetDb === 0
    ? scale
    : scale.copy().domain(scale.domain().map((value) => value - offsetDb));

// Module scope, so an axis handed one of these keeps the same function from
// render to render and does not restart its transition every time.
export const frequencyTickFormat = (domainValue: d3.NumberValue) =>
  `${d3.format('~s')(domainValue)} Hz`;

export const gainTickFormat = (domainValue: d3.NumberValue) =>
  `${Number(domainValue) > 0 ? '+' : ''}${d3.format('.2')(domainValue)} dB`;

const useController = ({
  width,
  height,
  padding,
  frequencyRange,
}: IChartControllerProps) => {
  const xScaleFreq = useMemo(
    () => frequencyScale(width, padding.left, padding.right, frequencyRange),
    [padding.left, padding.right, width, frequencyRange],
  );

  const yScaleGain = useMemo(
    () => gainScale(height, padding.top, padding.bottom),
    [height, padding.bottom, padding.top],
  );

  const yScaleEq = useMemo(
    () => eqGainScale(height, padding.top, padding.bottom),
    [height, padding.bottom, padding.top],
  );

  return {
    xTickFormat: frequencyTickFormat,
    yTickFormat: gainTickFormat,
    xScaleFreq,
    yScaleGain,
    yScaleEq,
  };
};

export default useController;
