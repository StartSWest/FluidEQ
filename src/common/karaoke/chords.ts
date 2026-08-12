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

export type TKaraokeChordQuality = 'major' | 'minor';

export interface IKaraokeChordEstimate {
  rootPitchClass: number;
  quality: TKaraokeChordQuality;
  label: string;
  confidence: number;
}

export interface IKaraokeChordSegment extends IKaraokeChordEstimate {
  startMs: number;
  endMs: number;
}

export interface IKaraokeChordAnalysisOptions {
  onProgress?: (progress: number) => void;
  shouldCancel?: () => boolean;
  /** Smaller values yield to the UI more often. Primarily exposed for tests. */
  framesPerYield?: number;
}

interface IKaraokeChordFeatureFrame {
  startMs: number;
  rms: number;
  chroma: Float32Array;
  bassChroma: Float32Array;
}

interface IKaraokeChordFrameResult {
  startMs: number;
  label?: string;
  estimate?: IKaraokeChordEstimate;
  rms: number;
}

interface IKaraokeChordTemplate {
  rootPitchClass: number;
  quality: TKaraokeChordQuality;
  label: string;
  values: Float32Array;
  norm: number;
}

export const KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE = 11_025;

const FFT_SIZE = 4_096;
const FFT_HOP_SIZE = 2_048;
const MINIMUM_CHORD_FREQUENCY_HZ = 55;
const MAXIMUM_CHORD_FREQUENCY_HZ = 1_760;
const MINIMUM_SEGMENT_MS = 560;
const MAXIMUM_SAME_CHORD_GAP_MS = 460;
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

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const chordLabel = (
  rootPitchClass: number,
  quality: TKaraokeChordQuality,
): string =>
  `${NOTE_NAMES[((rootPitchClass % 12) + 12) % 12]}${
    quality === 'minor' ? 'm' : ''
  }`;

const createChordTemplates = (): IKaraokeChordTemplate[] => {
  const templates: IKaraokeChordTemplate[] = [];
  (['major', 'minor'] as const).forEach((quality) => {
    const intervals = quality === 'major' ? [0, 4, 7] : [0, 3, 7];
    const weights = [1, 0.88, 0.78];
    for (let rootPitchClass = 0; rootPitchClass < 12; rootPitchClass += 1) {
      const values = new Float32Array(12);
      intervals.forEach((interval, index) => {
        values[(rootPitchClass + interval) % 12] = weights[index];
      });
      const norm = Math.sqrt(
        values.reduce((sum, value) => sum + value * value, 0),
      );
      templates.push({
        rootPitchClass,
        quality,
        label: chordLabel(rootPitchClass, quality),
        values,
        norm,
      });
    }
  });
  return templates;
};

const CHORD_TEMPLATES = createChordTemplates();

/** Match a normalized pitch-class energy vector to simple guitar chords. */
export const estimateKaraokeChord = (
  chroma: ArrayLike<number>,
  bassChroma?: ArrayLike<number>,
): IKaraokeChordEstimate | undefined => {
  if (chroma.length < 12) {
    return undefined;
  }
  let chromaNormSquared = 0;
  let chromaTotal = 0;
  let bassTotal = 0;
  for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
    const value = Math.max(0, Number(chroma[pitchClass]) || 0);
    chromaNormSquared += value * value;
    chromaTotal += value;
    bassTotal += Math.max(0, Number(bassChroma?.[pitchClass]) || 0);
  }
  const chromaNorm = Math.sqrt(chromaNormSquared);
  if (chromaNorm <= 1e-8 || chromaTotal <= 1e-8) {
    return undefined;
  }

  const ranked = CHORD_TEMPLATES.map((template) => {
    let dot = 0;
    let outsideEnergy = 0;
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      const energy = Math.max(0, Number(chroma[pitchClass]) || 0);
      dot += energy * template.values[pitchClass];
      if (template.values[pitchClass] === 0) {
        outsideEnergy += energy;
      }
    }
    const similarity = dot / (chromaNorm * template.norm);
    const rootBass = bassTotal
      ? Math.max(0, Number(bassChroma?.[template.rootPitchClass]) || 0) /
        bassTotal
      : 0;
    const outsideRatio = outsideEnergy / chromaTotal;
    return {
      template,
      score: similarity * 0.86 + rootBass * 0.2 - outsideRatio * 0.08,
    };
  }).sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 0.43) {
    return undefined;
  }
  const separation = best.score - (second?.score ?? 0);
  const confidence = clamp((best.score - 0.43) * 1.35 + separation * 3.2, 0, 1);
  return {
    rootPitchClass: best.template.rootPitchClass,
    quality: best.template.quality,
    label: best.template.label,
    confidence,
  };
};

const reverseBits = (value: number, bits: number): number => {
  let reversed = 0;
  let remaining = value;
  for (let bit = 0; bit < bits; bit += 1) {
    reversed = reversed * 2 + (remaining % 2);
    remaining = Math.floor(remaining / 2);
  }
  return reversed;
};

const createBitReversal = (size: number): Uint16Array => {
  const bits = Math.log2(size);
  const result = new Uint16Array(size);
  for (let index = 0; index < size; index += 1) {
    result[index] = reverseBits(index, bits);
  }
  return result;
};

const fftInPlace = (
  real: Float64Array,
  imaginary: Float64Array,
  bitReversal: Uint16Array,
) => {
  const size = real.length;
  for (let index = 0; index < size; index += 1) {
    const reversed = bitReversal[index];
    if (reversed > index) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [
        imaginary[reversed],
        imaginary[index],
      ];
    }
  }

  for (let length = 2; length <= size; length *= 2) {
    const half = length / 2;
    const phaseStep = (-2 * Math.PI) / length;
    for (let start = 0; start < size; start += length) {
      for (let offset = 0; offset < half; offset += 1) {
        const phase = phaseStep * offset;
        const cosine = Math.cos(phase);
        const sine = Math.sin(phase);
        const even = start + offset;
        const odd = even + half;
        const oddReal = real[odd] * cosine - imaginary[odd] * sine;
        const oddImaginary = real[odd] * sine + imaginary[odd] * cosine;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
      }
    }
  }
};

const normalizeChroma = (chroma: Float32Array) => {
  const maximum = chroma.reduce(
    (largest, value) => Math.max(largest, value),
    0,
  );
  if (maximum <= 1e-8) {
    return;
  }
  for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
    chroma[pitchClass] /= maximum;
  }
};

const yieldToRenderer = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const smoothChordFrames = (
  frames: readonly IKaraokeChordFrameResult[],
): Array<string | undefined> =>
  frames.map((_, frameIndex) => {
    const votes = new Map<string, number>();
    for (let offset = -2; offset <= 2; offset += 1) {
      const neighbor = frames[frameIndex + offset];
      if (neighbor?.label && neighbor.estimate) {
        const distanceWeight = 3 - Math.abs(offset);
        const vote = distanceWeight * (0.28 + neighbor.estimate.confidence);
        votes.set(neighbor.label, (votes.get(neighbor.label) ?? 0) + vote);
      }
    }
    if (!votes.size) {
      return undefined;
    }
    return [...votes.entries()].sort((left, right) => right[1] - left[1])[0][0];
  });

const chordFramesToSegments = (
  frames: readonly IKaraokeChordFrameResult[],
  smoothedLabels: readonly (string | undefined)[],
  durationMs: number,
): IKaraokeChordSegment[] => {
  const frameDurationMs =
    (FFT_HOP_SIZE / KARAOKE_CHORD_ANALYSIS_SAMPLE_RATE) * 1_000;
  const runs: Array<{
    label: string;
    startMs: number;
    endMs: number;
    estimates: IKaraokeChordEstimate[];
  }> = [];
  smoothedLabels.forEach((label, frameIndex) => {
    if (!label) {
      return;
    }
    const startMs = frames[frameIndex]?.startMs ?? frameIndex * frameDurationMs;
    const endMs = Math.min(durationMs, startMs + frameDurationMs);
    const previous = runs[runs.length - 1];
    if (
      previous?.label === label &&
      startMs - previous.endMs <= frameDurationMs * 1.5
    ) {
      previous.endMs = endMs;
      if (frames[frameIndex]?.estimate?.label === label) {
        previous.estimates.push(
          frames[frameIndex].estimate as IKaraokeChordEstimate,
        );
      }
      return;
    }
    runs.push({
      label,
      startMs,
      endMs,
      estimates:
        frames[frameIndex]?.estimate?.label === label &&
        frames[frameIndex].estimate
          ? [frames[frameIndex].estimate as IKaraokeChordEstimate]
          : [],
    });
  });

  const segments = runs
    .filter((run) => run.endMs - run.startMs >= MINIMUM_SEGMENT_MS)
    .map((run): IKaraokeChordSegment => {
      const matchingTemplate = CHORD_TEMPLATES.find(
        (template) => template.label === run.label,
      ) as IKaraokeChordTemplate;
      const confidence = run.estimates.length
        ? run.estimates.reduce(
            (sum, estimate) => sum + estimate.confidence,
            0,
          ) / run.estimates.length
        : 0.25;
      return {
        startMs: run.startMs,
        endMs: run.endMs,
        rootPitchClass: matchingTemplate.rootPitchClass,
        quality: matchingTemplate.quality,
        label: matchingTemplate.label,
        confidence,
      };
    });

  const merged: IKaraokeChordSegment[] = [];
  segments.forEach((segment) => {
    const previous = merged[merged.length - 1];
    if (
      previous?.label === segment.label &&
      segment.startMs - previous.endMs <= MAXIMUM_SAME_CHORD_GAP_MS
    ) {
      const previousDuration = previous.endMs - previous.startMs;
      const segmentDuration = segment.endMs - segment.startMs;
      previous.endMs = segment.endMs;
      previous.confidence =
        (previous.confidence * previousDuration +
          segment.confidence * segmentDuration) /
        Math.max(1, previousDuration + segmentDuration);
      return;
    }
    merged.push({ ...segment });
  });
  return merged;
};

/**
 * Estimate a simple major/minor chord track from mono PCM.
 *
 * This is intentionally dependency-free and cooperative: FFT work yields in
 * small batches, so importing a long song cannot freeze playback or the UI.
 */
export const analyzeKaraokeChords = async (
  samples: Float32Array,
  sampleRate: number,
  options: IKaraokeChordAnalysisOptions = {},
): Promise<IKaraokeChordSegment[]> => {
  if (!samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return [];
  }
  const frameCount = Math.max(
    1,
    Math.ceil(Math.max(0, samples.length - FFT_SIZE) / FFT_HOP_SIZE) + 1,
  );
  const framesPerYield = Math.max(1, options.framesPerYield ?? 8);
  const window = Float64Array.from(
    { length: FFT_SIZE },
    (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1)),
  );
  const bitReversal = createBitReversal(FFT_SIZE);
  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);
  const frames: IKaraokeChordFeatureFrame[] = [];
  const minimumBin = Math.max(
    1,
    Math.ceil((MINIMUM_CHORD_FREQUENCY_HZ * FFT_SIZE) / sampleRate),
  );
  const maximumBin = Math.min(
    FFT_SIZE / 2 - 1,
    Math.floor((MAXIMUM_CHORD_FREQUENCY_HZ * FFT_SIZE) / sampleRate),
  );

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    if (options.shouldCancel?.()) {
      return [];
    }
    const offset = frameIndex * FFT_HOP_SIZE;
    let energy = 0;
    for (let sampleIndex = 0; sampleIndex < FFT_SIZE; sampleIndex += 1) {
      const sample = samples[offset + sampleIndex] ?? 0;
      energy += sample * sample;
      real[sampleIndex] = sample * window[sampleIndex];
      imaginary[sampleIndex] = 0;
    }
    fftInPlace(real, imaginary, bitReversal);
    const chroma = new Float32Array(12);
    const bassChroma = new Float32Array(12);
    for (let bin = minimumBin; bin <= maximumBin; bin += 1) {
      const frequencyHz = (bin * sampleRate) / FFT_SIZE;
      const midi = 69 + 12 * Math.log2(frequencyHz / 440);
      const nearestMidi = Math.round(midi);
      const pitchClass = ((nearestMidi % 12) + 12) % 12;
      const detuneWeight = Math.max(0.35, 1 - Math.abs(midi - nearestMidi));
      const magnitude = Math.log1p(Math.hypot(real[bin], imaginary[bin]));
      const weightedMagnitude = magnitude * detuneWeight;
      chroma[pitchClass] += weightedMagnitude;
      if (frequencyHz <= 330) {
        bassChroma[pitchClass] += weightedMagnitude;
      }
    }
    normalizeChroma(chroma);
    normalizeChroma(bassChroma);
    frames.push({
      startMs: (offset / sampleRate) * 1_000,
      rms: Math.sqrt(energy / FFT_SIZE),
      chroma,
      bassChroma,
    });
    options.onProgress?.((frameIndex + 1) / frameCount);
    if ((frameIndex + 1) % framesPerYield === 0) {
      await yieldToRenderer();
    }
  }

  const audibleRms = frames
    .map((frame) => frame.rms)
    .filter((rms) => rms > 1e-6)
    .sort((left, right) => left - right);
  const medianRms = audibleRms.length
    ? audibleRms[Math.floor(audibleRms.length / 2)]
    : 0;
  const silenceFloor = Math.max(0.0002, medianRms * 0.055);
  const classified: IKaraokeChordFrameResult[] = frames.map((frame) => {
    const estimate =
      frame.rms >= silenceFloor
        ? estimateKaraokeChord(frame.chroma, frame.bassChroma)
        : undefined;
    return {
      startMs: frame.startMs,
      label:
        estimate && estimate.confidence >= 0.08 ? estimate.label : undefined,
      estimate,
      rms: frame.rms,
    };
  });
  const durationMs = (samples.length / sampleRate) * 1_000;
  return chordFramesToSegments(
    classified,
    smoothChordFrames(classified),
    durationMs,
  );
};
