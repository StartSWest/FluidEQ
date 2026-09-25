/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  advanceRhythm,
  createRhythmState,
  estimateTempo,
  OSS_HOP_MS,
  SILENT_RHYTHM,
  type ISceneRhythm,
} from '../../../common/sceneRhythm';

/**
 * The music's time, heard from a drum pattern laid out in the flux's own
 * bands: the kick across the low end up to 205 Hz, as a real kick's thump
 * sweeps down from there (`rhythmDrums.ts`: a rise under 130 Hz alone is a
 * bass note's), snare at its body and its crack, hats on top. A real song is
 * messier; what is held here is that the tracker finds the tempo a listener
 * would tap, lands its clock on the kicks rather than after them, finds the
 * bar's first beat when the music marks it, tells the drums apart, holds
 * still in silence, and hears a drop.
 */

const BANDS = 24;

interface IPattern {
  tempo: number;
  /** Kicks on these beats of four; the first may be heavier. */
  kicks?: readonly number[];
  snares?: readonly number[];
  hats?: boolean;
  /** How much heavier the kick on the bar's first beat lands. */
  downbeat?: number;
}

/** The band energies at `seconds` into `pattern`: hits decaying from each onset. */
const bandsAt = (pattern: IPattern, seconds: number): number[] => {
  const beat = 60 / pattern.tempo;
  const beatIndex = Math.floor(seconds / beat);
  const since = seconds - beatIndex * beat;
  const inBar = beatIndex % 4;
  const hit = (age: number, length: number) =>
    age >= 0 ? Math.exp(-age / length) : 0;
  const kick = (pattern.kicks ?? [0, 1, 2, 3]).includes(inBar)
    ? hit(since, 0.09) * (inBar === 0 ? (pattern.downbeat ?? 1) : 1)
    : 0;
  const snare = (pattern.snares ?? []).includes(inBar) ? hit(since, 0.08) : 0;
  const halfSince = seconds % (beat / 2);
  const hat = pattern.hats ? hit(halfSince, 0.03) : 0;
  const bed = 0.25;
  return Array.from({ length: BANDS }, (_, band) => {
    let value = bed;
    // Up to 1.6 on the downbeat: 0.45 of it stays under the band's ceiling.
    if (band <= 6) {
      value += 0.45 * kick;
    }
    if (band >= 6 && band <= 8) {
      value += 0.5 * snare;
    }
    if (band >= 15 && band <= 19) {
      value += 0.5 * snare + 0.1 * kick;
    }
    if (band >= 21) {
      value += 0.4 * hat;
    }
    return Math.min(1, value);
  });
};

/** Plays `pattern` for `seconds` at `fps`, returning every frame's reading. */
const play = (
  pattern: IPattern,
  seconds: number,
  fps = 60,
  state = createRhythmState(),
  from = 0,
) => {
  const readings: { at: number; rhythm: ISceneRhythm }[] = [];
  const step = 1000 / fps;
  for (let frame = 0; frame * step < seconds * 1000; frame += 1) {
    const at = from + (frame * step) / 1000;
    const rhythm = advanceRhythm(
      state,
      { bands: bandsAt(pattern, at) },
      step,
      true,
    );
    readings.push({ at, rhythm });
  }
  return { readings, state };
};

const lastOf = (readings: { rhythm: ISceneRhythm }[]) =>
  readings[readings.length - 1].rhythm;

const rock = { kicks: [0, 2], snares: [1, 3], hats: true, downbeat: 1.6 };

test('finds the tempo a listener would tap, and is sure of it', () => {
  const { readings } = play({ tempo: 120, ...rock }, 10);
  const { tempo, confidence } = lastOf(readings);
  expect(tempo).toBeGreaterThan(117);
  expect(tempo).toBeLessThan(123);
  expect(confidence).toBeGreaterThan(0.5);
});

test('a four-on-the-floor at 128 is 128, not 64 or 256', () => {
  const { readings } = play(
    { tempo: 128, kicks: [0, 1, 2, 3], hats: true },
    10,
  );
  expect(lastOf(readings).tempo).toBeGreaterThan(125);
  expect(lastOf(readings).tempo).toBeLessThan(131);
});

test('the clock lands on the kicks, and runs evenly between them', () => {
  const pattern = { tempo: 120, ...rock };
  const { readings } = play(pattern, 12);
  const beat = 0.5;
  // Every frame of the last four seconds: the phase is how far into the beat
  // the pattern is, give or take the analyser's own frame.
  const late = readings.filter(({ at }) => at > 8);
  const errors = late.map(({ at, rhythm }) => {
    const truth = (at % beat) / beat;
    const off = rhythm.beatPhase - truth;
    return Math.abs(off - Math.round(off));
  });
  const worst = Math.max(...errors);
  expect(worst).toBeLessThan(0.12);
});

test('the bar starts where the heaviest kick lands', () => {
  const pattern = { tempo: 120, ...rock };
  const { readings } = play(pattern, 16);
  const late = readings.filter(({ at }) => at > 12);
  const errors = late.map(({ at, rhythm }) => {
    const truth = (at % 2) / 2;
    const off = rhythm.barPhase - truth;
    return Math.abs(off - Math.round(off));
  });
  expect(Math.max(...errors)).toBeLessThan(0.06);
});

test('the drums are told apart', () => {
  const pattern = { tempo: 100, ...rock };
  const { readings } = play(pattern, 8);
  const beat = 60 / 100;
  const late = readings.filter(({ at }) => at > 4);
  // Just after a kick beat (1 and 3) the kick is up and the snare is not;
  // just after a snare beat (2 and 4), the other way round.
  const justAfter = (inBar: number) =>
    late.filter(({ at }) => {
      const index = Math.floor(at / beat);
      return index % 4 === inBar && at - index * beat < 0.05;
    });
  justAfter(0).forEach(({ rhythm }) => {
    expect(rhythm.kick).toBeGreaterThan(0.5);
    expect(rhythm.snare).toBeLessThan(0.3);
  });
  justAfter(1).forEach(({ rhythm }) => {
    expect(rhythm.snare).toBeGreaterThan(0.5);
    expect(rhythm.kick).toBeLessThan(0.3);
  });
  // The hats, twice a beat, keep their own envelope moving.
  expect(Math.max(...late.map(({ rhythm }) => rhythm.hat))).toBeGreaterThan(
    0.9,
  );
});

test('a new song at a new tempo is followed', () => {
  const { state } = play({ tempo: 120, ...rock }, 8);
  const { readings } = play({ tempo: 90, ...rock }, 10, 60, state, 8);
  expect(lastOf(readings).tempo).toBeGreaterThan(87);
  expect(lastOf(readings).tempo).toBeLessThan(93);
});

test('a rest is counted through, and a silence then holds the clock still', () => {
  // A stop inside the song is counted through the way a drummer counts
  // through it, so the beat is still on time when the band comes back in;
  // past a second and a half nothing is playing, and the clock stands still
  // while its certainty and the drums fade.
  const { state } = play({ tempo: 120, ...rock }, 8);
  const before = advanceRhythm(
    state,
    { bands: bandsAt({ tempo: 120 }, 0) },
    16,
    true,
  );
  const quiet = Array.from({ length: BANDS }, () => 0);
  const readings: ISceneRhythm[] = [];
  for (let frame = 0; frame < 300; frame += 1) {
    readings.push(advanceRhythm(state, { bands: quiet }, 1000 / 60, true));
  }
  // Half a second into the rest the bar has gone on by a beat: a quarter.
  const counted = readings[29].barPhase - before.barPhase;
  expect(Math.abs(counted - 0.25 - Math.round(counted - 0.25))).toBeLessThan(
    0.03,
  );
  // From two seconds on, nothing moves.
  const held = readings[119];
  const after = readings[readings.length - 1];
  expect(after.beatPhase).toBeCloseTo(held.beatPhase, 5);
  expect(after.barPhase).toBeCloseTo(held.barPhase, 5);
  expect(after.running).toBe(false);
  expect(after.confidence).toBeLessThan(before.confidence / 4);
  expect(after.kick + after.snare + after.hat).toBeLessThan(0.01);
});

test('a pause holds the clock where it is, and what was heard fades', () => {
  // Nothing playing - a paused song, or the silence between two, which the
  // capture hands over as no music at all - holds the beat where it stood
  // and lets the certainty go, so a dancer weighed by it comes to rest
  // instead of freezing mid step. It froze everything once, certainty too.
  const { state } = play({ tempo: 120, ...rock }, 8);
  const held = advanceRhythm(
    state,
    { bands: bandsAt({ tempo: 120 }, 0) },
    0,
    false,
  );
  const again = advanceRhythm(
    state,
    { bands: bandsAt({ tempo: 120 }, 3) },
    2_000,
    false,
  );
  expect(again.beatPhase).toBe(held.beatPhase);
  expect(again.barPhase).toBe(held.barPhase);
  expect(again.tempo).toBe(held.tempo);
  expect(held.confidence).toBeGreaterThan(0.5);
  expect(again.confidence).toBeLessThan(held.confidence / 3);
  expect(again.kick + again.snare + again.hat).toBeLessThan(0.01);
});

test('a clock on the wrong beat is moved onto the kicks', () => {
  // Locked, then knocked half a beat off - a window covered while the song
  // played on comes back at a guessed phase - the kicks all land in the
  // middle of its beat, where its pull never reaches. They move it back.
  const pattern = { tempo: 120, ...rock };
  const { state } = play(pattern, 8);
  state.phase = (state.phase + 0.5) % 1;
  const { readings } = play(pattern, 6, 60, state, 8);
  const late = readings.filter(({ at }) => at > 11);
  const errors = late.map(({ at, rhythm }) => {
    const off = rhythm.beatPhase - (at % 0.5) / 0.5;
    return Math.abs(off - Math.round(off));
  });
  expect(Math.max(...errors)).toBeLessThan(0.12);
});

test('a song after a gap is heard afresh, at its own tempo, at once', () => {
  // Between two songs the capture hears nothing at all: the next one's tempo
  // is taken from its own onsets, with no vote against the last song's.
  const { state } = play({ tempo: 120, ...rock }, 10);
  advanceRhythm(state, { bands: bandsAt({ tempo: 120 }, 0) }, 3_000, false);
  const { readings } = play({ tempo: 90, ...rock }, 5, 60, state, 13);
  expect(lastOf(readings).tempo).toBeGreaterThan(87);
  expect(lastOf(readings).tempo).toBeLessThan(93);
});

test('the same music at 30 and at 144 frames a second keeps the same time', () => {
  const pattern = { tempo: 120, ...rock };
  const slow = lastOf(play(pattern, 10, 30).readings);
  const fast = lastOf(play(pattern, 10, 144).readings);
  expect(Math.abs(slow.tempo - fast.tempo)).toBeLessThan(3);
});

/**
 * Eight seconds of break after eight of the pattern: pads with no drums, and
 * with `riser` a sweep climbing 1 dB a second in the upper bands, where a
 * build's riser and snare roll crowd. Then the pattern again for three.
 */
const breakThenDrums = (riser: boolean) => {
  const { state } = play({ tempo: 124, ...rock }, 8);
  let breakEnd = SILENT_RHYTHM;
  for (let frame = 0; frame < 8 * 60; frame += 1) {
    const seconds = frame / 60;
    const pad = Array.from({ length: BANDS }, (_, band) =>
      riser && band >= 14 ? 0.25 + 0.01 * seconds : 0.2,
    );
    breakEnd = advanceRhythm(state, { bands: pad }, 1000 / 60, true);
  }
  const { readings } = play({ tempo: 124, ...rock }, 3, 60, state, 16);
  return { readings, breakIntensity: breakEnd.intensity };
};

test('nothing heard yet is no song, and no intensity', () => {
  // Before the first sound the song's range is nobody's, and a scene handed
  // a third of full intensity danced to music that had not started.
  const quiet = Array.from({ length: BANDS }, () => 0);
  const state = createRhythmState();
  expect(advanceRhythm(state, { bands: quiet }, 16, true).intensity).toBe(0);
  expect(advanceRhythm(state, undefined, 500, false).intensity).toBe(0);
  // The control: the first music heard, held, is part way up the range a
  // song is taken to span while little of it has been heard.
  const pad = Array.from({ length: BANDS }, () => 0.5);
  let heard = SILENT_RHYTHM;
  for (let frame = 0; frame < 120; frame += 1) {
    heard = advanceRhythm(state, { bands: pad }, 1000 / 60, true);
  }
  expect(heard.intensity).toBeGreaterThan(0.1);
});

test('a drop after a build is heard, once, and counted', () => {
  const { readings } = breakThenDrums(true);
  const peak = Math.max(...readings.map(({ rhythm }) => rhythm.drop));
  expect(peak).toBeGreaterThan(0.9);
  const serials = new Set(readings.map(({ rhythm }) => rhythm.dropSerial));
  expect(serials.size).toBe(2);
});

test('the drums coming back without a build first are no drop', () => {
  // The control beside the drop: the same return after a flat break. Heard
  // as a drop, a piano ballad's left hand landing after a crescendo fired
  // two or three a minute; it is the song lifting, and says so as intensity.
  const { readings, breakIntensity } = breakThenDrums(false);
  expect(Math.max(...readings.map(({ rhythm }) => rhythm.drop))).toBeLessThan(
    0.1,
  );
  expect(new Set(readings.map(({ rhythm }) => rhythm.dropSerial)).size).toBe(1);
  // And the loud part is intense against the break it came out of.
  expect(lastOf(readings).intensity).toBeGreaterThan(breakIntensity + 0.2);
});

test('noise with no pulse gives no confident tempo', () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const history = Float32Array.from({ length: 300 }, () => random() * 0.1);
  const heard = estimateTempo(history);
  expect(heard === undefined || heard.clarity < 0.3).toBe(true);
  // The control: a pulse every half second is heard as 120.
  const pulse = Float32Array.from({ length: 300 }, (_, at) =>
    at % (500 / OSS_HOP_MS) === 0 ? 1 : 0,
  );
  const clear = estimateTempo(pulse);
  expect(clear?.tempo).toBeGreaterThan(117);
  expect(clear?.tempo).toBeLessThan(123);
  expect(clear?.clarity).toBeGreaterThan(0.6);
});
