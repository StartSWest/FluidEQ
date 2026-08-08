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

/**
 * The meter's arithmetic, which is the only part of it that can be checked
 * without a sound card.
 *
 * The capture, the splitter and the two analysers need Windows and something
 * playing. The conversion from samples to decibels and the ballistics that
 * carry the two readings between frames need a number and a stopwatch, and both
 * are exactly the sort of thing that can be quietly wrong for months — a meter
 * that under-reads by six decibels, or a peak-hold that never lets go, still
 * looks entirely plausible.
 */

import {
  LEVEL_FALL_DB_PER_S,
  LEVEL_FLOOR_DB,
  LEVEL_HOT_DB,
  LEVEL_OVER_DB,
  LEVEL_TOP_DB,
  PEAK_FALL_DB_PER_S,
  PEAK_HOLD_MS,
  advanceLevel,
  amplitudeToDb,
  createLevelFollower,
  levelFraction,
  levelZone,
  readPeakAmplitude,
} from '../../../renderer/graph/outputLevel';

describe('output level conversion', () => {
  it('reads full scale as zero decibels', () => {
    // The single number the whole meter is referenced to. If this drifts,
    // everything drawn is wrong by the same amount and nothing looks broken.
    expect(amplitudeToDb(1)).toBeCloseTo(0, 6);
  });

  it('halves the amplitude for every six decibels', () => {
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.0206, 3);
    expect(amplitudeToDb(0.25)).toBeCloseTo(-12.0412, 3);
    expect(amplitudeToDb(0.1)).toBeCloseTo(-20, 6);
    expect(amplitudeToDb(0.01)).toBeCloseTo(-40, 6);
  });

  it('measures a trough exactly as loudly as a crest', () => {
    // Samples are signed and a waveform spends half its life below zero, so a
    // conversion that forgot the magnitude would read every negative half-cycle
    // as silence and the meter would flicker at the signal's own frequency.
    expect(amplitudeToDb(-0.5)).toBe(amplitudeToDb(0.5));
  });

  it('puts silence on the floor rather than at negative infinity', () => {
    expect(amplitudeToDb(0)).toBe(LEVEL_FLOOR_DB);
    // Below the floor is still the floor: there is nothing to draw down there.
    expect(amplitudeToDb(1e-9)).toBe(LEVEL_FLOOR_DB);
    // And a NaN sample lands there too rather than poisoning the arithmetic.
    expect(amplitudeToDb(Number.NaN)).toBe(LEVEL_FLOOR_DB);
  });

  it('reports a level above full scale rather than hiding it', () => {
    // Clamping here would erase the one reading that matters most. The drawing
    // stops at the top of the strip; the number does not.
    expect(amplitudeToDb(2)).toBeCloseTo(6.0206, 3);
  });

  it('takes the loudest sample in a block, in either direction', () => {
    expect(readPeakAmplitude(new Float32Array([0.1, -0.7, 0.3]))).toBeCloseTo(
      0.7,
      6,
    );
    expect(readPeakAmplitude(new Float32Array(64))).toBe(0);
    expect(readPeakAmplitude([])).toBe(0);
  });
});

describe('output level scale', () => {
  it('spans the floor to full scale', () => {
    expect(levelFraction(LEVEL_FLOOR_DB)).toBe(0);
    expect(levelFraction(LEVEL_TOP_DB)).toBe(1);
    expect(levelFraction(LEVEL_FLOOR_DB / 2)).toBeCloseTo(0.5, 6);
  });

  it('clamps rather than running off either end of the strip', () => {
    expect(levelFraction(LEVEL_FLOOR_DB - 40)).toBe(0);
    expect(levelFraction(6)).toBe(1);
    expect(levelFraction(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(levelFraction(Number.NaN)).toBe(0);
  });

  it('puts the colour changes exactly where the stylesheet paints them', () => {
    // `.output-meter__fill` hard-stops its gradient at 80% and 95%. Those two
    // numbers are these two thresholds and nothing else, and the stylesheet
    // cannot import a TypeScript constant — so this is the join. Moving a
    // threshold without moving the stop would slide the colours off the
    // decibels they are named for, silently, and the meter would keep looking
    // entirely reasonable while lying about where the danger starts.
    expect(levelFraction(LEVEL_HOT_DB)).toBeCloseTo(0.8, 6);
    expect(levelFraction(LEVEL_OVER_DB)).toBeCloseTo(0.95, 6);
  });
});

describe('output level zones', () => {
  it('is green through most of the range', () => {
    expect(levelZone(LEVEL_FLOOR_DB, false)).toBe('safe');
    expect(levelZone(-30, false)).toBe('safe');
    expect(levelZone(LEVEL_HOT_DB - 0.1, false)).toBe('safe');
  });

  it('turns amber approaching full scale and red at the top', () => {
    expect(levelZone(LEVEL_HOT_DB, false)).toBe('hot');
    expect(levelZone(-6, false)).toBe('hot');
    expect(levelZone(LEVEL_OVER_DB, false)).toBe('over');
    expect(levelZone(0, false)).toBe('over');
  });

  it('takes the capture at its word about clipping', () => {
    // There is one definition of clipping in this app and it lives in the
    // capture, taken from samples pinned to either rail. A meter that decided
    // for itself would eventually disagree with the badge over the graph, and
    // nothing on screen would say which of the two to believe.
    expect(levelZone(LEVEL_FLOOR_DB, true)).toBe('over');
    expect(levelZone(-30, true)).toBe('over');
  });
});

describe('output level ballistics', () => {
  it('starts at silence', () => {
    const follower = createLevelFollower();
    expect(follower.levelDb).toBe(LEVEL_FLOOR_DB);
    expect(follower.peakDb).toBe(LEVEL_FLOOR_DB);
  });

  it('rises to a transient on the frame it happens', () => {
    // The whole reason to look at a meter. Easing upward would under-read
    // exactly the events it exists to catch, and no amount of hold below could
    // put back a peak that was never measured.
    const follower = createLevelFollower();
    advanceLevel(follower, -6, 33);
    expect(follower.levelDb).toBe(-6);
    expect(follower.peakDb).toBe(-6);
  });

  it('falls at the stated rate and no faster', () => {
    const follower = createLevelFollower();
    advanceLevel(follower, -6, 33);
    // A full second of silence, in one step and then in thirty, to prove the
    // rate is per second rather than per frame — an interval that runs late
    // must not make the meter empty faster.
    const oneStep = createLevelFollower();
    advanceLevel(oneStep, -6, 0);
    advanceLevel(oneStep, LEVEL_FLOOR_DB, 1000);
    expect(oneStep.levelDb).toBeCloseTo(-6 - LEVEL_FALL_DB_PER_S, 6);

    const manySteps = createLevelFollower();
    advanceLevel(manySteps, -6, 0);
    for (let step = 0; step < 30; step += 1) {
      advanceLevel(manySteps, LEVEL_FLOOR_DB, 1000 / 30);
    }
    expect(manySteps.levelDb).toBeCloseTo(oneStep.levelDb, 6);
  });

  it('never falls below what was just measured', () => {
    const follower = createLevelFollower();
    advanceLevel(follower, -6, 0);
    advanceLevel(follower, -20, 10000);
    expect(follower.levelDb).toBe(-20);
  });

  it('holds a peak still before letting it go', () => {
    const follower = createLevelFollower();
    advanceLevel(follower, -6, 0);
    // The bar drops away underneath it; the mark does not move at all.
    advanceLevel(follower, -40, PEAK_HOLD_MS / 2);
    expect(follower.peakDb).toBe(-6);
    expect(follower.levelDb).toBeLessThan(-6);
  });

  it('lets the peak down slowly once the hold expires', () => {
    const follower = createLevelFollower();
    advanceLevel(follower, -6, 0);
    advanceLevel(follower, LEVEL_FLOOR_DB, PEAK_HOLD_MS);
    expect(follower.peakDb).toBe(-6);
    advanceLevel(follower, LEVEL_FLOOR_DB, 1000);
    expect(follower.peakDb).toBeCloseTo(-6 - PEAK_FALL_DB_PER_S, 6);
  });

  it('lets the peak down more slowly than the bar under it', () => {
    // If the two matched, the mark would sit glued to the top of the bar and
    // the hold would be holding nothing.
    expect(PEAK_FALL_DB_PER_S).toBeLessThan(LEVEL_FALL_DB_PER_S);
  });

  it('never lets the peak sink under the level it is marking', () => {
    const follower = createLevelFollower();
    advanceLevel(follower, -30, 0);
    // Long enough for the peak's own fall to take it well past the bar.
    advanceLevel(follower, -30, PEAK_HOLD_MS + 5000);
    expect(follower.peakDb).toBe(-30);
  });

  it('settles on the floor and stays there through silence', () => {
    const follower = createLevelFollower();
    advanceLevel(follower, 0, 0);
    for (let step = 0; step < 200; step += 1) {
      advanceLevel(follower, LEVEL_FLOOR_DB, 100);
    }
    expect(follower.levelDb).toBe(LEVEL_FLOOR_DB);
    expect(follower.peakDb).toBe(LEVEL_FLOOR_DB);
  });

  it('ignores a delta that went backwards', () => {
    // `performance.now()` is monotonic, but the clamp above it is not the only
    // caller this could ever have, and a negative step would push the readings
    // upward — a meter that got louder because the clock hiccuped.
    const follower = createLevelFollower();
    advanceLevel(follower, -6, 0);
    advanceLevel(follower, LEVEL_FLOOR_DB, -1000);
    expect(follower.levelDb).toBe(-6);
  });

  it('takes a target that is not a number as silence', () => {
    const follower = createLevelFollower();
    advanceLevel(follower, -6, 0);
    advanceLevel(follower, Number.NaN, 1000);
    expect(follower.levelDb).toBeCloseTo(-6 - LEVEL_FALL_DB_PER_S, 6);
  });
});
