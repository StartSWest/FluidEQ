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

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;

export const KARAOKE_CANONICAL_CENTER_MIDI = 60;

export interface IKaraokePitchEstimate {
  frequencyHz: number;
  midi: number;
  note: string;
  cents: number;
  confidence: number;
  rms: number;
}

export interface IKaraokePitchDetectorOptions {
  minFrequencyHz?: number;
  maxFrequencyHz?: number;
  threshold?: number;
  minimumConfidence?: number;
  minimumRms?: number;
}

export type TKaraokeProviderPitchUnit =
  | 'frequency-hz'
  | 'midi'
  | 'midi-cents'
  | 'relative-semitones'
  | 'relative-cents';

export type TKaraokePitchOctavePolicy = 'absolute' | 'nearest-target';

export interface IKaraokePitchViewport {
  centerMidi: number;
  semitoneSpan: number;
}

export const frequencyToMidi = (frequencyHz: number): number =>
  69 + 12 * Math.log2(frequencyHz / 440);

export const midiToFrequency = (midi: number): number =>
  440 * 2 ** ((midi - 69) / 12);

/** Human-readable equal-tempered note name for a canonical MIDI pitch. */
export const midiToNoteName = (midi: number, includeOctave = true): string => {
  if (!Number.isFinite(midi)) {
    return '';
  }
  const nearestMidi = Math.round(midi);
  const noteIndex = ((nearestMidi % 12) + 12) % 12;
  const octave = Math.floor(nearestMidi / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${includeOctave ? octave : ''}`;
};

/**
 * Convert a provider's native pitch value to FluidEQ's canonical coordinate:
 * MIDI semitones. Importers own this translation; renderers never interpret a
 * provider-specific scale.
 */
export const providerPitchToCanonicalMidi = (
  value: number,
  unit: TKaraokeProviderPitchUnit,
  relativeCenterMidi = KARAOKE_CANONICAL_CENTER_MIDI,
): number => {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (unit === 'frequency-hz') {
    return frequencyToMidi(value);
  }
  if (unit === 'midi-cents') {
    return value / 100;
  }
  if (unit === 'relative-semitones') {
    return relativeCenterMidi + value;
  }
  if (unit === 'relative-cents') {
    return relativeCenterMidi + value / 100;
  }
  return value;
};

/**
 * Place a detected voice in the target note's nearest octave. Providers whose
 * charts describe pitch class rather than a fixed vocal octave opt into this
 * behavior through their imported target metadata.
 */
export const alignPitchToTargetOctave = (
  singerMidi: number,
  targetMidi: number,
): number => {
  if (!Number.isFinite(singerMidi) || !Number.isFinite(targetMidi)) {
    return singerMidi;
  }
  return singerMidi + Math.round((targetMidi - singerMidi) / 12) * 12;
};

/** Apply the octave semantics declared by the imported karaoke provider. */
export const projectSingerPitchToTarget = (
  singerMidi: number,
  targetMidi: number,
  octavePolicy: TKaraokePitchOctavePolicy,
): number =>
  octavePolicy === 'nearest-target'
    ? alignPitchToTargetOctave(singerMidi, targetMidi)
    : singerMidi;

export const singerPitchMatchesTarget = (
  singerMidi: number,
  targetMidi: number,
  octavePolicy: TKaraokePitchOctavePolicy,
  toleranceSemitones = 0.5,
): boolean =>
  Number.isFinite(singerMidi) &&
  Number.isFinite(targetMidi) &&
  Number.isFinite(toleranceSemitones) &&
  toleranceSemitones >= 0 &&
  Math.abs(
    projectSingerPitchToTarget(singerMidi, targetMidi, octavePolicy) -
      targetMidi,
  ) <= toleranceSemitones;

/** Calculate a vertical camera that contains every supplied target note. */
export const karaokePitchViewportForTargets = (
  targetMidis: readonly number[],
  fallbackCenterMidi = KARAOKE_CANONICAL_CENTER_MIDI,
  minimumSemitoneSpan = 24,
  paddingSemitones = 4,
): IKaraokePitchViewport => {
  const finiteTargets = targetMidis.filter(Number.isFinite);
  const minimumSpan =
    Number.isFinite(minimumSemitoneSpan) && minimumSemitoneSpan > 0
      ? minimumSemitoneSpan
      : 24;
  if (!finiteTargets.length) {
    return {
      centerMidi: Number.isFinite(fallbackCenterMidi)
        ? fallbackCenterMidi
        : KARAOKE_CANONICAL_CENTER_MIDI,
      semitoneSpan: minimumSpan,
    };
  }
  const minimumMidi = Math.min(...finiteTargets);
  const maximumMidi = Math.max(...finiteTargets);
  const padding =
    Number.isFinite(paddingSemitones) && paddingSemitones > 0
      ? paddingSemitones
      : 0;
  return {
    centerMidi: (minimumMidi + maximumMidi) / 2,
    semitoneSpan: Math.max(minimumSpan, maximumMidi - minimumMidi + padding),
  };
};

/** Exponential easing keeps viewport motion stable at every frame rate. */
export const easeKaraokePitchViewport = (
  current: IKaraokePitchViewport,
  target: IKaraokePitchViewport,
  elapsedMs: number,
  smoothingMs = 240,
): IKaraokePitchViewport => {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return current;
  }
  const duration =
    Number.isFinite(smoothingMs) && smoothingMs > 0 ? smoothingMs : 240;
  const progress = 1 - Math.exp(-elapsedMs / duration);
  const centerMidi =
    current.centerMidi + (target.centerMidi - current.centerMidi) * progress;
  const semitoneSpan =
    current.semitoneSpan +
    (target.semitoneSpan - current.semitoneSpan) * progress;
  return {
    centerMidi:
      Math.abs(target.centerMidi - centerMidi) < 0.01
        ? target.centerMidi
        : centerMidi,
    semitoneSpan:
      Math.abs(target.semitoneSpan - semitoneSpan) < 0.01
        ? target.semitoneSpan
        : semitoneSpan,
  };
};

export const describePitch = (
  frequencyHz: number,
  confidence: number,
  rms: number,
): IKaraokePitchEstimate | undefined => {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return undefined;
  }
  const midi = frequencyToMidi(frequencyHz);
  const nearestMidi = Math.round(midi);
  return {
    frequencyHz,
    midi,
    note: midiToNoteName(nearestMidi),
    cents: Math.round((midi - nearestMidi) * 100),
    confidence: Math.min(1, Math.max(0, confidence)),
    rms: Math.max(0, rms),
  };
};

export const medianPitch = (frequencies: readonly number[]): number => {
  const finite = frequencies
    .filter((frequency) => Number.isFinite(frequency) && frequency > 0)
    .sort((left, right) => left - right);
  if (!finite.length) {
    return 0;
  }
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2
    ? finite[middle]
    : (finite[middle - 1] + finite[middle]) / 2;
};

/**
 * Allocation-bounded YIN detector for one monophonic analysis window.
 *
 * The caller may provide scratch storage so an AudioWorklet can reuse the
 * same difference array for every hop. Low energy or low-confidence windows
 * return undefined: silence is a gap, never a fabricated/held note.
 */
export const detectPitchYin = (
  samples: Float32Array,
  sampleRate: number,
  options: IKaraokePitchDetectorOptions = {},
  scratch = new Float32Array(Math.floor(samples.length / 2) + 1),
): IKaraokePitchEstimate | undefined => {
  const minFrequencyHz = options.minFrequencyHz ?? 70;
  const maxFrequencyHz = options.maxFrequencyHz ?? 1_200;
  const threshold = options.threshold ?? 0.14;
  const minimumConfidence = options.minimumConfidence ?? 0.72;
  const minimumRms = options.minimumRms ?? 0.008;
  if (
    samples.length < 128 ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0 ||
    minFrequencyHz <= 0 ||
    maxFrequencyHz <= minFrequencyHz
  ) {
    return undefined;
  }

  let energy = 0;
  for (let index = 0; index < samples.length; index += 1) {
    energy += samples[index] * samples[index];
  }
  const rms = Math.sqrt(energy / samples.length);
  if (rms < minimumRms) {
    return undefined;
  }

  const minTau = Math.max(2, Math.floor(sampleRate / maxFrequencyHz));
  const maxTau = Math.min(
    Math.floor(sampleRate / minFrequencyHz),
    Math.floor(samples.length / 2),
    scratch.length - 1,
  );
  if (maxTau <= minTau) {
    return undefined;
  }

  scratch.fill(0, 0, maxTau + 1);
  const comparisonLength = samples.length - maxTau;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    let difference = 0;
    for (let index = 0; index < comparisonLength; index += 1) {
      const delta = samples[index] - samples[index + tau];
      difference += delta * delta;
    }
    scratch[tau] = difference;
  }

  scratch[0] = 1;
  let cumulative = 0;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    cumulative += scratch[tau];
    scratch[tau] = cumulative > 0 ? (scratch[tau] * tau) / cumulative : 1;
  }

  let selectedTau = -1;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (scratch[tau] < threshold) {
      selectedTau = tau;
      while (
        selectedTau + 1 <= maxTau &&
        scratch[selectedTau + 1] < scratch[selectedTau]
      ) {
        selectedTau += 1;
      }
      break;
    }
  }
  if (selectedTau < 0) {
    let bestValue = Infinity;
    for (let tau = minTau; tau <= maxTau; tau += 1) {
      if (scratch[tau] < bestValue) {
        bestValue = scratch[tau];
        selectedTau = tau;
      }
    }
  }

  const confidence = 1 - scratch[selectedTau];
  if (!Number.isFinite(confidence) || confidence < minimumConfidence) {
    return undefined;
  }
  const left = scratch[Math.max(1, selectedTau - 1)];
  const center = scratch[selectedTau];
  const right = scratch[Math.min(maxTau, selectedTau + 1)];
  const denominator = 2 * (2 * center - right - left);
  const refinedTau =
    denominator === 0
      ? selectedTau
      : selectedTau + (right - left) / denominator;
  return describePitch(sampleRate / refinedTau, confidence, rms);
};
