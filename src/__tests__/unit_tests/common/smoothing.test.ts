/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  EUPHORIA_FRAME_MS,
  SMOOTH_FRAME_MS,
  easeTowards,
  getEaseFactor,
  shouldDrawFrame,
} from 'common/smoothing';

describe('getEaseFactor', () => {
  it('covers half the distance in one half-life', () => {
    expect(getEaseFactor(50, 50)).toBeCloseTo(0.5, 5);
  });

  it('is the same motion however fast the display runs', () => {
    // The property the whole thing exists for. Two 8ms frames on a 120Hz
    // screen must cover the same ground as one 16ms frame on a 60Hz one, or
    // the animation is quicker on better hardware.
    const slow = getEaseFactor(16, 50);
    const fast = getEaseFactor(8, 50);
    const afterOneSlow = 1 - slow;
    const afterTwoFast = (1 - fast) * (1 - fast);
    expect(afterTwoFast).toBeCloseTo(afterOneSlow, 5);
  });

  it('does not snap after the window was left alone', () => {
    // A backgrounded window hands back an enormous delta on its first frame
    // back. Unclamped that is a factor of 1 and the trace teleports.
    expect(getEaseFactor(60000, 50)).toBeLessThan(1);
  });

  it('arrives immediately when there is no half-life to speak of', () => {
    expect(getEaseFactor(16, 0)).toBe(1);
  });
});

describe('easeTowards', () => {
  it('moves toward the target without overshooting it', () => {
    const current = [0];
    easeTowards(current, [10], 0.5);
    expect(current[0]).toBeCloseTo(5);
    easeTowards(current, [10], 0.5);
    expect(current[0]).toBeCloseTo(7.5);
  });

  it('reports movement while it is still going', () => {
    expect(easeTowards([0], [1], 0.5)).toBe(true);
  });

  it('stops reporting movement once it has arrived', () => {
    // What lets the animation loop shut down. Without it a silent room costs
    // sixty wake-ups a second forever.
    expect(easeTowards([1], [1], 0.5)).toBe(false);
  });

  it('snaps the last hair rather than approaching forever', () => {
    // An exponential ease never technically finishes, so a value that is
    // close enough is set exactly — otherwise the loop never stops and the
    // drawn shape is permanently a rounding error away from the measurement.
    const current = [0.9999999];
    expect(easeTowards(current, [1], 0.5)).toBe(false);
    expect(current[0]).toBe(1);
  });

  it('works in place, because it runs on hundreds of values every frame', () => {
    const current = [0, 0, 0];
    const same = current;
    easeTowards(current, [1, 2, 3], 1);
    expect(current).toBe(same);
    expect(current).toEqual([1, 2, 3]);
  });

  it('handles falling as well as rising', () => {
    const current = [10];
    easeTowards(current, [0], 0.5);
    expect(current[0]).toBeCloseTo(5);
  });
});

describe('the frame budget', () => {
  it('caps ordinary use at thirty a second', () => {
    expect(shouldDrawFrame(10, SMOOTH_FRAME_MS)).toBe(false);
    expect(shouldDrawFrame(34, SMOOTH_FRAME_MS)).toBe(true);
  });

  it('lets euphoria run at whatever the display offers', () => {
    // Zero is a floor on the interval, not a target rate — so a 144Hz screen
    // is not held down to 60 during the one moment that is meant to look
    // expensive.
    expect(shouldDrawFrame(7, EUPHORIA_FRAME_MS)).toBe(true);
    expect(shouldDrawFrame(0, EUPHORIA_FRAME_MS)).toBe(true);
  });
});

describe('meter ballistics', () => {
  it('rises faster than it falls when told to', () => {
    // What makes a spectrum look driven by music rather than averaging it: a
    // kick arrives at once and decays over a beat, so the two directions are
    // not the same motion.
    const rising = [0];
    easeTowards(rising, [1], 0.8, 0.1);
    const falling = [1];
    easeTowards(falling, [0], 0.8, 0.1);

    expect(rising[0]).toBeCloseTo(0.8);
    // Fell only a tenth, where it rose four fifths.
    expect(falling[0]).toBeCloseTo(0.9);
  });

  it('stays symmetric when only one factor is given', () => {
    // The waveform meter draws a shape oscillating about zero rather than a
    // level, so easing its two directions differently would bend the wave
    // rather than add punch.
    const rising = [0];
    easeTowards(rising, [1], 0.5);
    const falling = [1];
    easeTowards(falling, [0], 0.5);
    expect(rising[0]).toBeCloseTo(0.5);
    expect(falling[0]).toBeCloseTo(0.5);
  });

  it('arrives within one measurement at the attack rate', () => {
    // The bug being fixed: a half-life longer than the 45ms between
    // measurements means the shape never reaches one target before the next
    // replaces it, so it trails the music forever however smooth it looks.
    const value = [0];
    let elapsed = 0;
    while (elapsed < 45) {
      easeTowards(value, [1], getEaseFactor(16, 10));
      elapsed += 16;
    }
    expect(value[0]).toBeGreaterThan(0.9);
  });
});
