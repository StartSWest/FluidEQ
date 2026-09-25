/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library's session as it is kept across a restart. Taking a song out of
 * Up Next shortens the play order and leaves the list of ids as it was, and
 * the reader refused any session whose two lengths differed: every queue a
 * song had been taken out of came back as nothing at the next launch.
 */

import type { ILibraryQueue } from '../../../common/library/queue';
import {
  readPlaybackMemory,
  writePlaybackMemory,
} from '../../../renderer/library/player/playbackMemory';

const queue = (overrides: Partial<ILibraryQueue> = {}): ILibraryQueue => ({
  trackIds: ['a', 'b', 'c', 'd'],
  order: [0, 1, 2, 3],
  position: 1,
  repeat: 'off',
  isShuffled: false,
  ...overrides,
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("the Library's session across a restart", () => {
  it('comes back after a song was taken out of Up Next', () => {
    // c taken out: the order is one shorter than the ids.
    writePlaybackMemory(queue({ order: [0, 1, 3] }), 12_000);
    expect(readPlaybackMemory()).toMatchObject({
      trackIds: ['a', 'b', 'c', 'd'],
      order: [0, 1, 3],
      position: 1,
      positionMs: 12_000,
    });
  });

  it('keeps the list the queue was aimed at', () => {
    writePlaybackMemory(queue({ source: 'songs' }), 0);
    expect(readPlaybackMemory()?.source).toBe('songs');
    writePlaybackMemory(queue(), 0);
    expect(readPlaybackMemory()).not.toHaveProperty('source');
  });

  // The control: the range check the length check stood beside still refuses
  // an index that would read past the end of the queue.
  it('still refuses an order that points past the ids', () => {
    window.localStorage.setItem(
      'fluideq.library.playback',
      JSON.stringify({ ...queue(), order: [0, 1, 9], positionMs: 0 }),
    );
    expect(readPlaybackMemory()).toBeUndefined();
  });
});
