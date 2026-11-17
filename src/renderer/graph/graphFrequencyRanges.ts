/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The frequency spans the graph can be set to, picked in its View menu
 * (Ivan, 2026-11-16: "what are the standard professional frequencies on a
 * graph? We need an option for users to pick from different frequency
 * distributions").
 *
 * - `extended`, 10 Hz to 20 kHz, the default: the span Ivan chose the same
 *   day, an octave under 20 Hz for the low cut's slope and the rumble it
 *   takes out, and nothing past 20 kHz.
 * - `standard`, 20 Hz to 20 kHz: the range of hearing, which most analysers
 *   and equalisers open at.
 * - `wide`, 10 Hz to 30 kHz: as FabFilter Pro-Q draws it, for an output
 *   faster than 48 kHz. On a 48 kHz output the analyser stops at Nyquist,
 *   24 kHz, and the curves hold their Nyquist value past it, as they are
 *   played (`getFilterLineData`).
 * - `music`, 20 Hz to 16 kHz: where records have sound. Most masters, and
 *   every MP3, are empty above 16 kHz.
 *
 * Each span is one frozen pair, never rebuilt: the scale is memoised on the
 * pair's identity, and every axis handed a new one restarts its transition.
 */
export const GRAPH_FREQUENCY_RANGES = [
  'extended',
  'standard',
  'wide',
  'music',
] as const;

export type TGraphFrequencyRange = (typeof GRAPH_FREQUENCY_RANGES)[number];

export const DEFAULT_GRAPH_FREQUENCY_RANGE: TGraphFrequencyRange = 'extended';

export const GRAPH_FREQUENCY_SPANS: Readonly<
  Record<TGraphFrequencyRange, readonly [number, number]>
> = Object.freeze({
  extended: Object.freeze([10, 20000] as const),
  standard: Object.freeze([20, 20000] as const),
  wide: Object.freeze([10, 30000] as const),
  music: Object.freeze([20, 16000] as const),
});

export const isGraphFrequencyRange = (
  value: unknown,
): value is TGraphFrequencyRange =>
  GRAPH_FREQUENCY_RANGES.some((range) => range === value);

/**
 * The span every curve is sampled over and the analyser is read across:
 * every range the plot can be set to, so a range change moves the scale and
 * never has to recompute a curve or rebuild the analyser. The plot clips
 * what lies past its own edges, as it always did with the grid off.
 */
export const SPECTRUM_START = Math.min(
  ...GRAPH_FREQUENCY_RANGES.map((range) => GRAPH_FREQUENCY_SPANS[range][0]),
);
export const SPECTRUM_END = Math.max(
  ...GRAPH_FREQUENCY_RANGES.map((range) => GRAPH_FREQUENCY_SPANS[range][1]),
);
