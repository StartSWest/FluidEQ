/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ACCENT_PERIOD_S,
  createStudioSignalBuffers,
  shapeStudioFrame,
  studioBands,
} from '../../../renderer/studio/studioSignals';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { BASS_HZ, MID_HZ, TREBLE_HZ } from '../../../common/spectrumEnergy';

/** What a part playing as it has been reads (`energyLevels.ts`). */
const AT_USUAL = 0.55;

const live = (seconds: number): ISceneFrame => ({
  timeSeconds: seconds,
  deltaMs: 16,
  level: 0.61,
  beat: 0.2,
  bands: [0.5, 0.4, 0.3],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [0, 0.9, 0.8],
  fade: 1,
  spectrum: new Uint8Array(512).fill(99),
  waveform: new Uint8Array(128).fill(77),
  params: { glow: 0.4 },
});

describe("the Studio's test signals", () => {
  it('passes live music through untouched', () => {
    const frame = live(3);
    expect(shapeStudioFrame(frame, 'live', createStudioSignalBuffers())).toBe(
      frame,
    );
  });

  it('makes silence silent, and keeps the clock and the parameters', () => {
    const shaped = shapeStudioFrame(
      live(3),
      'silence',
      createStudioSignalBuffers(),
    );
    expect(shaped).toMatchObject({
      level: 0,
      beat: 0,
      bands: [0, 0, 0],
      musicAccent: [0, 0],
      musicRun: [0, 0],
      timeSeconds: 3,
      params: { glow: 0.4 },
    });
    expect(shaped.spectrum.every((value) => value === 0)).toBe(true);
    expect(shaped.waveform.every((value) => value === 0)).toBe(true);
  });

  /**
   * A song's spectrum as the analyser lays it out, 20 Hz to 20 kHz on a log
   * scale, a level in each part where the parts meet: loud in the bass, less
   * in the mids, quiet in the treble.
   */
  const texelHertz = (texel: number) => 20 * 1000 ** (texel / 511);
  const song = (bass: number, mid: number, treble: number) => {
    const spectrum = new Uint8Array(512);
    spectrum.forEach((_, texel) => {
      const hertz = texelHertz(texel);
      let value = treble;
      if (hertz < BASS_HZ[1]) {
        value = bass;
      } else if (hertz < MID_HZ[1]) {
        value = mid;
      }
      spectrum[texel] = value;
    });
    return spectrum;
  };
  const playing = (seconds: number, spectrum: Uint8Array): ISceneFrame => ({
    ...live(seconds),
    level: 0.5,
    spectrum,
  });
  const firstTexelAt = (hertz: number) =>
    Math.ceil((Math.log(hertz / 20) / Math.log(1000)) * 511);

  /** `count` frames of `spectrum` under `signal`, the last one shaped. */
  const hearFor = (
    signal: 'bass' | 'mid' | 'treble',
    spectrum: Uint8Array,
    count: number,
    buffers = createStudioSignalBuffers(),
  ) => {
    let shaped = live(0);
    for (let frame = 0; frame < count; frame += 1) {
      shaped = shapeStudioFrame(playing(frame / 60, spectrum), signal, buffers);
    }
    return shaped;
  };

  it.each([
    ['bass', 0, 204, BASS_HZ],
    ['mid', 1, 153, MID_HZ],
    ['treble', 2, 102, TREBLE_HZ],
  ] as const)(
    'hears only the %s of the music playing, measured as the graph measures it',
    (signal, index, value, [from, to]) => {
      const shaped = hearFor(signal, song(204, 153, 102), 20);
      // That part playing as it has been, and the rest taken out: nothing at
      // all, where a quiet rest still read as a part playing.
      expect(shaped.bands[index]).toBeCloseTo(AT_USUAL, 2);
      expect(shaped.bands.filter((_, other) => other !== index)).toEqual([
        0, 0,
      ]);
      // The spectrum keeps that part where it lives, and nothing else.
      const inside = Math.max(0, firstTexelAt(Math.max(20, from))) + 2;
      expect(shaped.spectrum[inside]).toBe(value);
      const outsideLit = Array.from(shaped.spectrum.keys()).filter(
        (texel) =>
          (texelHertz(texel) < from || texelHertz(texel) >= to) &&
          shaped.spectrum[texel] !== 0,
      );
      expect(outsideLit).toEqual([]);
      expect(shaped.level).toBeGreaterThan(0);
    },
  );

  it('follows the bass from frame to frame, a kick arriving at once and falling away', () => {
    const buffers = createStudioSignalBuffers();
    const heard = [30, 230, 120, 40].map(
      (bass, frame) =>
        shapeStudioFrame(
          playing(frame / 60, song(bass, 100, 60)),
          'bass',
          buffers,
        ).bands[0],
    );
    expect(heard[0]).toBeCloseTo(AT_USUAL, 2);
    // Up in the same frame the kick is in, never eased in: far over the bass
    // it had been hearing.
    expect(heard[1]).toBe(1);
    // Down again, eased, but already on its way.
    expect(heard[2]).toBeLessThan(heard[1]);
    expect(heard[3]).toBeLessThan(heard[2]);
  });

  it('beats on a kick in the bass, and not on the hi-hats the bass does not have', () => {
    const buffers = createStudioSignalBuffers();
    // Frame by frame, as the scene is given them: the listener keeps the pulse
    // it has been hearing and will not call two onsets inside a quarter of a
    // second, so three frames stepped thirty apart are, to it, three frames in
    // a twentieth of a second.
    const play = (
      from: number,
      count: number,
      bass: number,
      treble: number,
    ) => {
      let last = 0;
      for (let frame = from; frame < from + count; frame += 1) {
        last = shapeStudioFrame(
          playing(frame / 60, song(bass, 40, treble)),
          'bass',
          buffers,
        ).beat;
      }
      return last;
    };
    play(0, 30, 20, 20);
    // A hat: loud in the treble only, and the bass signal has no treble.
    expect(play(30, 30, 20, 250)).toBe(0);
    // A kick, which the bass does have.
    expect(play(60, 1, 240, 20)).toBe(1);
  });

  it('takes the waveform down by as much of the sound as is left', () => {
    // A song that is all bass is all there under Bass.
    expect(hearFor('bass', song(204, 0, 0), 1).waveform[10]).toBe(77);
    // The quiet treble of a song is a small part of it, and the loud bass a
    // large one: each scaled by its share, and neither by a level, which
    // reads 1 for a part alone and for the whole song alike.
    const treble = hearFor('treble', song(204, 153, 102), 1).waveform[10];
    const bass = hearFor('bass', song(204, 153, 102), 1).waveform[10];
    expect(treble).toBeGreaterThan(0);
    expect(treble).toBeLessThan(77 / 4);
    expect(bass).toBeGreaterThan(treble);
    expect(bass).toBeLessThan(77);
  });

  it('starts afresh when another part is chosen', () => {
    const buffers = createStudioSignalBuffers();
    hearFor('bass', song(240, 10, 10), 20, buffers);
    // The bass the last signal heard does not carry into the mids: they read
    // exactly as mids heard from the start.
    const mids = hearFor('mid', song(240, 10, 10), 10, buffers);
    const fresh = hearFor('mid', song(240, 10, 10), 10);
    expect(mids.bands).toEqual(fresh.bands);
    expect(mids.bands[0]).toBe(0);
    expect(mids.bands[1]).toBeGreaterThan(0);
  });

  it('beats at a steady tempo', () => {
    const peaks = [0, 0.1, 0.5, 60 / 118, 60 / 118 + 0.01].map(
      (seconds) => studioBands('beat', seconds).beat,
    );
    expect(peaks[0]).toBeCloseTo(1, 6);
    expect(peaks[2]).toBeLessThan(0.1);
    expect(peaks[3]).toBeCloseTo(1, 6);
  });

  it('gives an accent onset once a period, and quiet between', () => {
    expect(studioBands('accent', 0).beat).toBeCloseTo(1, 6);
    expect(studioBands('accent', ACCENT_PERIOD_S / 2).beat).toBeLessThan(0.01);
    expect(studioBands('accent', ACCENT_PERIOD_S).beat).toBeCloseTo(1, 6);
  });
});
