/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  alignPitchToTargetOctave,
  describePitch,
  detectPitchYin,
  easeKaraokePitchViewport,
  frequencyToMidi,
  karaokePitchViewportForTargets,
  medianPitch,
  midiToFrequency,
  midiToNoteName,
  projectSingerPitchToTarget,
  providerPitchToCanonicalMidi,
  singerPitchMatchesTarget,
} from '../../../common/karaoke/pitch';

const SAMPLE_RATE = 48_000;
const WINDOW_SIZE = 2_048;

const sine = (frequencyHz: number, amplitude = 0.5) => {
  const samples = new Float32Array(WINDOW_SIZE);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] =
      amplitude * Math.sin((2 * Math.PI * frequencyHz * index) / SAMPLE_RATE);
  }
  return samples;
};

describe('Karaoke pitch detector', () => {
  it.each([110, 220, 440, 880])(
    'detects a clean %d Hz tone within twenty cents',
    (frequencyHz) => {
      const estimate = detectPitchYin(sine(frequencyHz), SAMPLE_RATE);
      expect(estimate).toBeDefined();
      const errorCents =
        1_200 * Math.log2((estimate?.frequencyHz ?? 1) / frequencyHz);
      expect(Math.abs(errorCents)).toBeLessThanOrEqual(20);
      expect(estimate?.confidence).toBeGreaterThan(0.72);
    },
  );

  it('rejects silence and a signal below the energy gate', () => {
    expect(detectPitchYin(new Float32Array(WINDOW_SIZE), SAMPLE_RATE)).toBe(
      undefined,
    );
    expect(detectPitchYin(sine(440, 0.001), SAMPLE_RATE)).toBe(undefined);
  });

  it('converts frequency, MIDI, note and cents without rewriting raw pitch', () => {
    expect(frequencyToMidi(440)).toBe(69);
    expect(midiToFrequency(69)).toBe(440);
    expect(describePitch(440, 0.9, 0.2)).toMatchObject({
      note: 'A4',
      cents: 0,
      midi: 69,
    });
    expect(describePitch(445, 0.9, 0.2)).toMatchObject({
      note: 'A4',
      cents: 20,
    });
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(66, false)).toBe('F♯');
  });

  it('normalizes provider pitch units to canonical MIDI semitones', () => {
    expect(providerPitchToCanonicalMidi(440, 'frequency-hz')).toBe(69);
    expect(providerPitchToCanonicalMidi(69, 'midi')).toBe(69);
    expect(providerPitchToCanonicalMidi(6_900, 'midi-cents')).toBe(69);
    expect(providerPitchToCanonicalMidi(0, 'relative-semitones')).toBe(60);
    expect(providerPitchToCanonicalMidi(2, 'relative-semitones', 57)).toBe(59);
    expect(providerPitchToCanonicalMidi(900, 'relative-cents', 60)).toBe(69);
  });

  it('provides stable median smoothing while ignoring rejected values', () => {
    expect(medianPitch([440, 880, 441, 0, Number.NaN, 439])).toBe(440.5);
    expect(medianPitch([])).toBe(0);
  });

  it('aligns a singer to the target octave without hiding pitch errors', () => {
    expect(alignPitchToTargetOctave(48, 60)).toBe(60);
    expect(alignPitchToTargetOctave(72, 60)).toBe(60);
    expect(alignPitchToTargetOctave(49.4, 60)).toBeCloseTo(61.4);
    expect(alignPitchToTargetOctave(58.6, 60)).toBeCloseTo(58.6);
  });

  it('uses each provider octave policy when projecting the singer', () => {
    expect(projectSingerPitchToTarget(48, 60, 'nearest-target')).toBe(60);
    expect(projectSingerPitchToTarget(48, 60, 'absolute')).toBe(48);
    expect(projectSingerPitchToTarget(73.25, 61, 'nearest-target')).toBe(61.25);
  });

  it('matches pitch against the same provider-neutral projection', () => {
    expect(singerPitchMatchesTarget(48.35, 60, 'nearest-target')).toBe(true);
    expect(singerPitchMatchesTarget(48.7, 60, 'nearest-target')).toBe(false);
    expect(singerPitchMatchesTarget(48, 60, 'absolute')).toBe(false);
    expect(singerPitchMatchesTarget(59.6, 60, 'absolute')).toBe(true);
  });

  it('fits all visible targets and eases viewport changes', () => {
    expect(karaokePitchViewportForTargets([48, 72])).toEqual({
      centerMidi: 60,
      semitoneSpan: 28,
    });
    expect(karaokePitchViewportForTargets([64])).toEqual({
      centerMidi: 64,
      semitoneSpan: 24,
    });

    const eased = easeKaraokePitchViewport(
      { centerMidi: 60, semitoneSpan: 24 },
      { centerMidi: 72, semitoneSpan: 36 },
      120,
      240,
    );
    expect(eased.centerMidi).toBeGreaterThan(60);
    expect(eased.centerMidi).toBeLessThan(72);
    expect(eased.semitoneSpan).toBeGreaterThan(24);
    expect(eased.semitoneSpan).toBeLessThan(36);
  });
});
