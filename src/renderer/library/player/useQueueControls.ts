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
import { MutableRefObject, useCallback } from 'react';
import {
  ILibraryQueue,
  setShuffle as setQueueShuffle,
} from '../../../common/library/queue';
import { nextRepeat } from './playerContract';

export interface IQueueControls {
  jumpToQueuePosition: (position: number) => void;
  appendToQueue: (trackIds: readonly string[], playNext?: boolean) => void;
  removeUpNextAt: (position: number) => void;
  moveUpNext: (from: number, to: number) => void;
  setShuffle: (isShuffled: boolean) => void;
  cycleRepeat: () => void;
}

export const useQueueControls = (options: {
  setQueue: (
    update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
  ) => void;
  queueRef: MutableRefObject<ILibraryQueue | undefined>;
  /** What the listener put there by hand, which survives a re-aim. */
  addedIdsRef: MutableRefObject<ReadonlySet<string>>;
  setAddedIds: (
    update: (current: ReadonlySet<string>) => ReadonlySet<string>,
  ) => void;
  /**
   * Starting a queue from nothing is still a play, not a rearrangement — it
   * is the one case here that CAN make a sound, so it is borrowed rather than
   * reimplemented.
   */
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
}): IQueueControls => {
  const { setQueue, queueRef, addedIdsRef, setAddedIds, playTracks } = options;

  const jumpToQueuePosition = useCallback(
    (position: number) => {
      setQueue((current) =>
        !current || position < 0 || position >= current.order.length
          ? current
          : { ...current, position },
      );
    },
    [setQueue],
  );

  const appendToQueue = useCallback(
    (trackIds: readonly string[]) => {
      const [first] = trackIds;
      if (first === undefined) {
        return;
      }
      if (!queueRef.current) {
        playTracks(trackIds, first);
        return;
      }
      setAddedIds((current) => {
        const next = new Set(current);
        trackIds.forEach((id) => next.add(id));
        return next;
      });
      setQueue((current) => {
        if (!current) {
          return current;
        }
        // PROMOTED, NOT COPIED.
        //
        // Pressing play on a record makes it the context, so the whole thing
        // is already sitting ahead of the playhead under "then". Choosing
        // "add to up next" on that same record afterwards used to append a
        // second copy of every track, and the panel then listed the album
        // twice — once as what happens to be coming, once as a decision.
        //
        // It is one decision. A track already queued ahead is MOVED into the
        // picks run rather than duplicated; only a track that is not there at
        // all is a genuinely new entry. Do the same on a second album and both
        // sit in the picks, in the order they were chosen, which is what
        // building a list for the evening actually looks like.
        //
        // AFTER WHAT WAS PICKED BEFORE THEM, never on top of it: the run of
        // hand-picked entries following the playhead is where these join, and
        // the playhead itself when there is no such run yet. `addedIdsRef` is
        // read rather than the set being written above, because that write
        // has not landed and the end of the OLD run is the insertion point.
        const nextTrackIds = [...current.trackIds];
        const order = [...current.order];
        let insertAt = current.position + 1;
        while (insertAt < order.length) {
          const id = nextTrackIds[order[insertAt] ?? -1];
          if (id === undefined || !addedIdsRef.current.has(id)) {
            break;
          }
          insertAt += 1;
        }
        const moved = trackIds.map((id) => {
          // An occurrence beyond the picks run — the context copy. Anything
          // inside the run is already a pick and is left where it stands.
          const at = order.findIndex(
            (trackIndex, position) =>
              position >= insertAt && nextTrackIds[trackIndex] === id,
          );
          if (at !== -1) {
            const [entry] = order.splice(at, 1);
            return entry ?? -1;
          }
          nextTrackIds.push(id);
          return nextTrackIds.length - 1;
        });
        order.splice(insertAt, 0, ...moved.filter((entry) => entry >= 0));
        return { ...current, trackIds: nextTrackIds, order };
      });
    },
    [playTracks, setQueue, queueRef, addedIdsRef, setAddedIds],
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

  return {
    jumpToQueuePosition,
    appendToQueue,
    removeUpNextAt,
    moveUpNext,
    setShuffle,
    cycleRepeat,
  };
};
