/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import basicPitchModelUrl from '@spotify/basic-pitch/model/model.json?url';
import basicPitchShardUrl from '@spotify/basic-pitch/model/group1-shard1of1.bin?url';
import { IKaraokeMakerAnalysisNote } from '../makerAnalysis';
import {
  IKaraokeMakerProject,
  karaokeMakerLineIsSection,
  karaokeMakerMaximumAutomaticWordDurationMs,
} from '../../../common/karaoke/makerProject';
import { BASIC_PITCH_SAMPLE_RATE, decodeMono } from './audio';

export interface IKaraokeMakerAnalysisWindow {
  startMs: number;
  endMs: number;
}

/** Merge timed lyric words into padded vocal phrases for pitch analysis. */
export const karaokeMakerVocalAnalysisWindows = (
  project: IKaraokeMakerProject,
): IKaraokeMakerAnalysisWindow[] => {
  const durationMs = project.audio.durationMs ?? Number.POSITIVE_INFINITY;
  const raw = project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => {
      const timed = line.tokens.filter(
        (token) =>
          token.startMs !== undefined &&
          token.endMs !== undefined &&
          token.endMs > token.startMs,
      );
      if (!timed.length) {
        return [];
      }
      return [
        {
          startMs: Math.max(
            0,
            Math.min(...timed.map((token) => token.startMs as number)) - 220,
          ),
          endMs: Math.min(
            durationMs,
            Math.max(...timed.map((token) => token.endMs as number)) + 220,
          ),
        },
      ];
    })
    .sort((left, right) => left.startMs - right.startMs);
  const merged: IKaraokeMakerAnalysisWindow[] = [];
  raw.forEach((window) => {
    const previous = merged[merged.length - 1];
    if (previous && window.startMs - previous.endMs <= 500) {
      previous.endMs = Math.max(previous.endMs, window.endMs);
    } else {
      merged.push({ ...window });
    }
  });
  return merged;
};

/**
 * Run Spotify's bundled Apache-2.0 Basic Pitch model entirely in the renderer.
 * It is most useful with a vocal stem; mixed masters can include instruments.
 */
export const analyzeKaraokeWithBasicPitch = async (
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  analysisWindows?: readonly IKaraokeMakerAnalysisWindow[],
): Promise<IKaraokeMakerAnalysisNote[]> => {
  if (!basicPitchModelUrl || !basicPitchShardUrl) {
    throw new Error('The bundled Basic Pitch model is unavailable.');
  }
  onProgress(0.01);
  const samples = await decodeMono(file, BASIC_PITCH_SAMPLE_RATE);
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.06);
  const {
    BasicPitch,
    outputToNotesPoly,
    addPitchBendsToNoteEvents,
    noteFramesToTime,
  } = await import('@spotify/basic-pitch');
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  const model = new BasicPitch(basicPitchModelUrl);
  const windows = analysisWindows?.length
    ? analysisWindows
        .map((window) => ({
          startSample: Math.max(
            0,
            Math.floor((window.startMs / 1_000) * BASIC_PITCH_SAMPLE_RATE),
          ),
          endSample: Math.min(
            samples.length,
            Math.ceil((window.endMs / 1_000) * BASIC_PITCH_SAMPLE_RATE),
          ),
        }))
        .filter((window) => window.endSample > window.startSample)
    : [{ startSample: 0, endSample: samples.length }];
  const totalWindowSamples = Math.max(
    1,
    windows.reduce(
      (sum, window) => sum + window.endSample - window.startSample,
      0,
    ),
  );
  let completedSamples = 0;
  const candidateBatches: IKaraokeMakerAnalysisNote[][] = [];
  await windows.reduce<Promise<void>>(async (prior, window) => {
    await prior;
    const windowFrames: number[][] = [];
    const windowOnsets: number[][] = [];
    const windowContours: number[][] = [];
    const windowSamples = samples.subarray(
      window.startSample,
      window.endSample,
    );
    await model.evaluateModel(
      windowSamples,
      (incomingFrames, incomingOnsets, incomingContours) => {
        windowFrames.push(...incomingFrames);
        windowOnsets.push(...incomingOnsets);
        windowContours.push(...incomingContours);
      },
      (progress) => {
        if (signal?.aborted) {
          throw new DOMException('Analysis cancelled.', 'AbortError');
        }
        const processed = completedSamples + windowSamples.length * progress;
        onProgress(0.08 + (processed / totalWindowSamples) * 0.84);
      },
    );
    const offsetSeconds = window.startSample / BASIC_PITCH_SAMPLE_RATE;
    candidateBatches.push(
      noteFramesToTime(
        addPitchBendsToNoteEvents(
          windowContours,
          outputToNotesPoly(windowFrames, windowOnsets, 0.32, 0.28, 5),
        ),
      )
        .filter(
          (event) =>
            event.durationSeconds >= 0.055 &&
            event.pitchMidi >= 24 &&
            event.pitchMidi <= 96,
        )
        .map((event) => ({
          startMs: (offsetSeconds + event.startTimeSeconds) * 1_000,
          endMs:
            (offsetSeconds + event.startTimeSeconds + event.durationSeconds) *
            1_000,
          targetMidi: event.pitchMidi,
          confidence: Math.min(1, Math.max(0, event.amplitude)),
        })),
    );
    completedSamples += windowSamples.length;
  }, Promise.resolve());
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  // Preserve the polyphonic candidates here. Whisper's narrow word windows
  // give the lyric-guided reducer much better context for choosing a vocal
  // path than a global "strongest onset wins" pass can have.
  const melody = candidateBatches
    .flat()
    .sort((left, right) => left.startMs - right.startMs);
  onProgress(1);
  return melody;
};

export const maximumAutomaticWordDurationMs = (text: string): number => {
  // Corpus calibration: 99% of one-letter words are below 500 ms and 99% of
  // ordinary words below roughly 2.5 s. This generous ceiling still permits a
  // held note but rejects a chunk-sized 20–30 second "word" timestamp.
  return karaokeMakerMaximumAutomaticWordDurationMs(text);
};
