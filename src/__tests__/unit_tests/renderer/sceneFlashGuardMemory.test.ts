/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the brightness limiter counts, and why it counts THAT.
 *
 * WCAG calls a flash a PAIR of opposing changes. The limiter used to count the
 * changes, and that counts a square wave twice a cycle — it turns at both its
 * edges — against once for a picture that slides up over the whole cycle and
 * snaps back, whose rise is spread too thin for any one frame to be a change
 * at all. One shape scored double the other for the same number of flashes, so
 * no step size and no threshold could separate a forbidden ramp from an
 * allowed strobe. Every repair tried on top of that counting failed on a real
 * driver, and the guard's own header lists the four of them.
 *
 * Counting where the TRAVEL turns round scores both at two a cycle: the strobe
 * at each edge, the ramp at its snap and again on the first step of the rise
 * after it. That is what this file is about, and the pairing is the case worth
 * having — it is the property that makes one threshold serve both shapes, and
 * it is what was false before.
 *
 * The rule lives twice, in the guard and as GLSL beside it, because the suite
 * cannot run a shader. Nothing held the two spellings together once, they
 * drifted, and the suite went on measuring a limiter the GPU had stopped
 * being. The text pin below is what stops that happening again.
 */

import fs from 'fs';
import path from 'path';
import {
  FLASH_PRESSURE_MEMORY_SOURCE,
  FLASH_SWING,
  flashStep,
  FLASH_STATE_REST,
  flashPressureMemory,
} from '../../../renderer/graph/sceneFlashGuard';

const FRAME_MS = 1000 / 60;
const guardSource = fs.readFileSync(
  path.join(process.cwd(), 'src', 'renderer', 'graph', 'sceneFlashGuard.ts'),
  'utf8',
);

/**
 * How many turns a series of swings is counted as having.
 *
 * Asked of the guard rather than spelled out again here — re-spelling the rule
 * in the test is the mistake that let the two halves drift apart unnoticed.
 * From a pressure of nothing the answer is the step itself or zero, so this
 * reads the count without a running pressure that would saturate and stop
 * showing it.
 */
const countsIn = (swings: readonly number[]) => {
  let last = 0;
  let counted = 0;
  swings.forEach((swing) => {
    // A turn is what puts the gap back to nothing. Asked of a pixel at rest
    // each time, so the count is of turns and not of which ones came too soon
    // after the one before.
    if (flashStep(FLASH_STATE_REST, swing, last, FRAME_MS).sinceTurn === 0) {
      counted += 1;
    }
    last = flashPressureMemory(swing, last, FRAME_MS);
  });
  return counted;
};

/** How strongly a series of swings ever reads as flashing, run properly. */
const settles = (swings: readonly number[]) => {
  let state = FLASH_STATE_REST;
  let last = 0;
  let highest = 0;
  swings.forEach((swing) => {
    state = flashStep(state, swing, last, FRAME_MS);
    last = flashPressureMemory(swing, last, FRAME_MS);
    highest = Math.max(highest, state.flashing);
  });
  return highest;
};

const linear = (level: number) => Math.max(0, level) ** 2.2;
/** The swings of a whole-frame shape, as the state pass measures them. */
const swingsOf = (levelAt: (frame: number) => number, frames: number) =>
  Array.from({ length: frames }, (_, frame) =>
    frame === 0 ? 0 : linear(levelAt(frame)) - linear(levelAt(frame - 1)),
  );

/** Rises over a whole cycle in equal steps and snaps back at its end. */
const ramp = (turns: number) => (frame: number) =>
  (frame % turns) / (turns - 1);
const square = (turns: number) => (frame: number) =>
  Math.floor(frame / (turns / 2)) % 2;

describe('what the pressure counts', () => {
  // Pinning the text is all a suite with no WebGL can do about the GLSL. It
  // proves the shader reads the exported rule rather than a second copy of it;
  // the cases below say the rule itself is right.
  it('is the rule the state pass is written from', () => {
    expect(FLASH_PRESSURE_MEMORY_SOURCE).toBe(
      'flashTravel(lastSwing, swing, uDecay)',
    );
    // The hole is escaped so this file carries no template expression of its
    // own; what it spells is the line as the shader text is written.
    expect(guardSource).toContain(
      `float remembered = $\{FLASH_PRESSURE_MEMORY_SOURCE};`,
    );
    expect(guardSource).toContain('float opposing = remembered > 0.0');
  });

  /**
   * The property the whole design rests on. Sixty frames is four cycles of a
   * fifteen-frame shape, so two a cycle is eight; the count is allowed to be
   * a turn out at the ends of the window, never double.
   */
  it('scores a ramp that snaps back as often as a strobe', () => {
    const FRAMES = 240;
    const strobe = countsIn(swingsOf(square(15), FRAMES));
    const rampAndSnap = countsIn(swingsOf(ramp(15), FRAMES));
    expect(strobe).toBeGreaterThan(FRAMES / 15 - 2);
    expect(rampAndSnap).toBeGreaterThan(FRAMES / 15 - 2);
    expect(Math.abs(strobe - rampAndSnap)).toBeLessThanOrEqual(2);
  });

  it('carries a rise made of steps too small to be a flash on their own', () => {
    // Twelve steps of a fiftieth: not one of them is a change WCAG counts,
    // and together they are most of the way across the scale.
    let memory = 0;
    for (let frame = 0; frame < 12; frame += 1) {
      memory = flashPressureMemory(0.02, memory, FRAME_MS);
    }
    expect(memory).toBeGreaterThan(FLASH_SWING);
    // Which is what lets the snap at the end of it be seen at all: the fall
    // carries the travel down past a flash's worth, and the rise that starts
    // straight after it is the turn this counts.
    const snapped = flashPressureMemory(-1, memory, FRAME_MS);
    expect(snapped).toBeLessThanOrEqual(-FLASH_SWING);
    expect(flashStep(FLASH_STATE_REST, 0.02, snapped, FRAME_MS).sinceTurn).toBe(
      0,
    );
  });

  it('takes a swing big enough to be a flash whole and at once', () => {
    expect(flashPressureMemory(0.4, 0, FRAME_MS)).toBe(1);
    expect(flashPressureMemory(-1, 0.9, FRAME_MS)).toBe(-1);
  });

  /**
   * Turning restarts the travel from the new step, which is a refractory
   * period without needing a clock: a pixel that jitters cannot run the
   * pressure up, because after each turn the picture has to travel a tenth
   * again before another turn can count.
   */
  it('will not count a second turn until the picture has travelled again', () => {
    const jitter = Array.from({ length: 120 }, (_, frame) =>
      frame % 2 === 0 ? 0.02 : -0.02,
    );
    expect(countsIn(jitter)).toBeLessThan(4);
    expect(settles(jitter)).toBe(0);
    // The positive control: the same frames at a size that IS a flash are a
    // turn every one of them, and hold the pixel completely.
    const strobe = Array.from({ length: 120 }, (_, frame) =>
      frame % 2 === 0 ? 1 : -1,
    );
    // Rises only, so one a flash: a strobe turning every frame flashes on
    // every other one.
    expect(countsIn(strobe)).toBeGreaterThan(50);
    expect(settles(strobe)).toBe(1);
  });
});
