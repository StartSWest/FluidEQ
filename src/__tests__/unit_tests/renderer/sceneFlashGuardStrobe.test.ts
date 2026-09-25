/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the brightness limiter puts on the screen for a picture that flashes,
 * run frame by frame through the guard's own exported arithmetic, and counted
 * the way WCAG 2.3.1 counts: a flash is a pair of opposing swings of a tenth
 * of full luminance or more, and three a second is the most allowed.
 *
 * One pixel of a picture that is the same everywhere, which is the one case
 * the arithmetic can stand in for the shaders whole: its flag is the flag of
 * every pixel around it, so the area it is weighed by is the flag itself, and
 * the calm field's patch around it is the picture. That pixel goes through
 * the same three steps the GPU runs — the state pass's reading of how soon it
 * rose again (`flashStep`), the calm field following it no faster than the
 * limit (`flashCalmShare`), and the calming weighed by the cube of its flag
 * (`flashCalmWeight`) — and what comes out is what the listener's eye gets.
 *
 * Both what must be held and what must NOT be are measured, because a
 * limiter that holds everything is not a fix: smearing every scene is how
 * this one was wrong before, twice. Patterns, partial areas and the finishing
 * chain need the passes run on a GPU, which no suite here can do; that was
 * done over every shape below and more, at 30, 60, 144 and 240 frames a
 * second (see the header of `sceneFlashGuard.ts`).
 */

import {
  FLASH_STATE_REST,
  FLASH_SWING,
  flashAllowance,
  flashCalmShare,
  flashCalmWeight,
  flashPressureMemory,
  flashStep,
} from '../../../renderer/graph/sceneFlashGuard';

const WCAG_FLASHES_PER_SECOND = 3;

/** The luminance on the screen, frame by frame, for `drawn` at `fps`. */
const shownOf = (drawn: readonly number[], fps = 60): number[] => {
  const frameMs = 1000 / fps;
  const allowance = flashAllowance(frameMs);
  let state = FLASH_STATE_REST;
  let travel = 0;
  let calm = drawn[0] ?? 0;
  return drawn.map((level, frame) => {
    const swing = frame === 0 ? 0 : level - drawn[frame - 1];
    state = flashStep(state, swing, travel, frameMs);
    travel = flashPressureMemory(swing, travel, frameMs);
    calm += (level - calm) * flashCalmShare(level - calm, allowance);
    const calmed = flashCalmWeight(state.flashing);
    return level + (calm - level) * calmed;
  });
};

/**
 * Flashes a second in a series of luminances, as WCAG counts them: swings of
 * a tenth or more from the last extreme, two to a flash.
 */
const flashesPerSecond = (series: readonly number[], fps = 60): number => {
  let anchor = series[0] ?? 0;
  let direction = 0;
  let swings = 0;
  series.forEach((value) => {
    const moved = value - anchor;
    if (direction !== 0 && moved * direction > 0) {
      anchor = value;
      return;
    }
    if (Math.abs(moved) >= FLASH_SWING) {
      direction = Math.sign(moved);
      anchor = value;
      swings += 1;
    }
  });
  return swings / 2 / (series.length / fps);
};

const SECONDS = 5;

/** Full on, full off, `hz` flashes a second. */
const square = (hz: number, fps = 60) =>
  Array.from({ length: SECONDS * fps }, (_, frame) =>
    ((frame / fps) * hz) % 1 < 0.5 ? 0 : 1,
  );

/** Rising over each cycle in steps too small to count, dropping in one frame. */
const rampAndSnap = (hz: number, fps = 60) =>
  Array.from({ length: SECONDS * fps }, (_, frame) => ((frame / fps) * hz) % 1);

/** A scene breathing with the music: smooth, both ways, `hz` a second. */
const breathe = (hz: number, fps = 60) =>
  Array.from(
    { length: SECONDS * fps },
    (_, frame) => 0.5 - 0.5 * Math.cos(2 * Math.PI * hz * (frame / fps)),
  );

describe('a picture that flashes is held', () => {
  it.each([3.75, 4, 5, 6, 10])('holds a square strobe at %s a second', (hz) => {
    // The control: drawn, it is the flash it is meant to be.
    expect(flashesPerSecond(square(hz))).toBeGreaterThan(
      WCAG_FLASHES_PER_SECOND,
    );
    expect(flashesPerSecond(shownOf(square(hz)))).toBeLessThanOrEqual(1);
  });

  it.each([3.75, 4, 5, 6, 10])(
    'holds a ramp that snaps back at %s a second',
    (hz) => {
      expect(flashesPerSecond(rampAndSnap(hz))).toBeGreaterThan(
        WCAG_FLASHES_PER_SECOND,
      );
      expect(flashesPerSecond(shownOf(rampAndSnap(hz)))).toBeLessThanOrEqual(1);
    },
  );

  it.each([30, 144, 240])(
    'holds a strobe the same at %s frames a second',
    (fps) => {
      expect(
        flashesPerSecond(shownOf(square(6, fps), fps), fps),
      ).toBeLessThanOrEqual(1);
    },
  );
});

describe('a picture that does not flash is left alone', () => {
  it.each([2, 2.5, 3])('leaves a square at %s a second as drawn', (hz) => {
    const drawn = square(hz);
    expect(shownOf(drawn)).toEqual(drawn);
  });

  it.each([2, 2.5])('leaves a ramp that snaps back at %s a second', (hz) => {
    const drawn = rampAndSnap(hz);
    expect(shownOf(drawn)).toEqual(drawn);
  });

  it.each([0.5, 1, 2])('leaves a scene breathing at %s a second', (hz) => {
    const drawn = breathe(hz);
    expect(shownOf(drawn)).toEqual(drawn);
  });

  it('leaves one cut on a beat alone', () => {
    const drawn = Array.from({ length: 120 }, (_, frame) =>
      frame < 60 ? 0 : 1,
    );
    expect(shownOf(drawn)).toEqual(drawn);
  });
});

describe('what a held picture shows', () => {
  it('moves no faster than the limit once it is calmed', () => {
    const shown = shownOf(square(10));
    const allowance = flashAllowance(1000 / 60);
    // Past the first swings, which arm it: every frame after, the step on
    // the screen is the calm field's own, within the allowance.
    const settled = shown.slice(30);
    settled.slice(1).forEach((value, at) => {
      expect(Math.abs(value - settled[at])).toBeLessThanOrEqual(
        allowance + 1e-9,
      );
    });
  });

  it('comes back to what is drawn once the flashing stops', () => {
    const drawn = [...square(10).slice(0, 60), ...new Array(240).fill(0.4)];
    const shown = shownOf(drawn);
    expect(shown[shown.length - 1]).toBeCloseTo(0.4, 2);
  });
});
