/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  advanceEnergy,
  BEAT_FLASH_MS,
  createEnergyState,
  RUN_MAX_TURNS,
  type ISpectrumPoint,
} from '../../../common/spectrumEnergy';
import { SILENT_RHYTHM } from '../../../common/sceneRhythm';
import { SILENT_VOICE } from '../../../common/voiceReading';

/**
 * The music as a desktop background or another computer's shared audio
 * hands it over: points on the plot's gain scale, MAX at its top, where the
 * track's peak lands. Every level is read against the music itself
 * (`energyLevels.ts`): the whole against its loudest lately, each part
 * against its own usual level, and nothing where nothing is.
 */

const MAX = 20;
/** Far under the analyser's floor: a spectrum with nothing in it. */
const NOTHING = -80;
const FRAME = 45;
/** What a part playing as it has been reads (`energyLevels.ts`). */
const AT_USUAL = 0.55;
/** How fast the whole falls away, as a half-life (`energyLevels.ts`). */
const LEVEL_RELEASE_MS = 120;

const frequencies = Array.from(
  { length: 320 },
  (_, i) => 16 * (25_000 / 16) ** (i / 319),
);

/** A log-spaced spectrum at one level everywhere, like the analyser's. */
const flat = (db: number): ISpectrumPoint[] =>
  frequencies.map((x) => ({ x, y: db }));

/** `db` from `fromHz` up to `toHz`, and `rest` everywhere else. */
const region = (
  fromHz: number,
  toHz: number,
  db: number,
  rest = NOTHING,
): ISpectrumPoint[] =>
  frequencies.map((x) => ({ x, y: x >= fromHz && x < toHz ? db : rest }));

/** The quiet bed the kicks below land on. */
const HUM = MAX - 36;

/** A kick: loud below `hz`, over the hum everywhere above. */
const lowOnly = (hz: number): ISpectrumPoint[] => region(0, hz, MAX, HUM);

/** Run the reading for a while so everything has settled. */
const settle = (points: ISpectrumPoint[], frames = 40) => {
  const state = createEnergyState();
  let energy = advanceEnergy(state, points, MAX, FRAME, true);
  for (let i = 1; i < frames; i += 1) {
    energy = advanceEnergy(state, points, MAX, FRAME, true);
  }
  return { state, energy };
};

describe('spectrum energy', () => {
  // The positive control beside the silence: a reading that returned zero for
  // everything would pass "silence is zero" and nothing else. And silence is
  // zero: a dozen seconds after a song stopped, nothing playing read a level
  // of 1 and every part 0.55 (Ivan's screenshot, 2026-09-24).
  it('reads nothing at all in silence, and music as music', () => {
    const silence = settle(flat(NOTHING), 400).energy;
    expect(silence.level).toBe(0);
    expect(silence.bass).toBe(0);
    expect(silence.mid).toBe(0);
    expect(silence.treble).toBe(0);

    const music = settle(flat(MAX)).energy;
    expect(music.level).toBeCloseTo(1, 3);
    expect(music.bass).toBeCloseTo(AT_USUAL, 3);
    expect(music.mid).toBeCloseTo(AT_USUAL, 3);
    expect(music.treble).toBeCloseTo(AT_USUAL, 3);
  });

  it.each([
    ['bass', 40, 115],
    ['mid', 250, 4_000],
    ['treble', 6_000, 12_000],
  ] as const)(
    'puts what sounds in the %s in the %s alone',
    (part, fromHz, toHz) => {
      const { energy } = settle(region(fromHz, toHz, MAX));
      (['bass', 'mid', 'treble'] as const).forEach((other) => {
        expect(energy[other]).toBeCloseTo(other === part ? AT_USUAL : 0, 3);
      });
    },
  );

  // The analyser's noise under 30 Hz and its roll-off over 16 kHz are no
  // part of the music.
  it('ignores what lies under 30 Hz and over 16 kHz', () => {
    const edges = frequencies.map((x) => ({
      x,
      y: x < 30 || x >= 16_000 ? MAX : NOTHING,
    }));
    const { energy } = settle(edges);
    expect(energy.level).toBe(0);
    expect(energy.bass + energy.mid + energy.treble).toBe(0);
  });

  // Each part against its own usual level, never stretched between the
  // lowest and highest it had been: stretched, every drum hit took all three
  // to the top.
  it('reads a part against how it usually plays', () => {
    const { state } = settle(flat(0));
    const louder = frequencies.map((x) => ({
      x,
      y: x >= 40 && x < 115 ? 12 : 0,
    }));
    // Ten decibels over its usual reads full, on the frame it arrives - a
    // little more than ten here, as the usual takes its share of the step.
    expect(advanceEnergy(state, louder, MAX, FRAME, true).bass).toBe(1);
    // Held there it becomes the usual, and reads as such.
    let held = 1;
    for (let frame = 0; frame < 120; frame += 1) {
      held = advanceEnergy(state, louder, MAX, FRAME, true).bass;
    }
    expect(held).toBeCloseTo(AT_USUAL, 2);
    // A quiet bar reads under its usual, not as nothing.
    const quieter = flat(0);
    let dipped = 1;
    for (let frame = 0; frame < 4; frame += 1) {
      dipped = advanceEnergy(state, quieter, MAX, FRAME, true).bass;
    }
    expect(dipped).toBeLessThan(0.35);
    expect(dipped).toBeGreaterThan(0.05);
  });

  // The mids are what sounds there and lasts - a piano, a voice, a chord -
  // and a drum's crack, a few milliseconds long, never is.
  it('keeps what lasts in the mids and leaves a crack out', () => {
    const { state } = settle(region(40, 115, MAX));
    const crack = region(40, 4_000, MAX);
    const bed = region(40, 115, MAX);
    let mid = 0;
    [crack, crack, bed, bed].forEach((points) => {
      mid = Math.max(mid, advanceEnergy(state, points, MAX, FRAME, true).mid);
    });
    expect(mid).toBe(0);
    // The control: the same sound held is the mids'.
    for (let frame = 0; frame < 10; frame += 1) {
      mid = advanceEnergy(state, crack, MAX, FRAME, true).mid;
    }
    expect(mid).toBeGreaterThan(0.5);
  });

  // An eased rise put a kick half its height 45 ms after the analyser heard
  // it, the largest single delay between the music and a scene.
  it('rises on the frame the music does', () => {
    const { state } = settle(flat(MAX));
    let quiet = advanceEnergy(state, flat(MAX - 12), MAX, FRAME, true);
    for (let frame = 0; frame < 20; frame += 1) {
      quiet = advanceEnergy(state, flat(MAX - 12), MAX, FRAME, true);
    }
    expect(quiet.level).toBeLessThan(0.8);
    expect(quiet.bass).toBeLessThan(0.4);
    expect(quiet.treble).toBeLessThan(0.4);
    const back = advanceEnergy(state, flat(MAX), MAX, FRAME, true);
    expect(back.level).toBe(1);
    // Twelve decibels back over a usual that had followed them part of the
    // way down: over it, at once.
    expect(back.bass).toBeGreaterThan(0.7);
    expect(back.treble).toBeGreaterThan(0.7);
  });

  // The other half: without it an instant fall would pass the test above
  // just as well, and the analyser's steps would flicker on every drop.
  it('falls away over its release instead of dropping', () => {
    const { state } = settle(flat(MAX));
    const first = advanceEnergy(state, flat(NOTHING), MAX, FRAME, true);
    expect(first.level).toBeCloseTo(2 ** (-FRAME / LEVEL_RELEASE_MS), 5);
    const second = advanceEnergy(state, flat(NOTHING), MAX, FRAME, true);
    expect(second.level).toBeCloseTo(2 ** ((-2 * FRAME) / LEVEL_RELEASE_MS), 5);
    expect(second.bass).toBeGreaterThan(0);
    expect(second.bass).toBeLessThan(first.bass);
  });

  it('fires a beat on a step up, then decays it over the flash length', () => {
    const { state } = settle(flat(MAX - 40));
    const hit = advanceEnergy(state, flat(MAX), MAX, FRAME, true);
    expect(hit.beat).toBe(1);

    const later = advanceEnergy(state, flat(MAX), MAX, FRAME, true);
    expect(later.beat).toBeCloseTo(1 - FRAME / BEAT_FLASH_MS, 5);

    // Held loud, the envelope catches up and the flash runs out: a sustained
    // passage is not a drum roll.
    let last = later;
    for (let i = 0; i < 10; i += 1) {
      last = advanceEnergy(state, flat(MAX), MAX, FRAME, true);
    }
    expect(last.beat).toBe(0);
  });

  it('does not fire on a level that only creeps upward', () => {
    const state = createEnergyState();
    let fired = false;
    for (let step = 0; step <= 100; step += 1) {
      const db = MAX - 40 + (40 * step) / 100;
      // Fine steps of the range: each is well under the threshold.
      fired =
        advanceEnergy(state, flat(db), MAX, FRAME, true).beat > 0 || fired;
    }
    expect(fired).toBe(false);
  });

  it('holds still while paused', () => {
    const { state, energy } = settle(flat(MAX));
    const paused = advanceEnergy(state, flat(NOTHING), MAX, FRAME, false);
    expect(paused.level).toBe(energy.level);
    expect(paused.bass).toBe(energy.bass);
  });

  it('answers nothing for an empty spectrum', () => {
    const energy = advanceEnergy(createEnergyState(), [], MAX, FRAME, true);
    expect(energy).toEqual({
      level: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      beat: 0,
      accent: 0,
      accentSerial: 0,
      run: 0,
      runSpeed: 0,
      // Nothing heard: no tempo, the clock where it started, no drums, and
      // no song yet to be intense.
      rhythm: SILENT_RHYTHM,
      voice: SILENT_VOICE,
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
        kicking ? lowOnly(160) : flat(HUM),
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

  // A band with hardly anything in it measured 0.00 to 0.04 over a minute of
  // one track once, so a scene asking for treble got nothing.
  it('shows what a quiet band is doing rather than leaving it at the floor', () => {
    const state = createEnergyState();
    const step = 1000 / 60;
    const highAt = (db: number) =>
      frequencies.map((x) => ({ x, y: x >= 2_000 ? db : MAX - 20 }));
    let low = 1;
    let high = 0;
    // A top end 40 dB down, swinging 3 dB twice a second.
    for (let frame = 0; frame < 600; frame += 1) {
      const swing = frame % 60 < 30 ? MAX - 39 : MAX - 36;
      const energy = advanceEnergy(state, highAt(swing), MAX, step, true);
      if (frame > 240) {
        low = Math.min(low, energy.treble);
        high = Math.max(high, energy.treble);
      }
    }
    expect(high - low).toBeGreaterThan(0.1);
  });

  it('keeps accents apart, and brings each one in over more than a frame', () => {
    const state = createEnergyState();
    const step = 1000 / 60;
    const run = (frames: number, points: ISpectrumPoint[]) => {
      let last = advanceEnergy(state, points, MAX, step, true);
      for (let frame = 1; frame < frames; frame += 1) {
        last = advanceEnergy(state, points, MAX, step, true);
      }
      return last;
    };
    // A steady kick pattern is beats, and no moments: every kick is as tall
    // as the one before it. Read against the running spread of the onsets,
    // every kick of every song was one, and only the gap kept them apart -
    // a moment every seven seconds, a ballad's included.
    let previousSerial = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      const kicking = frame % 30 < 3;
      const energy = advanceEnergy(
        state,
        kicking ? lowOnly(160) : flat(HUM),
        MAX,
        step,
        true,
      );
      previousSerial = energy.accentSerial;
    }
    expect(previousSerial).toBe(0);

    // Everything at once, dwarfing every kick before it: that is a moment.
    const arriving = run(1, flat(MAX));
    expect(arriving.accent).toBeLessThan(0.7);
    // It has to take longer than a fifth of a second to arrive. A scene is
    // free to put this in an angle or in a light across half the picture, and
    // the brightness limiter every member's scene is drawn through blends the
    // frame into the one before it whenever a quarter of the frame changes
    // faster than half of full scale a second. Crystal's band of light was
    // measured at seven times that with the moment arriving in 90 ms, and the
    // stone came out looking painted.
    const partWay = run(12, flat(MAX));
    expect(partWay.accent).toBeLessThan(0.8);
    expect(partWay.accentSerial).toBe(1);
    const settled = run(48, flat(MAX));
    expect(settled.accent).toBeGreaterThan(0.85);

    // And the next one has to wait, however loud the music stays.
    const again = run(120, flat(MAX));
    expect(again.accentSerial).toBe(1);
  });

  // What this exists for: a scene is handed the music of one frame and
  // nothing else, so a chorus cannot build anything up inside a shader — the
  // hits arrive and fade and the picture keeps the same speed all song. The
  // wheel is where a loud passage accumulates, and it belongs here because
  // this is the only place that sees one frame after another.
  it('winds up through a loud passage, holds a cap, and coasts down after', () => {
    const state = createEnergyState();
    const step = 1000 / 60;
    const play = (seconds: number, points: ISpectrumPoint[]) => {
      let last = advanceEnergy(state, points, MAX, step, true);
      for (let frame = 1; frame < seconds * 60; frame += 1) {
        last = advanceEnergy(state, points, MAX, step, true);
      }
      return last;
    };

    // Loud music with a kick on the beat, read after one second and after
    // four.
    let afterOne = 0;
    let afterFour = 0;
    for (let frame = 0; frame < 240; frame += 1) {
      const energy = advanceEnergy(
        state,
        frame % 30 < 3 ? lowOnly(160) : flat(MAX - 2),
        MAX,
        step,
        true,
      );
      if (frame === 59) {
        afterOne = energy.runSpeed;
      }
      afterFour = energy.runSpeed;
    }
    // The failure this pins: the first tuning was at the cap before the first
    // second was out, so every song ran at one speed and the build-up Ivan
    // asked for was not on screen at all. Four seconds in it is well past one
    // second in, and still has somewhere to go.
    expect(afterFour).toBeGreaterThan(afterOne * 1.8);
    expect(afterFour).toBeLessThan(RUN_MAX_TURNS * 0.75);

    // Held loud with the drums in it, it keeps gaining until it presses the
    // cap, and however hard it is pushed it never passes it.
    let chorus = afterFour;
    for (let frame = 0; frame < 25 * 60; frame += 1) {
      chorus = advanceEnergy(
        state,
        frame % 30 < 3 ? lowOnly(160) : flat(MAX),
        MAX,
        step,
        true,
      ).runSpeed;
    }
    expect(chorus).toBeGreaterThan(afterFour);
    expect(chorus).toBeGreaterThan(RUN_MAX_TURNS * 0.9);
    expect(chorus).toBeLessThanOrEqual(RUN_MAX_TURNS);

    // What separates a chorus from a loud pad: the drums. The same level with
    // nothing hitting in it settles well short of the cap, which is the range
    // a listener actually feels.
    const pad = play(25, flat(MAX)).runSpeed;
    expect(pad).toBeLessThan(chorus * 0.8);
    expect(pad).toBeGreaterThan(RUN_MAX_TURNS * 0.5);

    // Silence lets it down over its coast, and it keeps turning while it
    // slows rather than stopping dead.
    const before = state.run;
    const easing = play(3, flat(NOTHING));
    expect(easing.runSpeed).toBeLessThan(pad * 0.7);
    const quiet = play(9, flat(NOTHING));
    expect(quiet.runSpeed).toBeLessThan(pad * 0.2);
    expect(quiet.runSpeed).toBeGreaterThan(0);
    expect(quiet.run).not.toBe(before);

    // Paused is not silence: everything holds where it is, the wheel with it.
    const held = advanceEnergy(state, flat(NOTHING), MAX, step, false);
    expect(held.run).toBe(quiet.run);
    expect(held.runSpeed).toBe(quiet.runSpeed);

    // And it is an angle a scene can read straight: always inside one turn.
    expect(quiet.run).toBeGreaterThanOrEqual(0);
    expect(quiet.run).toBeLessThan(1);
  });
});
