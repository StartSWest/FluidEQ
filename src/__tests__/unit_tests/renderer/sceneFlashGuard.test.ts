/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FLASH_AREA_FULL,
  FLASH_AREA_START,
  FLASH_AREA_WINDOW,
  FLASH_LIMIT_PER_SECOND,
  FLASH_PRESSURE_FULL,
  FLASH_PRESSURE_START,
  FLASH_SWING,
  flashAllowance,
  flashAreaLod,
  flashBlend,
  flashLod,
  flashPressure,
  flashPressureDecay,
} from '../../../renderer/graph/sceneFlashGuard';

/**
 * WCAG 2.3.1: a general flash is a pair of opposing changes of at least 10 %
 * of full relative luminance, and no more than three flashes may happen in any
 * one second. Three pairs are six swings — 0.6 of full scale in one second.
 */
const WCAG_SWING = 0.1;
const WCAG_FLASHES_PER_SECOND = 3;

describe('the brightness limiter', () => {
  it('stays below what three flashes a second need', () => {
    const needed = WCAG_SWING * 2 * WCAG_FLASHES_PER_SECOND;
    expect(FLASH_LIMIT_PER_SECOND).toBeLessThan(needed);
  });

  it('allows the same change per second at any frame rate', () => {
    const perSecond = (fps: number) => flashAllowance(1000 / fps) * fps;
    expect(perSecond(30)).toBeCloseTo(FLASH_LIMIT_PER_SECOND, 6);
    expect(perSecond(60)).toBeCloseTo(FLASH_LIMIT_PER_SECOND, 6);
    expect(perSecond(144)).toBeCloseTo(FLASH_LIMIT_PER_SECOND, 6);
  });

  it('gives a stalled frame no more than a tenth of a second of change', () => {
    expect(flashAllowance(5000)).toBeCloseTo(flashAllowance(100), 9);
    expect(flashAllowance(-3)).toBe(0);
  });

  it('shows all of a gentle change and only part of a sudden one', () => {
    const allowance = flashAllowance(1000 / 60);
    // The control: a change inside the allowance passes untouched.
    expect(flashBlend(allowance / 2, allowance)).toBe(1);
    // A full white flash is spread over about two seconds.
    expect(flashBlend(1, allowance)).toBeCloseTo(allowance, 9);
    expect(flashBlend(-1, allowance)).toBeCloseTo(allowance, 9);
  });

  it('reads luminance from a level about a quarter of the frame across', () => {
    expect(2 ** flashLod(3840, 2160)).toBeCloseTo(3840 / 4, 6);
    expect(2 ** flashLod(400, 1200)).toBeCloseTo(1200 / 4, 6);
    expect(flashLod(2, 2)).toBe(0);
  });

  it('judges the flashing share over a window a quarter of the frame across', () => {
    // Four taps half a texel either side, on the half-size flag texture.
    const window = (width: number, height: number) =>
      2 ** flashAreaLod(width, height) * 2 * 2;
    expect(window(1460, 603)).toBeCloseTo(1460 / FLASH_AREA_WINDOW, 6);
    expect(window(1080, 1920)).toBeCloseTo(1920 / FLASH_AREA_WINDOW, 6);
    expect(flashAreaLod(8, 8)).toBe(0);
  });

  it('holds only once flashing covers at least a fifth of that window', () => {
    // WCAG counts a quarter of a 10° field; flame flicker filled about that
    // without flashing as a whole, so holding starts just below it.
    expect(FLASH_AREA_START).toBeGreaterThanOrEqual(0.2);
    expect(FLASH_AREA_START).toBeLessThan(0.25);
    expect(FLASH_AREA_FULL).toBeGreaterThan(FLASH_AREA_START);
    expect(FLASH_AREA_FULL).toBeLessThanOrEqual(0.35);
  });
});

// What the pressure a pixel carries does frame by frame, which the state
// shader mirrors. The GPU passes were measured in a browser: an inverting
// checkerboard and a red-grey flash went from thirty flashes a second to
// none, and a moving dot and a field of particles were drawn as before.
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
