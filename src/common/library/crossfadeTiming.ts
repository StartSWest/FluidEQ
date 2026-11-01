/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where an overlap between two songs starts and where it lands, from what was
 * measured of each: the end of the music rather than of the file, and the
 * first sound rather than the file's first sample.
 */
import type { ILibraryProgrammeEdges } from './types';

/**
 * How much leading silence is worth a seek.
 *
 * Below this the jump costs a decoder re-sync for something nobody could
 * hear missing, and the incoming deck is better off simply starting at the
 * file's first sample.
 */
const MIN_LEAD_IN_TRIM_MS = 250;

/** Where a song comes in on a handoff: its music, or the file's start. */
export const leadInStartMs = (
  edges: ILibraryProgrammeEdges | undefined,
): number => {
  const leadInMs = edges?.leadInMs ?? 0;
  return leadInMs >= MIN_LEAD_IN_TRIM_MS ? leadInMs : 0;
};

/**
 * Whether the next song should start fading in now.
 *
 * The end of the music, not the end of the file: a track padded with five
 * seconds of digital silence used to start its two-second fade three seconds
 * into that silence — nothing audible crossed over, and the next song waited
 * for the padding to run out. Without a measurement this is the duration,
 * which is what it always was.
 *
 * Not `remaining > 0`, which is the same test only while the programme runs
 * to the last sample. Once the end is trimmed, being already inside the
 * trailing silence — seeked into it, or arrived there while the DSP was off —
 * is a reason to hand over now.
 */
export const isCrossfadeDue = (clock: {
  positionMs: number;
  durationMs: number;
  edges: ILibraryProgrammeEdges | undefined;
  fadeMs: number;
}): boolean => {
  const { positionMs, durationMs, edges, fadeMs } = clock;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return false;
  }
  const programmeEndMs = Math.min(
    durationMs,
    edges?.endMs ?? Number.POSITIVE_INFINITY,
  );
  return positionMs < durationMs && programmeEndMs - positionMs <= fadeMs;
};
