/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';
import type { ILibraryQueue, TLibraryRepeat } from 'common/library/queue';
import type { ILibraryTrack } from 'common/library/types';

/** One song of the Library's play order, as the player's queue lists it. */
export interface ILibraryDeckItem {
  /** Where it stands in the play order — what a press jumps to. */
  position: number;
  trackId: string;
  title: string;
  artist?: string;
  durationMs?: number;
  artId?: string;
}

/**
 * What the Library's player tells the mini player beyond the transport every
 * source shares (`transportSource.ts`): its cover, its format, shuffle and
 * repeat, stop, and the queue.
 *
 * Published from inside `LibraryPlayerProvider`, the only place those exist,
 * and read by the player from anywhere: the provider is mounted inside the
 * full shell, which stays mounted but unseen while the window is the player.
 * Nothing is published while the Library has never been opened, and the
 * player says so rather than drawing an empty list.
 */
export interface ILibraryDeck {
  track: ILibraryTrack | undefined;
  isShuffled: boolean;
  repeat: TLibraryRepeat;
  stop: () => void;
  setShuffle: (isShuffled: boolean) => void;
  cycleRepeat: () => void;
  jumpTo: (position: number) => void;
  /**
   * Music files dragged onto the queue from the computer: they join the
   * library and go on the end of the play order, in the order they were
   * dropped. Resolves once they are in the queue — tags and durations arrive
   * afterwards, as the scan reaches them.
   */
  addFiles: (paths: string[]) => Promise<void>;
  /**
   * Drag a song to a different place in what is coming up. Only what is
   * still ahead of the playhead can move, and only to somewhere ahead of it:
   * a song already played is a record of what happened.
   */
  move: (from: number, to: number) => void;
  /** The play order around the current song — see `QUEUE_WINDOW`. */
  items: ILibraryDeckItem[];
  /** The current song's place in the play order, and how many there are. */
  position: number;
  total: number;
  /**
   * How long is still to come: this song and every one after it, in full.
   * What the deck's head reads out — the whole queue's length says less
   * about the evening than how much of it is left (Ivan, 2026-09-22).
   */
  leftDurationMs: number;
}

/**
 * How much of the play order the player lists.
 *
 * EVERYTHING ALREADY PLAYED OR SKIPPED, and the next stretch (Ivan,
 * 2026-09-22). It was three behind the playhead, which after an evening of
 * listening meant the deck could say nothing about what had been on — and
 * what has been on is exactly what somebody reaches for when they want it
 * again. They are drawn dimmed (`is-played`), so the list still reads as
 * "here is where you are".
 *
 * Both sides are still bounded, and have to be. A queue built from a whole
 * library is thousands long, the deck lays its list out again on every song,
 * and a listener who jumps to the end of such a queue has "played or skipped"
 * nothing — the playhead simply moved. Two hundred is past any evening's
 * listening and cannot cost a frame.
 */
const QUEUE_WINDOW = { before: 200, after: 60 };

let deck: ILibraryDeck | undefined;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const setDeck = (next: ILibraryDeck | undefined) => {
  deck = next;
  listeners.forEach((listener) => listener());
};

/** The Library's deck, or nothing while the Library has not been opened. */
export const useLibraryDeck = (): ILibraryDeck | undefined =>
  useSyncExternalStore(subscribe, () => deck);

interface IPublishedLibraryDeck {
  queue: ILibraryQueue | undefined;
  track: ILibraryTrack | undefined;
  trackById: ReadonlyMap<string, ILibraryTrack>;
  isShuffled: boolean;
  repeat: TLibraryRepeat;
  stop: () => void;
  setShuffle: (isShuffled: boolean) => void;
  cycleRepeat: () => void;
  jumpToQueuePosition: (position: number) => void;
  addFiles: (paths: string[]) => Promise<void>;
  moveUpNext: (from: number, to: number) => void;
}

/**
 * Publishes the deck from the Library's provider, and takes it back when the
 * provider goes (the Library's lease ends and its providers unmount).
 */
export const usePublishedLibraryDeck = ({
  queue,
  track,
  trackById,
  isShuffled,
  repeat,
  stop,
  setShuffle,
  cycleRepeat,
  jumpToQueuePosition,
  addFiles,
  moveUpNext,
}: IPublishedLibraryDeck) => {
  useEffect(() => {
    const order = queue?.order ?? [];
    const position = queue?.position ?? 0;
    const first = Math.max(0, position - QUEUE_WINDOW.before);
    const last = Math.min(order.length, position + QUEUE_WINDOW.after + 1);
    const items: ILibraryDeckItem[] = [];
    let leftDurationMs = 0;
    order.forEach((index, at) => {
      const id = queue?.trackIds[index];
      const song = id === undefined ? undefined : trackById.get(id);
      if (at >= position) {
        leftDurationMs += song?.durationMs ?? 0;
      }
      if (at < first || at >= last || id === undefined) {
        return;
      }
      items.push({
        position: at,
        trackId: id,
        title: song?.title ?? id,
        artist: song?.artist,
        durationMs: song?.durationMs,
        artId: song?.artId,
      });
    });
    setDeck({
      track,
      isShuffled,
      repeat,
      stop,
      setShuffle,
      cycleRepeat,
      jumpTo: jumpToQueuePosition,
      addFiles,
      move: moveUpNext,
      items,
      position,
      total: order.length,
      leftDurationMs,
    });
  }, [
    addFiles,
    cycleRepeat,
    moveUpNext,
    isShuffled,
    jumpToQueuePosition,
    queue,
    repeat,
    setShuffle,
    stop,
    track,
    trackById,
  ]);
  useEffect(() => () => setDeck(undefined), []);
};
