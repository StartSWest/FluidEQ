/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Up Next may hold, as rules on the play order.
 *
 * Three of them, each one Ivan's (2026-10-25: "needs to add to the bottom
 * and make sure it doesn't duplicate and also no showing more random things
 * below the last one, only when a song reaches its last position it shows
 * more similar things to play as a different section"):
 *
 * - Songs added go to the END of what the listener has queued, in the order
 *   given.
 * - No song stands twice in what is coming, the song playing included.
 * - What continuation draws ("More like this") comes after the last song the
 *   listener queued, and only once that song is playing: while any song of
 *   theirs is still ahead, nothing of continuation's is.
 *
 * Pure, so each rule is held by a test rather than by a panel somebody has
 * to read.
 */
import {
  ILibraryQueue,
  currentTrackId,
  extendQueue,
} from '../../../common/library/queue';

/** Each id once, at its first place. */
export const uniqueTrackIds = (trackIds: readonly string[]): string[] => [
  ...new Set(trackIds),
];

/**
 * The play order without continuation's draws still ahead of the playhead.
 *
 * Those draws are what plays once the listener's own songs have run out, so
 * the moment any of theirs is ahead again they are answering a question
 * nobody is asking yet; they are drawn again when the last song is reached.
 * Only `order` changes: an id nothing points at costs a string, and the
 * draws stay out of continuation's next ask, which excludes everything the
 * queue holds. The song playing stays even when it was drawn. Answers
 * `queue` itself when nothing is dropped.
 */
export const dropGuessesAhead = (
  queue: ILibraryQueue,
  isGuess: (trackId: string) => boolean,
): ILibraryQueue => {
  const order = queue.order.filter(
    (index, at) =>
      at <= queue.position || !isGuess(queue.trackIds[index] ?? ''),
  );
  return order.length === queue.order.length ? queue : { ...queue, order };
};

/**
 * The play order after the playhead has moved: continuation's draws go if a
 * song of the listener's is ahead again — Previous, or a press on an earlier
 * row in Up Next — and are drawn afresh when the last song is reached.
 */
export const settleGuesses = (
  queue: ILibraryQueue,
  isGuess: (trackId: string) => boolean,
): ILibraryQueue =>
  queue.order
    .slice(queue.position + 1)
    .some((index) => !isGuess(queue.trackIds[index] ?? ''))
    ? dropGuessesAhead(queue, isGuess)
    : queue;

/**
 * The song playing and the listener's own songs ahead of it — what a song
 * added is checked against. Continuation's draws ahead are not in it: they
 * are dropped when anything is added.
 */
export const idsStillComing = (
  queue: ILibraryQueue,
  isGuess: (trackId: string) => boolean,
): Set<string> =>
  new Set(
    queue.order
      .slice(queue.position)
      .map((index) => queue.trackIds[index])
      .filter(
        (id, at): id is string =>
          id !== undefined && (at === 0 || !isGuess(id)),
      ),
  );

/**
 * "Add to up next": the songs join the end, never twice.
 *
 * It used to splice them in right after the song playing, ahead of the rest
 * of the record, and to look for a song already queued only BEYOND the songs
 * added before — so adding the same playlist twice queued every song of it
 * twice, and a playlist holding the song playing queued that song again
 * (Ivan, 2026-10-25). The contract always said "at the end of what is
 * already queued ... left where they are rather than duplicated"; this is the
 * body agreeing with it.
 *
 * A song already playing or ahead stays where it stands; one that has played
 * comes round again, because it is no longer in what is coming. Continuation's
 * draws ahead are dropped first (`dropGuessesAhead`), so the songs land after
 * the listener's own and nothing of continuation's stands between them.
 * Answers `queue` itself when nothing joins.
 */
export const appendToEnd = (
  queue: ILibraryQueue,
  trackIds: readonly string[],
  isGuess: (trackId: string) => boolean,
): ILibraryQueue => {
  const kept = dropGuessesAhead(queue, isGuess);
  const coming = idsStillComing(queue, isGuess);
  const joining = uniqueTrackIds(trackIds).filter((id) => !coming.has(id));
  if (joining.length === 0) {
    return kept;
  }
  // A song the order no longer points at — a draw just dropped, a song taken
  // out — takes its old slot back rather than a second copy of its id, which
  // `setShuffle` and `removeFromQueue` would read as one song in two places.
  const pointedAt = new Set(kept.order);
  const nextTrackIds = [...kept.trackIds];
  const order = [...kept.order];
  joining.forEach((id) => {
    const free = nextTrackIds.findIndex(
      (existing, index) => existing === id && !pointedAt.has(index),
    );
    if (free !== -1) {
      pointedAt.add(free);
      order.push(free);
      return;
    }
    nextTrackIds.push(id);
    order.push(nextTrackIds.length - 1);
  });
  return { ...kept, trackIds: nextTrackIds, order };
};

/**
 * The list the queue plays, asked for again as it moves on, topping it up.
 *
 * `extendQueue` adds the songs of a longer list the queue has never held, and
 * once it has, continuation's draws ahead are dropped for the reason above.
 */
export const topUpQueue = (
  queue: ILibraryQueue,
  trackIds: readonly string[],
  isGuess: (trackId: string) => boolean,
): ILibraryQueue => {
  const extended = extendQueue(queue, trackIds, isGuess);
  return extended === queue ? queue : dropGuessesAhead(extended, isGuess);
};

/**
 * Whether the song playing is the last of the play order — the one moment
 * continuation draws (Ivan: "only when a song reaches its last position").
 * An empty order has nothing playing and draws nothing.
 */
export const isOnLastSong = (queue: ILibraryQueue): boolean =>
  currentTrackId(queue) !== undefined &&
  queue.position === queue.order.length - 1;
