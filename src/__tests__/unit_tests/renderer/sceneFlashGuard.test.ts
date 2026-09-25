/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FLASH_AREA_FULL,
  FLASH_AREA_START,
  FLASH_AREA_WINDOW,
  FLASH_CALM_TEXELS,
  FLASH_LIMIT_PER_SECOND,
  FLASH_STATE_REST,
  flashAllowance,
  flashAreaLod,
  flashCalmLod,
  flashCalmShare,
  flashCalmWeight,
  flashStep,
  flashingDecay,
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

  it('calms a gentle change whole and a sudden one a little at a time', () => {
    const allowance = flashAllowance(1000 / 60);
    // The control: a change inside the allowance is followed at once.
    expect(flashCalmShare(allowance / 2, allowance)).toBe(1);
    // A full white flash is spread over several seconds.
    expect(flashCalmShare(1, allowance)).toBeCloseTo(allowance, 9);
    expect(flashCalmShare(-1, allowance)).toBeCloseTo(allowance, 9);
  });

  it('takes a calm patch from the frame blurred to its own size', () => {
    expect(2 ** flashCalmLod(3840, 2160)).toBeCloseTo(
      3840 / FLASH_CALM_TEXELS,
      6,
    );
    expect(2 ** flashCalmLod(400, 1200)).toBeCloseTo(
      1200 / FLASH_CALM_TEXELS,
      6,
    );
    expect(flashCalmLod(2, 2)).toBe(0);
  });

  it('calms a whole flash whole and barely touches the edge of one', () => {
    expect(flashCalmWeight(1)).toBe(1);
    expect(flashCalmWeight(0)).toBe(0);
    // Where the area gate is just opening — a fire's flame tips — a fraction
    // of the share, not the share, so they keep their swing.
    expect(flashCalmWeight(0.3)).toBeLessThan(0.03);
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

// What a pixel's state does frame by frame, which the state shader mirrors.
// The GPU passes were measured in a browser: an inverting checkerboard and a
// red-grey flash went from thirty flashes a second to none, and a moving dot
// and a field of particles were drawn as before.
const FRAME_MS = 1000 / 60;

/** A full swing every `every` frames, each the opposite of the one before. */
const alternating = (every: number) => (frame: number) => {
  if (frame % every !== 0) {
    return 0;
  }
  return frame % (every * 2) === 0 ? 1 : -1;
};

/** Frames between swings for `flashes` a second at `fps`: two swings a flash. */
const everyFor = (flashes: number, fps: number) =>
  Math.max(1, Math.round(fps / (2 * flashes)));

/**
 * A pixel's state over `frames`, swinging by `swingAt(frame)` each frame.
 *
 * The memory comes from the guard rather than being spelled again here. It
 * was spelled again here, and when the shader's copy changed to travel this
 * kept running the old rule and passed: the suite went on measuring a
 * limiter the GPU had stopped being.
 */
const run = (
  frames: number,
  swingAt: (frame: number) => number,
  frameMs = FRAME_MS,
) => {
  let state = FLASH_STATE_REST;
  let lastSwing = 0;
  let highest = 0;
  let lowest = 1;
  for (let frame = 0; frame < frames; frame += 1) {
    const swing = swingAt(frame);
    state = flashStep(state, swing, lastSwing, frameMs);
    lastSwing = flashPressureMemory(swing, lastSwing, frameMs);
    highest = Math.max(highest, state.flashing);
    // Once it has run in. The LOWEST it reaches is what decides whether a
    // picture is held for the whole of a cycle or only part of it.
    if (frame > frames / 3) {
      lowest = Math.min(lowest, state.flashing);
    }
  }
  return { flashing: state.flashing, highest, lowest };
};

describe('the flash guard’s reading of how often a pixel turns', () => {
  it('flags a strobe within a few frames', () => {
    // Full swings, opposite every frame: thirty flashes a second.
    expect(run(8, alternating(1)).highest).toBe(1);
  });

  it('leaves two flashes a second alone, which WCAG allows', () => {
    const allowed = run(600, alternating(everyFor(2, 60)));
    expect(allowed.highest).toBe(0);
    // Positive control: the same swings at six flashes a second do not.
    expect(run(600, alternating(everyFor(6, 60))).lowest).toBeGreaterThan(0.5);
  });

  /**
   * THE REASON THIS REPLACED A PRESSURE. The old one gained per flash and
   * lost a fixed step per FRAME — the least an 8-bit channel can fall by —
   * so its drain ran at the monitor's rate while its gain did not, and above
   * about ninety frames a second it was deaf. Eleven of twenty-five shapes
   * came out wrong at 144 on the driver, some of them held completely at 60.
   *
   * A gap between turns is the same number of seconds whatever the frame
   * rate, so the same picture has to get the same answer at every rate this
   * app draws at.
   */
  it.each([30, 60, 90, 120, 144, 240])(
    'gives the same answer at %s frames a second',
    (fps) => {
      const frameMs = 1000 / fps;
      const seconds = 10;
      const frames = Math.round(fps * seconds);
      // Held: six flashes a second, twice the limit.
      expect(
        run(frames, alternating(everyFor(6, fps)), frameMs).lowest,
      ).toBeGreaterThan(0.5);
      // Left alone: two a second, which is allowed.
      expect(run(frames, alternating(everyFor(2, fps)), frameMs).highest).toBe(
        0,
      );
    },
  );

  /**
   * A picture that brightens in steps too small to be a flash and snaps back
   * in one frame — the shape a scene would be written in to get past this.
   *
   * Relative luminance, not brightness — a step near white is worth several
   * near black, which is why the rise counts at all.
   */
  const rampAndSnap = (flashesPerSecond: number, fps = 60) => {
    const turns = Math.round(fps / flashesPerSecond);
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
        0.5,
      );
    },
  );

  it.each([2, 2.5])(
    'never takes hold of one at %s flashes a second, which is allowed',
    (flashesPerSecond) => {
      expect(run(600, rampAndSnap(flashesPerSecond)).highest).toBe(0);
    },
  );

  it('leaves something passing by alone: in, a while, and out again', () => {
    const passing = run(120, (frame) => {
      if (frame === 10) {
        return 1;
      }
      return frame === 20 ? -1 : 0;
    });
    expect(passing.highest).toBe(0);
  });

  /**
   * One hard cut on a beat is not a flash, and nothing had to be added to say
   * so: a pixel that has been still carries the cap, which is never under the
   * gap being tested, so the first turn after a quiet stretch can never come
   * "too soon". It takes a second turn close behind the first.
   */
  it('is not set off by a single cut after a still stretch', () => {
    const oneCut = run(300, (frame) => {
      if (frame === 150) {
        return 1;
      }
      return frame === 151 ? -1 : 0;
    });
    expect(oneCut.highest).toBe(0);
  });

  it('lets go soon after the flashing stops, not seconds later', () => {
    // The pressure it replaced took four seconds to fall, which is a scene
    // staying dim long after a flash — reported from the window.
    const after = run(60 * 5, (frame) =>
      frame < 60 ? alternating(1)(frame) : 0,
    );
    expect(after.highest).toBe(1);
    expect(after.flashing).toBeLessThan(0.01);
    // And it was still holding a second after the flashing stopped, so this
    // is a fade rather than a switch.
    const soonAfter = run(60 + 30, (frame) =>
      frame < 60 ? alternating(1)(frame) : 0,
    );
    expect(soonAfter.flashing).toBeGreaterThan(0.3);
  });

  it('gives a stalled frame no more elapsed than a tenth of a second', () => {
    const still = FLASH_STATE_REST;
    // A five-second stall may not advance the gap more than a 100ms frame.
    expect(flashStep({ ...still, sinceTurn: 0 }, 0, 0, 5000).sinceTurn).toBe(
      flashStep({ ...still, sinceTurn: 0 }, 0, 0, 100).sinceTurn,
    );
    expect(flashingDecay(5000)).toBeCloseTo(flashingDecay(100));
    expect(flashingDecay(0)).toBe(1);
  });
});
