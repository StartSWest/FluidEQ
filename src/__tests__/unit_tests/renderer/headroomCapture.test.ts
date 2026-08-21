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
  accumulateHeadroomFrame,
  advanceSupervisorTrimDb,
  createHeadroomCaptureState,
  HEADROOM_MIN_LISTENED_MS,
  HEADROOM_RELEASE_DB_PER_S,
  IDLE_PUSH_INTERVAL_MS,
  IHeadroomCaptureState,
  PUSH_DEADBAND_DB,
  readHeadroomProgramme,
  shouldPushMeasurement,
  SUPERVISOR_CEILING_DBFS,
  URGENT_PUSH_INTERVAL_MS,
} from '../../../renderer/utils/headroomCapture';

/** A log axis of the kind the analyser publishes, 20 Hz to 20 kHz. */
const AXIS = Array.from(
  { length: 240 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index * (Math.log10(20000) - Math.log10(20))) / 239),
);

const FRAME_MS = 45;

/** Levels for every axis point, from a function of frequency. */
const levelsFrom = (shape: (frequency: number) => number): Float64Array =>
  Float64Array.from(AXIS, shape);

const play = (
  state: IHeadroomCaptureState,
  shape: (frequency: number) => number,
  durationMs: number,
): IHeadroomCaptureState => {
  const frames = Math.round(durationMs / FRAME_MS);
  for (let index = 0; index < frames; index += 1) {
    accumulateHeadroomFrame(state, {
      levels: levelsFrom(shape),
      timestampMs: state.lastTimestampMs + FRAME_MS,
    });
  }
  return state;
};

const at = (points: { frequency: number; gain: number }[], target: number) => {
  const found = points.reduce((best, point) =>
    Math.abs(point.frequency - target) < Math.abs(best.frequency - target)
      ? point
      : best,
  );
  return found.gain;
};

describe('headroom capture', () => {
  it('says nothing before it has heard enough (null)', () => {
    const state = createHeadroomCaptureState(AXIS);
    play(state, () => -20, HEADROOM_MIN_LISTENED_MS / 2);
    expect(readHeadroomProgramme(state)).toEqual([]);
  });

  it('reports the shape it heard once it has (positive control)', () => {
    // The control the null test above needs: the same call, the same material,
    // enough time. Without this, "reports nothing" cannot be told apart from
    // "never measures anything".
    const state = createHeadroomCaptureState(AXIS);
    play(state, () => -20, HEADROOM_MIN_LISTENED_MS * 2);
    const points = readHeadroomProgramme(state);
    expect(points.length).toBeGreaterThan(5);
    points.forEach((point) => expect(point.gain).toBeCloseTo(-20, 1));
  });

  it('measures a sloped spectrum as sloped', () => {
    const state = createHeadroomCaptureState(AXIS);
    // 30 dB down at the top relative to the bottom.
    const slope = (frequency: number) =>
      -10 - 30 * (Math.log10(frequency / 20) / Math.log10(1000));
    play(state, slope, HEADROOM_MIN_LISTENED_MS * 2);
    const points = readHeadroomProgramme(state);
    expect(at(points, 28)).toBeGreaterThan(at(points, 14142) + 20);
  });

  it('keeps the loudest passage, not the average one', () => {
    const state = createHeadroomCaptureState(AXIS);
    play(state, () => -40, 6000);
    play(state, () => -12, 1000);
    play(state, () => -40, 6000);
    const points = readHeadroomProgramme(state);
    // A mean of this material sits near -37. The maximum is what protects the
    // chorus, and it is why this is not autoBalanceCapture.
    expect(at(points, 1000)).toBeGreaterThan(-20);
  });

  it('lets an old peak decay at the documented rate', () => {
    const state = createHeadroomCaptureState(AXIS);
    play(state, () => -40, HEADROOM_MIN_LISTENED_MS + 1000);
    play(state, () => -12, 1000);
    const loud = at(readHeadroomProgramme(state), 1000);
    play(state, () => -40, 60000);
    const later = at(readHeadroomProgramme(state), 1000);
    // Sixty seconds of quiet at a tenth of a decibel a second is six decibels,
    // and it cannot fall below what is actually playing.
    expect(loud).toBeCloseTo(-12, 0);
    expect(loud - later).toBeGreaterThan(4);
    expect(later).toBeGreaterThan(-41);
  });

  it('buys no listened time from silence', () => {
    const state = createHeadroomCaptureState(AXIS);
    play(state, () => -95, HEADROOM_MIN_LISTENED_MS * 3);
    expect(state.listenedMs).toBe(0);
    expect(readHeadroomProgramme(state)).toEqual([]);
  });

  it('subtracts the chain, so the record is measured and not the output', () => {
    const withChain = createHeadroomCaptureState(AXIS);
    // The chain lifts everything above 1 kHz by 12 dB, and the analyser sees
    // that lift because the loopback is post-APO.
    withChain.chainGainDb = AXIS.map((frequency) =>
      frequency >= 1000 ? 12 : 0,
    );
    play(
      withChain,
      (frequency) => (frequency >= 1000 ? -20 + 12 : -20),
      HEADROOM_MIN_LISTENED_MS * 2,
    );
    const points = readHeadroomProgramme(withChain);
    // Reconstructed, the record is flat at -20 despite the output not being.
    expect(at(points, 500)).toBeCloseTo(-20, 0);
    expect(at(points, 4000)).toBeCloseTo(-20, 0);
  });

  it('fills a range it never heard with the loudest range it did', () => {
    const state = createHeadroomCaptureState(AXIS);
    // Nothing at all above 2 kHz: those regions stay on the analyser floor.
    play(
      state,
      (frequency) => (frequency < 2000 ? -15 : -100),
      HEADROOM_MIN_LISTENED_MS * 2,
    );
    const points = readHeadroomProgramme(state);
    // The silent treble must NOT be reported as quiet, or a treble boost would
    // be paid for out of a range nobody has evidence about.
    expect(at(points, 14142)).toBeCloseTo(at(points, 500), 0);
  });
});

describe('the sample peak supervisor', () => {
  it('does nothing while the output stays under the ceiling', () => {
    expect(advanceSupervisorTrimDb(0, SUPERVISOR_CEILING_DBFS - 6, 100)).toBe(
      0,
    );
  });

  it('pulls down when the output crosses the ceiling', () => {
    const trim = advanceSupervisorTrimDb(0, SUPERVISOR_CEILING_DBFS + 2, 200);
    expect(trim).toBeLessThan(0);
    // Never further than the overshoot: it puts the peak on the ceiling rather
    // than ducking under and crawling back.
    expect(trim).toBeGreaterThanOrEqual(-2);
  });

  it('comes down faster than it goes back up', () => {
    const down = advanceSupervisorTrimDb(0, SUPERVISOR_CEILING_DBFS + 10, 1000);
    const up =
      advanceSupervisorTrimDb(-10, SUPERVISOR_CEILING_DBFS - 10, 1000) - -10;
    expect(Math.abs(down)).toBeGreaterThan(up * 10);
  });

  it('recovers towards unity but never above it', () => {
    let trim = -1;
    for (let index = 0; index < 200; index += 1) {
      trim = advanceSupervisorTrimDb(trim, SUPERVISOR_CEILING_DBFS - 20, 200);
    }
    expect(trim).toBe(0);
  });

  it('never returns a positive trim, whatever it is handed', () => {
    expect(advanceSupervisorTrimDb(5, SUPERVISOR_CEILING_DBFS - 20, 200)).toBe(
      0,
    );
    expect(
      advanceSupervisorTrimDb(Number.NaN, SUPERVISOR_CEILING_DBFS + 5, 200),
    ).toBeLessThanOrEqual(0);
  });

  it('is measured in decibels per second, not per frame', () => {
    // A starved renderer handing in one late tick must not be able to slam the
    // trim, and the same elapsed time in two steps must land in the same place.
    const oneStep = advanceSupervisorTrimDb(
      0,
      SUPERVISOR_CEILING_DBFS + 20,
      200,
    );
    const twoSteps = advanceSupervisorTrimDb(
      advanceSupervisorTrimDb(0, SUPERVISOR_CEILING_DBFS + 20, 100),
      SUPERVISOR_CEILING_DBFS + 20,
      100,
    );
    expect(twoSteps).toBeCloseTo(oneStep, 6);
  });
});

describe('deciding when a measurement is worth a config write', () => {
  const settled = {
    sincePushMs: 0,
    trimDb: 0,
    lastPushedTrimDb: 0,
    programmeDeltaDb: 0,
  };

  it('does not write for a measurement that has not moved', () => {
    expect(
      shouldPushMeasurement({ ...settled, sincePushMs: IDLE_PUSH_INTERVAL_MS }),
    ).toBe(false);
  });

  it('writes a settled change once the idle interval has passed', () => {
    expect(
      shouldPushMeasurement({
        ...settled,
        sincePushMs: IDLE_PUSH_INTERVAL_MS,
        programmeDeltaDb: 1,
      }),
    ).toBe(true);
    // ...and not before it, however much the spectrum moved.
    expect(
      shouldPushMeasurement({
        ...settled,
        sincePushMs: IDLE_PUSH_INTERVAL_MS - 1,
        programmeDeltaDb: 12,
      }),
    ).toBe(false);
  });

  /*
   * THE REGRESSION THIS SECTION EXISTS FOR.
   *
   * The ordinary two-second floor used to be tested before urgency, so a
   * supervisor pull-down computed a fifth of a second after a write sat unsent
   * until the floor expired — nearly two seconds above the ceiling with the
   * correction already in hand. Every test below fails against that ordering.
   */
  it('sends a pull-down without waiting out the ordinary floor', () => {
    expect(
      shouldPushMeasurement({
        ...settled,
        sincePushMs: URGENT_PUSH_INTERVAL_MS,
        trimDb: -5,
        lastPushedTrimDb: 0,
      }),
    ).toBe(true);
  });

  it('still refuses to write on consecutive frames', () => {
    expect(
      shouldPushMeasurement({
        ...settled,
        sincePushMs: 45,
        trimDb: -5,
        lastPushedTrimDb: 0,
      }),
    ).toBe(false);
  });

  it('hurries only downward, never upward', () => {
    // The supervisor recovering towards unity makes the output louder. That
    // waits its turn like any other settled change.
    expect(
      shouldPushMeasurement({
        ...settled,
        sincePushMs: URGENT_PUSH_INTERVAL_MS,
        trimDb: 0,
        lastPushedTrimDb: -5,
      }),
    ).toBe(false);
  });

  it('ignores a pull-down smaller than the deadband', () => {
    expect(
      shouldPushMeasurement({
        ...settled,
        sincePushMs: URGENT_PUSH_INTERVAL_MS,
        trimDb: -PUSH_DEADBAND_DB / 2,
        lastPushedTrimDb: 0,
      }),
    ).toBe(false);
  });
});

describe('the release rate is the documented one', () => {
  it('forgets six decibels a minute of listened time', () => {
    const state = createHeadroomCaptureState(AXIS);
    play(state, () => -55, HEADROOM_MIN_LISTENED_MS + 1000);
    play(state, () => -10, 1000);
    const before = at(readHeadroomProgramme(state), 1000);
    // Quiet but still above the frame gate, so this IS listened time. Material
    // below the gate would decay nothing at all, which is the separate promise
    // that a paused evening costs no headroom.
    play(state, () => -55, 30000);
    const after = at(readHeadroomProgramme(state), 1000);
    expect(before).toBeCloseTo(-10, 0);
    expect(before - after).toBeCloseTo(30 * HEADROOM_RELEASE_DB_PER_S, 0);
  });

  it('forgets nothing at all while the music is paused', () => {
    const state = createHeadroomCaptureState(AXIS);
    play(state, () => -55, HEADROOM_MIN_LISTENED_MS + 1000);
    play(state, () => -10, 1000);
    const before = at(readHeadroomProgramme(state), 1000);
    play(state, () => -95, 600000);
    expect(at(readHeadroomProgramme(state), 1000)).toBeCloseTo(before, 6);
  });
});
