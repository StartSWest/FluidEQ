/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A look picked in silence plays one frame of spectrum across the plot. With
 * no capture to borrow an axis from, the preview was laid out on 20 Hz to
 * 20 kHz and drew short of both ends of a graph that spans 10 Hz to Nyquist
 * (2026-09-27). It takes the graph's own axis now, and a capture's when there
 * is one.
 */

import { renderHook } from '@testing-library/react';
import { MIN_GAIN } from 'common/constants';
import type { IChartPointData } from 'renderer/graph/ChartController';
import { GRAPH_SILENT_POINTS } from 'renderer/graph/liveGraphBand';
import { useLookPreviewPoints } from 'renderer/graph/lookPreview';

/** The points drawn once the look has changed from `a` to `b`. */
const previewAfterPick = (live: IChartPointData[]) => {
  const hook = renderHook(
    ({ lookId }: { lookId: string }) => useLookPreviewPoints(live, lookId),
    { initialProps: { lookId: 'a' } },
  );
  hook.rerender({ lookId: 'b' });
  return hook.result.current;
};

it('lays a preview with no capture across the graph’s whole axis', () => {
  const preview = previewAfterPick([]);
  expect(preview.map((point) => point.x)).toEqual(
    GRAPH_SILENT_POINTS.map((point) => point.x),
  );
  // A spectrum, not the floor.
  expect(Math.max(...preview.map((point) => point.y))).toBeGreaterThan(
    MIN_GAIN + 10,
  );
});

it('lays it on the capture’s axis when there is one', () => {
  const capture = [20, 200, 2000, 20000].map((x) => ({ x, y: MIN_GAIN }));
  const preview = previewAfterPick(capture);
  expect(preview.map((point) => point.x)).toEqual([20, 200, 2000, 20000]);
});
