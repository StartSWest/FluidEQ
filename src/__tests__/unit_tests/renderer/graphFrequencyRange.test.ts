/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The frequencies the graph spans: the range picked in the View menu while
 * its grid is on (10 Hz to 20 kHz unless another is picked, 2026-11-16), and
 * trimmed to where records have sound while it is off and the plot is a
 * picture drawn edge to edge, whatever range is picked.
 */

import {
  frequencyScale,
  gainScale,
  graphFrequencyRange,
  PICTURE_END,
  PICTURE_START,
} from '../../../renderer/graph/ChartController';
import {
  DEFAULT_GRAPH_FREQUENCY_RANGE,
  GRAPH_FREQUENCY_RANGES,
  GRAPH_FREQUENCY_SPANS,
  SPECTRUM_END,
  SPECTRUM_START,
} from '../../../renderer/graph/graphFrequencyRanges';
import { MAX_GAIN, MIN_GAIN } from '../../../common/constants';

describe('the graph’s frequency range', () => {
  it('shows 10 Hz to 20 kHz with the grid on, unless another range is picked', () => {
    expect(DEFAULT_GRAPH_FREQUENCY_RANGE).toBe('extended');
    expect(graphFrequencyRange(false)).toEqual([10, 20000]);
    expect(graphFrequencyRange(false, 'standard')).toEqual([20, 20000]);
    expect(graphFrequencyRange(false, 'wide')).toEqual([10, 30000]);
    expect(graphFrequencyRange(false, 'music')).toEqual([20, 16000]);
  });

  it('trims the sides with the grid off, whatever range is picked', () => {
    GRAPH_FREQUENCY_RANGES.forEach((range) => {
      expect(graphFrequencyRange(true, range)).toEqual([20, 16000]);
      expect(graphFrequencyRange(true, range)).toEqual([
        PICTURE_START,
        PICTURE_END,
      ]);
    });
  });

  it('hands back the same range every time, so the scale is not rebuilt', () => {
    expect(graphFrequencyRange(true)).toBe(graphFrequencyRange(true));
    GRAPH_FREQUENCY_RANGES.forEach((range) =>
      expect(graphFrequencyRange(false, range)).toBe(
        graphFrequencyRange(false, range),
      ),
    );
  });

  it('samples and reads across every range, so a pick recomputes nothing', () => {
    GRAPH_FREQUENCY_RANGES.forEach((range) => {
      const [start, end] = GRAPH_FREQUENCY_SPANS[range];
      expect(start).toBeGreaterThanOrEqual(SPECTRUM_START);
      expect(end).toBeLessThanOrEqual(SPECTRUM_END);
    });
    expect([SPECTRUM_START, SPECTRUM_END]).toEqual([10, 30000]);
  });

  it('puts each range edge to edge of the plot', () => {
    const [start, end] = graphFrequencyRange(false);
    const full = frequencyScale(1000, 50, 48);
    const picture = frequencyScale(1000, 0, 0, graphFrequencyRange(true));
    expect(full(start)).toBeCloseTo(50, 9);
    expect(full(end)).toBeCloseTo(952, 9);
    expect(picture(PICTURE_START)).toBeCloseTo(0, 9);
    expect(picture(PICTURE_END)).toBeCloseTo(1000, 9);
    // Past a trimmed side is off the plot, not squeezed onto it.
    expect(picture(end)).toBeGreaterThan(1000);
    const wide = frequencyScale(1000, 0, 0, graphFrequencyRange(false, 'wide'));
    expect(wide(30000)).toBeCloseTo(1000, 9);
  });
});

describe('the graph’s gain scale', () => {
  it('holds the EQ’s ±20 dB whatever is drawn on it', () => {
    expect(gainScale(400, 10, 30).domain()).toEqual([MIN_GAIN, MAX_GAIN]);
  });
});
