/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How much listening one live frame stands for: the gap since the last one,
 * only while music plays, and never a sleep or a hidden window.
 */

import {
  accrueFromFrame,
  MAX_FRAME_GAP_SECONDS,
} from '../../../renderer/usage/usageAccrual';

describe('one frame of listening', () => {
  it('is the gap since the previous frame while music plays', () => {
    expect(accrueFromFrame(1000, 1045, true)).toBeCloseTo(0.045);
  });

  it('is nothing in silence, on the first frame, or with the clock going back', () => {
    expect(accrueFromFrame(1000, 1045, false)).toBe(0);
    expect(accrueFromFrame(undefined, 1045, true)).toBe(0);
    expect(accrueFromFrame(1045, 1000, true)).toBe(0);
  });

  it('never counts a sleep or a hidden window as listening', () => {
    expect(accrueFromFrame(0, 60 * 60 * 1000, true)).toBe(
      MAX_FRAME_GAP_SECONDS,
    );
  });
});
