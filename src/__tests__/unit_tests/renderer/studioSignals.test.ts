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

const energyIn = (spectrum: Uint8Array, from: number, to: number) => {
  let sum = 0;
  for (let texel = from; texel < to; texel += 1) {
    sum += spectrum[texel];
  }
  return sum / (to - from);
};

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

  it.each([
    ['bass', 0, [0, 100]],
    ['mid', 1, [220, 300]],
    ['treble', 2, [390, 460]],
  ] as const)(
    'isolates %s, in the bands and where it lives in the spectrum',
    (signal, index, [from, to]) => {
      const shaped = shapeStudioFrame(
        live(1.3),
        signal,
        createStudioSignalBuffers(),
      );
      const loudest = shaped.bands.indexOf(Math.max(...shaped.bands));
      expect(loudest).toBe(index);
      expect(shaped.beat).toBe(0);
      // The band's own region is the loudest part of the spectrum.
      const own = energyIn(shaped.spectrum, from, to);
      expect(own).toBeGreaterThan(energyIn(shaped.spectrum, 0, 512) * 1.5);
    },
  );

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
