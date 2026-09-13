/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The flash guard's arithmetic: what the pressure a pixel carries does frame
 * by frame, which the state shader mirrors. The GPU passes themselves were
 * measured in a browser (an inverting checkerboard and a red-grey flash went
 * from 30 flashes a second to none; a moving dot and a field of particles
 * were drawn exactly as before).
 */

import {
  FLASH_PRESSURE_FULL,
  FLASH_PRESSURE_START,
  FLASH_SWING,
  flashPressure,
  flashPressureDecay,
} from '../../../renderer/graph/sceneFlashGuard';

const FRAME_MS = 1000 / 60;

/** A full swing every `every` frames, each the opposite of the one before. */
const alternating = (every: number) => (frame: number) => {
  if (frame % every !== 0) {
    return 0;
  }
  return frame % (every * 2) === 0 ? 1 : -1;
};

/** A pixel's pressure over `frames`, swinging by `swingAt(frame)` each frame. */
const run = (frames: number, swingAt: (frame: number) => number) => {
  let pressure = 0;
  let lastSwing = 0;
  let highest = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const swing = swingAt(frame);
    pressure = flashPressure(pressure, swing, lastSwing, FRAME_MS);
    lastSwing =
      Math.abs(swing) >= FLASH_SWING
        ? swing
        : lastSwing * flashPressureDecay(FRAME_MS);
    highest = Math.max(highest, pressure);
  }
  return { pressure, highest };
};

describe('the flash guard’s pressure', () => {
  it('reaches the full limit within a few frames of a strobe', () => {
    // Full swings, opposite every frame: thirty flashes a second.
    const strobe = run(8, alternating(1));
    expect(strobe.pressure).toBeGreaterThanOrEqual(FLASH_PRESSURE_FULL);
  });

  it('stays under the limit for two flashes a second, which WCAG allows', () => {
    // A swing every fifteen frames at 60 frames a second: two flashes a second.
    const allowed = run(600, alternating(15));
    expect(allowed.highest).toBeLessThan(FLASH_PRESSURE_START);
    // Positive control: the same swings at six flashes a second do not.
    const tooMany = run(600, alternating(5));
    expect(tooMany.highest).toBeGreaterThanOrEqual(FLASH_PRESSURE_FULL);
  });

  it('leaves something passing by alone: in, a while, and out again', () => {
    const passing = run(120, (frame) => {
      if (frame === 10) {
        return 1;
      }
      return frame === 20 ? -1 : 0;
    });
    expect(passing.highest).toBeLessThan(FLASH_PRESSURE_START);
  });

  it('falls all the way back once the flashing stops, despite 8-bit rounding', () => {
    const strobeThenStill = alternating(1);
    const after = run(60 * 20, (frame) =>
      frame < 60 ? strobeThenStill(frame) : 0,
    );
    expect(after.highest).toBe(1);
    expect(after.pressure).toBe(0);
  });

  it('gives a stalled frame no more decay than a tenth of a second', () => {
    expect(flashPressureDecay(5000)).toBeCloseTo(flashPressureDecay(100));
    expect(flashPressureDecay(0)).toBe(1);
  });
});
