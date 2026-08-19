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

import {
  advanceQueue,
  buildQueue,
  currentTrackId,
  queueAtEnd,
  removeFromQueue,
  setShuffle,
} from '../../../common/library/queue';

const ids = ['a', 'b', 'c', 'd'];

describe('the play queue', () => {
  it('starts on the track that was double-clicked, not the first one', () => {
    expect(currentTrackId(buildQueue(ids, 'c', false))).toBe('c');
  });

  it('walks forward and back', () => {
    let queue = buildQueue(ids, 'a', false);
    queue = advanceQueue(queue, 1);
    expect(currentTrackId(queue)).toBe('b');
    queue = advanceQueue(queue, -1);
    expect(currentTrackId(queue)).toBe('a');
  });

  it('stops at the end with repeat off, and wraps with repeat all', () => {
    const last = { ...buildQueue(ids, 'd', false), repeat: 'off' as const };
    expect(queueAtEnd(last)).toBe(true);
    expect(currentTrackId(advanceQueue(last, 1))).toBe('d');
    const looping = { ...last, repeat: 'all' as const };
    expect(currentTrackId(advanceQueue(looping, 1))).toBe('a');
  });

  it('stays put on repeat one', () => {
    const queue = { ...buildQueue(ids, 'b', false), repeat: 'one' as const };
    expect(currentTrackId(advanceQueue(queue, 1))).toBe('b');
  });

  it('keeps playing the same track when shuffle is switched on', () => {
    // Shuffle reorders what comes next. Interrupting the song somebody is
    // listening to is not what the button says it does.
    const queue = buildQueue(ids, 'c', false);
    const shuffled = setShuffle(queue, true);
    expect(currentTrackId(shuffled)).toBe('c');
    expect(shuffled.order).toHaveLength(ids.length);
    expect([...shuffled.order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('drops a removed track without losing its place', () => {
    const queue = buildQueue(ids, 'c', false);
    const shorter = removeFromQueue(queue, 'a');
    expect(currentTrackId(shorter)).toBe('c');
    expect(shorter.trackIds).toEqual(['b', 'c', 'd']);
  });

  it('survives the queue emptying under it', () => {
    let queue = buildQueue(['a'], 'a', false);
    queue = removeFromQueue(queue, 'a');
    expect(currentTrackId(queue)).toBeUndefined();
    expect(currentTrackId(advanceQueue(queue, 1))).toBeUndefined();
  });
});

describe('edges the brief names but does not spell out', () => {
  it('has no current track and does not throw when built from an empty list', () => {
    const queue = buildQueue([], 'a', false);
    expect(currentTrackId(queue)).toBeUndefined();
    expect(() => advanceQueue(queue, 1)).not.toThrow();
    expect(currentTrackId(advanceQueue(queue, 1))).toBeUndefined();
    // Pinned separately from the `currentTrackId` check above: that helper
    // reports `undefined` for *any* out-of-range `position`, so it cannot
    // tell -1 apart from the 0 an empty `order` is supposed to hold `position`
    // at. Without the `order.length === 0` guard in `advanceQueue`, this path
    // — reachable only by advancing a queue built from an empty list, never
    // through `removeFromQueue` — lands `position` at -1, breaking the
    // documented invariant that `position` always indexes `order`.
    expect(advanceQueue(queue, 1).position).toBe(0);
  });

  it('falls back to the first track when startTrackId is not in the list', () => {
    const queue = buildQueue(ids, 'zzz', false);
    expect(currentTrackId(queue)).toBe('a');
  });

  it('holds a single-track queue still, forward and back, under every repeat mode', () => {
    const single = buildQueue(['a'], 'a', false);
    (['off', 'all', 'one'] as const).forEach((repeat) => {
      const queue = { ...single, repeat };
      expect(currentTrackId(advanceQueue(queue, 1))).toBe('a');
      expect(currentTrackId(advanceQueue(queue, -1))).toBe('a');
    });
  });

  it('is a no-op removing a track that is not in the queue', () => {
    const queue = buildQueue(ids, 'b', false);
    const unchanged = removeFromQueue(queue, 'zzz');
    expect(unchanged.trackIds).toEqual(queue.trackIds);
    expect(unchanged.order).toEqual(queue.order);
    expect(unchanged.position).toBe(queue.position);
  });

  it('advances to what now sits in its place when the playing track is removed', () => {
    const queue = buildQueue(ids, 'b', false);
    const after = removeFromQueue(queue, 'b');
    expect(after.trackIds).toEqual(['a', 'c', 'd']);
    expect(currentTrackId(after)).toBe('c');
  });

  it('falls back to the new last track when the removed track was playing and last', () => {
    const queue = buildQueue(ids, 'd', false);
    const after = removeFromQueue(queue, 'd');
    expect(after.trackIds).toEqual(['a', 'b', 'c']);
    expect(currentTrackId(after)).toBe('c');
  });

  it('does not re-shuffle when shuffle is switched on a second time', () => {
    const queue = buildQueue(ids, 'c', false);
    const first = setShuffle(queue, true);
    const randomSpy = jest.spyOn(Math, 'random');
    const second = setShuffle(first, true);
    expect(randomSpy).not.toHaveBeenCalled();
    expect(second.order).toEqual(first.order);
    expect(second.position).toBe(first.position);
    randomSpy.mockRestore();
  });

  it('never mutates the queue it was given', () => {
    const queue = buildQueue(ids, 'a', false);
    const before = JSON.parse(JSON.stringify(queue));
    advanceQueue(queue, 1);
    setShuffle(queue, true);
    removeFromQueue(queue, 'b');
    expect(queue).toEqual(before);
  });
});
