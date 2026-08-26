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

import { ILibraryTrack } from '../../../common/library/types';
import { pickContinuation } from '../../../common/library/continuation';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'root',
  path: `C:\\Music\\${over.title ?? 'id'}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

/** Pinned, so a draw can be asserted rather than merely counted. */
const firstAlways = () => 0;

const NOTHING_EXCLUDED: ReadonlySet<string> = new Set<string>();

describe('what plays when the shelf runs out', () => {
  const seed = track({ title: 'seed', genre: 'Rock', artist: 'One' });

  it('draws only tracks sharing a genre with the one playing', () => {
    const picked = pickContinuation(
      [
        seed,
        track({ title: 'rock', genre: 'Rock', artist: 'Two' }),
        track({ title: 'jazz', genre: 'Jazz', artist: 'Three' }),
      ],
      seed,
      NOTHING_EXCLUDED,
      10,
      firstAlways,
    );
    expect(picked).toEqual(['rock']);
  });

  it('matches a cross-tagged track on either of its genres', () => {
    const picked = pickContinuation(
      [seed, track({ title: 'both', genre: 'Pop; Rock', artist: 'Two' })],
      seed,
      NOTHING_EXCLUDED,
      10,
      firstAlways,
    );
    expect(picked).toEqual(['both']);
  });

  it('never draws the track that is playing', () => {
    const picked = pickContinuation([seed], seed, NOTHING_EXCLUDED, 10);
    expect(picked).toEqual([]);
  });

  it('skips anything already queued or already heard', () => {
    const picked = pickContinuation(
      [
        seed,
        track({ title: 'queued', genre: 'Rock', artist: 'Two' }),
        track({ title: 'heard', genre: 'Rock', artist: 'Three' }),
        track({ title: 'fresh', genre: 'Rock', artist: 'Four' }),
      ],
      seed,
      new Set(['queued', 'heard']),
      10,
      firstAlways,
    );
    expect(picked).toEqual(['fresh']);
  });

  it('leaves video and undecodable files alone', () => {
    // A film starting itself is not what "keep the music going" means, and an
    // unplayable file would queue a track that can only report that it will
    // not play.
    const picked = pickContinuation(
      [
        seed,
        track({ title: 'film', genre: 'Rock', kind: 'video' }),
        track({ title: 'broken', genre: 'Rock', isPlayable: false }),
      ],
      seed,
      NOTHING_EXCLUDED,
      10,
      firstAlways,
    );
    expect(picked).toEqual([]);
  });

  it('never draws more than it was asked for', () => {
    const pool = ['a', 'b', 'c', 'd'].map((title) =>
      track({ title, genre: 'Rock', artist: title }),
    );
    expect(
      pickContinuation([seed, ...pool], seed, NOTHING_EXCLUDED, 2),
    ).toHaveLength(2);
  });

  it('falls back to the same artist when the playing track has no genre', () => {
    // "Everything else nobody tagged" is not a resemblance — on most
    // libraries it is half the collection, and the continuation would be a
    // library-wide shuffle wearing a genre's name.
    const untagged = track({ title: 'seed', artist: 'One' });
    const picked = pickContinuation(
      [
        untagged,
        track({ title: 'same-band', artist: 'One' }),
        track({ title: 'other-band', artist: 'Two' }),
        track({ title: 'also-untagged', artist: 'Three' }),
      ],
      untagged,
      NOTHING_EXCLUDED,
      10,
      firstAlways,
    );
    expect(picked).toEqual(['same-band']);
  });

  it('stops rather than pretending when there is nothing to go on', () => {
    const nameless = track({ title: 'seed' });
    expect(
      pickContinuation(
        [nameless, track({ title: 'stranger' })],
        nameless,
        NOTHING_EXCLUDED,
        10,
      ),
    ).toEqual([]);
  });

  it('stops once the genre has been heard through, rather than repeating it', () => {
    const picked = pickContinuation(
      [seed, track({ title: 'heard', genre: 'Rock', artist: 'Two' })],
      seed,
      new Set(['heard']),
      10,
    );
    expect(picked).toEqual([]);
  });

  it('shuffles rather than walking the library in order', () => {
    // The positive control the assertions above need: every one of them
    // would still pass if this returned the pool untouched, and a
    // continuation that always played the same songs in the same order is
    // the bug nobody would think to look for.
    const pool = Array.from({ length: 8 }, (_, index) =>
      track({ title: `t${index}`, genre: 'Rock', artist: `a${index}` }),
    );
    const inOrder = pool.map((entry) => entry.id);
    // `firstAlways` and NOT a generator near 1, which was the first attempt
    // here and passed against a shuffle that does nothing: Fisher-Yates picks
    // `j` in `[0, i]`, so a generator returning ~1 always chooses `j === i`
    // and every swap is an element with itself. The identity permutation is
    // the one draw a broken shuffle and a working one agree on.
    expect(
      pickContinuation([seed, ...pool], seed, NOTHING_EXCLUDED, 8, firstAlways),
    ).not.toEqual(inOrder);
  });
});
