/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCENE_TIME_WRAP_S,
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
} from '../../../common/sceneUniformContract';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import {
  calmBands,
  createCalmShaper,
  fillCalmSpectrum,
  fillCalmWaveform,
} from '../../../renderer/wallpaper/calmMotion';

const spectrumAt = (seconds: number) => {
  const spectrum = new Uint8Array(SPECTRUM_TEXELS);
  fillCalmSpectrum(calmBands(seconds), seconds, spectrum);
  return spectrum;
};

const waveformAt = (seconds: number) => {
  const waveform = new Uint8Array(WAVEFORM_TEXELS);
  fillCalmWaveform(calmBands(seconds), seconds, waveform);
  return waveform;
};

const largestDifference = (a: Uint8Array, b: Uint8Array) =>
  a.reduce(
    (most, value, index) => Math.max(most, Math.abs(value - b[index])),
    0,
  );

const heardFrame = (seconds: number, beat = 0.9): ISceneFrame => ({
  timeSeconds: seconds,
  deltaMs: 1000 / 60,
  level: 0.7,
  beat,
  bands: [0.8, 0.5, 0.3],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [0, 0.9, 0.8],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS).fill(200),
  waveform: new Uint8Array(WAVEFORM_TEXELS).fill(180),
  params: { growth: 0.4 },
});

describe('the calm motion', () => {
  const minutes = Array.from({ length: 2400 }, (_, step) => step * 0.05);

  it('stays at the quiet end of what music measures, and never beats', () => {
    minutes.forEach((seconds) => {
      const { level, bass, mid, treble } = calmBands(seconds);
      expect(level).toBeGreaterThan(0.08);
      expect(level).toBeLessThan(0.36);
      [bass, mid, treble].forEach((band) => {
        expect(band).toBeGreaterThanOrEqual(0);
        expect(band).toBeLessThanOrEqual(1);
      });
      expect(treble).toBeLessThan(bass);
    });
  });

  it('breathes: the level swells and settles again within one breath pair', () => {
    const levels = Array.from(
      { length: 160 },
      (_, step) => calmBands(step * 0.1).level,
    );
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.1);
  });

  // The scene clock wraps every hour; a motion that did not come round with it
  // would jump once an hour on a desktop left running for days.
  it('comes round exactly with the scene clock, so its hourly wrap moves nothing', () => {
    [0, 3.7, 811.25, SCENE_TIME_WRAP_S - 0.01].forEach((seconds) => {
      const now = calmBands(seconds);
      const anHourOn = calmBands(seconds + SCENE_TIME_WRAP_S);
      (['level', 'bass', 'mid', 'treble'] as const).forEach((key) =>
        expect(anHourOn[key]).toBeCloseTo(now[key], 6),
      );
      expect(
        largestDifference(
          spectrumAt(seconds),
          spectrumAt(seconds + SCENE_TIME_WRAP_S),
        ),
      ).toBeLessThanOrEqual(1);
      expect(
        largestDifference(
          waveformAt(seconds),
          waveformAt(seconds + SCENE_TIME_WRAP_S),
        ),
      ).toBeLessThanOrEqual(1);
    });
    expect(
      largestDifference(spectrumAt(SCENE_TIME_WRAP_S - 1 / 60), spectrumAt(0)),
    ).toBeLessThanOrEqual(3);
  });

  it('moves the spectrum gently: never a jump between frames, a visible change over seconds', () => {
    expect(largestDifference(spectrumAt(12), spectrumAt(12))).toBe(0);
    expect(
      largestDifference(spectrumAt(12), spectrumAt(12 + 1 / 60)),
    ).toBeLessThanOrEqual(3);
    expect(largestDifference(spectrumAt(12), spectrumAt(15))).toBeGreaterThan(
      10,
    );
  });
});

describe('a desktop background’s shaper', () => {
  it('passes the music through untouched while the background follows it', () => {
    const shaper = createCalmShaper('music');
    const heard = heardFrame(4);
    expect(shaper.shape(heard)).toBe(heard);
  });

  it('opens calm when the background was set calm, with no beat and the scene’s own clock', () => {
    const shaper = createCalmShaper('calm');
    const heard = heardFrame(4);
    const shaped = shaper.shape(heard);
    expect(shaped.beat).toBe(0);
    expect(shaped.level).toBeCloseTo(calmBands(4).level, 6);
    expect(Array.from(shaped.spectrum)).toEqual(Array.from(spectrumAt(4)));
    expect([shaped.timeSeconds, shaped.fade, shaped.params]).toEqual([
      heard.timeSeconds,
      heard.fade,
      heard.params,
    ]);
    // Never written into the runner's own buffers.
    expect(heard.spectrum.every((value) => value === 200)).toBe(true);
    expect(heard.waveform.every((value) => value === 180)).toBe(true);
  });

  it('hands over from the music to calm in a second and a half, the beat only ever fading', () => {
    const shaper = createCalmShaper('music');
    shaper.setMotion('calm');
    const first = shaper.shape(heardFrame(10));
    expect(first.beat).toBeGreaterThan(0.85);
    expect(first.beat).toBeLessThan(0.9);

    let previous = first;
    for (let frame = 1; frame < 89; frame += 1) {
      const next = shaper.shape(heardFrame(10 + frame / 60));
      expect(next.beat).toBeLessThanOrEqual(previous.beat);
      expect(next.beat).toBeGreaterThan(0);
      previous = next;
    }
    // The ninetieth frame at 60 a second: a second and a half, and calm.
    const over = shaper.shape(heardFrame(11.5));
    expect(over.beat).toBe(0);
    expect(over.level).toBeCloseTo(calmBands(11.5).level, 6);
    expect(Array.from(over.spectrum)).toEqual(Array.from(spectrumAt(11.5)));
  });

  it('hands back to the music, until the music passes through untouched again', () => {
    const shaper = createCalmShaper('calm');
    shaper.setMotion('music');
    const heard = heardFrame(20);
    expect(shaper.shape(heard)).not.toBe(heard);
    let last: ISceneFrame | undefined;
    let passed: ISceneFrame | undefined;
    for (let frame = 1; frame <= 90; frame += 1) {
      passed = heardFrame(20 + frame / 60);
      last = shaper.shape(passed);
    }
    expect(last).toBe(passed);
  });

  it('turns round smoothly when switched back before the handoff is over', () => {
    const shaper = createCalmShaper('music');
    shaper.setMotion('calm');
    let beat = 0.9;
    for (let frame = 0; frame < 45; frame += 1) {
      ({ beat } = shaper.shape(heardFrame(30 + frame / 60)));
    }
    shaper.setMotion('music');
    const turned = shaper.shape(heardFrame(30.75));
    expect(Math.abs(turned.beat - beat)).toBeLessThan(0.05);
  });
});
