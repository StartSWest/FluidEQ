/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCENE_TAP_AGE_LIMIT_S,
  SPECTRUM_TEXELS,
} from '../../../common/sceneUniformContract';
import { getEaseFactor } from '../../../common/smoothing';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import {
  createSlowSpectrum,
  frameSignals,
  frameStepMs,
} from '../../../renderer/graph/sceneSignals';

/**
 * What a frame hands a scene beyond its own numbers, worked out once for the
 * shader path and a 3D world alike: each kept its own copy, which is how one
 * rule became two that disagreed. So the rules are held here, where both
 * read them — how far a clock steps, how the sky's spectrum eases, and what
 * a frame that says nothing reads as.
 */

const frame = (over: Partial<ISceneFrame> = {}): ISceneFrame => ({
  timeSeconds: 2,
  level: 0,
  beat: 0,
  bands: [0, 0, 0],
  musicAccent: [0, 0],
  musicRun: [0, 0],
  accent: [1, 1, 1],
  fade: 1,
  spectrum: new Uint8Array(SPECTRUM_TEXELS),
  waveform: new Uint8Array(SPECTRUM_TEXELS),
  params: {},
  ...over,
});

describe('the step a scene’s clocks take', () => {
  it('is nothing on the first frame, whatever the frame says', () => {
    expect(frameStepMs(frame({ deltaMs: 16 }), undefined)).toBe(0);
  });

  it('is the frame’s own step when it gives one, and its time’s otherwise', () => {
    expect(frameStepMs(frame({ timeSeconds: 2.0625, deltaMs: 16 }), 2)).toBe(
      16,
    );
    expect(frameStepMs(frame({ timeSeconds: 2.0625 }), 2)).toBe(62.5);
  });

  it('is never below nought nor more than a tenth of a second', () => {
    expect(frameStepMs(frame({ deltaMs: 5000 }), 1)).toBe(100);
    expect(frameStepMs(frame({ timeSeconds: 60 }), 2)).toBe(100);
    expect(frameStepMs(frame({ deltaMs: -3 }), 1)).toBe(0);
    expect(frameStepMs(frame({ timeSeconds: 1 }), 2)).toBe(0);
  });
});

describe('the spectrum eased for the sky', () => {
  const spectrum = (value: number, at?: number) => {
    const bins = new Uint8Array(SPECTRUM_TEXELS);
    if (at === undefined) {
      bins.fill(value);
    } else {
      bins[at] = value;
    }
    return bins;
  };

  it('takes the first spectrum as it is, settled', () => {
    const slow = createSlowSpectrum();
    slow.ease(spectrum(200), 16);
    expect(Array.from(slow.values)).toEqual(Array(SPECTRUM_TEXELS).fill(200));
    expect(Array.from(slow.bytes)).toEqual(Array(SPECTRUM_TEXELS).fill(200));
    expect(slow.settled()).toBe(true);
  });

  it('rises over 180 ms and falls over 420, so it rises faster than it falls', () => {
    const rising = createSlowSpectrum();
    rising.ease(spectrum(0), 16);
    rising.ease(spectrum(200), 16);
    const falling = createSlowSpectrum();
    falling.ease(spectrum(200), 16);
    falling.ease(spectrum(0), 16);
    const rose = rising.values[0];
    const fell = 200 - falling.values[0];
    expect(rose).toBeCloseTo(200 * getEaseFactor(16, 180), 4);
    expect(fell).toBeCloseTo(200 * getEaseFactor(16, 420), 4);
    expect(rose).toBeGreaterThan(fell);
    expect(rising.bytes[0]).toBe(Math.round(rising.values[0]));
    expect(rising.settled()).toBe(false);
  });

  it('is settled only when every bin is within a quarter of where it is going', () => {
    const slow = createSlowSpectrum();
    slow.ease(spectrum(100), 16);
    // Two half-lives of 180 ms leave a step of one a quarter short.
    const step = spectrum(100);
    step[0] = 101;
    slow.ease(step, 360);
    expect(slow.values[0]).toBe(100.75);
    expect(slow.settled()).toBe(true);

    const moving = createSlowSpectrum();
    moving.ease(spectrum(100), 16);
    moving.ease(step, 300);
    expect(101 - moving.values[0]).toBeGreaterThan(0.25);
    expect(moving.settled()).toBe(false);
  });

  it('reads a bin past the end of a short spectrum as silence', () => {
    const slow = createSlowSpectrum();
    slow.ease(new Uint8Array([9, 9]), 16);
    expect(Array.from(slow.values.slice(0, 3))).toEqual([9, 9, 0]);
  });
});

describe('what a frame hands a scene', () => {
  it('is nothing heard, nobody pointing and the author’s own view when the frame says nothing', () => {
    expect(frameSignals(frame())).toEqual({
      rhythm: [0, 0, 0, 0],
      drums: [0, 0, 0],
      song: [0, 0, 0, 0],
      stereo: [0, 0],
      voice: [0, 0, 0],
      pointer: [0.5, 0.5, 0, 0],
      tap: [0.5, 0.5, SCENE_TAP_AGE_LIMIT_S, 0],
      camera: [0, 0, 1],
    });
  });

  it('lays what the frame heard into the contract’s values, in their order', () => {
    const signals = frameSignals(
      frame({
        rhythm: {
          beatPhase: 0.1,
          barPhase: 0.2,
          tempo: 120,
          confidence: 0.9,
          kick: 0.8,
          snare: 0.7,
          hat: 0.6,
          intensity: 0.5,
          build: 0.4,
          drop: 0.3,
          dropSerial: 3,
          running: true,
        },
        stereo: [-0.5, 0.25],
        voice: [0.1, 0.2, 0.3],
        pointer: [0.2, 0.8, 1, 1],
        tap: [0.3, 0.4, 0.5, 2],
        camera: [0.1, -0.2, 1.5],
      }),
    );
    expect(signals).toEqual({
      rhythm: [0.1, 0.2, 120, 0.9],
      drums: [0.8, 0.7, 0.6],
      song: [0.5, 0.4, 0.3, 3],
      stereo: [-0.5, 0.25],
      voice: [0.1, 0.2, 0.3],
      pointer: [0.2, 0.8, 1, 1],
      tap: [0.3, 0.4, 0.5, 2],
      camera: [0.1, -0.2, 1.5],
    });
  });
});
