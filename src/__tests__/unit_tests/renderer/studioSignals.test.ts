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

const live = (seconds: number): ISceneFrame => ({
  timeSeconds: seconds,
  deltaMs: 16,
  level: 0.61,
  beat: 0.2,
  bands: [0.5, 0.4, 0.3],
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
      timeSeconds: 3,
      params: { glow: 0.4 },
    });
    expect(shaped.spectrum.every((value) => value === 0)).toBe(true);
    expect(shaped.waveform.every((value) => value === 0)).toBe(true);
  });

  /**
   * A song's spectrum as the analyser lays it out, 20 Hz to 20 kHz on a log
   * scale: loud in the bass, less in the mids, quiet in the treble.
   */
  const texelHertz = (texel: number) => 20 * 1000 ** (texel / 511);
  const song = (bass: number, mid: number, treble: number) => {
    const spectrum = new Uint8Array(512);
    spectrum.forEach((_, texel) => {
      const hertz = texelHertz(texel);
      let value = 0;
      if (hertz >= 20 && hertz < 160) {
        value = bass;
      } else if (hertz >= 160 && hertz < 2000) {
        value = mid;
      } else if (hertz >= 2000 && hertz < 16000) {
        value = treble;
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

  it.each([
    ['bass', 0, 204, [20, 160]],
    ['mid', 1, 153, [160, 2000]],
    ['treble', 2, 102, [2000, 16000]],
  ] as const)(
    'hears only the %s of the music playing, measured as the graph measures it',
    (signal, index, value, [from, to]) => {
      const shaped = shapeStudioFrame(
        playing(1, song(204, 153, 102)),
        signal,
        createStudioSignalBuffers(),
      );
      // That part as loud as it is in the music, the others silent.
      expect(shaped.bands[index]).toBeCloseTo(value / 255, 2);
      expect(shaped.bands.filter((_, other) => other !== index)).toEqual([
        0, 0,
      ]);
      // The spectrum keeps that part where it lives, and nothing else.
      const inside = firstTexelAt(from) + 2;
      const outside = firstTexelAt(to) + 2;
      expect(shaped.spectrum[inside]).toBe(value);
      expect(shaped.spectrum[outside]).toBe(0);
      // Only as loud as that part alone, so quieter than the whole song.
      expect(shaped.level).toBeGreaterThan(0);
      expect(shaped.level).toBeLessThan(shaped.bands[index]);
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
    expect(heard[0]).toBeCloseTo(30 / 255, 2);
    // Up in the same frame the kick is in, never eased in.
    expect(heard[1]).toBeCloseTo(230 / 255, 2);
    // Down again, eased, but already on its way.
    expect(heard[2]).toBeLessThan(heard[1]);
    expect(heard[3]).toBeLessThan(heard[2]);
  });

  it('beats on a kick in the bass, and not on the hi-hats the bass does not have', () => {
    const buffers = createStudioSignalBuffers();
    const shaped = (frame: number, bass: number, treble: number) =>
      shapeStudioFrame(
        playing(frame / 60, song(bass, 40, treble)),
        'bass',
        buffers,
      );
    shaped(0, 20, 20);
    // A hat: loud in the treble only.
    expect(shaped(30, 20, 250).beat).toBe(0);
    // A kick.
    expect(shaped(60, 240, 20).beat).toBe(1);
  });

  it('takes the waveform down by as much of the level as is left', () => {
    const shaped = shapeStudioFrame(
      playing(1, song(204, 153, 102)),
      'treble',
      createStudioSignalBuffers(),
    );
    const scale = shaped.level / 0.5;
    expect(shaped.waveform[10]).toBe(Math.round(77 * scale));
  });

  it('starts afresh when another part is chosen', () => {
    const buffers = createStudioSignalBuffers();
    shapeStudioFrame(playing(0, song(240, 10, 10)), 'bass', buffers);
    // The bass the last signal heard does not carry into the mids.
    const mids = shapeStudioFrame(
      playing(1 / 60, song(240, 10, 10)),
      'mid',
      buffers,
    );
    expect(mids.bands[0]).toBe(0);
    expect(mids.bands[1]).toBeCloseTo(10 / 255, 2);
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
