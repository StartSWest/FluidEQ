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

  it('eases towards a new level rather than snapping', () => {
    const state = createEnergyState();
    const first = advanceEnergy(state, flat(MAX), MIN, MAX, FRAME, true);
    expect(first.level).toBeGreaterThan(0);
    expect(first.level).toBeLessThan(1);
    const second = advanceEnergy(state, flat(MAX), MIN, MAX, FRAME, true);
    expect(second.level).toBeGreaterThan(first.level);
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
    expect(energy).toEqual({ level: 0, bass: 0, mid: 0, treble: 0, beat: 0 });
  });
});
