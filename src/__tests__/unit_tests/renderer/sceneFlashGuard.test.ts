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
  flashAlternating,
  flashAreaLod,
  flashBlend,
  flashCoarseDecay,
  flashCoarseMemory,
  flashLod,
  flashPressure,
  flashPressureDecay,
  flashPressureMemory,
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

  /**
   * Below it by enough, which is a different sum and the one that was wrong.
   *
   * A picture that RISES for a whole cycle and snaps back at the end of it
   * gets its swing from the rise alone — the snap never has to be let through
   * for the shape to be a flash. So the rise over one cycle, at a rate that
   * must be held, has to come out under the tenth WCAG counts. At 0.5 a
   * second it did not: 0.133 at 3.75 flashes a second, and that shape was
   * measured reaching the screen at 3.2 flashes a second against a bound of
   * three. At 0.35 it is 0.093.
   */
  it('is below it by enough that a whole cycle of rise is not a flash', () => {
    const riseOverACycle = (flashes: number) =>
      FLASH_LIMIT_PER_SECOND / flashes;
    expect(riseOverACycle(3.75)).toBeLessThan(WCAG_SWING);
    // And not so tight that it holds what WCAG allows: at two a second the
    // rise may still reach a flash on its own.
    expect(riseOverACycle(2)).toBeGreaterThan(WCAG_SWING);
  });

  /**
   * And below it with the FINISHING CHAIN's gain still to come, which is the
   * sum that was missing entirely. What this limiter hands on is not what the
   * listener sees: the picture is judged at the size the scene drew it, then
   * scaled up to the panel through a sharpen with a negative lobe and an
   * anti-aliasing pass. Measured on those real passes at their shipped
   * strength, a checkerboard held to 0.093 came back at 0.115 — over the line,
   * from a swing the guard had called safe.
   */
  it('leaves room for the sharpening that runs after it', () => {
    // The worst measured over checkerboards of one, two, four and eight
    // pixels: 0.115 out of 0.093 in.
    const CHAIN_GAIN = 0.115 / 0.093;
    expect((FLASH_LIMIT_PER_SECOND / 3.75) * CHAIN_GAIN).toBeLessThan(
      WCAG_SWING,
    );
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

/**
 * The frame-wide limit follows reversing brightness only. A flash is a pair
 * of opposing swings; a cell's average moves just as fast when something
 * bright crosses it, and limiting that smeared every fast scene.
 */
describe('the brightness limiter’s reversal test', () => {
  const FRAME = 1000 / 60;
  /** A cell's swings, frame by frame, and how much of the limit each draws. */
  const applied = (swings: readonly number[]) => {
    let memory = 0;
    return swings.map((swing) => {
      const before = memory;
      memory = flashCoarseMemory(swing, memory, FRAME);
      return flashAlternating(memory, before);
    });
  };

  it('leaves brightness moving one way alone, however fast', () => {
    // A cell filling with light over four frames: never limited.
    expect(applied([0.3, 0.3, 0.3, 0.3])).toEqual([0, 0, 0, 0]);
    // And emptying again the same way.
    expect(applied([-0.5, -0.5, -0.5])).toEqual([0, 0, 0]);
  });

  it('holds every swing of a strobe after the first', () => {
    const strobe = applied([0.9, -0.9, 0.9, -0.9, 0.9]);
    expect(strobe[0]).toBe(0);
    expect(strobe.slice(1)).toEqual([1, 1, 1, 1]);
  });

  it('holds a pair at the smallest size WCAG counts as a flash', () => {
    expect(applied([FLASH_SWING, -FLASH_SWING])[1]).toBe(1);
    // Positive control: just under that size is not a flash and passes.
    const small = FLASH_SWING * 0.7;
    expect(applied([small, -small])[1]).toBe(0);
  });

  it('leaves something crossing the cell alone: in, a while, and out', () => {
    // A bright thing enters, sits a third of a second, leaves: one pair,
    // slower than three flashes a second, so nothing is held — however big
    // the swing is, since what matters is how soon the reversal comes.
    const quiet = new Array(20).fill(0);
    const passing = applied([0.6, ...quiet, -0.6]);
    expect(passing[0]).toBe(0);
    expect(passing[passing.length - 1]).toBe(0);
  });

  it('holds three flashes a second and leaves two alone', () => {
    /** A full swing every `every` frames, the opposite of the one before. */
    const swinging = (every: number, frames: number) =>
      applied(
        Array.from(
          { length: frames },
          (_, frame) => 0.9 * alternating(every)(frame),
        ),
      );
    // Every tenth of a second: five flashes a second, over the limit.
    expect(Math.max(...swinging(6, 30).slice(6))).toBe(1);
    // Every quarter second: two flashes a second, which WCAG allows. A tenth
    // rather than nothing, because the boundary is one frame wide.
    expect(Math.max(...swinging(15, 60))).toBeLessThan(0.1);
  });

  it('forgets a swing over the period of three flashes a second', () => {
    // The memory of a swing, a third of a second later.
    let memory = 0.5;
    for (let frame = 0; frame < 20; frame += 1) {
      memory = flashCoarseMemory(0, memory, FRAME);
    }
    expect(memory).toBeCloseTo(0.5 * Math.exp(-1), 2);
    expect(flashCoarseDecay(0)).toBe(1);
    // A stalled frame forgets no more than a tenth of a second would.
    expect(flashCoarseDecay(5000)).toBeCloseTo(flashCoarseDecay(100), 9);
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

/**
 * A pixel's pressure over `frames`, swinging by `swingAt(frame)` each frame.
 *
 * The memory comes from the guard rather than being spelled again here. It
 * was spelled again here, and when the shader's copy changed to travel this
 * kept running the old rule and passed: the suite went on measuring a
 * limiter the GPU had stopped being.
 */
const run = (frames: number, swingAt: (frame: number) => number) => {
  let pressure = 0;
  let lastSwing = 0;
  let highest = 0;
  let lowest = 1;
  for (let frame = 0; frame < frames; frame += 1) {
    const swing = swingAt(frame);
    pressure = flashPressure(pressure, swing, lastSwing, FRAME_MS);
    lastSwing = flashPressureMemory(swing, lastSwing, FRAME_MS);
    highest = Math.max(highest, pressure);
    // Once it has run in. The LOWEST it reaches is what decides whether a
    // picture is held for the whole of a cycle or only part of it.
    if (frame > frames / 3) {
      lowest = Math.min(lowest, pressure);
    }
  }
  return { pressure, highest, lowest };
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

  /**
   * A picture that brightens in steps too small to be a flash and snaps back
   * in one frame — the shape a scene would be written in to get past this.
   *
   * Every step of the rise is a fraction of full scale, so the pressure has
   * to still remember the drop when the rise finally takes a step big enough
   * to count against it. It stopped remembering, and the pressure at four and
   * five flashes a second then never once reached the level where holding
   * starts: 0.52 and 0.68 against a 0.70 floor, where it should not fall
   * below 0.81 and 0.88 at any point in the cycle.
   *
   * Relative luminance, not brightness — a step near white is worth several
   * near black, which is why the rise counts at all.
   */
  const rampAndSnap = (flashesPerSecond: number) => {
    const turns = Math.round(60 / flashesPerSecond);
    const luma = (level: number) => Math.max(0, level) ** 2.2;
    return (frame: number) => {
      const at = frame % turns;
      const was = at === 0 ? 1 : (at - 1) / (turns - 1);
      return luma(at / (turns - 1)) - luma(was);
    };
  };

  it.each([4, 5, 6])(
    'never lets go of a ramp that snaps back at %s flashes a second',
    (flashesPerSecond) => {
      expect(run(600, rampAndSnap(flashesPerSecond)).lowest).toBeGreaterThan(
        FLASH_PRESSURE_START,
      );
    },
  );

  it.each([2, 2.5])(
    'never takes hold of one at %s flashes a second, which is allowed',
    (flashesPerSecond) => {
      expect(run(600, rampAndSnap(flashesPerSecond)).highest).toBeLessThan(
        FLASH_PRESSURE_START,
      );
    },
  );

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
