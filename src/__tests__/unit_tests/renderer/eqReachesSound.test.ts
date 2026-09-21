/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the EQ pages lock, as a truth table.
 *
 * The page stayed live while the engine was on and not reaching the output —
 * the side bar's switch read off, the engine's name wore its red dot, and
 * every slider still moved. The half of the condition that was forgotten is
 * the case pinned here, so it cannot be forgotten again quietly.
 */
import eqReachesSound from '../../../renderer/utils/eqReachesSound';

describe('whether a band on the EQ page can be heard', () => {
  it('can, with FluidEQ on and the engine on the output', () => {
    expect(eqReachesSound(true, true)).toBe(true);
  });

  it('cannot, with the engine on and not reaching the output', () => {
    expect(eqReachesSound(true, false)).toBe(false);
  });

  it('cannot, with FluidEQ switched off, whatever the engine says', () => {
    expect(eqReachesSound(false, true)).toBe(false);
    expect(eqReachesSound(false, undefined)).toBe(false);
    expect(eqReachesSound(false, false)).toBe(false);
  });

  /**
   * No status read yet, or an engine that reports none. Locking the page on
   * that would lock it on every launch until the first status arrives, and on
   * Equalizer APO for good.
   */
  it('can, while the window cannot tell yet', () => {
    expect(eqReachesSound(true, undefined)).toBe(true);
  });
});
