/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How far the host may drift from the element before it is a seek.
 *
 * The element reports position four times a second and the host runs on its
 * own clock, so they are never exactly equal. Half a second is well past any
 * ordinary drift and well inside the smallest jump a person makes on a
 * scrubber — anything tighter turns steady playback into a seek every tick,
 * which empties the read-ahead ring and stutters.
 */
const SEEK_THRESHOLD_MS = 500;

/**
 * The media element's clock, read for jumps made on it while it is still the
 * authority: the engine switched on under a song, a restore landing, a file
 * the host could not open playing on the elements.
 */
export interface IElementClock {
  /**
   * A reading taken as the new baseline, never compared. `hold` keeps every
   * reading after it a baseline too, until `settle`: while the host is being
   * brought to a new track the element's clock belongs to neither track
   * reliably — on the tick that changes it the path is the new song while
   * the position is still the old one's, and the lead-in lands on the
   * element after its own `play()` settles. The host is cued where the new
   * track starts in the same command that loads it, so any jump read then is
   * one of those and never the listener: forwarded, it seeked the deck
   * already fading in and emptied its read-ahead, the crack heard on Next.
   */
  rebase: (positionMs: number, now: number, hold: boolean) => void;
  /** The host has the track the hold was for: readings count again. */
  settle: () => void;
  /**
   * Where the listener has just put the playhead, as the last reading — or
   * the jump would be read back as drift: the element is paused while a deck
   * holds the track, and the next reading would seek the deck straight back.
   */
  claim: (positionMs: number, now: number) => void;
  /** A reading: the position to seek the host to, when it is a jump. */
  read: (
    positionMs: number,
    now: number,
    playing: boolean,
    hostOwnsTransport: boolean,
  ) => number | undefined;
}

export const watchElementClock = (): IElementClock => {
  let lastPositionMs = 0;
  /**
   * When that reading was taken, which is what makes the next one meaningful.
   *
   * Without it, "drift" was the gap between two syncs rather than the gap
   * between two clocks — so a render that arrived half a second late looked
   * exactly like a listener dragging the scrubber, and the answer to that is a
   * seek. A seek empties the read-ahead ring, which is a hole in the audio.
   */
  let lastAt = 0;
  let held = false;
  const take = (positionMs: number, now: number) => {
    lastPositionMs = positionMs;
    lastAt = now;
  };

  return {
    rebase: (positionMs, now, hold) => {
      held = hold;
      take(positionMs, now);
    },
    settle: () => {
      held = false;
    },
    claim: take,
    read: (positionMs, now, playing, hostOwnsTransport) => {
      if (held) {
        take(positionMs, now);
        return undefined;
      }
      /**
       * A jump made on the element, not the time this tick took to arrive.
       *
       * Compared against where the element SHOULD be by now — the last
       * reading plus the wall time since it, while playing — rather than
       * against the last reading itself: measured the second way, every
       * render that came half a second late was indistinguishable from a drag
       * of the scrubber, and each one cost a seek and the read-ahead ring with
       * it.
       *
       * A reading that has not moved is a stopped clock, not a jump: the
       * element is paused for as long as a deck holds the track, and seeking
       * the deck to that frozen reading put the song back to its beginning on
       * its own. And only while the element still owns the transport: once
       * the host does, the listener's seeks have their own route, and a paused
       * element refusing an assignment reads back a position that must never
       * command the audible deck.
       */
      const elapsed = playing && lastAt > 0 ? now - lastAt : 0;
      const previous = lastPositionMs;
      const expected = lastPositionMs + elapsed;
      take(positionMs, now);
      return !hostOwnsTransport &&
        positionMs !== previous &&
        Math.abs(positionMs - expected) > SEEK_THRESHOLD_MS
        ? positionMs
        : undefined;
    },
  };
};
