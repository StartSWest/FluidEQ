/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILibraryQueue } from '../../../common/library/queue';
import {
  AWAY_FROM_SURPRISES,
  RECENT_SURPRISES,
  picksAhead,
  rememberSurprise,
  surpriseQueue,
  surpriseRequest,
} from '../../../renderer/library/player/surpriseRules';

/** A record playing at its second song, with two picks added after it. */
const queue: ILibraryQueue = {
  trackIds: ['a1', 'a2', 'a3', 'p1', 'p2'],
  order: [0, 1, 2, 3, 4],
  position: 1,
  repeat: 'off',
  isShuffled: false,
};
const picks = new Set(['p1', 'p2', 'a1']);

describe('what Surprise me asks for', () => {
  it('moves away from the song playing and the last surprises, and skips all it has heard or holds', () => {
    const request = surpriseRequest(queue, ['old1', 'a1'], ['s1', 's2', 's3']);
    expect(request.playing).toBe('a2');
    expect(request.awayFrom).toEqual(['a2', 's2', 's3']);
    expect(AWAY_FROM_SURPRISES).toBe(2);
    expect([...request.exclude].sort()).toEqual(
      ['a1', 'a2', 'a3', 'old1', 'p1', 'p2', 's1', 's2', 's3'].sort(),
    );
  });

  it('asks with no song playing when nothing is queued', () => {
    const request = surpriseRequest(undefined, [], ['s1']);
    expect(request).toEqual({ awayFrom: ['s1'], exclude: ['s1'] });
    expect('playing' in request).toBe(false);
  });
});

describe('what a surprise keeps', () => {
  it('keeps only the picks still ahead, in their order', () => {
    // a1 was picked but has played; a3 is the record, not a pick.
    expect(picksAhead(queue, (id) => picks.has(id))).toEqual(['p1', 'p2']);
    expect(picksAhead(undefined, () => true)).toEqual([]);
  });

  it('puts the picks behind the surprise in their order, even shuffled', () => {
    const built: ILibraryQueue = {
      trackIds: ['z'],
      order: [0],
      position: 0,
      repeat: 'off',
      isShuffled: true,
    };
    const next = surpriseQueue(built, ['p2', 'p1', 'z', 'p2']);
    expect(next.trackIds).toEqual(['z', 'p2', 'p1']);
    expect(next.order).toEqual([0, 1, 2]);
    expect(next.position).toBe(0);
    expect(next.isShuffled).toBe(true);
  });

  it('turns Repeat all off, and leaves Repeat one and off as they are', () => {
    const built: ILibraryQueue = {
      trackIds: ['z'],
      order: [0],
      position: 0,
      repeat: 'all',
      isShuffled: false,
    };
    expect(surpriseQueue(built, []).repeat).toBe('off');
    expect(surpriseQueue({ ...built, repeat: 'one' }, []).repeat).toBe('one');
    expect(surpriseQueue({ ...built, repeat: 'off' }, []).repeat).toBe('off');
  });
});

describe('what is remembered', () => {
  it('keeps each surprise once, newest last, the last fifty', () => {
    expect(rememberSurprise(['a', 'b', 'c'], 'b')).toEqual(['a', 'c', 'b']);
    const many = Array.from({ length: RECENT_SURPRISES }, (_, at) => `s${at}`);
    const next = rememberSurprise(many, 'new');
    expect(next).toHaveLength(RECENT_SURPRISES);
    expect(next[0]).toBe('s1');
    expect(next[next.length - 1]).toBe('new');
  });
});
