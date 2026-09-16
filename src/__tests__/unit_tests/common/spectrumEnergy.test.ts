/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  advanceEnergy,
  BEAT_FLASH_MS,
  createEnergyState,
  type ISpectrumPoint,
} from '../../../common/spectrumEnergy';

const MIN = -20;
const MAX = 20;
const FRAME = 45;

/** A log-spaced spectrum at one level everywhere, like the analyser's. */
const flat = (db: number): ISpectrumPoint[] =>
  Array.from({ length: 320 }, (_, i) => ({
    x: 16 * (25_000 / 16) ** (i / 319),
    y: db,
  }));

/** Loud below `hz`, silent above. */
const lowOnly = (hz: number): ISpectrumPoint[] =>
  flat(MIN).map((point) => (point.x < hz ? { ...point, y: MAX } : point));

/** Run the detector for a while so the easing has settled. */
const settle = (points: ISpectrumPoint[], frames = 40) => {
  const state = createEnergyState();
  let energy = advanceEnergy(state, points, MIN, MAX, FRAME, true);
  for (let i = 1; i < frames; i += 1) {
    energy = advanceEnergy(state, points, MIN, MAX, FRAME, true);
  }
  return { state, energy };
};

describe('spectrum energy', () => {
  // The positive control beside the silence test: a detector that returned
  // zero for everything would pass "silence is zero" and nothing else.
  it('reads full scale as one and silence as zero', () => {
    expect(settle(flat(MAX)).energy.level).toBeCloseTo(1, 3);
    expect(settle(flat(MAX)).energy.bass).toBeCloseTo(1, 3);
    expect(settle(flat(MAX)).energy.treble).toBeCloseTo(1, 3);

    const silence = settle(flat(MIN)).energy;
    expect(silence.level).toBe(0);
    expect(silence.bass).toBe(0);
    expect(silence.mid).toBe(0);
    expect(silence.treble).toBe(0);
  });

  it('puts energy under 160 Hz in bass and nowhere else', () => {
    const { energy } = settle(lowOnly(160));
    expect(energy.bass).toBeCloseTo(1, 3);
    expect(energy.mid).toBe(0);
    expect(energy.treble).toBe(0);
  });

  it('puts energy between 160 Hz and 2 kHz in mid alone', () => {
    const points = flat(MIN).map((point) =>
      point.x >= 160 && point.x < 2_000 ? { ...point, y: MAX } : point,
    );
    const { energy } = settle(points);
    expect(energy.bass).toBe(0);
    expect(energy.mid).toBeCloseTo(1, 3);
    expect(energy.treble).toBe(0);
  });

  it('ignores the noise floor below 20 Hz and the roll-off above 16 kHz', () => {
    const edges = flat(MIN).map((point) =>
      point.x < 20 || point.x >= 16_000 ? { ...point, y: MAX } : point,
    );
    expect(settle(edges).energy.level).toBe(0);
  });

  // An eased rise put a kick half its height 45 ms after the analyser heard
  // it, the largest single delay between the music and a scene.
  it('rises on the frame the music does', () => {
    const state = createEnergyState();
    const first = advanceEnergy(state, flat(MAX), MIN, MAX, FRAME, true);
    expect(first.level).toBe(1);
    expect(first.bass).toBe(1);
    expect(first.treble).toBe(1);
  });

  // The other half: without it an instant fall would pass the test above
  // just as well, and the analyser's steps would flicker on every drop.
  it('falls away over its release instead of dropping', () => {
    const { state } = settle(flat(MAX));
    const first = advanceEnergy(state, flat(MIN), MIN, MAX, FRAME, true);
    expect(first.level).toBeCloseTo(0.5, 5);
    const second = advanceEnergy(state, flat(MIN), MIN, MAX, FRAME, true);
    expect(second.level).toBeCloseTo(0.25, 5);
  });

  it('fires a beat on a step up, then decays it over the flash length', () => {
    const { state } = settle(flat(MIN));
    const hit = advanceEnergy(state, flat(MAX), MIN, MAX, FRAME, true);
    expect(hit.beat).toBe(1);

    const later = advanceEnergy(state, flat(MAX), MIN, MAX, FRAME, true);
    expect(later.beat).toBeCloseTo(1 - FRAME / BEAT_FLASH_MS, 5);

    // Held loud, the envelope catches up and the flash runs out: a sustained
    // passage is not a drum roll.
    let last = later;
    for (let i = 0; i < 10; i += 1) {
      last = advanceEnergy(state, flat(MAX), MIN, MAX, FRAME, true);
    }
    expect(last.beat).toBe(0);
  });

  it('does not fire on a level that only creeps upward', () => {
    const state = createEnergyState();
    let fired = false;
    for (let step = 0; step <= 100; step += 1) {
      const db = MIN + ((MAX - MIN) * step) / 100;
      // Fine steps of the range: each is well under the threshold.
      fired =
        advanceEnergy(state, flat(db), MIN, MAX, FRAME, true).beat > 0 || fired;
    }
    expect(fired).toBe(false);
  });

  it('holds still while paused', () => {
    const { state, energy } = settle(flat(MAX));
    const paused = advanceEnergy(state, flat(MIN), MIN, MAX, FRAME, false);
    expect(paused.level).toBe(energy.level);
    expect(paused.bass).toBe(energy.bass);
  });

  it('answers zeros for an empty spectrum', () => {
    const energy = advanceEnergy(
      createEnergyState(),
      [],
      MIN,
      MAX,
      FRAME,
      true,
    );
    expect(energy).toEqual({
      level: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      beat: 0,
      accent: 0,
      accentSerial: 0,
    });
  });

  // What the old detector got wrong, measured over a minute of each of five
  // tracks: it called 192 to 287 beats a minute, two or three times a pulse.
  it('calls one onset a kick, not three', () => {
    const state = createEnergyState();
    const step = 1000 / 60;
    let beats = 0;
    let previous = 0;
    // Ten kicks half a second apart - 120 a minute - each three frames long.
    for (let frame = 0; frame < 300; frame += 1) {
      const kicking = frame % 30 < 3;
      const energy = advanceEnergy(
        state,
        kicking ? lowOnly(160) : flat(MIN + 4),
        MIN,
        MAX,
        step,
        true,
      );
      if (energy.beat > 0.85 && previous < 0.65) {
        beats += 1;
      }
      previous = energy.beat;
    }
    expect(beats).toBeGreaterThanOrEqual(9);
    expect(beats).toBeLessThanOrEqual(11);
  });

  // The other half of that: a band with hardly anything in it measured 0.00 to
  // 0.04 over a minute of one track, so a scene asking for treble got nothing.
  it('shows what a quiet band is doing rather than leaving it at the floor', () => {
    const state = createEnergyState();
    const step = 1000 / 60;
    const highAt = (db: number) =>
      flat(MIN).map((point) =>
        point.x >= 2_000 ? { ...point, y: db } : point,
      );
    let low = 1;
    let high = 0;
    // A top end that lives in the bottom tenth of the scale and moves there.
    for (let frame = 0; frame < 600; frame += 1) {
      const swing = frame % 60 < 30 ? MIN + 1 : MIN + 4;
      const energy = advanceEnergy(state, highAt(swing), MIN, MAX, step, true);
      if (frame > 240) {
        low = Math.min(low, energy.treble);
        high = Math.max(high, energy.treble);
      }
    }
    // A tenth of the scale, from three decibels of swing at the bottom of it:
    // the same band measured 0.00 to 0.04 over a whole minute of a real track
    // before. Not more, because the range follows a swing this slow and takes
    // some of it back - which is what keeps a steady tone from reading as a
    // drum.
    expect(high - low).toBeGreaterThan(0.1);
  });

  it('keeps accents apart, and brings each one in over more than a frame', () => {
    const state = createEnergyState();
    const step = 1000 / 60;
    const run = (frames: number, points: ISpectrumPoint[]) => {
      let last = advanceEnergy(state, points, MIN, MAX, step, true);
      for (let frame = 1; frame < frames; frame += 1) {
        last = advanceEnergy(state, points, MIN, MAX, step, true);
      }
      return last;
    };
    // A steady kick pattern is beats, and no moments.
    let previousSerial = 0;
    for (let frame = 0; frame < 300; frame += 1) {
      const kicking = frame % 30 < 3;
      const energy = advanceEnergy(
        state,
        kicking ? lowOnly(160) : flat(MIN + 4),
        MIN,
        MAX,
        step,
        true,
      );
      previousSerial = energy.accentSerial;
    }
    expect(previousSerial).toBe(0);

    // Everything at once, after the gap: that is a moment.
    const arriving = run(1, flat(MAX));
    expect(arriving.accent).toBeLessThan(0.7);
    // Up over about a fifth of a second, not in one frame: a scene is free to
    // put this in an angle, and a jump there is a jerk.
    const settled = run(12, flat(MAX));
    expect(settled.accent).toBeGreaterThan(0.75);
    expect(settled.accentSerial).toBe(1);

    // And the next one has to wait, however loud the music stays.
    const again = run(120, flat(MAX));
    expect(again.accentSerial).toBe(1);
  });
});
