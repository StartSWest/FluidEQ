/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The levels the engine learned for each song, kept so a song heard before is
 * levelled from its first second the next time it plays.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  MIN_LEARNED_SECONDS,
  SONG_LEVELS_FILENAME,
  SONG_LEVELS_LIMIT,
  createSongLevelStore,
} from 'main/songLevels';

const song = (id: string, levelLufs: number, seconds = 120, peakDb = -1) => ({
  id,
  levelLufs,
  peakDb,
  seconds,
});

describe('song levels', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-levels-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('remembers a song across launches', () => {
    expect(
      createSongLevelStore(directory).record(song('00000000000a11ce', -12)),
    ).toBe(true);
    expect(
      createSongLevelStore(directory).lookup('00000000000a11ce'),
    ).toMatchObject({
      levelLufs: -12,
      peakDb: -1,
      seconds: 120,
    });
  });

  it('does not learn a level from a song heard only for its opening', () => {
    const store = createSongLevelStore(directory);
    expect(
      store.record(song('00000000000a11ce', -30, MIN_LEARNED_SECONDS - 1)),
    ).toBe(false);
    expect(store.lookup('00000000000a11ce')).toBeUndefined();
    // Positive control: the same report, long enough, is kept.
    expect(
      store.record(song('00000000000a11ce', -30, MIN_LEARNED_SECONDS)),
    ).toBe(true);
    expect(store.lookup('00000000000a11ce')?.levelLufs).toBe(-30);
  });

  it('keeps the loudest level any play heard', () => {
    const store = createSongLevelStore(directory);
    store.record(song('00000000000a11ce', -12, 200, -0.5));
    store.record(song('00000000000a11ce', -20, 40, -3));
    expect(store.lookup('00000000000a11ce')).toMatchObject({
      levelLufs: -12,
      peakDb: -0.5,
      seconds: 200,
    });
    store.record(song('00000000000a11ce', -10, 60, -0.2));
    expect(store.lookup('00000000000a11ce')?.levelLufs).toBe(-10);
  });

  it('forgets the least recently heard songs beyond the limit', () => {
    let clock = 0;
    const store = createSongLevelStore(directory, () => {
      clock += 1;
      return clock;
    });
    const id = (n: number) => n.toString(16).padStart(16, '0');
    for (let n = 1; n <= SONG_LEVELS_LIMIT + 2; n += 1) {
      store.record(song(id(n), -14));
    }
    const reopened = createSongLevelStore(directory);
    expect(reopened.lookup(id(1))).toBeUndefined();
    expect(reopened.lookup(id(2))).toBeUndefined();
    expect(reopened.lookup(id(3))).toBeDefined();
    expect(reopened.lookup(id(SONG_LEVELS_LIMIT + 2))).toBeDefined();
  });

  it.each([
    ['a file that is not JSON', 'not json'],
    ['another version', JSON.stringify({ version: 2, songs: {} })],
  ])('starts empty from %s', (_label, text) => {
    fs.writeFileSync(path.join(directory, SONG_LEVELS_FILENAME), text);
    const store = createSongLevelStore(directory);
    expect(store.lookup('00000000000a11ce')).toBeUndefined();
    expect(store.record(song('00000000000a11ce', -12))).toBe(true);
  });

  it('skips an entry that is malformed, and keeps the rest', () => {
    fs.writeFileSync(
      path.join(directory, SONG_LEVELS_FILENAME),
      JSON.stringify({
        version: 1,
        songs: {
          '00000000000a11ce': {
            levelLufs: -12,
            peakDb: -1,
            seconds: 90,
            heardAt: 1,
          },
          'not-an-id': { levelLufs: -12, peakDb: -1, seconds: 90, heardAt: 1 },
          '0000000000000b0b': {
            levelLufs: 'loud',
            peakDb: -1,
            seconds: 90,
            heardAt: 1,
          },
        },
      }),
    );
    const store = createSongLevelStore(directory);
    expect(store.lookup('00000000000a11ce')?.levelLufs).toBe(-12);
    expect(store.lookup('0000000000000b0b')).toBeUndefined();
  });
});
