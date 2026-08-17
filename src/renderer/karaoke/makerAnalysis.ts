/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IKaraokeMakerProject,
  karaokeMakerId,
} from '../../common/karaoke/makerProject';
import analysisWorkerUrl from './maker-analysis.worklet';

const ANALYSIS_SAMPLE_RATE = 12_000;
const MAX_ANALYSIS_SECONDS = 30 * 60;
const MAX_ANALYSIS_BYTES = 1024 * 1024 * 1024;
const DEFAULT_WAVEFORM_PEAKS = 2_048;

export interface IKaraokeMakerPitchFrame {
  timeMs: number;
  frequencyHz?: number;
  midi?: number;
  confidence: number;
  rms: number;
}

export interface IKaraokeMakerAnalysisNote {
  startMs: number;
  endMs: number;
  targetMidi: number;
  confidence: number;
}

export interface IKaraokeMakerAnalysisResult {
  waveform: number[];
  frames: IKaraokeMakerPitchFrame[];
  notes: IKaraokeMakerAnalysisNote[];
}

const validateAnalysisFile = (file: File) => {
  if (file.size > MAX_ANALYSIS_BYTES) {
    throw new Error(
      'Karaoke analysis is limited to audio files of 1 GB or less.',
    );
  }
};

const validateAnalysisDuration = (durationSeconds: number) => {
  if (durationSeconds > MAX_ANALYSIS_SECONDS) {
    throw new Error(
      'Karaoke analysis is limited to recordings under 30 minutes.',
    );
  }
};

/**
 * Decode only enough information to paint the Maker's overview waveform.
 * Pitch detection remains an explicit action; opening the editor should still
 * reveal the song shape immediately without running autocorrelation or AI.
 */
export const extractKaraokeMakerWaveform = async (
  file: File,
  peakCount = DEFAULT_WAVEFORM_PEAKS,
): Promise<{ waveform: number[]; durationMs: number }> => {
  validateAnalysisFile(file);
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    validateAnalysisDuration(buffer.duration);
    const count = Math.max(32, Math.min(8_192, Math.round(peakCount)));
    const peaks = new Array<number>(count).fill(0);
    const stride = Math.max(1, Math.ceil(buffer.length / count));
    const samplesPerPeak = 512;
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const samples = buffer.getChannelData(channel);
      for (let peakIndex = 0; peakIndex < count; peakIndex += 1) {
        const start = peakIndex * stride;
        const end = Math.min(samples.length, start + stride);
        const sampleStep = Math.max(
          1,
          Math.floor(Math.max(1, end - start) / samplesPerPeak),
        );
        let peak = peaks[peakIndex];
        for (
          let sampleIndex = start;
          sampleIndex < end;
          sampleIndex += sampleStep
        ) {
          peak = Math.max(peak, Math.abs(samples[sampleIndex] ?? 0));
        }
        peaks[peakIndex] = peak;
      }
    }
    const maximum = Math.max(0.001, ...peaks);
    return {
      waveform: peaks.map((peak) => peak / maximum),
      durationMs: buffer.duration * 1_000,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
};

interface IKaraokeMakerVocalPhrase {
  startMs: number;
  endMs: number;
  notes: IKaraokeMakerAnalysisNote[];
}

/**
 * Audio analysis already uses the complete decoded file, so its timestamps are
 * absolute song time. UltraStar/LRC importers have already applied provider
 * offsets to their canonical tokens; adding GAP here a second time moves every
 * detected vocal into a later instrumental section.
 */
export const karaokeMakerAnalysisOffsetMs = (
  _project: IKaraokeMakerProject,
  _earliestStartMs: number,
): number => 0;

interface IKaraokeMakerWorkerMessage {
  id: string;
  type: 'progress' | 'complete' | 'error';
  progress?: number;
  result?: IKaraokeMakerAnalysisResult;
  message?: string;
}

const downsample = (
  source: Float32Array,
  sourceRate: number,
  targetRate: number,
): Float32Array => {
  if (sourceRate <= targetRate) {
    return source.slice();
  }
  const ratio = sourceRate / targetRate;
  const target = new Float32Array(Math.ceil(source.length / ratio));
  for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
    const start = Math.floor(targetIndex * ratio);
    const end = Math.min(source.length, Math.floor((targetIndex + 1) * ratio));
    let total = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      total += source[sourceIndex];
    }
    target[targetIndex] = total / Math.max(1, end - start);
  }
  return target;
};

const mixAnalysisChannel = (buffer: AudioBuffer): Float32Array => {
  const mixed = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < mixed.length; index += 1) {
      mixed[index] += samples[index] / buffer.numberOfChannels;
    }
  }
  // One-pole high-pass removes rumble that otherwise wins autocorrelation.
  const cutoff = 75;
  const rc = 1 / (Math.PI * 2 * cutoff);
  const dt = 1 / buffer.sampleRate;
  const alpha = rc / (rc + dt);
  let previousInput = 0;
  let previousOutput = 0;
  for (let index = 0; index < mixed.length; index += 1) {
    const input = mixed[index];
    const output = alpha * (previousOutput + input - previousInput);
    mixed[index] = output;
    previousInput = input;
    previousOutput = output;
  }
  return mixed;
};

export const decodeKaraokeMakerAudio = async (
  file: File,
): Promise<{
  samples: Float32Array;
  sampleRate: number;
  durationMs: number;
}> => {
  validateAnalysisFile(file);
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    validateAnalysisDuration(buffer.duration);
    return {
      samples: downsample(
        mixAnalysisChannel(buffer),
        buffer.sampleRate,
        ANALYSIS_SAMPLE_RATE,
      ),
      sampleRate: Math.min(buffer.sampleRate, ANALYSIS_SAMPLE_RATE),
      durationMs: buffer.duration * 1_000,
    };
  } finally {
    await context.close().catch(() => undefined);
  }
};

export const analyzeKaraokeMakerAudio = async (
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<IKaraokeMakerAnalysisResult & { durationMs: number }> => {
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.01);
  const decoded = await decodeKaraokeMakerAudio(file);
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.08);
  return new Promise((resolve, reject) => {
    const worker = new Worker(analysisWorkerUrl);
    const id = karaokeMakerId('analysis');
    const stop = () => worker.terminate();
    const onAbort = () => {
      stop();
      reject(new DOMException('Analysis cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.onerror = (event) => {
      signal?.removeEventListener('abort', onAbort);
      stop();
      reject(new Error(event.message || 'Karaoke analysis failed.'));
    };
    worker.onmessage = (event: MessageEvent<IKaraokeMakerWorkerMessage>) => {
      if (event.data.id !== id) {
        return;
      }
      if (event.data.type === 'progress') {
        onProgress(0.08 + (event.data.progress ?? 0) * 0.92);
        return;
      }
      signal?.removeEventListener('abort', onAbort);
      stop();
      if (event.data.type === 'error' || !event.data.result) {
        reject(new Error(event.data.message || 'Karaoke analysis failed.'));
        return;
      }
      onProgress(1);
      resolve({ ...event.data.result, durationMs: decoded.durationMs });
    };
    worker.postMessage(
      { id, samples: decoded.samples, sampleRate: decoded.sampleRate },
      [decoded.samples.buffer],
    );
  });
};

const median = (values: readonly number[]): number => {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Split detected melody into phrases at adaptive no-voice gaps. */
export const karaokeMakerVocalPhrases = (
  incomingNotes: readonly IKaraokeMakerAnalysisNote[],
): IKaraokeMakerVocalPhrase[] => {
  const notes = incomingNotes
    .filter(
      (note) =>
        Number.isFinite(note.startMs) &&
        Number.isFinite(note.endMs) &&
        note.endMs > note.startMs,
    )
    .sort((left, right) => left.startMs - right.startMs);
  if (!notes.length) {
    return [];
  }
  const gaps = notes
    .slice(1)
    .map((note, index) => Math.max(0, note.startMs - notes[index].endMs));
  const ordinaryGaps = gaps.filter((gap) => gap <= 650);
  const ordinaryGapMs = median(ordinaryGaps) || 120;
  const phraseGapMs = Math.max(420, Math.min(1_200, ordinaryGapMs * 3.5));
  const phrases: IKaraokeMakerVocalPhrase[] = [];
  let current: IKaraokeMakerAnalysisNote[] = [];
  notes.forEach((note) => {
    const previous = current[current.length - 1];
    if (previous && note.startMs - previous.endMs >= phraseGapMs) {
      phrases.push({
        startMs: current[0].startMs,
        endMs: previous.endMs,
        notes: current,
      });
      current = [];
    }
    current.push(note);
  });
  if (current.length) {
    phrases.push({
      startMs: current[0].startMs,
      endMs: current[current.length - 1].endMs,
      notes: current,
    });
  }
  return phrases;
};
