/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Rearranging what is coming, without touching what is playing.
 *
 * Every one of these ends in `setQueue` and not one of them reaches a media
 * element, which is what makes them a group rather than a drawer. The loader
 * is keyed on the track id alone, so a queue that comes back with the same
 * track still playing does not restart it: moving, adding and removing what is
 * BELOW the playhead is silent by construction.
 *
 * `skip` and `seek` deliberately stayed behind. They read as queue operations
 * and are not — both touch the deck, and Previous decides between rewinding
 * one and changing track by asking where the playhead is.
 */
import { Dispatch, MutableRefObject, SetStateAction, useCallback } from 'react';
import {
  ILibraryQueue,
  buildQueue,
  currentTrackId,
  setShuffle as setQueueShuffle,
} from '../../../common/library/queue';
import { nextRepeat } from './playerContract';
import {
  appendToEnd,
  dropGuessesAhead,
  idsStillComing,
  insertAt,
  insertionBefore,
  settleGuesses,
  topUpQueue as topUpPlayOrder,
  uniqueTrackIds,
} from './upNextRules';

export interface IQueueControls {
  jumpToQueuePosition: (position: number) => void;
  /** Puts songs at the end of Up next, and says how many joined. */
  appendToQueue: (trackIds: readonly string[]) => number;
  /** Inserts before the first still-upcoming anchor, retaining drop order. */
  insertIntoQueue: (
    trackIds: readonly string[],
    beforeIds: readonly string[],
  ) => number;
  removeUpNextAt: (position: number) => void;
  moveUpNext: (from: number, to: number) => void;
  setShuffle: (isShuffled: boolean) => void;
  cycleRepeat: () => void;
  /**
   * Re-aim the queue at a different list without interrupting the track.
   *
   * Nothing here reaches a media element, and that is the point: the same
   * `trackId` comes out, so the loader — keyed on that id alone — does not
   * run and the audio carries on through the swap.
   *
   * `listKey` names the list `trackIds` come from. The list the queue is
   * already aimed at only tops it up (`extendQueue`); another one re-aims it.
   */
  retargetQueue: (trackIds: readonly string[], listKey: string) => void;
  /**
   * Tops the queue up from the list it plays, and never re-aims it: a window
   * of any other list leaves the queue as it is. What a change of song asks.
   */
  topUpQueue: (trackIds: readonly string[], listKey: string) => void;
}

export const useQueueControls = (options: {
  setQueue: (
    update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
  ) => void;
  queueRef: MutableRefObject<ILibraryQueue | undefined>;
  /** What the listener put there by hand, which survives a re-aim. */
  addedIdsRef: MutableRefObject<ReadonlySet<string>>;
  /** What continuation guessed, which is re-aimed differently from the rest. */
  continuedIdsRef: MutableRefObject<ReadonlySet<string>>;
  setAddedIds: Dispatch<SetStateAction<ReadonlySet<string>>>;
  /**
   * Starting a queue from nothing is still a play, not a rearrangement — it
   * is the one case here that CAN make a sound, so it is borrowed rather than
   * reimplemented.
   */
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
}): IQueueControls => {
  const {
    setQueue,
    queueRef,
    addedIdsRef,
    continuedIdsRef,
    setAddedIds,
    playTracks,
  } = options;

  /**
   * A draw of continuation's that is still one: drawn, and not picked since.
   * Read through the refs, so it sees the sets as they are when it runs.
   */
  const isGuess = useCallback(
    (id: string) =>
      continuedIdsRef.current.has(id) && !addedIdsRef.current.has(id),
    [addedIdsRef, continuedIdsRef],
  );

  // A press on an earlier row puts the listener's songs ahead again, so
  // continuation's draws go with it (`settleGuesses`).
  const jumpToQueuePosition = useCallback(
    (position: number) => {
      setQueue((current) =>
        !current || position < 0 || position >= current.order.length
          ? current
          : settleGuesses({ ...current, position }, isGuess),
      );
    },
    [isGuess, setQueue],
  );

  const addToQueue = useCallback(
    (trackIds: readonly string[], beforeIds?: readonly string[]) => {
      const [first] = trackIds;
      if (first === undefined) {
        return 0;
      }
      if (!queueRef.current) {
        playTracks(trackIds, first);
        return uniqueTrackIds(trackIds).length;
      }
      // Only songs that join are marked as picks: a song already coming
      // keeps the heading it had, and a song playing is not "up next".
      const coming = idsStillComing(queueRef.current, isGuess);
      const joining = uniqueTrackIds(trackIds).filter((id) => !coming.has(id));
      if (joining.length > 0) {
        setAddedIds((picked) => {
          const next = new Set(picked);
          joining.forEach((id) => next.add(id));
          return next;
        });
      }
      setQueue((queue) => {
        if (!queue) {
          return queue;
        }
        return beforeIds === undefined
          ? appendToEnd(queue, trackIds, isGuess)
          : insertAt(
              queue,
              trackIds,
              insertionBefore(queue, beforeIds),
              isGuess,
            );
      });
      return joining.length;
    },
    [playTracks, setQueue, queueRef, isGuess, setAddedIds],
  );

  /**
   * Out of the run, by place rather than by name.
   *
   * `order` alone is edited and `trackIds` is left as it is: the same song
   * can sit in this list several times, so the id says nothing about WHICH
   * entry was meant, and an unreferenced id costs a string.
   */
  const removeUpNextAt = useCallback(
    (position: number) => {
      setQueue((current) => {
        if (
          !current ||
          position <= current.position ||
          position >= current.order.length
        ) {
          return current;
        }
        const order = [...current.order];
        order.splice(position, 1);
        return { ...current, order };
      });
    },
    [setQueue],
  );

  const moveUpNext = useCallback(
    (from: number, to: number) => {
      setQueue((current) => {
        if (
          !current ||
          from <= current.position ||
          from >= current.order.length ||
          from === to
        ) {
          return current;
        }
        const order = [...current.order];
        const [moved] = order.splice(from, 1);
        if (moved === undefined) {
          return current;
        }
        // After the splice everything past `from` has shifted down one, so a
        // target that was below it is now one place nearer.
        const shifted = to > from ? to - 1 : to;
        order.splice(
          Math.min(Math.max(current.position + 1, shifted), order.length),
          0,
          moved,
        );
        return { ...current, order };
      });
    },
    [setQueue],
  );

  const setShuffle = useCallback(
    (isShuffled: boolean) => {
      setQueue((current) =>
        current ? setQueueShuffle(current, isShuffled) : current,
      );
    },
    [setQueue],
  );

  const cycleRepeat = useCallback(() => {
    setQueue((current) =>
      current ? { ...current, repeat: nextRepeat(current.repeat) } : current,
    );
  }, [setQueue]);

  /**
   * The list a press was made in, put under the song it started.
   *
   * A press plays its song at once as a queue of itself (`playTrack` in
   * `useViewQueue`), and the list it was pressed in arrives a moment later,
   * when the store has said where the song stands in it. This puts that list
   * under the song. Only after a press: a change of song tops the queue up
   * from its own list (`topUpQueue`) and never re-aims it, or the Library on
   * screen — or hidden behind the amp — took over a playlist the amp had just
   * started (Ivan, 2026-10-25).
   *
   * Nothing here reaches the media element, and that is the point: `trackId`
   * comes out the same, so the loader effect — keyed on that id alone — does
   * not run, and the audio carries on through the swap without a gap. Shuffle
   * and repeat are the listener's settings rather than the list's, so they
   * come across too.
   */
  const retargetQueue = useCallback(
    (trackIds: readonly string[], listKey: string) => {
      setQueue((current) => {
        if (!current) {
          return current;
        }
        const playing = currentTrackId(current);
        if (playing === undefined || !trackIds.includes(playing)) {
          return current;
        }
        // The same list again: only what it has that the queue never held.
        if (current.source === listKey) {
          return topUpPlayOrder(current, trackIds, isGuess);
        }
        // WHAT WAS ADDED BY HAND SURVIVES THE SWAP, AT THE END.
        //
        // The listener's own list is not part of the list pressed in, and
        // losing it to a press would be the worst kind of quiet. Lifted out
        // and put back after the list, where "add to up next" puts songs, so
        // the list underneath is built WITHOUT them and nothing is drawn
        // twice.
        //
        // CONTINUATION'S DRAWS DO NOT. They were drawn for the song standing
        // alone the moment the press started it, a queue of one whose last
        // song was the first, and survived the swap at the end of the list —
        // which is how "More like this" stood under a six-song playlist from
        // its first second, with five of the playlist's songs still to come.
        // They are drawn again when the list's last song plays.
        const ahead = current.order
          .slice(current.position + 1)
          .map((index) => current.trackIds[index])
          .filter((id): id is string => id !== undefined);
        const pending = uniqueTrackIds(
          ahead.filter((id) => addedIdsRef.current.has(id)),
        );
        const pendingSet = new Set(pending);
        const context = uniqueTrackIds(trackIds).filter(
          (id) => id === playing || !pendingSet.has(id),
        );
        // Whichever way the queue is kept below, it is now aimed at this list,
        // so the next song's ask for it tops it up instead of comparing again.
        const aimed = dropGuessesAhead(
          { ...current, source: listKey },
          isGuess,
        );
        // THE SAME SONGS IN THE SAME ORDER ARE NOT SOMETHING TO REBUILD:
        // compared against what the queue was BUILT from, minus the picks, so
        // an order the listener made in Up Next survives a press on the list
        // it came from.
        const built = current.trackIds.filter(
          (id) => !pendingSet.has(id) && !isGuess(id),
        );
        if (
          built.length === context.length &&
          built.every((id, index) => id === context[index])
        ) {
          return aimed;
        }
        // A SHUFFLED QUEUE IS NOT RE-AIMED BY A LIST OF THE SAME SONGS.
        //
        // `buildQueue` draws a FRESH random order every time it is asked for a
        // shuffled one, so a list re-aimed at itself came back re-shuffled
        // and the playhead landed somewhere new in the new order each time —
        // reported as something firing on a timer. Under shuffle the shelf's
        // order is deliberately not the queue's, so membership is the only
        // thing that can mean anything.
        if (current.isShuffled) {
          const held = new Set(built);
          if (
            held.size === context.length &&
            context.every((id) => held.has(id))
          ) {
            return aimed;
          }
        }
        const base = buildQueue(context, playing, current.isShuffled);
        const kept = base.trackIds.length;
        const next =
          pending.length === 0
            ? base
            : {
                ...base,
                trackIds: [...base.trackIds, ...pending],
                order: [
                  ...base.order,
                  ...pending.map((_, index) => kept + index),
                ],
              };
        return { ...next, repeat: current.repeat, source: listKey };
      });
      // Refs, listed because the rule cannot see they are stable through a hook
      // boundary.
    },
    [addedIdsRef, isGuess, setQueue],
  );

  const topUpQueue = useCallback(
    (trackIds: readonly string[], listKey: string) => {
      setQueue((current) =>
        current && current.source === listKey
          ? topUpPlayOrder(current, trackIds, isGuess)
          : current,
      );
    },
    [isGuess, setQueue],
  );

  return {
    jumpToQueuePosition,
    appendToQueue: addToQueue,
    insertIntoQueue: addToQueue,
    removeUpNextAt,
    moveUpNext,
    setShuffle,
    cycleRepeat,
    retargetQueue,
    topUpQueue,
  };
};
