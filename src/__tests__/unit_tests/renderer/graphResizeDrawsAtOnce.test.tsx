/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's rules take a new size at once and never glide into it: glided,
 * the grid slid into place every time the graph appeared on a page and again
 * leaving full screen (Ivan, 2026-09-26: "no moving animation like when
 * exiting full screen … kind of move the grid in an animation"). What the
 * graph shows changing still glides — the control below.
 */

import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import * as d3 from 'd3';
import GridLine from 'renderer/graph/GridLine';
import scaleRangeKey from 'renderer/graph/scaleRange';

const TICKS = [10, 100, 1000];

const grid = (width: number, top = 1000) => (
  <svg>
    <GridLine
      type="vertical"
      scale={d3.scaleLog().domain([10, top]).range([0, width])}
      tickValues={TICKS}
      size={100}
    />
  </svg>
);

/** Where the middle rule stands, in pixels. */
const middleRule = (container: HTMLElement) =>
  Number(
    /translate\(([-\d.]+),/.exec(
      container.querySelectorAll('g.tick')[1]?.getAttribute('transform') ?? '',
    )?.[1],
  );

describe('a resized graph', () => {
  it('rules its grid at the new size in the same render', () => {
    const { container, rerender } = render(grid(200));
    expect(middleRule(container)).toBeCloseTo(100.5);
    rerender(grid(400));
    expect(middleRule(container)).toBeCloseTo(200.5);
  });

  // The control: the same size showing another span is a change of what is
  // shown, and that still glides — the rule has not moved yet.
  it('still glides when what is shown changes', () => {
    const { container, rerender } = render(grid(200));
    rerender(grid(200, 10000));
    expect(middleRule(container)).toBeCloseTo(100.5);
  });

  it('tells a size from a change of scale by the pixels the scales span', () => {
    const narrow = d3.scaleLinear().domain([0, 1]).range([0, 200]);
    const zoomed = d3.scaleLinear().domain([0, 2]).range([0, 200]);
    const wide = d3.scaleLinear().domain([0, 1]).range([0, 400]);
    expect(scaleRangeKey(narrow)).toBe(scaleRangeKey(zoomed));
    expect(scaleRangeKey(narrow)).not.toBe(scaleRangeKey(wide));
  });
});
