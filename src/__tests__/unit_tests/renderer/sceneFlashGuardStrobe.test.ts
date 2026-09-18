/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the brightness limiter does to a picture that flashes, run frame by
 * frame through the guard's own exported arithmetic.
 *
 * A member's scene is shown to other people without anybody having watched
 * it first, and a picture flashing more than three times a second can cause a
 * seizure. The limiter compared each frame to the one before and only
 * remembered a step of a tenth of full scale or more — so brightness ramped
 * over eleven frames or more moved by less than that every time, remembered
 * nothing, and the instant drop at the end had nothing to oppose. Measured on
 * this arithmetic: a full-screen black-to-white strobe at three to five and a
 * half flashes a second was drawn exactly as written. Ten characters of
 * shader, and it reaches the graph, full screen and the desktop background.
 *
 * Both what must be held and what must NOT be are measured here, because a
 * limiter that holds everything is not a fix — it is the smearing this file's
 * own header says was sent back twice.
 */

import {
  flashAllowance,
  flashAlternating,
  flashBlend,
  flashCoarseMemory,
} from '../../../renderer/graph/sceneFlashGuard';

const FRAME_MS = 1000 / 60;

/**
 * The share of a frame's own change that reaches the screen, at its worst
 * moment: 1 is drawn as the scene wrote it, 0 is held completely.
 */
const shownSwing = (brightness: readonly number[]) => {
  let travelled = 0;
  let worst = 1;
  brightness.forEach((value, at) => {
    if (at === 0) {
      return;
    }
    const swing = value - brightness[at - 1];
    const before = travelled;
    travelled = flashCoarseMemory(swing, travelled, FRAME_MS);
    const alternating = flashAlternating(travelled, before);
    const change = Math.abs(swing);
    const blend = flashBlend(change, flashAllowance(FRAME_MS));
    const shown = 1 - alternating * (1 - blend);
    if (change > 0.2) {
      worst = Math.min(worst, shown);
    }
  });
  return worst;
};

/** Brightness rising over a period then dropping in one frame, `seconds` long. */
const sawtooth = (hz: number, seconds = 3) =>
  Array.from({ length: Math.round(seconds * 60) }, (_, frame) => {
    const turn = ((frame / 60) * hz) % 1;
    return turn;
  });

/** A square wave: full on, full off, at `hz` flashes a second. */
const square = (hz: number, seconds = 3) =>
  Array.from({ length: Math.round(seconds * 60) }, (_, frame) =>
    ((frame / 60) * hz) % 1 < 0.5 ? 0 : 1,
  );

/** A scene breathing with the music: smooth, both ways, at `hz` a second. */
const breathe = (hz: number, seconds = 3) =>
  Array.from(
    { length: Math.round(seconds * 60) },
    (_, frame) => 0.5 - 0.5 * Math.cos(2 * Math.PI * hz * (frame / 60)),
  );

/** A picture getting brighter and staying bright: motion, never a flash. */
const oneWay = (seconds = 3) =>
  Array.from({ length: Math.round(seconds * 60) }, (_, frame) =>
    Math.min(1, frame / 30),
  );

describe('a picture that flashes is held', () => {
  // The shape that went through untouched: a ramp every step of which is too
  // small to count, and a drop that used to meet nothing.
  it.each([2.5, 3, 3.5, 4, 5, 5.5])(
    'holds a ramp-and-drop at %s flashes a second',
    (hz) => {
      expect(shownSwing(sawtooth(hz))).toBeLessThan(0.35);
    },
  );

  it.each([4, 6, 10, 30])('holds a square wave at %s a second', (hz) => {
    expect(shownSwing(square(hz))).toBeLessThan(0.35);
  });
});

describe('a picture that does not flash is left alone', () => {
  // The control. Without these, holding everything would pass every case
  // above, and smearing every scene is how this limiter was wrong before.
  it.each([0.25, 0.5, 1, 1.5])(
    'leaves a scene breathing at %s a second',
    (hz) => {
      expect(shownSwing(breathe(hz))).toBeGreaterThan(0.9);
    },
  );

  it('leaves a picture that only gets brighter', () => {
    expect(shownSwing(oneWay())).toBe(1);
  });

  // Two flashes a second is what WCAG allows, and the thresholds are set on
  // it deliberately: it may not be held whole.
  it('lets two flashes a second through', () => {
    expect(shownSwing(sawtooth(2))).toBeGreaterThan(0.35);
  });
});
