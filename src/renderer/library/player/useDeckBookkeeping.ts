/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each deck is currently doing, keyed by the deck itself.
 *
 * Four records that answer questions about a specific element rather than
 * about the player: which track it holds, whether its playhead still needs
 * zeroing, where the music in it stops, and whether the jump it just made was
 * one the player asked for rather than the listener.
 *
 * Keyed by element and not by track id, and that is the whole reason they are
 * a group. Listeners are bound once for the life of a deck and outlive every
 * track it plays, so they have to be able to ask about the deck in front of
 * them — not about the track the app happens to be showing.
 */
import { useRef } from 'react';
import { ILibraryProgrammeEdges } from '../../../common/library/types';

export const useDeckBookkeeping = () => {
  /**
   * Which track each element is playing, so only one of them reports position.
   *
   * A crossfade runs both elements at once, and for the length of the overlap
   * the outgoing one is still playing a track that is no longer the current
   * one. Its `timeupdate` kept writing `positionMs`, so the seek bar was being
   * driven by three writers at the same time: the reset to zero on the track
   * change, the outgoing element still reporting the middle of the previous
   * song, and the incoming element starting from nothing. The thumb jumped to
   * the start, back out to where the old track was, and to the start again —
   * reported as the bar "going crazy" on Next, which is a fair description.
   *
   * Ownership of TRANSPORT cannot be moved early to fix it — `audioElementRef`
   * deliberately waits for `play()` to settle, because handing Next and
   * Previous to a deck that then fails to start makes the working song
   * unreachable. But position is a different question with a different answer:
   * it belongs to the track on screen, and only the element playing that track
   * may report it.
   */
  const elementTrackRef = useRef(new Map<HTMLMediaElement, string>());

  /**
   * Decks holding a track that has just been loaded and must start at zero.
   *
   * A song reached by switching away and back was starting part-way in, and
   * every explanation for it was ruled out one at a time by measurement: the
   * crossfade lead-in trim never runs with crossfade off, the blob swap costs
   * 26ms, the fade-in is 80ms, and the element reports `currentTime` 0 when it
   * begins. Stopping a song and playing it again is fine and switching away
   * and back is not, which puts the write on the loader path — it is keyed on
   * the track id, so stop-and-play never re-runs it.
   *
   * Rather than keep hunting the writer, the load states the position it
   * wants. A track that has just been loaded plays from its beginning; that is
   * true of every path except the two that deliberately ask for somewhere
   * else, and both of those clear this first.
   *
   * Applied when metadata arrives rather than beside the `src` assignment, and
   * that ordering is not a detail — the comment above `audio.src` has the
   * measurements: seeking an element still at `HAVE_NOTHING` records the seek
   * against a resource whose ranges are unknown, and `seekable` then comes
   * back empty and STAYS empty, so every later seek is silently refused. That
   * is the disabled seek bar this file has already been through once.
   */
  const freshLoadRef = useRef(new Set<HTMLMediaElement>());

  /**
   * Where the music stops in whatever each deck is playing.
   *
   * Keyed by element rather than by track id so it holds two entries and not
   * one per song of a listening session, and so the `timeupdate` listener —
   * bound once for the life of the element — can answer for the track that
   * element is actually playing rather than the one the app is showing.
   *
   * Populated from the library's cached analysis at load, and again when a
   * first-play measurement finishes, which for a track long enough to matter
   * lands minutes before its own ending does.
   */
  const programmeEdgesRef = useRef(
    new Map<HTMLMediaElement, ILibraryProgrammeEdges>(),
  );

  /** Decks whose next `seeked` is the lead-in trim — see `bindMediaEvents`. */
  const leadInSeekRef = useRef(new Set<HTMLMediaElement>());

  return {
    elementTrackRef,
    freshLoadRef,
    programmeEdgesRef,
    leadInSeekRef,
  };
};
