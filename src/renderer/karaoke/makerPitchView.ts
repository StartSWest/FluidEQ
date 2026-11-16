/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_NOTE_MIDI, MIN_NOTE_MIDI } from './makerCanvasGeometry';

/**
 * The stretch of pitch the note grid shows, in MIDI note numbers, low to high.
 *
 * Fractional on purpose: a wheel zoom scales the span smoothly around the
 * pointer, and rounding each step to a semitone would make the pitch under
 * the pointer wander as it zooms.
 */
export interface IMakerPitchWindow {
  lowMidi: number;
  highMidi: number;
}

export const FULL_PITCH_WINDOW: IMakerPitchWindow = {
  lowMidi: MIN_NOTE_MIDI,
  highMidi: MAX_NOTE_MIDI,
};

const FULL_PITCH_SPAN = MAX_NOTE_MIDI - MIN_NOTE_MIDI;

/**
 * The closest the grid may zoom: one octave. Closer, a melody's neighbouring
 * notes leave the window on most moves and the rows stop reading as a scale.
 */
export const MIN_PITCH_SPAN = 12;

/** Room kept above the highest note and below the lowest when fitting. */
export const FIT_MARGIN_SEMITONES = 2;

/**
 * A window that can be drawn: its span between one octave and the whole grid,
 * moved (never squeezed) to lie inside the grid's range. A span that has to
 * grow or shrink does so about its own centre, so a fit around a single note
 * keeps that note in the middle.
 */
export const clampPitchWindow = ({
  lowMidi,
  highMidi,
}: IMakerPitchWindow): IMakerPitchWindow => {
  if (!Number.isFinite(lowMidi) || !Number.isFinite(highMidi)) {
    return FULL_PITCH_WINDOW;
  }
  const span = Math.max(
    MIN_PITCH_SPAN,
    Math.min(FULL_PITCH_SPAN, Math.abs(highMidi - lowMidi)),
  );
  const centre = (lowMidi + highMidi) / 2;
  const low = Math.max(
    MIN_NOTE_MIDI,
    Math.min(MAX_NOTE_MIDI - span, centre - span / 2),
  );
  return { lowMidi: low, highMidi: low + span };
};

export const pitchWindowSpan = (window: IMakerPitchWindow): number =>
  window.highMidi - window.lowMidi;

/**
 * Scale the window by `factor` about `anchorMidi`, which stays at the same
 * height on screen — the pitch under the pointer is still under it after.
 */
export const zoomPitchWindow = (
  window: IMakerPitchWindow,
  anchorMidi: number,
  factor: number,
): IMakerPitchWindow => {
  const span = pitchWindowSpan(window);
  // A pointer over the lyrics zooms about the window's top edge, not about
  // a pitch above it that would drag the window off its rows.
  const anchor = Math.max(
    window.lowMidi,
    Math.min(window.highMidi, anchorMidi),
  );
  const anchorShare = (anchor - window.lowMidi) / Math.max(1e-6, span);
  const nextSpan = Math.max(
    MIN_PITCH_SPAN,
    Math.min(FULL_PITCH_SPAN, span * factor),
  );
  const nextLow = anchor - anchorShare * nextSpan;
  return clampPitchWindow({ lowMidi: nextLow, highMidi: nextLow + nextSpan });
};

/** Move the window up (positive) or down by `semitones`, span unchanged. */
export const panPitchWindow = (
  window: IMakerPitchWindow,
  semitones: number,
): IMakerPitchWindow =>
  clampPitchWindow({
    lowMidi: window.lowMidi + semitones,
    highMidi: window.highMidi + semitones,
  });

/** Which end of the window a grip moves. */
export type TPitchWindowEdge = 'high' | 'low';

/**
 * One end of the window moved by `semitones` while the other stays put: the
 * song strip's grips, turned on their side. Held between one octave and the
 * grid's own edge, so a grip dragged past either stops there.
 */
export const resizePitchWindow = (
  window: IMakerPitchWindow,
  edge: TPitchWindowEdge,
  semitones: number,
): IMakerPitchWindow => {
  if (edge === 'high') {
    return {
      lowMidi: window.lowMidi,
      highMidi: Math.min(
        MAX_NOTE_MIDI,
        Math.max(window.lowMidi + MIN_PITCH_SPAN, window.highMidi + semitones),
      ),
    };
  }
  return {
    lowMidi: Math.max(
      MIN_NOTE_MIDI,
      Math.min(window.highMidi - MIN_PITCH_SPAN, window.lowMidi + semitones),
    ),
    highMidi: window.highMidi,
  };
};

/**
 * The window that holds every note with `FIT_MARGIN_SEMITONES` to spare, or
 * the whole grid when there are no notes to fit. A note beyond the grid's
 * range counts at the range's edge, where the grid pins it.
 */
export const fitPitchWindow = (
  notes: readonly { targetMidi: number }[],
): IMakerPitchWindow => {
  const pitches = notes
    .map((note) => note.targetMidi)
    .filter(Number.isFinite)
    .map((midi) => Math.max(MIN_NOTE_MIDI, Math.min(MAX_NOTE_MIDI, midi)));
  if (!pitches.length) {
    return FULL_PITCH_WINDOW;
  }
  return clampPitchWindow({
    lowMidi: Math.min(...pitches) - FIT_MARGIN_SEMITONES,
    highMidi: Math.max(...pitches) + FIT_MARGIN_SEMITONES,
  });
};

/**
 * A window read back from storage, or undefined when it is not one. Stored
 * values were written by this app but pass through a user-writable store, so
 * the shape is checked and the result clamped rather than trusted.
 */
export const normalizePersistedPitchWindow = (
  value: unknown,
): IMakerPitchWindow | undefined => {
  const candidate = value as Partial<IMakerPitchWindow> | undefined;
  if (
    typeof candidate?.lowMidi !== 'number' ||
    typeof candidate.highMidi !== 'number' ||
    !Number.isFinite(candidate.lowMidi) ||
    !Number.isFinite(candidate.highMidi) ||
    candidate.highMidi <= candidate.lowMidi
  ) {
    return undefined;
  }
  return clampPitchWindow({
    lowMidi: candidate.lowMidi,
    highMidi: candidate.highMidi,
  });
};
