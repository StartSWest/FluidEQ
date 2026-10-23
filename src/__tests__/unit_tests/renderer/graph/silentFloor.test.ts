/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The trace slid right when the music stopped (Ivan, 2026-10-06: "I stop the
 * music and it moves", "it needs to be always in the right position matching
 * the real freq"). Silence was drawn on the graphs' own axis, 10 Hz to
 * 25 kHz, while the music had been measured to Nyquist, and the easing takes
 * x from the frame it eases toward: every falling peak was redrawn up the
 * axis, 4.5 px at 48 kHz and 15 px at 44.1 kHz on a 1,100 px plot. Silence
 * now rests on the axis the music was last measured on.
 */

import { renderHook } from '@testing-library/react';
import { MIN_GAIN } from 'common/constants';
import type { IChartPointData } from 'renderer/graph/ChartController';
import { GRAPH_SILENT_POINTS } from 'renderer/graph/liveGraphBand';
import { silenceOn, useSilentFloor } from 'renderer/graph/silentFloor';

/** A measured frame: log-spaced from 10 Hz to `top`, some level on each. */
const measured = (top: number): IChartPointData[] =>
  Array.from({ length: 96 }, (_, index) => ({
    x: 10 * (top / 10) ** (index / 95),
    y: -20 - (index % 7),
  }));
const xs = (points: readonly IChartPointData[]) => points.map(({ x }) => x);
const at48k = measured(24000);
const at44k = measured(22050);

const floorAfter = (...frames: IChartPointData[][]) => {
  const hook = renderHook(({ live }) => useSilentFloor(live), {
    initialProps: { live: frames[0] },
  });
  frames.slice(1).forEach((live) => hook.rerender({ live }));
  return hook.result;
};

it('rests silence on the axis the music was last measured on', () => {
  const floor = floorAfter(at48k, []).current;
  expect(xs(floor)).toEqual(xs(at48k));
  floor.forEach(({ y }) => expect(y).toBe(MIN_GAIN));
  // CONTROL: the graphs' own axis is another one, so a floor laid on it
  // would move every point the trace falls along.
  expect(xs(GRAPH_SILENT_POINTS)).not.toEqual(xs(at48k));
});

it('rests on the graphs’ own axis before anything has been measured', () => {
  expect(floorAfter([]).current).toBe(GRAPH_SILENT_POINTS);
});

it('takes a new axis once one is measured, as a change of rate brings', () => {
  expect(xs(floorAfter(at48k, at44k, []).current)).toEqual(xs(at44k));
});

it('keeps one floor while the axis stays, whatever the levels on it', () => {
  const hook = renderHook(({ live }) => useSilentFloor(live), {
    initialProps: { live: at48k },
  });
  const before = hook.result.current;
  hook.rerender({ live: at48k.map((point) => ({ ...point, y: -3 })) });
  expect(hook.result.current).toBe(before);
});

it('lays every point of an axis on the floor', () => {
  const floor = silenceOn(at44k);
  expect(xs(floor)).toEqual(xs(at44k));
  floor.forEach(({ y }) => expect(y).toBe(MIN_GAIN));
  expect(Object.isFrozen(floor)).toBe(true);
});
