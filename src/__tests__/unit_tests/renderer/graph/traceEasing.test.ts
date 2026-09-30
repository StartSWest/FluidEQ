/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The trace's drawn copy eased toward each measured frame. After a look
 * preview, the Analyzer was drawn squeezed into 20 Hz to 20 kHz: the copy
 * kept the frequencies of the preview it was first made from (2026-09-27).
 */

import type { IChartPointData } from 'renderer/graph/ChartController';
import easeTraceToward from 'renderer/graph/traceEasing';

const at = (xs: number[], y: number): IChartPointData[] =>
  xs.map((x) => ({ x, y }));

it('takes every point’s place on the axis from the frame, never from the copy', () => {
  // The copy laid out on a preview's 20 Hz to 20 kHz; the frame on the
  // graph's own 10 Hz to 24 kHz.
  const eased = at([20, 1000, 20000], -80);
  const frame = at([10, 1100, 24000], -20);
  easeTraceToward(eased, frame, 0.5, 0.5);
  expect(eased.map((point) => point.x)).toEqual([10, 1100, 24000]);
  // The control: the levels are eased, not taken.
  expect(eased.map((point) => point.y)).toEqual([-50, -50, -50]);
});

it('rises by the attack and falls by the release', () => {
  const eased = [
    { x: 100, y: -60 },
    { x: 200, y: -20 },
  ];
  const { moving } = easeTraceToward(eased, at([100, 200], -40), 0.25, 0.75);
  expect(eased.map((point) => point.y)).toEqual([-55, -35]);
  expect(moving).toBe(true);
});

it('settles within a twentieth of a decibel, and says it has stopped', () => {
  const eased = at([100, 200], -40.04);
  const { moving } = easeTraceToward(eased, at([100, 200], -40), 0.1, 0.1);
  expect(eased.map((point) => point.y)).toEqual([-40, -40]);
  expect(moving).toBe(false);
});

it('is rising while a point is more than a decibel short of the frame', () => {
  expect(
    easeTraceToward(at([100], -41.5), at([100], -40), 0.5, 0.5).rising,
  ).toBe(true);
  // A decibel short, or above: reached.
  expect(easeTraceToward(at([100], -41), at([100], -40), 0.5, 0.5).rising).toBe(
    false,
  );
  expect(easeTraceToward(at([100], -30), at([100], -40), 0.5, 0.5).rising).toBe(
    false,
  );
});
