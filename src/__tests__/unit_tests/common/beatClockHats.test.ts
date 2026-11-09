/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { stepHat } from '../../../common/rhythmDrums';
import { createDrumKit, followHitHeight } from '../../../common/rhythmKit';
import { advanceRhythm, createRhythmState } from '../../../common/sceneRhythm';
import {
  createSoundCursor,
  createSoundHops,
  soundHistorySamples,
  type ISoundHop,
} from '../../../common/soundHops';
import { createEnergyState, hearSound } from '../../../common/spectrumEnergy';

/**
 * The beat clock against a hat played between every two kicks, heard as the
 * window hears music: from its own samples, a hop every 10 ms (`soundHops.ts`).
 * The control is the one the clock was caught on: 120 bpm, a 55 Hz kick on
 * every beat, a held 82 Hz bass, a quiet pad, and a hat of white noise half a
 * beat after each kick, 19 dB under it. The kit hears every one of those hats
 * as a snare as well, and the grid, weighing that snare against a height on
 * another scale, flashed every beat 250 ms late, on the hats.
 */

const RATE = 48_000;
const BLOCK = 480;
const BEAT_S = 0.5;
const SECONDS = 16;
/** Beats before this are the clock finding the song. */
const SETTLED_S = 8;

const control = (hats: boolean) => {
  let noise = 12_345;
  return (t: number) => {
    const sinceKick = t % BEAT_S;
    const kick =
      0.7 *
      Math.exp(-sinceKick * 14) *
      Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-sinceKick * 40)) * sinceKick);
    const bass = 0.18 * Math.sin(2 * Math.PI * 82.4 * t);
    const sinceHat = (t + BEAT_S / 2) % BEAT_S;
    noise = (noise * 1_103_515_245 + 12_345) % 2_147_483_648;
    const hat = hats
      ? 0.08 * Math.exp(-sinceHat * 60) * (noise / 1_073_741_824 - 1)
      : 0;
    const pad =
      0.05 * Math.sin(2 * Math.PI * 440 * t) +
      0.04 * Math.sin(2 * Math.PI * 660 * t);
    return kick + bass + hat + pad;
  };
};

/** Every hop of `sample`, played for SECONDS, handed to `hear`. */
const playHops = (
  sample: (t: number) => number,
  hear: (hop: ISoundHop) => void,
) => {
  const size = soundHistorySamples(RATE);
  const hops = createSoundHops(RATE);
  const cursor = createSoundCursor();
  const history = new Float32Array(size);
  for (let played = 0; played < SECONDS * RATE; played += BLOCK) {
    history.copyWithin(0, BLOCK);
    for (let at = 0; at < BLOCK; at += 1) {
      history[size - BLOCK + at] = sample((played + at) / RATE);
    }
    hops.update(history, history, ((played + BLOCK) / RATE) * 1000);
    hops.take(cursor).forEach(hear);
  }
};

interface IHeard {
  /** Where the clock put each beat, in seconds. */
  beats: number[];
  /** Where the clock-led flash rose. */
  flashes: number[];
  snares: number[];
}

/** Watches the clock's phase wrap and the flash rise, hop by hop. */
const watcher = () => {
  const heard: IHeard = { beats: [], flashes: [], snares: [] };
  let lastPhase: number | undefined;
  let lastFlash = 0;
  return {
    heard,
    see: (
      atS: number,
      { beatPhase, tempo }: { beatPhase: number; tempo: number },
      flash: number,
      snare: boolean,
    ) => {
      if (lastPhase !== undefined && beatPhase < lastPhase - 0.5 && tempo > 0) {
        heard.beats.push(atS - (beatPhase * 60) / tempo);
      }
      lastPhase = beatPhase;
      if (flash > lastFlash + 0.5) {
        heard.flashes.push(atS);
      }
      lastFlash = flash;
      if (snare) {
        heard.snares.push(atS);
      }
    },
  };
};

/** As the capture and the demo song are heard: the spectrum and the bands. */
const hearLive = (hats: boolean): IHeard => {
  const energy = createEnergyState();
  const { heard, see } = watcher();
  playHops(control(hats), (hop) => {
    const reading = hearSound(energy, [hop], 0);
    see(
      hop.atMs / 1000,
      reading.rhythm,
      reading.beat,
      energy.rhythm.step.snare,
    );
  });
  return heard;
};

/** As music sent from another computer is heard: the bands alone. */
const hearBands = (hats: boolean): IHeard => {
  const state = createRhythmState();
  const { heard, see } = watcher();
  playHops(control(hats), (hop) => {
    const rhythm = advanceRhythm(
      state,
      { bands: Array.from(hop.bands) },
      hop.stepMs,
      true,
    );
    see(hop.atMs / 1000, rhythm, 0, state.step.snare);
  });
  return heard;
};

/** How far each time after SETTLED_S stands from the nearest kick, in ms. */
const fromKicks = (times: number[]) =>
  times
    .filter((at) => at >= SETTLED_S)
    .map((at) => {
      const into = at % BEAT_S;
      return Math.round(1000 * (into > BEAT_S / 2 ? into - BEAT_S : into));
    });

/**
 * Whether there was one a beat over the settled seconds, none lost, and the
 * ones that stood 40 ms or more from a kick.
 */
const offTheKicks = (times: number[]) => {
  const offsets = fromKicks(times);
  return {
    everyBeat: offsets.length >= (SECONDS - SETTLED_S) / BEAT_S - 1,
    off: offsets.filter((offset) => Math.abs(offset) >= 40),
  };
};
const ON_THE_KICKS = { everyBeat: true, off: [] };

describe('the beat clock, with a hat between every two kicks', () => {
  it('hears every hat as a snare, which is the trap', () => {
    // Without this the tests below could pass on a control that never
    // reached the grid's snare at all.
    const snares = fromKicks(hearLive(true).snares);
    expect(snares.length).toBeGreaterThanOrEqual(12);
    snares.forEach((offset) => expect(Math.abs(offset)).toBeGreaterThan(200));
  });

  it('beats on the kicks, and flashes on them, heard live', () => {
    const heard = hearLive(true);
    expect(offTheKicks(heard.beats)).toEqual(ON_THE_KICKS);
    expect(offTheKicks(heard.flashes)).toEqual(ON_THE_KICKS);
  });

  it('beats on the kicks with the kick alone, heard live', () => {
    const heard = hearLive(false);
    expect(offTheKicks(heard.beats)).toEqual(ON_THE_KICKS);
    expect(offTheKicks(heard.flashes)).toEqual(ON_THE_KICKS);
  });

  it('beats on the kicks heard as bands alone, hats or none', () => {
    expect(offTheKicks(hearBands(true).beats)).toEqual(ON_THE_KICKS);
    expect(offTheKicks(hearBands(false).beats)).toEqual(ON_THE_KICKS);
  });
});

describe("the grid's measures", () => {
  const frame = (crack: number, top: number) =>
    Array.from({ length: 24 }, (_, band) => {
      if (band >= 22) {
        return top;
      }
      return band >= 14 ? crack : 0.3;
    });

  it("calls new energy in the air a hat's, and in the crack a snare's", () => {
    const quiet = [{ atMs: 0, bands: frame(0.3, 0.3) }];
    // White noise: as loud in every band, so most of its energy is up top.
    expect(stepHat(quiet, frame(0.6, 0.62))).toBe(1);
    // A snare's crack, with little above it.
    expect(stepHat(quiet, frame(0.6, 0.35))).toBe(0);
    // Nothing new.
    expect(stepHat(quiet, frame(0.3, 0.3))).toBe(0);
  });

  it('raises a height only while its detector hears a hit', () => {
    const kit = createDrumKit();
    // A detector that has heard nothing yet: what rises is not this drum.
    expect(followHitHeight(kit, 'snare', 0, 0.4, 10)).toBe(0);
    kit.snare.detector.sinceMs = 0;
    expect(followHitHeight(kit, 'snare', 0, 0.4, 10)).toBe(0.4);
    // And it is forgotten as the detector forgets its own.
    expect(followHitHeight(kit, 'kick', 0.4, 0, 4_000)).toBeCloseTo(0.2, 6);
  });
});
