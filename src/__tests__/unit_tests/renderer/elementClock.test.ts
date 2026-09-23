/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The element's clock, read for jumps the host should follow — and for the
 * many readings that look like jumps and are not.
 */
import { watchElementClock } from '../../../renderer/dsp/elementClock';

describe("the element's clock", () => {
  it('forwards a real jump while the element is the authority', () => {
    const clock = watchElementClock();
    clock.rebase(10_000, 1_000, false);
    expect(clock.read(95_000, 1_250, true, false)).toBe(95_000);
  });

  it('forwards nothing once the host owns the transport', () => {
    const clock = watchElementClock();
    clock.rebase(10_000, 1_000, false);
    expect(clock.read(95_000, 1_250, true, true)).toBeUndefined();
  });

  it('reads a late render as time passing, not as a jump', () => {
    const clock = watchElementClock();
    clock.rebase(10_000, 1_000, false);
    // Six hundred milliseconds late, and the element advanced exactly that.
    expect(clock.read(10_600, 1_600, true, false)).toBeUndefined();
  });

  it('reads a clock that has not moved as stopped, not as a jump', () => {
    const clock = watchElementClock();
    clock.rebase(10_000, 1_000, false);
    // Playing, and far past where it should be by now: the element is paused
    // under a deck, and its frozen reading must not send the deck back.
    expect(clock.read(10_000, 5_000, true, false)).toBeUndefined();
  });

  /**
   * Around a change of track nothing it reads is the listener: the position
   * is the old track's for a tick, then the element's own lead-in lands. The
   * host was cued where the track starts, so until it has the track every
   * reading is a baseline.
   */
  it('holds while the host is brought to a new track, then reads again', () => {
    const clock = watchElementClock();
    clock.rebase(185_000, 1_000, true);
    expect(clock.read(0, 1_250, true, false)).toBeUndefined();
    expect(clock.read(4_000, 1_500, true, false)).toBeUndefined();

    clock.settle();
    expect(clock.read(4_250, 1_750, true, false)).toBeUndefined();
    expect(clock.read(60_000, 2_000, true, false)).toBe(60_000);
  });

  it('takes the listener’s own seek as the reading, so it is not undone', () => {
    const clock = watchElementClock();
    clock.rebase(10_000, 1_000, false);
    clock.claim(120_000, 1_100);
    expect(clock.read(120_150, 1_250, true, false)).toBeUndefined();
  });
});
