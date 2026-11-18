/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A scene's preview clip runs from night to full day across its ten seconds
 * (Ivan, 2026-11-17: "record the scenes from night to day in the 10 seconds,
 * from 0 to 100"). The hour is the take's own clock — the recorder's elapsed
 * time, which leaves out every second the take was held — so a pause holds
 * the hour and the line comes out even in the clip. Only the take reads it:
 * outside one the stage draws the dialog slider's hour.
 */

import { renderHook } from '@testing-library/react';
import { PREVIEW_DURATION_MS } from 'common/scenePreviewMedia';
import { SCENE_DAYLIGHT_MAX, SCENE_DAYLIGHT_MIN } from 'common/sceneDaylight';
import {
  sweepDaylight,
  useDaylightSweep,
} from 'renderer/studio/StudioPublishSweep';
import type { TPublishVideoState } from 'renderer/studio/usePublishVideo';

const recording = (elapsedMs: number): TPublishVideoState => ({
  phase: 'recording',
  elapsedMs,
});

describe('the hour of a sweeping take', () => {
  it('is night until the first kept frame', () => {
    expect(sweepDaylight({ phase: 'waiting' })).toBe(SCENE_DAYLIGHT_MIN);
    expect(sweepDaylight({ phase: 'preparing' })).toBe(SCENE_DAYLIGHT_MIN);
  });

  it('runs in a straight line from night to full day across the clip', () => {
    expect(sweepDaylight(recording(0))).toBe(SCENE_DAYLIGHT_MIN);
    expect(sweepDaylight(recording(PREVIEW_DURATION_MS / 4))).toBeCloseTo(
      25,
      9,
    );
    expect(sweepDaylight(recording(PREVIEW_DURATION_MS / 2))).toBeCloseTo(
      50,
      9,
    );
    expect(sweepDaylight(recording(PREVIEW_DURATION_MS))).toBe(
      SCENE_DAYLIGHT_MAX,
    );
    // Never past full day, however long the encoder is waited on.
    expect(sweepDaylight(recording(PREVIEW_DURATION_MS * 2))).toBe(
      SCENE_DAYLIGHT_MAX,
    );
  });

  it('holds the hour where it was while the take is held', () => {
    const at = PREVIEW_DURATION_MS * 0.3;
    expect(sweepDaylight({ phase: 'paused', elapsedMs: at })).toBe(
      sweepDaylight(recording(at)),
    );
  });

  it('says nothing once the take is over, so the slider’s hour is drawn', () => {
    expect(sweepDaylight({ phase: 'encoding' })).toBeUndefined();
    expect(sweepDaylight({ phase: 'checking' })).toBeUndefined();
    expect(sweepDaylight({ phase: 'failed' })).toBeUndefined();
    expect(sweepDaylight({ phase: 'cancelled' })).toBeUndefined();
  });
});

describe('the stage’s read of the hour', () => {
  it('is the take’s while sweeping and the slider’s otherwise', () => {
    const chosen = { current: 70 };
    const sweep = renderHook(
      ({ sweeping, state }) => useDaylightSweep(sweeping, state, chosen),
      {
        initialProps: {
          sweeping: true,
          state: recording(PREVIEW_DURATION_MS / 2),
        },
      },
    );
    const read = sweep.result.current;
    expect(read()).toBeCloseTo(50, 9);
    // The same read, a render later: the stage never waits on one.
    sweep.rerender({ sweeping: true, state: recording(PREVIEW_DURATION_MS) });
    expect(sweep.result.current).toBe(read);
    expect(read()).toBe(SCENE_DAYLIGHT_MAX);
    // Night to day switched off, or the take over: the slider's hour.
    sweep.rerender({ sweeping: false, state: recording(PREVIEW_DURATION_MS) });
    expect(read()).toBe(70);
    sweep.rerender({ sweeping: true, state: { phase: 'encoding' } });
    expect(read()).toBe(70);
  });
});
