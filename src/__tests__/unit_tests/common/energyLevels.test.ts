/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createSoundCursor,
  createSoundHops,
  soundHistorySamples,
} from '../../../common/soundHops';
import {
  createEnergyState,
  hearSound,
  type ISpectrumEnergy,
} from '../../../common/spectrumEnergy';

/**
 * The four levels as the window hears them: from the sound's own samples,
 * a hop every 10 ms (`soundHops.ts`), through the same reading every scene,
 * lamp and Studio meter is handed (`energyLevels.ts`).
 */

const RATE = 48_000;
const BLOCK = 480;

/** Plays `sample(t)` into a fresh reading for `seconds`, keeping every reading. */
const listen = (seconds: number, sample: (t: number) => number) => {
  const size = soundHistorySamples(RATE);
  const hops = createSoundHops(RATE);
  const cursor = createSoundCursor();
  const energy = createEnergyState();
  const history = new Float32Array(size);
  const readings: { at: number; energy: ISpectrumEnergy }[] = [];
  let played = 0;
  const play = (until: number, sound: (t: number) => number) => {
    while (played < until * RATE) {
      history.copyWithin(0, BLOCK);
      for (let at = 0; at < BLOCK; at += 1) {
        history[size - BLOCK + at] = sound((played + at) / RATE);
      }
      played += BLOCK;
      hops.update(history, history, (played / RATE) * 1000);
      readings.push({
        at: played / RATE,
        energy: hearSound(energy, hops.take(cursor), cursor.lostMs),
      });
    }
  };
  play(seconds, sample);
  return {
    readings,
    then: (more: number, sound: (t: number) => number) => {
      play(seconds + more, sound);
      return readings;
    },
  };
};

const tone = (hz: number, amplitude: number) => (t: number) =>
  amplitude * Math.sin(2 * Math.PI * hz * t);

/** A sung note: its fundamental and the harmonics a voice carries over it. */
const sung = (hz: number) => (t: number) =>
  [1, 0.7, 0.5, 0.35, 0.25].reduce(
    (sum, amplitude, harmonic) =>
      sum + 0.1 * amplitude * Math.sin(2 * Math.PI * hz * (harmonic + 1) * t),
    0,
  );

const after = (
  readings: { at: number; energy: ISpectrumEnergy }[],
  seconds: number,
) => readings.filter(({ at }) => at >= seconds).map(({ energy }) => energy);

describe('the levels, heard from the sound itself', () => {
  // Summed from 30 to 200 Hz, the bass was a man's voice: the window spreads
  // each of his notes down through every bin below it, and on eighteen songs'
  // separated voices Bass read over 0.3 in half of every sung moment.
  it("reads a bass note as bass, and a man's sung note as none", () => {
    const bass = after(listen(2, tone(55, 0.3)).readings, 1);
    expect(Math.min(...bass.map(({ bass: level }) => level))).toBeGreaterThan(
      0.4,
    );

    const voice = after(listen(2, sung(150)).readings, 0.5);
    expect(Math.max(...voice.map(({ bass: level }) => level))).toBeLessThan(
      0.05,
    );
    // The control: the voice is heard, in the mids.
    expect(Math.max(...voice.map(({ mid }) => mid))).toBeGreaterThan(0.4);
  });

  // A dozen seconds after a song stopped, nothing playing read a level of 1
  // and every part 0.55, and the level went on winding the music's wheel
  // (Ivan's screenshot, 2026-09-24).
  it('reads nothing at all once the music stops, and lets the wheel coast', () => {
    const music = (t: number) =>
      tone(55, 0.2)(t) + sung(220)(t) + tone(8_000, 0.05)(t);
    const session = listen(3, music);
    const playing = session.readings[session.readings.length - 1].energy;
    expect(playing.level).toBeGreaterThan(0.5);
    expect(playing.bass).toBeGreaterThan(0.3);
    expect(playing.mid).toBeGreaterThan(0.3);
    expect(playing.treble).toBeGreaterThan(0.3);

    const readings = session.then(15, () => 0);
    // Two seconds after the music stopped, and on to fifteen: every part
    // fallen away to nothing a meter or a scene can show.
    const stopped = after(readings, 5);
    stopped.forEach(({ level, bass, mid, treble }) => {
      expect(Math.max(level, bass, mid, treble)).toBeLessThan(0.001);
    });
    // Nothing drives the wheel, so it only ever slows.
    const speeds = stopped.map(({ runSpeed }) => runSpeed);
    speeds.slice(1).forEach((speed, at) => {
      expect(speed).toBeLessThanOrEqual(speeds[at]);
    });
  });

  // The mids are what sounds there and lasts: a drum's crack, a few
  // milliseconds long, lifted all three parts on every hit.
  it('keeps a held chord in the mids and leaves a click out', () => {
    const click = (t: number) => {
      const since = t % 0.5;
      return since < 0.003 ? 0.5 * Math.sin(2 * Math.PI * 1_500 * t) : 0;
    };
    const clicks = after(listen(4, click).readings, 1);
    expect(Math.max(...clicks.map(({ mid }) => mid))).toBeLessThan(0.05);

    const chord = (t: number) =>
      tone(300, 0.1)(t) + tone(400, 0.1)(t) + tone(500, 0.1)(t);
    const held = after(listen(2, chord).readings, 1);
    expect(Math.min(...held.map(({ mid }) => mid))).toBeGreaterThan(0.4);
  });
});
