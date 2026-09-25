/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export type TLibraryRepeat = 'off' | 'all' | 'one';

/**
 * `order` holds indices into `trackIds`; `position` indexes into `order`,
 * never into `trackIds` directly. That indirection is the whole design:
 * shuffling permutes `order` alone, so switching shuffle back off restores
 * the original run without keeping a second copy of the list.
 */
export interface ILibraryQueue {
  trackIds: readonly string[];
  order: readonly number[];
  position: number;
  repeat: TLibraryRepeat;
  isShuffled: boolean;
  /**
   * The list on screen this queue was last aimed at, as that list names
   * itself (`retargetQueue`), or nothing for a queue that was started rather
   * than aimed. It is how the same list asked for again — every change of
   * song asks — is told from a different one: the same list only tops the
   * queue up (`extendQueue`), and never rebuilds the order the listener made.
   * Every change to a queue copies it, so it stays; a new queue has none.
   */
  source?: string;
}

const identityOrder = (length: number): number[] =>
  Array.from({ length }, (_, index) => index);

/** Fisher-Yates — every permutation of `indices` is equally likely. */
const shuffleIndices = (indices: readonly number[]): number[] => {
  const result = [...indices];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = result[i];
    result[i] = result[j];
    result[j] = swap;
  }
  return result;
};

/** Undefined once `order` is empty — an emptied queue, not an error state. */
export const currentTrackId = (queue: ILibraryQueue): string | undefined => {
  const index = queue.order[queue.position];
  return index === undefined ? undefined : queue.trackIds[index];
};

const unshuffle = (queue: ILibraryQueue): ILibraryQueue => {
  const playing = currentTrackId(queue);
  const order = identityOrder(queue.trackIds.length);
  const position = playing === undefined ? 0 : queue.trackIds.indexOf(playing);
  return { ...queue, order, position, isShuffled: false };
};

/**
 * The playing track goes to the FRONT, and the rest is shuffled behind it.
 *
 * It used to shuffle the whole run and then look up where the playing track
 * had landed, which is a different thing entirely: on a seven-track album the
 * playhead came to rest at a random point in the new order, so what was left
 * ahead of it was six entries, or three, or none, at random — and pressing
 * play on the same record again dealt a different hand every time. Reported
 * as the queue behaving "like a timer going crazy", which is exactly what a
 * number that changes by itself looks like.
 *
 * Everything before the playhead is what has already been heard, and no
 * shuffle can put songs there after the fact. Turning shuffle on means "a
 * fresh random run from here" — so here is the front, and `position` is 0.
 */
const shuffle = (queue: ILibraryQueue): ILibraryQueue => {
  const playing = currentTrackId(queue);
  const playingIndex =
    playing === undefined ? -1 : queue.trackIds.indexOf(playing);
  const rest = shuffleIndices(
    identityOrder(queue.trackIds.length).filter(
      (index) => index !== playingIndex,
    ),
  );
  return {
    ...queue,
    order: playingIndex === -1 ? rest : [playingIndex, ...rest],
    position: 0,
    isShuffled: true,
  };
};

/**
 * Reshuffles what comes after the current track without touching the
 * current track itself — the button says "shuffle", not "skip". Calling
 * this with the queue's existing `isShuffled` value is a no-op, so a
 * second `setShuffle(queue, true)` cannot re-shuffle the run underneath a
 * listener who never asked for it again.
 */
export const setShuffle = (
  queue: ILibraryQueue,
  isShuffled: boolean,
): ILibraryQueue => {
  if (isShuffled === queue.isShuffled) {
    return { ...queue };
  }
  return isShuffled ? shuffle(queue) : unshuffle(queue);
};

/**
 * Builds a play order starting on `startTrackId`. A `startTrackId` absent
 * from `trackIds` falls back to the first track rather than throwing — the
 * caller may be racing a rescan that already dropped it.
 */
export const buildQueue = (
  trackIds: readonly string[],
  startTrackId: string,
  isShuffled: boolean,
): ILibraryQueue => {
  const ids = [...trackIds];
  const startIndex = ids.indexOf(startTrackId);
  const base: ILibraryQueue = {
    trackIds: ids,
    order: identityOrder(ids.length),
    position: startIndex === -1 ? 0 : startIndex,
    repeat: 'off',
    isShuffled: false,
  };
  return isShuffled ? setShuffle(base, true) : base;
};

/**
 * The songs of `trackIds` the queue has never held, added ahead of the
 * playhead; everything already there stays exactly where it is.
 *
 * The same list asked for again, which is what every change of song does: a
 * library's list is handed over as a window around the playing song, and on
 * a list longer than the window it slides one song on with every song.
 * Rebuilding the queue from each slid window put the list's order back over
 * the listener's — a row dragged in Up Next went home when the song ended,
 * and a row taken out came back — which is what `retargetQueue`'s "same
 * shelf" rule had already fixed for a list handed over whole. So a window of
 * the same list only tops the queue up: never a song it has held, whether it
 * is still ahead, was played, or was taken out.
 *
 * Playing in order, only the songs past the playing one join, after the
 * list's songs already ahead and before `isGuess`'s, which continuation drew
 * because the list had run out and which come after all of it. Shuffled,
 * every new song joins at a random place among those ahead, so the run stays
 * shuffled without reshuffling anything already in it. Answers `queue`
 * itself when nothing joins.
 */
export const extendQueue = (
  queue: ILibraryQueue,
  trackIds: readonly string[],
  isGuess: (trackId: string) => boolean,
  random: () => number = Math.random,
): ILibraryQueue => {
  const playing = currentTrackId(queue);
  const at = playing === undefined ? -1 : trackIds.indexOf(playing);
  if (at === -1) {
    return queue;
  }
  const held = new Set(queue.trackIds);
  const fresh: string[] = [];
  (queue.isShuffled ? trackIds : trackIds.slice(at + 1)).forEach((id) => {
    if (!held.has(id)) {
      held.add(id);
      fresh.push(id);
    }
  });
  if (fresh.length === 0) {
    return queue;
  }
  const order = [...queue.order];
  let end = order.length;
  while (
    end > queue.position + 1 &&
    isGuess(queue.trackIds[order[end - 1] ?? -1] ?? '')
  ) {
    end -= 1;
  }
  fresh.forEach((_, offset) => {
    const place = queue.isShuffled
      ? queue.position + 1 + Math.floor(random() * (end - queue.position))
      : end;
    order.splice(place, 0, queue.trackIds.length + offset);
    end += 1;
  });
  return { ...queue, trackIds: [...queue.trackIds, ...fresh], order };
};

/** True once `position` is on the last entry of `order`, empty queue included. */
export const queueAtEnd = (queue: ILibraryQueue): boolean =>
  queue.position >= queue.order.length - 1;

/**
 * Moves `position` by one step.
 *
 * `repeat: 'all'` wraps past either edge; `repeat: 'off'` holds at the edge it
 * reached, the way a player that has nothing queued next just stops.
 *
 * REPEAT-ONE USED TO HOLD POSITION HERE, FOR EITHER DIRECTION, and that made
 * Next and Previous do nothing — except that they still handed back a new
 * queue object, so the track re-cued and started over. Both buttons restarted
 * the song, at any position, and it looked like a transport bug rather than a
 * repeat-mode one.
 *
 * Repeat-one says what happens when a track ENDS, not what the skip buttons
 * mean; no player disables Next because a song is set to loop. The end path
 * never needed this either — `handleEnded` returns early on repeat-one and
 * restarts the element directly, and the natural-crossfade effect bails on it
 * too, so neither reaches this function. The clause only ever changed the
 * behaviour of a button press.
 */
export const advanceQueue = (
  queue: ILibraryQueue,
  direction: 1 | -1,
): ILibraryQueue => {
  if (queue.order.length === 0) {
    return { ...queue };
  }
  const last = queue.order.length - 1;
  const next = queue.position + direction;
  if (next >= 0 && next <= last) {
    return { ...queue, position: next };
  }
  if (queue.repeat === 'all') {
    return { ...queue, position: next < 0 ? last : 0 };
  }
  return { ...queue, position: next < 0 ? 0 : last };
};

/**
 * Drops `trackId` from the queue, wherever it sits. Removing the track
 * that is currently playing lands on whatever now occupies its old slot in
 * `order`; removing the last track leaves `currentTrackId` undefined
 * rather than throwing — a rescan can delete the file mid-playback.
 */
export const removeFromQueue = (
  queue: ILibraryQueue,
  trackId: string,
): ILibraryQueue => {
  const removedIndex = queue.trackIds.indexOf(trackId);
  if (removedIndex === -1) {
    return { ...queue };
  }
  const remap = (index: number): number =>
    index > removedIndex ? index - 1 : index;
  const trackIds = queue.trackIds.filter((_, index) => index !== removedIndex);
  const order = queue.order
    .filter((index) => index !== removedIndex)
    .map(remap);

  const playing = currentTrackId(queue);
  let position: number;
  if (playing === trackId) {
    // Its slot in `order` is gone; clamp for the case it was the last one.
    position = Math.max(0, Math.min(queue.position, order.length - 1));
  } else if (playing === undefined) {
    position = 0;
  } else {
    const playingIndex = remap(queue.trackIds.indexOf(playing));
    const found = order.indexOf(playingIndex);
    position = found === -1 ? 0 : found;
  }

  return { ...queue, trackIds, order, position };
};
