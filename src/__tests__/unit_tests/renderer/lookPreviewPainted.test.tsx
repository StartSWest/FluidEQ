/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The look preview letting go once the trace has painted it, not a second
 * later by a timer.
 *
 * The timer ran whether or not a frame was drawn: behind a hidden window, or
 * while the canvas was still crossfading from the old look, the preview was
 * spent before the new look had shown it whole.
 */

import { act, renderHook } from '@testing-library/react';
import { MIN_GAIN } from 'common/constants';
import type { IChartPointData } from 'renderer/graph/ChartController';
import {
  noteLookPreviewPainted,
  useLookPreviewPoints,
} from 'renderer/graph/lookPreview';

const silence: IChartPointData[] = [
  { x: 100, y: MIN_GAIN },
  { x: 1000, y: MIN_GAIN },
  { x: 10000, y: MIN_GAIN },
];

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
});

afterEach(() => {
  jest.useRealTimers();
});

const pickLook = () => {
  const view = renderHook(
    ({ lookId }: { lookId: string }) => useLookPreviewPoints(silence, lookId),
    { initialProps: { lookId: 'line' } },
  );
  expect(view.result.current).toBe(silence);
  view.rerender({ lookId: 'bars' });
  return view;
};

it('holds the preview, with no timer, until the trace has painted it', () => {
  const view = pickLook();
  const preview = view.result.current;
  // POSITIVE CONTROL: changing look in silence plays a preview.
  expect(preview).not.toBe(silence);
  expect(preview.some((point) => point.y > MIN_GAIN + 10)).toBe(true);

  expect(jest.getTimerCount()).toBe(0);
  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(view.result.current).toBe(preview);

  // NULL: a frame painted from other points is not this preview painted.
  act(() => noteLookPreviewPainted(silence));
  expect(view.result.current).toBe(preview);

  act(() => noteLookPreviewPainted(preview));
  expect(view.result.current).toBe(silence);
});

it('stops listening once it has let go', () => {
  const view = pickLook();
  const preview = view.result.current;
  act(() => noteLookPreviewPainted(preview));
  view.rerender({ lookId: 'bars' });
  // Painted again after letting go: nothing to release, nothing brought back.
  act(() => noteLookPreviewPainted(preview));
  expect(view.result.current).toBe(silence);
});
