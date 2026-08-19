/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerAnalysisNote } from '../makerAnalysis';
import { IKaraokeMakerAnalysisWindow } from './analysisWindows';

/**
 * Turning a pitch contour into notes.
 *
 * Split out of `swiftF0Notes.ts` so it can be run on a contour without a model,
 * a worker or a file. That is not tidiness: every failure this code has ever
 * had is a question about one contour — does a vibrato survive as one note, does
 * a real step still split — and none of them could be asked while the only way
 * in was an async call into an IPC worker.
 */

/**
 * The shortest run of frames that may become a note.
 *
 * 60, down from 90, measured on a real song: eleven lane notes sat a fifth
 * or more from the sung pitch, all at phrase attacks, because the aligner
 * found no candidate overlapping a short first syllable and borrowed the
 * neighbouring note's pitch instead. Shorter minimums give it real material
 * exactly where singers start phrases fast.
 */
const MINIMUM_NOTE_MS = 60;

const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

/**
 * How far from an exact octave still counts as an octave error.
 *
 * The tracker locks onto a harmonic or a subharmonic, so the wrong answer sits
 * almost exactly 12 semitones out — the state grid is integer semitones, so in
 * practice it is exact. One semitone of slack catches the case where the note
 * either side was itself rounded a step away, and refuses everything that is
 * merely a wide interval somebody actually sang.
 */
const OCTAVE_SLACK_SEMITONES = 1;

/**
 * The longest note that may be dismissed as a tracking error.
 *
 * A held octave leap is singing; a brief one in the middle of a phrase is the
 * tracker slipping. 320ms is above a fast passing note and well under anything
 * anybody would call a sustained interval, so the repair reaches the slips and
 * leaves real leaps alone.
 */
const OCTAVE_REPAIR_MAX_MS = 320;

/**
 * How sharply a frame is charged for sitting away from its note, in nats per
 * squared semitone.
 *
 * This was 2.0, and it is the reason a held note came back as up to thirteen.
 * At 2.0 one semitone of displacement costs 2 nats per frame while changing
 * note costs 3.7 in total, so two frames — 32 ms — of vibrato outbid the note
 * the singer was actually holding. Measured on the two library projects whose
 * notes were never aligned, and so are raw detector output: 56% and 59% of all
 * notes touch their neighbour with no gap, in unbroken runs of up to 10 and 13,
 * and 92% of those splits move by two semitones or less. That is the shape of
 * vibrato, not of melody.
 *
 * At 0.5 a semitone costs 0.5 nats a frame, so a note change has to be held
 * about 120 ms before it pays for itself, and vibrato — which returns every
 * 90 ms or so at 5-6 Hz and does not sit at its extreme even then — is absorbed
 * into the note it belongs to. A real step still splits, because a real step
 * does not come back.
 *
 * The cost is at the fast end: a run of 16th notes at 120 bpm gives each note
 * 125 ms, which is right at the boundary. Losing the last of those is a smaller
 * failure than shattering every sustained note in the song, and the singer can
 * see a missing subdivision where they cannot see a sustain that was chopped.
 */
const EMISSION_SHARPNESS = 0.5;

/**
 * Fold isolated octave jumps back to where the phrase was.
 *
 * WHAT THIS FIXES, AND WHY THE MEDIAN CANNOT. Pitch trackers periodically lock
 * onto the first harmonic or the subharmonic instead of the fundamental. When
 * that happens it is not jitter — every frame of the note agrees, so the
 * per-note median that removes ordinary wobble reports the wrong octave with
 * total confidence, and the Viterbi path has no reason to prefer otherwise
 * because a consistent wrong state is cheap.
 *
 * It shows up as one note sitting an octave off its neighbours in the middle
 * of an otherwise level phrase, which is exactly what this looks for: both
 * sides present, both agreeing with each other, the note between them an
 * octave away and short enough to be a slip rather than a leap. Where all of
 * that holds, the octave is moved to the neighbours' and nothing else changes
 * — not the timing, not the confidence, not the note count.
 *
 * Deliberately conservative. A singer really does jump an octave, and doing it
 * on purpose is a moment worth keeping; every condition here exists to leave
 * that alone. The cost of being too eager is silently flattening the most
 * expressive bar in a song, which is far worse than leaving a stray note for
 * somebody to drag.
 *
 * Mutates in place: the caller owns the array and nothing else has seen it.
 */
const repairOctaveJumps = (notes: IKaraokeMakerAnalysisNote[]): void => {
  for (let i = 1; i < notes.length - 1; i += 1) {
    const previous = notes[i - 1];
    const note = notes[i];
    const next = notes[i + 1];
    // The phrase either side has to agree before it can be evidence. Two
    // neighbours a fifth apart say the melody is moving, and a note between
    // them is then doing something real whatever octave it is in.
    const isSlip =
      note.endMs - note.startMs <= OCTAVE_REPAIR_MAX_MS &&
      Math.abs(previous.targetMidi - next.targetMidi) <= 2;
    if (isSlip) {
      const anchor = Math.round((previous.targetMidi + next.targetMidi) / 2);
      const offset = note.targetMidi - anchor;
      const octaves = Math.round(offset / 12);
      if (
        octaves !== 0 &&
        Math.abs(offset - octaves * 12) <= OCTAVE_SLACK_SEMITONES
      ) {
        note.targetMidi -= octaves * 12;
      }
    }
  }
};

/**
 * The sung melody, one note at a time, from a pitch contour.
 *
 * The tracker's contour is excellent; the notes are only as good as this
 * segmentation. The first version split on any single frame that strayed —
 * and singing strays constantly. One octave blip became a note, vibrato
 * shattered sustains, a breath flicker chattered on and off. Each stage
 * below removes one of those failure modes, in order.
 */
export const karaokeMakerNotesFromPitchContour = (
  pitchHz: Float32Array | readonly number[],
  confidence: Float32Array | readonly number[],
  hopMs: number,
  voicedThreshold: number,
  analysisWindows?: readonly IKaraokeMakerAnalysisWindow[],
): IKaraokeMakerAnalysisNote[] => {
  const inWindow = (timeMs: number) =>
    !analysisWindows?.length ||
    analysisWindows.some(
      (window_) => timeMs >= window_.startMs && timeMs <= window_.endMs,
    );

  // 1. Median-filter the pitch track (5 frames). A lone octave error or
  //    tracker glitch cannot survive a median; real note changes can.
  //
  //    Deliberately not widened to cover vibrato. Five frames is 80 ms and a
  //    vibrato cycle is around 180 ms, so a median long enough to flatten one
  //    would also round off the attack of every real note. Vibrato is absorbed
  //    where it belongs, in the price the decoder pays to leave a note.
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

  // 3. Notes by Viterbi over a note HMM — the pYIN/Tony method, which is the
  //    published model for singing-to-notes (Mauch et al.; Tony is the
  //    academic tool built on it). There is no downloadable network that does
  //    this better: Hugging Face has no singing-note-transcription model at
  //    all (searched, empty), so the state of the art is exactly this — a
  //    strong contour tracker feeding a principled decoder. States are
  //    silence plus one state per MIDI note; each frame's evidence prefers
  //    the note nearest the smoothed pitch, weighted by the tracker's
  //    confidence; transitions price staying, moving by an interval, and
  //    entering or leaving silence. The best path through the whole song is
  //    the note chart — boundaries fall where the evidence globally says,
  //    not where a local heuristic flinched.
  const LOW_MIDI = 36;
  const HIGH_MIDI = 84;
  const noteStates = HIGH_MIDI - LOW_MIDI + 1;
  const states = noteStates + 1; // last index is silence
  const SILENCE = noteStates;
  const STAY = Math.log(0.96);
  const ENTER_SILENCE = Math.log(0.012);
  const STAY_SILENCE = Math.log(0.97);
  const LEAVE_SILENCE = Math.log(0.03 / noteStates);
  /** Moving between notes: priced by interval so runs prefer real steps. */
  const moveCost = (from: number, to: number) =>
    Math.log(0.028) - Math.abs(from - to) * 0.18;

  const emission = (frame: number, state: number): number => {
    const level = confidence[frame];
    if (state === SILENCE) {
      return Math.log(Math.max(1e-6, 1 - level));
    }
    if (Number.isNaN(smoothed[frame]) || !voiced[frame]) {
      return Math.log(1e-6);
    }
    const distance = Math.abs(smoothed[frame] - (LOW_MIDI + state));
    return (
      Math.log(Math.max(1e-6, level)) - distance * distance * EMISSION_SHARPNESS
    );
  };

  const previousScore = new Float64Array(states).fill(-1e9);
  const currentScore = new Float64Array(states);
  const backPointer = new Int16Array(states * frameCount);
  for (let state = 0; state < states; state += 1) {
    previousScore[state] = emission(0, state);
  }
  for (let frame = 1; frame < frameCount; frame += 1) {
    // The best predecessor for a note is overwhelmingly itself, silence, or a
    // nearby note; scanning all pairs is affordable and exact.
    let bestSilenceSource = SILENCE;
    let bestSilenceScore = previousScore[SILENCE] + STAY_SILENCE;
    for (let from = 0; from < noteStates; from += 1) {
      const score = previousScore[from] + ENTER_SILENCE;
      if (score > bestSilenceScore) {
        bestSilenceScore = score;
        bestSilenceSource = from;
      }
    }
    currentScore[SILENCE] = bestSilenceScore + emission(frame, SILENCE);
    backPointer[frame * states + SILENCE] = bestSilenceSource;
    for (let to = 0; to < noteStates; to += 1) {
      let bestSource = to;
      let bestScore = previousScore[to] + STAY;
      const fromSilence = previousScore[SILENCE] + LEAVE_SILENCE;
      if (fromSilence > bestScore) {
        bestScore = fromSilence;
        bestSource = SILENCE;
      }
      for (let from = 0; from < noteStates; from += 1) {
        if (from !== to) {
          const score = previousScore[from] + moveCost(from, to);
          if (score > bestScore) {
            bestScore = score;
            bestSource = from;
          }
        }
      }
      currentScore[to] = bestScore + emission(frame, to);
      backPointer[frame * states + to] = bestSource;
    }
    previousScore.set(currentScore);
  }

  let state = 0;
  for (let candidate = 1; candidate < states; candidate += 1) {
    if (previousScore[candidate] > previousScore[state]) {
      state = candidate;
    }
  }
  const path = new Int16Array(frameCount);
  for (let frame = frameCount - 1; frame >= 0; frame -= 1) {
    path[frame] = state;
    state = backPointer[frame * states + state];
  }

  // 4. The path is already the note chart: contiguous same-state stretches
  //    become notes, silence becomes rests, and only fragments too short to
  //    sing are dropped.
  const notes: IKaraokeMakerAnalysisNote[] = [];
  let runStart = 0;
  for (let frame = 1; frame <= frameCount; frame += 1) {
    if (frame === frameCount || path[frame] !== path[runStart]) {
      const runState = path[runStart];
      if (runState !== SILENCE) {
        const startMs = runStart * hopMs;
        const endMs = frame * hopMs;
        if (endMs - startMs >= MINIMUM_NOTE_MS) {
          let sum = 0;
          for (let i = runStart; i < frame; i += 1) {
            sum += confidence[i];
          }
          notes.push({
            startMs,
            endMs,
            targetMidi: LOW_MIDI + runState,
            confidence: sum / (frame - runStart),
          });
        }
      }
      runStart = frame;
    }
  }

  repairOctaveJumps(notes);
  return notes;
};

export default karaokeMakerNotesFromPitchContour;
