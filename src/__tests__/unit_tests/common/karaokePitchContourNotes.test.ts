/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { karaokeMakerNotesFromPitchContour } from '../../../renderer/karaoke/makerAi/pitchContourNotes';

/** The tracker's hop, and the one the model actually reports at. */
const HOP_MS = 16;
const VOICED_THRESHOLD = 0.5;

const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * A contour built frame by frame from a pitch function of time.
 *
 * `pitchAt` returns a MIDI number, or NaN for silence, so a test reads as the
 * thing a singer did rather than as an array of numbers.
 */
const contourOf = (
  durationMs: number,
  pitchAt: (atMs: number) => number,
): { pitchHz: Float32Array; confidence: Float32Array } => {
  const frames = Math.round(durationMs / HOP_MS);
  const pitchHz = new Float32Array(frames);
  const confidence = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame += 1) {
    const midi = pitchAt(frame * HOP_MS);
    const sounding = !Number.isNaN(midi);
    pitchHz[frame] = sounding ? midiToHz(midi) : 0;
    confidence[frame] = sounding ? 0.9 : 0.05;
  }
  return { pitchHz, confidence };
};

const notesFrom = (contour: {
  pitchHz: Float32Array;
  confidence: Float32Array;
}) =>
  karaokeMakerNotesFromPitchContour(
    contour.pitchHz,
    contour.confidence,
    HOP_MS,
    VOICED_THRESHOLD,
  );

describe('Karaoke Maker notes from a pitch contour', () => {
  it('keeps a note held with vibrato as one note', () => {
    // The measured failure, and the one the user reported as "ten notes in a
    // single word". On the two library projects whose notes were never
    // aligned — raw detector output — 56% and 59% of notes touched their
    // neighbour with no gap, in unbroken runs of up to 10 and 13, and 92% of
    // those splits moved two semitones or less. That is vibrato being read as
    // melody. 5.5 Hz and a semitone either way is an ordinary singer.
    const notes = notesFrom(
      contourOf(
        1_600,
        (atMs) => 62 + Math.sin((atMs / 1_000) * 2 * Math.PI * 5.5),
      ),
    );

    expect(notes.length).toBe(1);
    expect(notes[0].targetMidi).toBe(62);
  });

  it('still splits where the singer actually changed note', () => {
    // Positive control, and the one that decides whether the fix is a fix or
    // just a flattener: a real step does not come back, so it must still pay
    // for itself. Without this, "always return one note" passes the test above.
    const notes = notesFrom(contourOf(1_600, (atMs) => (atMs < 800 ? 62 : 67)));

    expect(notes.length).toBe(2);
    expect(notes.map((note) => note.targetMidi)).toEqual([62, 67]);
  });

  it('splits a step of a single semitone, which vibrato spans too', () => {
    // The hardest case for this pricing: the same interval vibrato covers,
    // but sustained. Duration is the only thing telling them apart, which is
    // exactly what the decoder is supposed to be weighing.
    const notes = notesFrom(contourOf(1_600, (atMs) => (atMs < 800 ? 62 : 63)));

    expect(notes.map((note) => note.targetMidi)).toEqual([62, 63]);
  });

  it('does not invent notes out of silence', () => {
    expect(notesFrom(contourOf(1_600, () => Number.NaN))).toEqual([]);
  });

  it('breaks a phrase where the voice stops', () => {
    const notes = notesFrom(
      contourOf(2_400, (atMs) => {
        if (atMs < 800) {
          return 62;
        }
        return atMs < 1_600 ? Number.NaN : 62;
      }),
    );

    expect(notes.length).toBe(2);
  });

  it('lands a scoop on one sustained note, not a staircase', () => {
    // Singers arrive at a pitch from below. The scoop itself may keep a short
    // note of its own — the minimum length was deliberately lowered to 60 ms
    // so phrase attacks have material for the aligner to use — but what the
    // singer holds afterwards has to come back as ONE note rather than as the
    // three or four steps of the glide.
    const notes = notesFrom(
      contourOf(1_200, (atMs) => (atMs < 150 ? 62 + (atMs / 150 - 1) * 3 : 62)),
    );
    const longest = [...notes].sort(
      (left, right) =>
        right.endMs - right.startMs - (left.endMs - left.startMs),
    )[0];

    expect(notes.length).toBeLessThanOrEqual(2);
    expect(longest.targetMidi).toBe(62);
    expect(longest.endMs - longest.startMs).toBeGreaterThan(900);
  });
});
