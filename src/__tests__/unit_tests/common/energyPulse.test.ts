/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ACCENT_GAP_MS,
  ACCENT_FALL_MS,
  BEAT_FLASH_MS,
  createPulseState,
  followPulse,
  pulseOf,
} from '../../../common/energyPulse';
import {
  SILENT_RHYTHM,
  type IRhythmState,
  type ISceneRhythm,
} from '../../../common/sceneRhythm';

/**
 * The pulse and the accent a scene is handed (`energyPulse.ts`), fed the
 * rhythm's own state step by step: its clock, how sure it is, and what the
 * drums were shown doing.
 */

const STEP = 10;

interface IMusic {
  tempo: number;
  confidence: number;
  /** Beats the clock has counted, and where it is in the one it is on. */
  beats: number;
  phase: number;
  kick: boolean;
  snare: boolean;
  drumsSinceMs: number;
  broad: number;
  dropSerial: number;
}

const music = (overrides: Partial<IMusic> = {}): IMusic => ({
  tempo: 0,
  confidence: 0,
  beats: 0,
  phase: 0,
  kick: false,
  snare: false,
  drumsSinceMs: 60_000,
  broad: 0,
  dropSerial: 0,
  ...overrides,
});

/** One step of the pulse with the rhythm standing as `now` says. */
const step = (
  state: ReturnType<typeof createPulseState>,
  now: IMusic,
  level = 1,
) => {
  const rhythm = {
    tempo: now.tempo,
    confidence: now.confidence,
    beats: now.beats,
    phase: now.phase,
    step: {
      kick: now.kick,
      snare: now.snare,
      drumsSinceMs: now.drumsSinceMs,
      broad: now.broad,
    },
  } as unknown as IRhythmState;
  const heard: ISceneRhythm = {
    ...SILENT_RHYTHM,
    tempo: now.tempo,
    confidence: now.confidence,
    dropSerial: now.dropSerial,
    running: true,
  };
  followPulse(state, rhythm, heard, level, STEP);
  return pulseOf(state);
};

/** A pulse state that has heard `ms` of music with nothing in it. */
const warmed = (ms = 200) => {
  const state = createPulseState();
  for (let t = 0; t < ms; t += STEP) {
    step(state, music());
  }
  return state;
};

/** The steps at which the pulse flashed, over `ms` of music at `tempo`. */
const flashes = (
  ms: number,
  at: (ms: number) => Partial<IMusic>,
  tempo = 120,
) => {
  const state = createPulseState();
  const beatMs = 60_000 / tempo;
  const hits: number[] = [];
  let previous = 0;
  for (let t = 0; t < ms; t += STEP) {
    const pulse = step(
      state,
      music({
        tempo,
        beats: Math.floor(t / beatMs),
        phase: (t % beatMs) / beatMs,
        ...at(t),
      }),
    );
    if (pulse === 1 && previous !== 1) {
      hits.push(t);
    }
    previous = pulse;
  }
  return hits;
};

describe('the pulse', () => {
  // Made of the drums shown, the pulse was only as good as the detectors:
  // on a song at 148 with the clock sure of it, it missed 5 beats of 20 in
  // eight seconds (Ivan, 2026-09-24: "now fix hit").
  it('is the clock’s beat once the clock is sure, every beat, drums or not', () => {
    const hits = flashes(10_000, () => ({ confidence: 0.9 }));
    // Every beat the clock begins, from the first one it begins after the
    // pulse started following it, on the step it begins.
    expect(hits).toEqual(Array.from({ length: 19 }, (_, at) => 500 * (at + 1)));
  });

  it('keeps the clock’s beat through a sag in its certainty, and gives it back under 0.3', () => {
    const hits = flashes(15_000, (t) => {
      if (t < 5_000) {
        return { confidence: 0.9 };
      }
      // A quieter part: the certainty sags, the clock keeps stepping.
      return { confidence: t < 10_000 ? 0.42 : 0.25 };
    });
    expect(hits.filter((hit) => hit >= 5_000 && hit < 10_000)).toHaveLength(10);
    // Handed back to the drums, and there are none shown.
    expect(hits.filter((hit) => hit >= 10_000)).toHaveLength(0);
  });

  it('only leads once the clock is sure enough to', () => {
    // A clock not yet at 0.5, and no drums: nothing to pulse on.
    expect(flashes(5_000, () => ({ confidence: 0.45 }))).toHaveLength(0);
  });

  it('is a drum shown hitting before then, never two inside the spacing', () => {
    const state = warmed();
    const hit = (kick: boolean) =>
      step(state, music({ kick, drumsSinceMs: kick ? 0 : 100 }));
    expect(hit(true)).toBe(1);
    // A snare an eighth later is not a second pulse.
    for (let t = 0; t < 120; t += STEP) {
      hit(false);
    }
    expect(hit(true)).toBeLessThan(1);
    // A beat later it is.
    for (let t = 0; t < 400; t += STEP) {
      hit(false);
    }
    expect(hit(true)).toBe(1);
  });

  it('flashes for BEAT_FLASH_MS', () => {
    const state = warmed();
    expect(step(state, music({ kick: true, drumsSinceMs: 0 }))).toBe(1);
    let left = 1;
    for (let t = STEP; t <= BEAT_FLASH_MS; t += STEP) {
      left = step(state, music({ drumsSinceMs: t }));
    }
    expect(left).toBe(0);
  });
});

describe('the accent', () => {
  /** Onsets of `height` every half second, and `extra` at `bigAt`. */
  const accents = (
    ms: number,
    height: number,
    big?: { at: number; height: number; level?: number },
  ) => {
    const state = createPulseState();
    const serials = new Set<number>();
    for (let t = 0; t < ms; t += STEP) {
      let broad = t % 500 === 0 ? height : 0;
      let level = 1;
      if (big && t === big.at) {
        broad = big.height;
        level = big.level ?? 1;
      }
      step(state, music({ broad }), level);
      serials.add(state.accentSerial);
    }
    return { serials: serials.size - 1, state };
  };

  // Read against the running spread of the onsets, every kick of every song
  // was a moment and only the gap kept them apart: one every 7.3 to 7.6 s on
  // eighteen songs, a piano ballad's included.
  it('is no moment in a steady groove, however long it runs', () => {
    expect(accents(60_000, 0.08).serials).toBe(0);
  });

  it('is an onset that dwarfs the ones around it, near the song’s loudest', () => {
    expect(accents(12_000, 0.08, { at: 10_000, height: 0.4 }).serials).toBe(1);
    // The control: the same onset in a quiet passage is not.
    expect(
      accents(12_000, 0.08, { at: 10_000, height: 0.4, level: 0.3 }).serials,
    ).toBe(0);
    // Nor one only a little over the rest.
    expect(accents(12_000, 0.08, { at: 10_000, height: 0.12 }).serials).toBe(0);
  });

  it('waits ACCENT_GAP_MS for the next, however big', () => {
    const state = createPulseState();
    const onset = (t: number, broad: number) => {
      step(state, music({ broad }));
      return t;
    };
    let t = 0;
    for (; t < 3_000; t += STEP) {
      onset(t, 0);
    }
    onset(t, 0.5);
    expect(state.accentSerial).toBe(1);
    for (t += STEP; t < 3_000 + ACCENT_GAP_MS - 1_000; t += STEP) {
      onset(t, t % 1_000 === 0 ? 2 : 0);
    }
    expect(state.accentSerial).toBe(1);
  });

  it('is every drop, as soon as the last has faded', () => {
    const state = createPulseState();
    step(state, music({ dropSerial: 1 }));
    expect(state.accentSerial).toBe(1);
    for (let t = STEP; t < ACCENT_FALL_MS; t += STEP) {
      step(state, music({ dropSerial: 1 }));
    }
    step(state, music({ dropSerial: 2 }));
    expect(state.accentSerial).toBe(2);
  });
});
