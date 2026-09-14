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
 * are a family of their own because they are one idea drawn nine ways, and
 * somebody who likes the titlebar goes looking for that set.
 */
export const GRAPH_STYLE_FAMILIES = [
  'lines',
  'fills',
  'bars',
  'points',
  'scenes',
  'wave',
] as const;

export type TGraphStyleFamily = (typeof GRAPH_STYLE_FAMILIES)[number];

/**
 * Every style, the retired ones included: a look somebody saved on a retired
 * form still has to file somewhere. A record over the whole union, so a style
 * added without a family does not compile.
 */
const FAMILIES: Record<GraphStyle, TGraphStyleFamily> = {
  line: 'lines',
  area: 'fills',
  bars: 'bars',
  dots: 'points',
  steps: 'bars',
  blocks: 'bars',
  spikes: 'bars',
  ridge: 'fills',
  stems: 'bars',
  terrace: 'fills',
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
  slope: 'lines',
  stalactites: 'scenes',
  bubbles: 'points',
  diamonds: 'points',
  sawtooth: 'lines',
  ecg: 'lines',
  echo: 'lines',
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
  'wave-line': 'wave',
  'wave-filled': 'wave',
  'wave-bars': 'wave',
  'wave-mirror': 'wave',
  'wave-dots': 'wave',
  'wave-ribbon': 'wave',
  'wave-spikes': 'wave',
  'wave-blocks': 'wave',
  'wave-outline': 'wave',
  'wave-lattice': 'wave',
};

export const graphStyleFamily = (style: GraphStyle): TGraphStyleFamily =>
  FAMILIES[style];
