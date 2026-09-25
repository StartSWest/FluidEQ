/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { GraphStyle } from './graphStyles';

/**
 * The kinds of drawing the standard styles come in, for the look picker's
 * filter.
 *
 * By what the eye takes in first, not by how a style is built: Pulse and Echo
 * are traces, so they are lines, whatever they draw with; Skyline and Dancing
 * flames are pictures, so they are scenes. The titlebar wave's own drawings
 * The titlebar wave's own drawings had a family here while they were in the
 * picker; retired, they file under the kind of drawing each one is, because a
 * look somebody saved on one still has to belong somewhere.
 */
export const GRAPH_STYLE_FAMILIES = [
  'analysis',
  'lines',
  'fills',
  'bars',
  'points',
  'scenes',
] as const;

export type TGraphStyleFamily = (typeof GRAPH_STYLE_FAMILIES)[number];

/**
 * Every style, the retired ones included: a look somebody saved on a retired
 * form still has to file somewhere. A record over the whole union, so a style
 * added without a family does not compile.
 */
const FAMILIES: Record<GraphStyle, TGraphStyleFamily> = {
  // The measuring views. Filed together whatever each one draws, because
  // what they have in common is the question they answer, not the shape.
  analyzer: 'analysis',
  compare: 'analysis',
  spectrogram: 'analysis',
  rta: 'analysis',
  average: 'analysis',
  waterfall: 'analysis',
  loudness: 'analysis',
  scope: 'analysis',
  midside: 'analysis',
  notes: 'analysis',
  energy: 'analysis',
  phase: 'analysis',
  ledwall: 'scenes',
  towers: 'scenes',
  tide: 'scenes',
  halo: 'scenes',
  synthwave: 'scenes',
  ledbars: 'scenes',
  neonbars: 'scenes',
  bars3d: 'scenes',
  spectrumwave: 'scenes',
  silkwaves: 'scenes',
  line: 'lines',
  area: 'fills',
  bars: 'bars',
  dots: 'points',
  steps: 'bars',
  blocks: 'bars',
  spikes: 'bars',
  ridge: 'fills',
  stems: 'bars',
  // A scene, whatever it draws with. The eight Ivan designed one at a time
  // are the whole of what is left beside the measuring views, and the picker
  // heads them as one group — filed by what they draw they came out under
  // five headings with one or two rows each (Ivan, 2026-09-23: "separate
  // real meters from the rest of viz like terra and sky line with a group").
  terrace: 'scenes',
  dashes: 'bars',
  scatter: 'points',
  caps: 'points',
  ribs: 'bars',
  pillars: 'bars',
  crown: 'points',
  weave: 'lines',
  contour: 'lines',
  hatch: 'fills',
  matrix: 'bars',
  skyline: 'scenes',
  bezier: 'lines',
  ribbon: 'fills',
  feather: 'lines',
  truss: 'scenes',
  zipper: 'lines',
  slope: 'scenes',
  stalactites: 'scenes',
  bubbles: 'scenes',
  diamonds: 'points',
  sawtooth: 'lines',
  ecg: 'scenes',
  echo: 'scenes',
  racer: 'scenes',
  invaders: 'scenes',
  starfield: 'scenes',
  candles: 'bars',
  arches: 'scenes',
  flames: 'scenes',
  barcode: 'bars',
  rain: 'scenes',
  honeycomb: 'bars',
  fence: 'bars',
  braid: 'lines',
  stitch: 'points',
  canyon: 'fills',
  fluid: 'fills',
  'wave-line': 'lines',
  'wave-filled': 'fills',
  'wave-bars': 'bars',
  'wave-mirror': 'lines',
  'wave-dots': 'points',
  'wave-ribbon': 'fills',
  'wave-spikes': 'bars',
  'wave-blocks': 'bars',
  'wave-outline': 'lines',
  'wave-lattice': 'fills',
};

export const graphStyleFamily = (style: GraphStyle): TGraphStyleFamily =>
  FAMILIES[style];
