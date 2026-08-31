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
  buildQueue,
  currentTrackId,
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
  /**
   * Re-aim the queue at a different list without interrupting the track.
   *
   * Nothing here reaches a media element, and that is the point: the same
   * `trackId` comes out, so the loader — keyed on that id alone — does not
   * run and the audio carries on through the swap.
   */
  retargetQueue: (trackIds: readonly string[]) => void;
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
  const {
    setQueue,
    queueRef,
    addedIdsRef,
    continuedIdsRef,
    setAddedIds,
    playTracks,
  } = options;

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

  /**
   * The list Next walks, swapped under a playing track. See the interface for
   * why the queue follows the view rather than the press that started it.
   *
   * Nothing here reaches the media element, and that is the point: `trackId`
   * comes out the same, so the loader effect — keyed on that id alone — does
   * not run, and the audio carries on through the swap without a gap. Shuffle
   * and repeat are the listener's settings rather than the list's, so they
   * come across too.
   */
  const retargetQueue = useCallback(
    (trackIds: readonly string[]) => {
      setQueue((current) => {
        if (!current) {
          return current;
        }
        const playing = currentTrackId(current);
        if (playing === undefined || !trackIds.includes(playing)) {
          return current;
        }
        // WHAT WAS ADDED BY HAND SURVIVES THE SWAP, IN ITS OWN ORDER.
        //
        // The context changes whenever the reader changes shelf or sorts one —
        // that is the point of re-aiming. A list they built themselves is not
        // part of that context: losing it because they looked elsewhere would
        // be the worst kind of quiet, and re-sorting it along with the shelf is
        // very nearly as bad. Sorting Songs by title used to scatter the picks
        // into alphabetical order among fifty thousand rows, because a pick
        // that also appears in the new list was simply absorbed by it.
        //
        // So they are lifted out first and put back at the front, and the list
        // underneath is built WITHOUT them so nothing is drawn twice.
        const ahead = current.order
          .slice(current.position + 1)
          .map((index) => current.trackIds[index])
          .filter((id): id is string => id !== undefined);
        const pending = ahead.filter((id) => addedIdsRef.current.has(id));
        // AND WHAT THE PLAYER DREW FOR ITSELF SURVIVES TOO — AT THE END.
        //
        // Continuation is not part of the context either: it exists precisely
        // because the context ran out. Left to be rebuilt, it was: this
        // callback runs on every track change, so a seven-track album with
        // continuation on dropped its ten drawn songs and drew ten different
        // ones after every single track. The panel then listed a different
        // "more like this" every three minutes with nothing having been asked
        // for — the same shape as the re-shuffle bug two comments down, and
        // the same report: something changing by itself.
        //
        // At the END rather than after the playhead, which is the one way this
        // differs from the picks above: what follows the current track is the
        // rest of the record, and a guess is what comes after all of it.
        const continued = ahead.filter(
          (id) =>
            !addedIdsRef.current.has(id) && continuedIdsRef.current.has(id),
        );
        const pendingSet = new Set([...pending, ...continued]);
        const context = trackIds.filter(
          (id) => id === playing || !pendingSet.has(id),
        );
        // A SHUFFLED QUEUE IS NOT RE-AIMED BY A LIST OF THE SAME SONGS.
        //
        // `buildQueue` draws a FRESH random order every time it is asked for a
        // shuffled one, and this callback runs on every track change — so with
        // shuffle on, an album re-aimed at itself came back re-shuffled and the
        // playhead landed somewhere new in the new order each time. Up Next then
        // reported a different length on every pass of the same seven songs —
        // six, then one, then four, then none — which looks exactly like
        // something firing on a timer, and was reported as one.
        //
        // Order is what re-aiming is FOR when nothing is shuffled: sorting the
        // shelf by title should reorder what plays next. Under shuffle the
        // shelf's order is deliberately not the queue's, so membership is the
        // only thing that can mean anything — same songs, same queue, whatever
        // order they arrive in. Compared against the context rather than the
        // whole queue, because the picks are not part of what is being re-aimed.
        if (current.isShuffled) {
          const held = new Set(
            current.trackIds.filter((id) => !pendingSet.has(id)),
          );
          const arriving = new Set(context);
          if (
            held.size === arriving.size &&
            [...arriving].every((id) => held.has(id))
          ) {
            return current;
          }
        }
        const base = buildQueue([...context], playing, current.isShuffled);
        const kept = base.trackIds.length;
        const next =
          pending.length === 0 && continued.length === 0
            ? base
            : {
                ...base,
                trackIds: [...base.trackIds, ...pending, ...continued],
                order: (() => {
                  const order = [...base.order];
                  order.splice(
                    base.position + 1,
                    0,
                    ...pending.map((_, index) => kept + index),
                  );
                  order.push(
                    ...continued.map(
                      (_, index) => kept + pending.length + index,
                    ),
                  );
                  return order;
                })(),
              };
        if (
          next.trackIds.length === current.trackIds.length &&
          next.trackIds.every((id, index) => id === current.trackIds[index]) &&
          next.order.length === current.order.length &&
          next.order.every((value, index) => value === current.order[index])
        ) {
          // The same list arriving again — a re-render of the view rather than a
          // change of it. Returning the existing object keeps every consumer of
          // this context from re-rendering for nothing.
          return current;
        }
        return { ...next, repeat: current.repeat };
      });
      // Refs, listed because the rule cannot see they are stable through a hook
      // boundary.
    },
    [addedIdsRef, continuedIdsRef, setQueue],
  );

  return {
    jumpToQueuePosition,
    appendToQueue,
    removeUpNextAt,
    moveUpNext,
    setShuffle,
    cycleRepeat,
    retargetQueue,
  };
};
