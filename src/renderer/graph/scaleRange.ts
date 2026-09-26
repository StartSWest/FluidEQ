/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type * as d3 from 'd3';

/**
 * The pixels a set of scales spans, as one comparable key.
 *
 * What the graph draws glides when what it shows changes — a preset loading,
 * a band dragged — and must not when only the graph's size does. A size
 * change moves every scale's range and none of its domain, so comparing the
 * ranges from one draw to the next is what tells the two apart. Glided on a
 * resize, the grid and the curves slid into place every time the graph
 * appeared on a page (its first measured size is a resize from nothing) and
 * again leaving full screen (Ivan, 2026-09-26: "no moving animation like
 * when exiting full screen … kind of move the grid in an animation").
 */
const scaleRangeKey = (
  ...scales: readonly d3.AxisScale<d3.NumberValue>[]
): string => scales.map((scale) => scale.range().join(',')).join('|');

export default scaleRangeKey;
