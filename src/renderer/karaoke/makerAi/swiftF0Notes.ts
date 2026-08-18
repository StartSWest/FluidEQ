/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerAnalysisNote } from '../makerAnalysis';
import { IKaraokeMakerLicenseRecord } from '../../../common/karaoke/makerProject';
import { decodeMono } from './audio';
import { IKaraokeMakerAnalysisWindow } from './basicPitch';

export const RMVPE_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: 'RMVPE vocal pitch model',
  version: 'lj1995/VoiceConversionWebUI (downloaded on demand)',
  license: 'MIT',
  sourceUrl: 'https://huggingface.co/lj1995/VoiceConversionWebUI',
};

export const SWIFT_F0_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: 'SwiftF0 vocal pitch model',
  version: 'lars76/swift-f0 (bundled)',
  license: 'MIT',
  sourceUrl: 'https://github.com/lars76/swift-f0',
};

/** A note shorter than this is a glide the singer passed through, not a note. */
const MINIMUM_NOTE_MS = 90;

/** Split a segment when the voice strays this far from the note it was on. */
const SPLIT_SEMITONES = 0.8;

const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

/**
 * Detect the sung melody with SwiftF0, one note at a time.
 *
 * Basic Pitch answered "which notes are sounding" — a polyphonic question the
 * karaoke Maker never asks, and its wrong answers (harmonics as chords,
 * breath as grace notes) were the weakest part of every result. This asks the
 * monophonic question: where is THE voice, and when does it move. The model
 * returns a pitch and a confidence every 16 ms; notes fall out of segmenting
 * that contour — voiced stretches, split where the pitch settles somewhere
 * new, each note's pitch the median of its frames so scoops and vibrato do
 * not drag it.
 *
 * Reads the audio FILE — playback volume and the guide-vocal fader shape what
 * is heard, never what is analysed.
 */
export const analyzeKaraokeWithSwiftF0 = async (
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  analysisWindows?: readonly IKaraokeMakerAnalysisWindow[],
): Promise<IKaraokeMakerAnalysisNote[]> => {
  onProgress(0.02);
  const samples = await decodeMono(file, 16_000);
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.2);
  // The one-time RMVPE download reports through here; detection after it is
  // seconds. Which model answered decides the voiced threshold and the
  // provenance the caller records.
  const unsubscribe = window.electron.ipcRenderer.onKaraokePitchProgress(
    ({ stage, fraction }) => {
      onProgress(
        stage === 'download' ? 0.2 + fraction * 0.4 : 0.6 + fraction * 0.3,
      );
    },
  );
  let reply;
  try {
    reply = await window.electron.ipcRenderer.detectKaraokePitch(samples);
  } finally {
    unsubscribe();
  }
  const { pitchHz, confidence, hopSeconds, voicedThreshold } = reply;
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.8);
  const hopMs = hopSeconds * 1_000;

  const inWindow = (timeMs: number) =>
    !analysisWindows?.length ||
    analysisWindows.some(
      (window_) => timeMs >= window_.startMs && timeMs <= window_.endMs,
    );

  const notes: IKaraokeMakerAnalysisNote[] = [];
  let segment:
    { startFrame: number; midis: number[]; confidences: number[] } | undefined;

  const flush = (endFrame: number) => {
    if (!segment) {
      return;
    }
    const { startFrame, midis, confidences } = segment;
    segment = undefined;
    const startMs = startFrame * hopMs;
    const endMs = endFrame * hopMs;
    if (endMs - startMs < MINIMUM_NOTE_MS) {
      return;
    }
    const sorted = [...midis].sort((left, right) => left - right);
    const median = sorted[Math.floor(sorted.length / 2)];
    notes.push({
      startMs,
      endMs,
      targetMidi: Math.round(median),
      confidence:
        confidences.reduce((sum, value) => sum + value, 0) / confidences.length,
    });
  };

  for (let frame = 0; frame < pitchHz.length; frame += 1) {
    const timeMs = frame * hopMs;
    const voiced =
      confidence[frame] >= voicedThreshold &&
      pitchHz[frame] > 0 &&
      inWindow(timeMs);
    if (!voiced) {
      flush(frame);
    } else if (!segment) {
      segment = {
        startFrame: frame,
        midis: [hzToMidi(pitchHz[frame])],
        confidences: [confidence[frame]],
      };
    } else {
      segmentStep(frame);
    }
  }
  flush(pitchHz.length);
  onProgress(1);
  return notes;

  function segmentStep(frame: number) {
    if (!segment) {
      return;
    }
    const midi = hzToMidi(pitchHz[frame]);
    const sorted = [...segment.midis].sort((left, right) => left - right);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (Math.abs(midi - median) > SPLIT_SEMITONES) {
      // The voice has settled somewhere new: close the note here and open
      // the next one on this frame, so a legato line becomes adjacent notes
      // rather than one smeared average.
      flush(frame);
      segment = {
        startFrame: frame,
        midis: [midi],
        confidences: [confidence[frame]],
      };
    } else {
      segment.midis.push(midi);
      segment.confidences.push(confidence[frame]);
    }
  }
};
