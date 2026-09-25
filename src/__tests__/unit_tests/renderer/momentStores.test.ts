/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two window-wide moments — a correction landing, the graph's caption —
 * end when the element showing them reports its own animation's end, by id,
 * and never on a clock. Time alone leaves each up with nothing scheduled (the
 * null, which the timers they replaced fail); an end reported for another
 * moment leaves it up; its own end takes it down (the positive control). And
 * with nothing mounted to show one, it is over: kept, it would reappear over
 * the next page mounted, about something long past.
 */

import { act, renderHook } from '@testing-library/react';
import {
  endCorrectionFlash,
  flashCorrection,
  useCorrectionFlash,
} from 'renderer/utils/correctionFlash';
import {
  announceGraphMode,
  endGraphModeAnnouncement,
  useGraphModeAnnouncement,
} from 'renderer/utils/graphViewSettings';

/**
 * Every timer this replaced would still be pending here. A helper, so the
 * check can run after each test without being an `expect` in a hook.
 */
const expectNothingScheduled = () => expect(jest.getTimerCount()).toBe(0);

const REGION = { label: 'Bass', lowFrequency: 60, highFrequency: 250 };

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  expectNothingScheduled();
  jest.useRealTimers();
});

describe('a correction landing', () => {
  it('stays until its own moment ends, and only its own', () => {
    const { result } = renderHook(() => useCorrectionFlash());
    act(() => flashCorrection([REGION]));
    const shown = result.current;
    if (!shown) {
      throw new Error('the landing was not shown');
    }
    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current).toBe(shown);

    act(() => endCorrectionFlash(shown.id + 1));
    expect(result.current).toBe(shown);
    act(() => endCorrectionFlash(shown.id));
    expect(result.current).toBeUndefined();
  });

  it('is shown to nobody when nothing is mounted, and over when that goes', () => {
    act(() => flashCorrection([REGION]));
    const first = renderHook(() => useCorrectionFlash());
    expect(first.result.current).toBeUndefined();

    act(() => flashCorrection([REGION]));
    expect(first.result.current).toBeDefined();
    first.unmount();
    const second = renderHook(() => useCorrectionFlash());
    expect(second.result.current).toBeUndefined();
    second.unmount();
  });
});

describe('the graph caption', () => {
  it('stays until its own animation ends, and only its own', () => {
    const { result } = renderHook(() => useGraphModeAnnouncement());
    act(() => announceGraphMode('Bands only'));
    const { id } = result.current;
    expect(result.current.label).toBe('Bands only');
    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.label).toBe('Bands only');

    act(() => endGraphModeAnnouncement(id - 1));
    expect(result.current.label).toBe('Bands only');
    act(() => endGraphModeAnnouncement(id));
    // A render sees the end: the snapshot changes, not only the words.
    expect(result.current).toEqual({ label: '', id });
  });

  it('is said to nobody when no chart is mounted, and over when it goes', () => {
    act(() => announceGraphMode('Curves only'));
    const first = renderHook(() => useGraphModeAnnouncement());
    expect(first.result.current.label).toBe('');

    act(() => announceGraphMode('Curves only'));
    expect(first.result.current.label).toBe('Curves only');
    first.unmount();
    const second = renderHook(() => useGraphModeAnnouncement());
    expect(second.result.current.label).toBe('');
    second.unmount();
  });
});
