/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library's session as the core keeps it across a restart
 * (`common/library/playbackMemory.ts`). Taking a song out of Up Next
 * shortens the play order and leaves the list of ids as it was, and a reader
 * that refused any session whose two lengths differed brought every such
 * queue back as nothing.
 */
import type { ILibraryQueue } from '../../../common/library/queue';
import {
  parseContinuationSwitch,
  parsePlaybackMemory,
  playbackMemoryOf,
  restorablePositionMs,
  restoreSession,
} from '../../../common/library/playbackMemory';

const queue = (overrides: Partial<ILibraryQueue> = {}): ILibraryQueue => ({
  trackIds: ['a', 'b', 'c', 'd'],
  order: [0, 1, 2, 3],
  position: 1,
  repeat: 'off',
  isShuffled: false,
  ...overrides,
});

/** Written and read back, as through the file. */
const roundTrip = (stored: ILibraryQueue, positionMs: number) =>
  parsePlaybackMemory(
    JSON.parse(JSON.stringify(playbackMemoryOf(stored, positionMs))),
  );

describe("the Library's session across a restart", () => {
  it('comes back after a song was taken out of Up Next', () => {
    expect(roundTrip(queue({ order: [0, 1, 3] }), 12_000)).toMatchObject({
      trackIds: ['a', 'b', 'c', 'd'],
      order: [0, 1, 3],
      position: 1,
      positionMs: 12_000,
    });
  });

  it('keeps the list the queue was aimed at', () => {
    expect(roundTrip(queue({ source: 'songs' }), 0)?.source).toBe('songs');
    expect(roundTrip(queue(), 0)).not.toHaveProperty('source');
  });

  // The control: the range check still refuses an index that would read past
  // the end of the queue.
  it('still refuses an order that points past the ids', () => {
    expect(
      parsePlaybackMemory({ ...queue(), order: [0, 1, 9], positionMs: 0 }),
    ).toBeUndefined();
    // One past the last id is past it too.
    expect(
      parsePlaybackMemory({ ...queue(), order: [0, 1, 4], positionMs: 0 }),
    ).toBeUndefined();
    expect(
      parsePlaybackMemory({ ...queue(), order: [0, 1, 3], positionMs: 0 }),
    ).toBeDefined();
  });

  it('refuses a playhead outside the order, and anything not a session', () => {
    expect(parsePlaybackMemory({ ...queue(), position: 4 })).toBeUndefined();
    expect(parsePlaybackMemory({ ...queue(), trackIds: [] })).toBeUndefined();
    expect(parsePlaybackMemory('a queue')).toBeUndefined();
    expect(parsePlaybackMemory(null)).toBeUndefined();
  });

  it('keeps nothing for an empty player', () => {
    expect(playbackMemoryOf(undefined, 5_000)).toBeUndefined();
    expect(
      playbackMemoryOf(queue({ trackIds: [], order: [] }), 0),
    ).toBeUndefined();
  });
});

describe('the session rebuilt from what the library still has', () => {
  const all = new Map<string, number | undefined>([
    ['a', 200_000],
    ['b', 200_000],
    ['c', 200_000],
    ['d', 200_000],
  ]);

  it('puts the playhead back on its song, cued where it was', () => {
    const memory = roundTrip(queue(), 40_000);
    const restored = memory ? restoreSession(memory, all) : undefined;
    expect(restored?.trackId).toBe('b');
    expect(restored?.positionMs).toBe(40_000);
    expect(restored?.queue.order).toEqual([0, 1, 2, 3]);
  });

  it('keeps the rest of the queue when one song is gone, in its order', () => {
    const memory = roundTrip(queue({ position: 2 }), 40_000);
    const without = new Map(all);
    without.delete('b');
    const restored = memory ? restoreSession(memory, without) : undefined;
    expect(restored?.queue.trackIds).toEqual(['a', 'c', 'd']);
    expect(restored?.trackId).toBe('c');
  });

  it('moves the playhead on to the next song still there', () => {
    const memory = roundTrip(queue(), 40_000);
    const without = new Map(all);
    without.delete('b');
    const restored = memory ? restoreSession(memory, without) : undefined;
    expect(restored?.trackId).toBe('c');
  });

  it('remembers songs taken out of Up Next, so a top-up does not bring them back', () => {
    const memory = roundTrip(queue({ order: [0, 1, 3] }), 0);
    const restored = memory ? restoreSession(memory, all) : undefined;
    expect(restored?.queue.trackIds).toEqual(['a', 'b', 'd', 'c']);
    expect(restored?.queue.order).toEqual([0, 1, 2]);
  });

  it('comes back as nothing when none of its songs are left', () => {
    const memory = roundTrip(queue(), 0);
    expect(memory ? restoreSession(memory, new Map()) : 'none').toBeUndefined();
  });
});

describe('where a song is resumed', () => {
  it('starts again from the top for the first five seconds', () => {
    expect(restorablePositionMs(4_999, 200_000)).toBeUndefined();
    expect(restorablePositionMs(5_000, 200_000)).toBe(5_000);
  });

  it('does not resume into the last five seconds of a song', () => {
    expect(restorablePositionMs(196_000, 200_000)).toBeUndefined();
    expect(restorablePositionMs(195_000, 200_000)).toBe(195_000);
  });

  it('resumes a song whose length is not known yet', () => {
    expect(restorablePositionMs(60_000, undefined)).toBe(60_000);
  });
});

describe('Keep playing, as stored', () => {
  it('is on unless it was explicitly switched off', () => {
    expect(parseContinuationSwitch(undefined)).toBe(true);
    expect(parseContinuationSwitch('garbled')).toBe(true);
    expect(parseContinuationSwitch(true)).toBe(true);
    expect(parseContinuationSwitch(false)).toBe(false);
    // The window's old storage wrote the word.
    expect(parseContinuationSwitch('off')).toBe(false);
  });
});
