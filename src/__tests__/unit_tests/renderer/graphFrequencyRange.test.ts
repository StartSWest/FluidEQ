/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The frequencies the graph spans: the whole spectrum while its grid is on,
 * an octave under 20 Hz included, and trimmed to where records have sound
 * while it is off and the plot is a picture drawn edge to edge.
 */

import {
  frequencyScale,
  gainScale,
  GRAPH_END,
  GRAPH_START,
  graphFrequencyRange,
  PICTURE_END,
  PICTURE_START,
} from '../../../renderer/graph/ChartController';
import { MAX_GAIN, MIN_GAIN } from '../../../common/constants';

describe('the graph’s frequency range', () => {
  it('shows the whole spectrum with the grid on', () => {
    expect(graphFrequencyRange(false)).toEqual([10, 25000]);
    expect(graphFrequencyRange(false)).toEqual([GRAPH_START, GRAPH_END]);
  });

  it('trims the sides with the grid off', () => {
    expect(graphFrequencyRange(true)).toEqual([20, 16000]);
    expect(graphFrequencyRange(true)).toEqual([PICTURE_START, PICTURE_END]);
  });

  it('hands back the same range every time, so the scale is not rebuilt', () => {
    expect(graphFrequencyRange(true)).toBe(graphFrequencyRange(true));
    expect(graphFrequencyRange(false)).toBe(graphFrequencyRange(false));
  });

  it('puts each range edge to edge of the plot', () => {
    const full = frequencyScale(1000, 50, 48);
    const picture = frequencyScale(1000, 0, 0, graphFrequencyRange(true));
    expect(full(GRAPH_START)).toBeCloseTo(50, 9);
    expect(full(GRAPH_END)).toBeCloseTo(952, 9);
    expect(picture(PICTURE_START)).toBeCloseTo(0, 9);
    expect(picture(PICTURE_END)).toBeCloseTo(1000, 9);
    // Past a trimmed side is off the plot, not squeezed onto it.
    expect(picture(GRAPH_END)).toBeGreaterThan(1000);
  });
});

describe('the graph’s gain scale', () => {
  it('holds the EQ’s ±20 dB whatever is drawn on it', () => {
    expect(gainScale(400, 10, 30).domain()).toEqual([MIN_GAIN, MAX_GAIN]);
  });
});
