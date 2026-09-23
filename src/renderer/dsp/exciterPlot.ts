/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IExciterSettings,
  exciterBandEdgesForIndex,
  organicBandEdges,
} from '../../common/dsp/chain';
import { BASE_CURVE_CSS, SKY_CSS, baseCurveInk, skyInk } from './dspInks';
import { IEdgeSpan, formatEdge, placeEdgeReadouts } from './exciterReadouts';

/**
 * The Exciter's picture: where each band works and what it is doing, over
 * the spectrum it is doing it to.
 *
 * The same picture the EQ page draws, answering this page's question instead.
 * Bars alone said how hard each band was working and never said WHERE — and
 * "where" is most of what a multiband stage is about, because every centre and
 * range is movable and a narrow band can otherwise look like a switched-off
 * band.
 *
 * Deliberately NOT the EQ's graph with different data in it. An equaliser
 * draws a transfer curve, because a filter has one and it is the whole truth
 * about the filter. This stage has no transfer curve: what it does depends on
 * the level going in, the harmonics coming out are at frequencies the input
 * does not occupy. So it draws SPANS with a live level in each — an honest
 * picture of a stage whose behaviour is not a line — in the EQ's frame: one
 * plot surface, its grid, and the legend across the top.
 *
 * Painting only. What the pointer does with it is `DspExciterGraph.tsx`, which
 * reads the same geometry from here so a grab lands where the edge is drawn.
 */

const MIN_HZ = 20;
const MAX_HZ = 20_000;

/** The plot inside the canvas, which hit-testing and painting agree on. */
export const EXCITER_PLOT_INSET = {
  left: 8,
  right: 8,
  /** Clear of the legend, which is absolutely positioned over the plot's top. */
  top: 34,
  bottom: 18,
} as const;

const PAD_L = EXCITER_PLOT_INSET.left;
const PAD_R = EXCITER_PLOT_INSET.right;
const PAD_T = EXCITER_PLOT_INSET.top;
const PAD_B = EXCITER_PLOT_INSET.bottom;

/**
 * The same system stack every other graph in this rack paints with.
 *
 * Named in full rather than left to `sans-serif`: canvas has no cascade to
 * fall back through, and a generic family answers from fontconfig on Linux
 * with DejaVu Sans while the DOM beside it is drawing Ubuntu.
 */
const GRAPH_FONT =
  '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Ubuntu, Cantarell, "Noto Sans", "DejaVu Sans", sans-serif';

/** One row of edge readouts; a readout that would overprint another drops one. */
const LABEL_ROW = 12;

/** The spectrum's range, matching the EQ page so the two read alike. */
const SPECTRUM_FLOOR_DB = -96;
const SPECTRUM_TOP_DB = 0;

const GRID_HZ: [number, string][] = [
  [50, '50'],
  [200, '200'],
  [1_000, '1k'],
  [5_000, '5k'],
  [15_000, '15k'],
];

/** How far a band's glow reaches under its level line before it is gone. */
const GLOW_PX = 26;

const EDGE_HANDLE_HEIGHT = 28;

/** The band colours, low to high, and the organic stage's own. */
/** Low and mid in the tokens a scene recolours (`dspInks.ts`); high stays green. */
const HIGH_INK = '150, 226, 128';
const bandInk = (index: number) =>
  [skyInk(), baseCurveInk(), HIGH_INK][index] ?? HIGH_INK;
const ORGANIC_INK = '255, 176, 89';

/** The legend's swatches, in the same colours the canvas draws each one in. */
export const EXCITER_LEGEND = [
  { key: 'dsp.exciter.band.low', color: SKY_CSS },
  { key: 'dsp.exciter.band.mid', color: BASE_CURVE_CSS },
  { key: 'dsp.exciter.band.high', color: `rgb(${HIGH_INK})` },
  { key: 'dsp.exciter.organic', color: `rgb(${ORGANIC_INK})` },
] as const;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

/** Where a frequency stands across a canvas `width` wide. */
export const exciterFrequencyToX = (hz: number, width: number): number => {
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  return (
    PAD_L +
    (Math.log10(clamp(hz, MIN_HZ, MAX_HZ) / MIN_HZ) /
      Math.log10(MAX_HZ / MIN_HZ)) *
      plotW
  );
};

/** The frequency under `x` on a canvas `width` wide. */
export const exciterXToFrequency = (x: number, width: number): number => {
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const position = clamp((x - PAD_L) / plotW, 0, 1);
  return MIN_HZ * (MAX_HZ / MIN_HZ) ** position;
};

/** Which part of a band the pointer holds: the span, or one of its edges. */
export type TExciterBandPart = 'move' | 'low' | 'high';

export interface IExciterPlotFrame {
  settings: IExciterSettings;
  /** Eased amounts, 0 to 1: the three bands, then the organic stage. */
  amounts: readonly number[];
  /** The live spectrum and the Nyquist it was taken against, when there is one. */
  spectrum: { bins: Float32Array; nyquist: number } | undefined;
  /** The band being dragged or pointed at, or else the one last picked. */
  focusedBand: number | undefined;
  /** The part of it under the pointer or in hand. */
  hotPart: TExciterBandPart | undefined;
  textInk: string;
}

/** One frame, onto a context already scaled to CSS pixels and cleared. */
export const paintExciterPlot = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: IExciterPlotFrame,
): void => {
  const { settings: current, amounts, spectrum, focusedBand, textInk } = frame;
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = Math.max(1, height - PAD_T - PAD_B);
  const floorY = PAD_T + plotH;
  const toX = (hz: number) =>
    PAD_L +
    (Math.log10(Math.max(MIN_HZ, hz) / MIN_HZ) / Math.log10(MAX_HZ / MIN_HZ)) *
      plotW;

  context.font = GRAPH_FONT;
  context.lineWidth = 1;

  /* -------------------------------------------------------- the grid */
  // The EQ's grid: faint verticals at the labelled frequencies, and the
  // labels under the floor.
  context.textAlign = 'center';
  context.textBaseline = 'top';
  GRID_HZ.forEach(([hz, label]) => {
    const line = Math.round(toX(hz)) + 0.5;
    context.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    context.beginPath();
    context.moveTo(line, PAD_T);
    context.lineTo(line, floorY);
    context.stroke();
    context.fillStyle = textInk;
    context.fillText(label, toX(hz), floorY + 4);
  });

  /* ---------------------------------------------------- the spectrum */
  if (spectrum) {
    const { bins, nyquist } = spectrum;
    context.beginPath();
    context.moveTo(PAD_L, floorY);
    for (let x = 0; x <= plotW; x += 1) {
      const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (x / plotW);
      const bin = Math.min(
        bins.length - 1,
        Math.max(0, Math.round((hz / nyquist) * bins.length)),
      );
      const peak = Number.isFinite(bins[bin]) ? bins[bin] : SPECTRUM_FLOOR_DB;
      const level =
        (Math.max(SPECTRUM_FLOOR_DB, peak) - SPECTRUM_FLOOR_DB) /
        (SPECTRUM_TOP_DB - SPECTRUM_FLOOR_DB);
      context.lineTo(PAD_L + x, floorY - level * plotH);
    }
    context.lineTo(PAD_L + plotW, floorY);
    context.closePath();
    context.fillStyle = 'rgba(255, 255, 255, 0.07)';
    context.fill();
  }

  /**
   * Each band's own span, which may overlap its neighbours'.
   *
   * Drawn with no ground of its own: its two edges mark it, and what it is
   * doing is a level line between them with a short glow under it. A tint
   * across each span covered the plot from end to end between the three of
   * them, and a fill from the level down to the floor did the same the moment
   * the music got loud: either way the graph stood on a second ground. Where
   * two overlap their glows add up, so the overlap still shows brighter —
   * which is exactly what is happening to the audio there: that octave gets
   * both bands' harmonics.
   */
  current.bands.forEach((band, index) => {
    // The smoothed return reported by the audio thread rather than the raw
    // knob position, so switching or bypassing a band is drawn as the same
    // continuous movement the listener hears.
    const amount = Math.min(1, amounts[index] ?? 0);
    if (!current.enabled || !band.enabled || amount <= 0.002) {
      return;
    }
    const { lowHz, highHz } = exciterBandEdgesForIndex(
      index,
      band.freqHz,
      band.range,
    );
    const x0 = toX(lowHz);
    const span = Math.max(1, toX(highHz) - x0);
    const level = floorY - plotH * amount;
    const glow = Math.min(GLOW_PX, floorY - level);
    const ink = bandInk(index);
    const fill = context.createLinearGradient(0, level, 0, level + glow);
    fill.addColorStop(0, `rgba(${ink}, 0.26)`);
    fill.addColorStop(1, `rgba(${ink}, 0)`);
    context.fillStyle = fill;
    context.fillRect(x0, level, span, glow);
    context.fillStyle = `rgba(${ink}, 0.9)`;
    context.fillRect(x0, level - 1, span, 2);
  });

  /* ------------------------------------------------- the band edges */
  // Each band's own two edges, in its own colour, so an edge belongs to a
  // band by sight. Six lines rather than two, and only the enabled bands' are
  // drawn solidly — with three spans free to overlap, drawing all six at
  // equal weight was a picket fence nobody could read.
  context.lineWidth = 1;
  current.bands.forEach((band, index) => {
    const isOn = current.enabled && band.enabled;
    const { lowHz, highHz } = exciterBandEdgesForIndex(
      index,
      band.freqHz,
      band.range,
    );
    context.setLineDash(isOn ? [] : [2, 3]);
    context.strokeStyle = `rgba(${bandInk(index)}, ${isOn ? 0.55 : 0.2})`;
    [lowHz, highHz].forEach((hz) => {
      const x = Math.round(toX(hz)) + 0.5;
      context.beginPath();
      context.moveTo(x, PAD_T);
      context.lineTo(x, floorY);
      context.stroke();
    });
  });
  context.setLineDash([]);

  /* ---------------------------------------------------- the organic */
  if (current.enabled && current.organic.enabled) {
    /**
     * Its span, which widens with Range while remaining band-limited.
     *
     * Drawn from the same two numbers the audio uses rather than from a
     * separate idea of where it works. It never becomes a broadband
     * non-linearity, because multiplying lows, mids and cymbals together is
     * what made Organic sound grainy.
     */
    const { focusHz, range } = current.organic;
    const { lowHz: from, highHz: to } = organicBandEdges(focusHz, range);
    const x0 = toX(from);
    const x1 = toX(to);
    const amount = Math.min(1, amounts[3] ?? 0);
    const band = Math.max(3, plotH * 0.16 * amount);

    const gradient = context.createLinearGradient(x0, 0, x1, 0);
    gradient.addColorStop(0, `rgba(${ORGANIC_INK}, 0)`);
    gradient.addColorStop(0.5, `rgba(${ORGANIC_INK}, ${0.16 + amount * 0.3})`);
    gradient.addColorStop(1, `rgba(${ORGANIC_INK}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(x0, PAD_T, x1 - x0, band);

    const x = Math.round(toX(focusHz)) + 0.5;
    context.strokeStyle = `rgba(${ORGANIC_INK}, 0.8)`;
    context.beginPath();
    context.moveTo(x, PAD_T);
    context.lineTo(x, PAD_T + band);
    context.stroke();
  }

  /* ---------------------------------------- hovered / selected band */
  // Always painted after every span (and Organic), so overlap cannot bury the
  // one under the pointer. Its edges come forward, heavier and with a grip on
  // each, and nothing is laid over the span itself: a highlight across it put
  // a box back inside the plot.
  const focused =
    focusedBand === undefined ? undefined : current.bands[focusedBand];
  if (
    focusedBand !== undefined &&
    focused &&
    current.enabled &&
    focused.enabled
  ) {
    const { lowHz, highHz } = exciterBandEdgesForIndex(
      focusedBand,
      focused.freqHz,
      focused.range,
    );
    const ink = bandInk(focusedBand);
    const handleY = PAD_T + (plotH - EDGE_HANDLE_HEIGHT) * 0.5;
    context.lineWidth = 2;
    context.strokeStyle = `rgba(${ink}, 0.95)`;
    [
      { x: toX(lowHz), part: 'low' as const },
      { x: toX(highHz), part: 'high' as const },
    ].forEach((edge) => {
      const line = Math.round(edge.x);
      context.beginPath();
      context.moveTo(line, PAD_T);
      context.lineTo(line, floorY);
      context.stroke();

      const isHot = frame.hotPart === edge.part;
      const handleWidth = isHot ? 6 : 4;
      context.fillStyle = `rgba(${ink}, ${isHot ? 1 : 0.82})`;
      context.fillRect(
        Math.round(edge.x - handleWidth * 0.5),
        handleY,
        handleWidth,
        EDGE_HANDLE_HEIGHT,
      );
    });
    context.lineWidth = 1;
  }

  /* ------------------------------------------- the edges, in hertz */
  // Only the enabled bands name their edges; where each readout goes is
  // `exciterReadouts.ts`, which keeps them off each other and inside the plot.
  const spans: IEdgeSpan[] = current.enabled
    ? current.bands.flatMap((band, index) => {
        if (!band.enabled) {
          return [];
        }
        const { lowHz, highHz } = exciterBandEdgesForIndex(
          index,
          band.freqHz,
          band.range,
        );
        return [
          {
            index,
            lowX: toX(lowHz),
            highX: toX(highHz),
            lowText: formatEdge(lowHz),
            highText: formatEdge(highHz),
          },
        ];
      })
    : [];
  context.textAlign = 'left';
  context.textBaseline = 'top';
  placeEdgeReadouts(
    spans,
    (text) => context.measureText(text).width,
    PAD_L,
    width - PAD_R,
    focusedBand,
  ).forEach(({ index, text, left, row }) => {
    context.fillStyle = `rgb(${bandInk(index)})`;
    context.fillText(text, left, PAD_T + 3 + row * LABEL_ROW);
  });
};
