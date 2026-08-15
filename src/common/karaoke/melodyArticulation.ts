/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

export interface IKaraokeLeadNoteTiming {
  startMs: number;
  endMs: number;
  targetMidi?: number;
  kind?: 'normal' | 'golden' | 'free';
}

export interface IKaraokeLeadNoteArticulation {
  startMs: number;
  endMs: number;
  durationMs: number;
  /** Portion of the authored note that is deliberately sounded/drawn. */
  gate: number;
}

const LEAD_GATE_PATTERNS = [0.78, 0.84, 0.74, 0.88, 0.81, 0.76, 0.86];
const MAXIMUM_LEAD_NOTE_MS = 1_450;

/**
 * Give a timed karaoke note musical articulation without changing its authored
 * word/syllable range. The shortened copy is only for guide presentation and
 * audition; editing and export continue to use the original timing.
 */
export const karaokeLeadNoteArticulation = (
  note: IKaraokeLeadNoteTiming,
): IKaraokeLeadNoteArticulation => {
  const startMs = Number.isFinite(note.startMs) ? note.startMs : 0;
  const authoredDurationMs = Math.max(1, note.endMs - startMs);
  const pitchSeed = Number.isFinite(note.targetMidi)
    ? Math.round((note.targetMidi as number) * 17)
    : 0;
  const timeSeed = Math.round(Math.abs(startMs) / 37);
  const patternIndex =
    Math.abs(pitchSeed + timeSeed) % LEAD_GATE_PATTERNS.length;
  let gate = LEAD_GATE_PATTERNS[patternIndex];
  if (note.kind === 'golden') {
    gate = Math.min(0.92, gate + 0.04);
  } else if (note.kind === 'free') {
    gate = Math.max(0.68, gate - 0.07);
  }

  // Tiny imported syllables cannot afford a large rest. Longer notes receive
  // a clearly audible separation and are capped so the cue never drones for
  // the complete duration of a long lyric word.
  const minimumRestMs = Math.min(
    authoredDurationMs * 0.24,
    Math.max(10, authoredDurationMs * 0.08),
  );
  const maximumDurationMs = Math.max(
    1,
    Math.min(authoredDurationMs - minimumRestMs, MAXIMUM_LEAD_NOTE_MS),
  );
  const minimumDurationMs = Math.min(
    maximumDurationMs,
    Math.max(36, Math.min(115, authoredDurationMs * 0.62)),
  );
  const durationMs = Math.max(
    1,
    Math.min(
      maximumDurationMs,
      Math.max(minimumDurationMs, authoredDurationMs * gate),
    ),
  );

  return {
    startMs,
    endMs: startMs + durationMs,
    durationMs,
    gate: durationMs / authoredDurationMs,
  };
};
