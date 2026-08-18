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

  // The tracker's contour is excellent; the notes are only as good as this
  // segmentation. The first version split on any single frame that strayed —
  // and singing strays constantly. One octave blip became a note, vibrato
  // shattered sustains, a breath flicker chattered on and off. Each stage
  // below removes one of those failure modes, in order.

  // 1. Median-filter the pitch track (5 frames). A lone octave error or
  //    tracker glitch cannot survive a median; real note changes can.
  const frameCount = pitchHz.length;
  const midiTrack = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    midiTrack[frame] = pitchHz[frame] > 0 ? hzToMidi(pitchHz[frame]) : NaN;
  }
  const smoothed = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const window: number[] = [];
    for (
      let i = Math.max(0, frame - 2);
      i <= Math.min(frameCount - 1, frame + 2);
      i += 1
    ) {
      if (!Number.isNaN(midiTrack[i])) {
        window.push(midiTrack[i]);
      }
    }
    smoothed[frame] = window.length
      ? window.sort((a, b) => a - b)[Math.floor(window.length / 2)]
      : NaN;
  }

  // 2. Voicing with hysteresis and gap-bridging: enter at the model's own
  //    threshold, leave only when confidence truly collapses, and ride over
  //    unvoiced flickers up to 3 frames (~30-50ms) inside a note.
  const exitThreshold = voicedThreshold * 0.7;
  const voiced = new Uint8Array(frameCount);
  let inVoice = false;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const usable = !Number.isNaN(smoothed[frame]) && inWindow(frame * hopMs);
    const level = confidence[frame];
    if (!usable) {
      inVoice = false;
    } else if (inVoice) {
      inVoice = level >= exitThreshold;
    } else {
      inVoice = level >= voicedThreshold;
    }
    voiced[frame] = inVoice ? 1 : 0;
  }
  for (let frame = 1; frame < frameCount - 1; frame += 1) {
    if (!voiced[frame]) {
      let gap = 0;
      while (frame + gap < frameCount && !voiced[frame + gap]) {
        gap += 1;
      }
      if (gap <= 3 && voiced[frame - 1] && voiced[frame + gap]) {
        for (let i = 0; i < gap; i += 1) {
          voiced[frame + i] = 1;
        }
      }
      frame += gap;
    }
  }

  // 3. Segment: split only on SUSTAINED deviation — three consecutive frames
  //    away from the note's running median — so vibrato and scoops stay part
  //    of their note and a genuine step to a new pitch still cuts cleanly.
  interface ISegment {
    startFrame: number;
    endFrame: number;
    midis: number[];
    confidences: number[];
  }
  const segments: ISegment[] = [];
  let current: ISegment | undefined;
  let strayRun = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (!voiced[frame]) {
      if (current) {
        segments.push(current);
        current = undefined;
      }
      strayRun = 0;
    } else if (!current) {
      current = {
        startFrame: frame,
        endFrame: frame + 1,
        midis: [smoothed[frame]],
        confidences: [confidence[frame]],
      };
    } else {
      const sorted = [...current.midis].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      if (Math.abs(smoothed[frame] - median) > SPLIT_SEMITONES) {
        strayRun += 1;
        if (strayRun >= 3) {
          // The voice settled somewhere new three frames ago; the note ends
          // where the stray began, and the new one starts there.
          const splitAt = frame - strayRun + 1;
          current.endFrame = splitAt;
          segments.push(current);
          current = {
            startFrame: splitAt,
            endFrame: frame + 1,
            midis: Array.from(smoothed.subarray(splitAt, frame + 1)),
            confidences: Array.from(confidence.subarray(splitAt, frame + 1)),
          };
          strayRun = 0;
        }
      } else {
        strayRun = 0;
        current.midis.push(smoothed[frame]);
        current.confidences.push(confidence[frame]);
        current.endFrame = frame + 1;
      }
    }
  }
  if (current) {
    segments.push(current);
  }

  // 4. A note's pitch comes from its interior — the attack scoops and the
  //    release falls, and neither is the note. Then neighbours on the same
  //    MIDI with a hair's gap merge back into one sustain, and only after
  //    that are the too-short fragments dropped.
  const rawNotes = segments.map((segment) => {
    const inner =
      segment.midis.length > 6 ? segment.midis.slice(2, -2) : segment.midis;
    const sorted = [...inner].sort((a, b) => a - b);
    return {
      startMs: segment.startFrame * hopMs,
      endMs: segment.endFrame * hopMs,
      targetMidi: Math.round(sorted[Math.floor(sorted.length / 2)]),
      confidence:
        segment.confidences.reduce((sum, value) => sum + value, 0) /
        segment.confidences.length,
    };
  });
  const merged: IKaraokeMakerAnalysisNote[] = [];
  rawNotes.forEach((note) => {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.targetMidi === note.targetMidi &&
      note.startMs - previous.endMs < 80
    ) {
      previous.endMs = note.endMs;
      previous.confidence = Math.max(previous.confidence, note.confidence);
    } else {
      merged.push({ ...note });
    }
  });
  const notes = merged.filter(
    (note) => note.endMs - note.startMs >= MINIMUM_NOTE_MS,
  );

  onProgress(1);
  return notes;
};
