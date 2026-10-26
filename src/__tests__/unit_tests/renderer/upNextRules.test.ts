/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryQueue } from '../../../common/library/queue';
import {
  appendToEnd,
  dropGuessesAhead,
  idsStillComing,
  isOnLastSong,
  settleGuesses,
  topUpQueue,
  uniqueTrackIds,
} from '../../../renderer/library/player/upNextRules';

/**
 * What Up Next may hold (Ivan, 2026-10-25): songs added go to the end, no
 * song stands twice in what is coming, and Keep playing's draws come only
 * once the last song queued is playing.
 */
const queueOf = (
  trackIds: readonly string[],
  position: number,
  order: readonly number[] = trackIds.map((_, index) => index),
): ILibraryQueue => ({
  trackIds,
  order,
  position,
  repeat: 'off',
  isShuffled: false,
});

/** The ids from the song playing onwards, the song playing first. */
const fromPlaying = (queue: ILibraryQueue) =>
  queue.order.slice(queue.position).map((index) => queue.trackIds[index]);

const guesses = (...ids: string[]) => {
  const set = new Set(ids);
  return (id: string) => set.has(id);
};
const noGuesses = () => false;

describe('adding to Up next', () => {
  it('puts the songs at the end, in the order given', () => {
    const queue = queueOf(['a', 'b', 'c'], 0);
    const next = appendToEnd(queue, ['x', 'y'], noGuesses);
    expect(fromPlaying(next)).toEqual(['a', 'b', 'c', 'x', 'y']);
  });

  it('never adds a song that is playing or already coming', () => {
    const queue = queueOf(['a', 'b', 'c'], 0);
    const next = appendToEnd(queue, ['a', 'c', 'x', 'x', 'b'], noGuesses);
    expect(fromPlaying(next)).toEqual(['a', 'b', 'c', 'x']);
  });

  it('answers the same queue when nothing joins, so nothing redraws', () => {
    const queue = queueOf(['a', 'b', 'c'], 0);
    expect(appendToEnd(queue, ['b', 'c'], noGuesses)).toBe(queue);
  });

  it('brings a song that has already played round again', () => {
    const queue = queueOf(['a', 'b', 'c'], 2);
    const next = appendToEnd(queue, ['a'], noGuesses);
    expect(fromPlaying(next)).toEqual(['c', 'a']);
  });

  it('lands after the listener’s songs, taking Keep playing’s draws away', () => {
    // c is the last song queued and is playing; x and y were drawn for it.
    const queue = queueOf(['a', 'b', 'c', 'x', 'y'], 2);
    const next = appendToEnd(queue, ['z'], guesses('x', 'y'));
    expect(fromPlaying(next)).toEqual(['c', 'z']);
  });

  it('adds a song Keep playing had drawn as the listener’s own, once', () => {
    const queue = queueOf(['a', 'b', 'x', 'y'], 1);
    const next = appendToEnd(queue, ['y'], guesses('x', 'y'));
    expect(fromPlaying(next)).toEqual(['b', 'y']);
    // Its old slot taken back rather than a second copy of its id.
    expect(next.trackIds.filter((id) => id === 'y')).toHaveLength(1);
  });
});

describe('Keep playing’s draws', () => {
  it('go when the playhead is back on the listener’s songs', () => {
    const queue = queueOf(['a', 'b', 'c', 'x', 'y'], 0);
    expect(fromPlaying(settleGuesses(queue, guesses('x', 'y')))).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('stay while nothing of the listener’s is ahead', () => {
    // Playing the last song queued, and playing a draw.
    const last = queueOf(['a', 'b', 'c', 'x', 'y'], 2);
    expect(settleGuesses(last, guesses('x', 'y'))).toBe(last);
    const drawn = queueOf(['a', 'b', 'c', 'x', 'y'], 3);
    expect(settleGuesses(drawn, guesses('x', 'y'))).toBe(drawn);
  });

  it('keep the draw that is playing when the rest are dropped', () => {
    const queue = queueOf(['a', 'x', 'y'], 1);
    expect(fromPlaying(dropGuessesAhead(queue, guesses('x', 'y')))).toEqual([
      'x',
    ]);
  });

  it('go when the list the queue plays brings more songs', () => {
    const queue = queueOf(['a', 'b', 'x'], 0);
    const next = topUpQueue(queue, ['a', 'b', 'c'], guesses('x'));
    expect(fromPlaying(next)).toEqual(['a', 'b', 'c']);
  });

  it('stay when the list brings nothing new', () => {
    const queue = queueOf(['a', 'b', 'x'], 1);
    expect(topUpQueue(queue, ['a', 'b'], guesses('x'))).toBe(queue);
  });

  it('are drawn only on the last song of the play order', () => {
    expect(isOnLastSong(queueOf(['a', 'b', 'c'], 2))).toBe(true);
    expect(isOnLastSong(queueOf(['a', 'b', 'c'], 1))).toBe(false);
    expect(isOnLastSong(queueOf([], 0))).toBe(false);
  });
});

describe('what a song added is checked against', () => {
  it('is the song playing and the listener’s songs ahead, never the draws', () => {
    const queue = queueOf(['a', 'b', 'c', 'x'], 1);
    expect([...idsStillComing(queue, guesses('x'))]).toEqual(['b', 'c']);
  });

  it('takes each id once, at its first place', () => {
    expect(uniqueTrackIds(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c']);
  });
});
