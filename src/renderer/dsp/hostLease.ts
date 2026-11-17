/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which player drives the native host: the Library, or the Karaoke.
 *
 * There is one host process (`ipc/dspHost.ts` holds one supervisor) with two
 * decks, and every command a player sends assumes those decks are its own:
 * the Library's mirror cues its track on the deck the host chooses and makes
 * it the one heard; its teardown empties both decks and pauses the transport,
 * and stops the process unless the other player is taking the host over — then
 * the process and its open device are handed on (`residentHost` in
 * `nativeBackend.ts`).
 * Two players engaged at once would cut each other's songs off — a Library
 * restored on mounting, paused, cueing its track over a karaoke song in mid
 * verse, or pausing the whole transport under it — and each would read the
 * other's position as its own.
 *
 * So exactly one engages, and the Library is the one unless the Karaoke
 * asks. The Karaoke asks while it is the one playing, and while its tab is
 * in front with a song on it and the Library is not playing — so a press of
 * Play on either finds its own engine already engaged, and a song playing on
 * one never loses the host to a tab change. The player that loses the host
 * lets it go the way the Library always has when its track went away: the
 * mirror hands the sound back to its media element, at the host's position,
 * and empties the decks — on a host that keeps running for the other player.
 *
 * A module store rather than a context, for the reason `playbackOwner.ts`
 * gives: the two players sit in different branches of the tree.
 */
import { useSyncExternalStore } from 'react';
import { setDspSourceClient } from './sourceAnalysis';

export type THostClient = 'library' | 'karaoke';

let karaokeWants = false;
const listeners = new Set<() => void>();

export const readHostClient = (): THostClient =>
  karaokeWants ? 'karaoke' : 'library';

/** The Karaoke asking for the host, or letting it go back to the Library. */
export const setKaraokeWantsHost = (wanted: boolean): void => {
  if (wanted === karaokeWants) {
    return;
  }
  karaokeWants = wanted;
  // Before anyone hears of it: the Karaoke's engine, built on this change,
  // prepares its start from the source this sets (`sourceAnalysis.ts`).
  setDspSourceClient(readHostClient());
  listeners.forEach((listener) => listener());
};

/** Heard whenever the host changes hands. Returns the unsubscribe. */
export const onHostClientChange = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useHostClient = (): THostClient =>
  useSyncExternalStore(onHostClientChange, readHostClient, readHostClient);
