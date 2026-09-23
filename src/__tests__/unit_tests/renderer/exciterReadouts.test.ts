/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the Exciter graph prints its bands' edges.
 *
 * Centred on their edges, the readouts printed over each other where two bands
 * met — "296" over "298", "3.0k" over "3.1k" — and the edge at 20 kHz ran off
 * the plot. jsdom has no canvas, so the layout is held here as numbers: text
 * measured at a fixed width per character, on the default rack's spans.
 */

import {
  IEdgeReadout,
  IEdgeSpan,
  READOUT_GAP,
  formatEdge,
  placeEdgeReadouts,
} from '../../../renderer/dsp/exciterReadouts';

const PLOT_LEFT = 8;
const PLOT_WIDTH = 1218;
const PLOT_RIGHT = PLOT_LEFT + PLOT_WIDTH;

/** Roughly the 10px system face: six pixels a character. */
const measure = (text: string) => text.length * 6;

const toX = (hz: number, width = PLOT_WIDTH) =>
  PLOT_LEFT + (Math.log10(hz / 20) / Math.log10(1000)) * width;

const span = (
  index: number,
  lowHz: number,
  highHz: number,
  width = PLOT_WIDTH,
): IEdgeSpan => ({
  index,
  lowX: toX(lowHz, width),
  highX: toX(highHz, width),
  lowText: formatEdge(lowHz),
  highText: formatEdge(highHz),
});

/** The default rack: three bands whose spans meet end to end. */
const DEFAULT_SPANS = [
  span(0, 20, 296),
  span(1, 298, 3_040),
  span(2, 3_050, 20_000),
];

/** Any two readouts on one row closer than the gap between them. */
const overprints = (readouts: readonly IEdgeReadout[]) =>
  readouts.some((first, at) =>
    readouts
      .slice(at + 1)
      .some(
        (second) =>
          first.row === second.row &&
          first.left < second.right + READOUT_GAP &&
          first.right > second.left - READOUT_GAP,
      ),
  );

describe('the Exciter graph naming its bands edges', () => {
  it('says an edge the way the dials do', () => {
    expect(formatEdge(296.4)).toBe('296');
    expect(formatEdge(3_040)).toBe('3.0k');
    expect(formatEdge(3_100)).toBe('3.1k');
    expect(formatEdge(12_345)).toBe('12k');
    expect(formatEdge(20_000)).toBe('20k');
  });

  it('prints every edge of the default rack apart and inside the plot', () => {
    const readouts = placeEdgeReadouts(
      DEFAULT_SPANS,
      measure,
      PLOT_LEFT,
      PLOT_RIGHT,
      undefined,
    );
    expect(readouts.map(({ text }) => text)).toEqual([
      '20',
      '296',
      '298',
      '3.0k',
      '3.0k',
      '20k',
    ]);
    expect(overprints(readouts)).toBe(false);
    readouts.forEach(({ left, right }) => {
      expect(left).toBeGreaterThanOrEqual(PLOT_LEFT);
      expect(right).toBeLessThanOrEqual(PLOT_RIGHT);
    });
    // Two bands meeting read side by side on the first row, each inside its
    // own span: the low band's top before the meeting, the mid's bottom after.
    const [, lowTop, midBottom] = readouts;
    expect(lowTop.row).toBe(0);
    expect(midBottom.row).toBe(0);
    expect(lowTop.right).toBeLessThanOrEqual(DEFAULT_SPANS[0].highX);
    expect(midBottom.left).toBeGreaterThanOrEqual(DEFAULT_SPANS[1].lowX);
  });

  it('POSITIVE CONTROL: centred on their edges, the same readouts overprint', () => {
    const centred: IEdgeReadout[] = DEFAULT_SPANS.flatMap((each) =>
      [
        { x: each.lowX, text: each.lowText },
        { x: each.highX, text: each.highText },
      ].map(({ x, text }) => ({
        index: each.index,
        text,
        left: x - measure(text) / 2,
        right: x + measure(text) / 2,
        row: 0,
      })),
    );
    expect(overprints(centred)).toBe(true);
    expect(Math.max(...centred.map(({ right }) => right))).toBeGreaterThan(
      PLOT_RIGHT,
    );
  });

  it('drops a readout a row rather than print it over another', () => {
    // Overlapping spans: the low band reaches past where the mid band starts.
    const readouts = placeEdgeReadouts(
      [span(0, 20, 330), span(1, 300, 3_000)],
      measure,
      PLOT_LEFT,
      PLOT_RIGHT,
      undefined,
    );
    expect(readouts).toHaveLength(4);
    expect(overprints(readouts)).toBe(false);
    expect(Math.max(...readouts.map(({ row }) => row))).toBeGreaterThan(0);
  });

  it('keeps a span too narrow for its readouts quiet unless it is being worked', () => {
    const narrow = 300;
    const spans = [span(0, 1_000, 1_450, narrow)];
    expect(
      placeEdgeReadouts(
        spans,
        measure,
        PLOT_LEFT,
        PLOT_LEFT + narrow,
        undefined,
      ),
    ).toEqual([]);
    const focused = placeEdgeReadouts(
      spans,
      measure,
      PLOT_LEFT,
      PLOT_LEFT + narrow,
      0,
    );
    expect(focused.map(({ text }) => text)).toEqual(['1.0k', '1.4k']);
    // Outside its edges, where it has room.
    expect(focused[0].right).toBeLessThanOrEqual(spans[0].lowX);
    expect(focused[1].left).toBeGreaterThanOrEqual(spans[0].highX);
    expect(overprints(focused)).toBe(false);
  });
});
