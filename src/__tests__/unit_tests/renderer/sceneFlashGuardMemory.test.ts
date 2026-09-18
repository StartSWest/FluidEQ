/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two memories the brightness limiter keeps, and the fact that they are
 * deliberately not the same one.
 *
 * The limiter carries two: how far the picture has travelled across a quarter
 * of the frame, which decides whether a whole-frame swing is a reversal, and
 * the last swing THIS pixel made, which decides whether it is alternating.
 * The first is travel and the second is not, and the difference is the whole
 * of this file.
 *
 * It exists because they were made the same and it shipped. Travel restarts
 * from the new step the moment a picture turns, so a pixel's memory of a full
 * drop was wiped by the first faint step of the rise after it — and a scene
 * that ramps up and snaps back stopped being recognised as flashing at all.
 * Nothing saw it: the shader was changed, its mirror in the suite was a copy
 * of the rule written out again in the test file, and the copy went on
 * measuring the limiter the GPU had stopped being. Measured afterwards on the
 * real shaders on an Intel UHD, a ramp-and-snap at four, five and six flashes
 * a second reached the screen at 3.9, 4.9 and 5.9 flashes a second — the
 * exact band that provokes seizures, drawn as its author wrote it.
 *
 * So: one spelling of the rule, in the guard, used by the shader and by every
 * test; and the shader text checked here for actually using it.
 */

import fs from 'fs';
import path from 'path';
import {
  FLASH_PRESSURE_MEMORY_SOURCE,
  FLASH_SWING,
  flashPressureDecay,
  flashPressureMemory,
  flashTravelled,
} from '../../../renderer/graph/sceneFlashGuard';

const FRAME_MS = 1000 / 60;
const guardSource = fs.readFileSync(
  path.join(process.cwd(), 'src', 'renderer', 'graph', 'sceneFlashGuard.ts'),
  'utf8',
);

describe('the pixel memory the pressure is weighed against', () => {
  // Pinning the text is all a suite with no WebGL can do about the GLSL. It
  // proves the shader reads the exported rule rather than a second copy of
  // it; the cases below are what say the rule itself is right.
  it('is the one the state pass is written from', () => {
    expect(FLASH_PRESSURE_MEMORY_SOURCE).toBe(
      'abs(swing) >= 0.100 ? swing : lastSwing * uDecay',
    );
    // The hole is escaped so this file carries no template expression of its
    // own; what it spells is the line as the shader text is written.
    expect(guardSource).toContain(
      `float remembered = $\{FLASH_PRESSURE_MEMORY_SOURCE};`,
    );
    // And that the green channel is not quietly given travel again.
    expect(guardSource).not.toContain(
      'float remembered = flashTravel(lastSwing, swing, uDecay);',
    );
  });

  it('keeps a swing big enough to be part of a flash, whole and signed', () => {
    expect(flashPressureMemory(0.4, 0, FRAME_MS)).toBe(0.4);
    expect(flashPressureMemory(-1, 0.9, FRAME_MS)).toBe(-1);
    expect(flashPressureMemory(FLASH_SWING, 0, FRAME_MS)).toBe(FLASH_SWING);
  });

  it('lets a smaller one decay the memory rather than replace it', () => {
    // The defect, as one line: a hundredth of a step must not erase a whole
    // drop, because what comes after it is the second half of the flash.
    expect(flashPressureMemory(0.01, -1, FRAME_MS)).toBeCloseTo(
      -flashPressureDecay(FRAME_MS),
      6,
    );
    expect(flashTravelled(-1, 0.01, flashPressureDecay(FRAME_MS))).toBe(0.01);
  });

  it('still remembers the drop six frames into the rise after it', () => {
    let memory = -1;
    for (let frame = 0; frame < 6; frame += 1) {
      memory = flashPressureMemory(0.02, memory, FRAME_MS);
    }
    // Enough to be read as an opposing swing when the rise finally takes one
    // step big enough to count — which is what makes the pressure rise.
    expect(Math.abs(memory)).toBeGreaterThanOrEqual(FLASH_SWING);
    expect(memory).toBeLessThan(0);
  });
});
