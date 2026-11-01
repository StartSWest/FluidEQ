/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Rearranging what is coming, without touching what is playing — the presses
 * on Up Next, shuffle and repeat, and the list a press was made in. Each is a
 * pure step on the player's state (`playerState.ts`); none of them changes
 * the song playing except `addToQueue` on an empty player, which starts it.
 */
import {
  type ILibraryPlayerState,
  isGuessIn,
  nextRepeat,
  playTracks,
  withQueue,
} from './playerState';
import {
  buildQueue,
  currentTrackId,
  setShuffle as setQueueShuffle,
} from './queue';
import {
  appendToEnd,
  dropGuessesAhead,
  idsStillComing,
  insertAt,
  insertionBefore,
  topUpQueue as topUpPlayOrder,
  uniqueTrackIds,
} from './upNextRules';

/**
 * Songs onto what is queued: at the end, or before the first of `beforeIds`
 * still coming (a file drop between two songs). With nothing playing it
 * starts the list instead — "add to up next" on an empty player means the
 * same thing as pressing play. Answers how many joined, so a drop that added
 * nothing can say so.
 */
export const addToQueue = (
  state: ILibraryPlayerState,
  trackIds: readonly string[],
  beforeIds?: readonly string[],
): { state: ILibraryPlayerState; joined: number } => {
  const [first] = trackIds;
  if (first === undefined) {
    return { state, joined: 0 };
  }
  if (!state.queue) {
    return {
      state: playTracks(state, trackIds, first),
      joined: uniqueTrackIds(trackIds).length,
    };
  }
  const isGuess = isGuessIn(state);
  const coming = idsStillComing(state.queue, isGuess);
  const joining = uniqueTrackIds(trackIds).filter((id) => !coming.has(id));
  const addedIds =
    joining.length === 0
      ? state.addedIds
      : new Set([...state.addedIds, ...joining]);
  const queue =
    beforeIds === undefined
      ? appendToEnd(state.queue, trackIds, isGuess)
      : insertAt(
          state.queue,
          trackIds,
          insertionBefore(state.queue, beforeIds),
          isGuess,
        );
  return {
    state: withQueue({ ...state, addedIds }, queue),
    joined: joining.length,
  };
};

/**
 * Out of the run, by place rather than by name: the same song can sit in
 * the list several times, so the id says nothing about WHICH entry was
 * meant. Never the song playing or one already played.
 */
export const removeUpNextAt = (
  state: ILibraryPlayerState,
  position: number,
): ILibraryPlayerState => {
  const { queue } = state;
  if (!queue || position <= queue.position || position >= queue.order.length) {
    return state;
  }
  const order = [...queue.order];
  order.splice(position, 1);
  return { ...state, queue: { ...queue, order } };
};

/**
 * One queued entry to another's place. Never to or past the playhead: this
 * list is what happens NEXT, and dropping something behind the current track
 * would drop it into the past.
 */
export const moveUpNext = (
  state: ILibraryPlayerState,
  from: number,
  to: number,
): ILibraryPlayerState => {
  const { queue } = state;
  if (
    !queue ||
    from <= queue.position ||
    from >= queue.order.length ||
    from === to
  ) {
    return state;
  }
  const order = [...queue.order];
  const [moved] = order.splice(from, 1);
  if (moved === undefined) {
    return state;
  }
  const shifted = to > from ? to - 1 : to;
  order.splice(
    Math.min(Math.max(queue.position + 1, shifted), order.length),
    0,
    moved,
  );
  return { ...state, queue: { ...queue, order } };
};

export const setShuffle = (
  state: ILibraryPlayerState,
  isShuffled: boolean,
): ILibraryPlayerState =>
  state.queue
    ? { ...state, queue: setQueueShuffle(state.queue, isShuffled) }
    : state;

export const cycleRepeat = (state: ILibraryPlayerState): ILibraryPlayerState =>
  state.queue
    ? {
        ...state,
        queue: { ...state.queue, repeat: nextRepeat(state.queue.repeat) },
      }
    : state;

/**
 * The list a press was made in, put under the song it started.
 *
 * A press plays its song at once as a queue of itself, and the list it was
 * pressed in arrives a moment later, when the store has said where the song
 * stands in it. This puts that list under the song. Only after a press: a
 * change of song tops the queue up from its own list (`topUpQueue`) and never
 * re-aims it, or the Library on screen — or hidden behind the amp — took
 * over a playlist the amp had just started (Ivan, 2026-10-25).
 *
 * The song playing comes out the same, so the deck carries on through the
 * swap. Songs added by hand that are still ahead stay ahead, after the list;
 * continuation's draws go, being guesses about the list that was.
 */
export const retargetQueue = (
  state: ILibraryPlayerState,
  trackIds: readonly string[],
  listKey: string,
): ILibraryPlayerState => {
  const { queue } = state;
  if (!queue) {
    return state;
  }
  const playing = currentTrackId(queue);
  if (playing === undefined || !trackIds.includes(playing)) {
    return state;
  }
  const isGuess = isGuessIn(state);
  if (queue.source === listKey) {
    return { ...state, queue: topUpPlayOrder(queue, trackIds, isGuess) };
  }
  const ahead = queue.order
    .slice(queue.position + 1)
    .map((index) => queue.trackIds[index])
    .filter((id): id is string => id !== undefined);
  const pending = uniqueTrackIds(ahead.filter((id) => state.addedIds.has(id)));
  const pendingSet = new Set(pending);
  const context = uniqueTrackIds(trackIds).filter(
    (id) => id === playing || !pendingSet.has(id),
  );
  const aimed = dropGuessesAhead({ ...queue, source: listKey }, isGuess);
  // The same list, already built: only the name changes. A shuffled queue
  // holding exactly the list's songs is the same list in the listener's
  // order, and rebuilding it would shuffle it again under them.
  const built = queue.trackIds.filter(
    (id) => !pendingSet.has(id) && !isGuess(id),
  );
  if (
    built.length === context.length &&
    built.every((id, index) => id === context[index])
  ) {
    return { ...state, queue: aimed };
  }
  if (queue.isShuffled) {
    const held = new Set(built);
    if (held.size === context.length && context.every((id) => held.has(id))) {
      return { ...state, queue: aimed };
    }
  }
  const base = buildQueue(context, playing, queue.isShuffled);
  const kept = base.trackIds.length;
  const next =
    pending.length === 0
      ? base
      : {
          ...base,
          trackIds: [...base.trackIds, ...pending],
          order: [...base.order, ...pending.map((_, index) => kept + index)],
        };
  return {
    ...state,
    queue: { ...next, repeat: queue.repeat, source: listKey },
  };
};

/**
 * Tops the queue up from the list it plays, and never re-aims it: a window
 * of any other list leaves the queue as it is. What a change of song asks,
 * so a long list refills the queue as it is played.
 */
export const topUpQueue = (
  state: ILibraryPlayerState,
  trackIds: readonly string[],
  listKey: string,
): ILibraryPlayerState =>
  state.queue && state.queue.source === listKey
    ? {
        ...state,
        queue: topUpPlayOrder(state.queue, trackIds, isGuessIn(state)),
      }
    : state;

/**
 * SWITCHED OFF, THE QUEUE ENDS WHERE THE LISTENER'S LIST DOES (Ivan: "only
 * when that option is on"). What was drawn and is still ahead goes with the
 * switch; the song playing plays on.
 */
export const setContinuation = (
  state: ILibraryPlayerState,
  isContinuationOn: boolean,
): ILibraryPlayerState => {
  if (state.isContinuationOn === isContinuationOn) {
    return state;
  }
  const next = { ...state, isContinuationOn };
  if (isContinuationOn || !state.queue) {
    return next;
  }
  return {
    ...next,
    queue: dropGuessesAhead(state.queue, (id) => state.continuedIds.has(id)),
  };
};

/** Continuation's draw, appended under the last song as its own run. */
export const continuationDrawn = (
  state: ILibraryPlayerState,
  picked: readonly string[],
): ILibraryPlayerState => {
  const { queue } = state;
  if (!queue || picked.length === 0) {
    return state;
  }
  const base = queue.trackIds.length;
  return {
    ...state,
    continuedIds: new Set([...state.continuedIds, ...picked]),
    queue: {
      ...queue,
      trackIds: [...queue.trackIds, ...picked],
      order: [...queue.order, ...picked.map((_, index) => base + index)],
    },
  };
};
