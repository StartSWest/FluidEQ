/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import { ISongSound } from 'common/songSound';
import { isSongSoundChanged, pickCovers } from 'common/songSoundChoices';
import {
  getInitialSongSoundState,
  ISongSoundState,
  reduceSongSound,
  TSongSoundEffect,
  TSongSoundEvent,
} from 'common/songSoundRecorder';

// A sound picked here for the playing song or its album plays at once (Ivan,
// 2026-11-20: "when I play from the lib and select a preset for the album,
// even the current playing song, if that preset applies to it, needs to
// instantly change the preset to the chosen one"), even over a change he made
// since the song began — which a look-up for anything else keeps.

const sound = (presetId: string, gain = 0): ISongSound => ({
  presetId,
  filters: {
    band: {
      id: 'band',
      frequency: 1000,
      gain,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
});
/** The listener's own sound: his main preset, K-pop. */
const own = sound('kPop');
/** The album's Pop over his bands, as `soundToPlay` makes it. */
const albumPop = sound('pop');
const song = (): ISongIdentity => {
  const identity = buildSongIdentity('library', 'girls-1', 'Song', 'Artist');
  if (!identity) {
    throw new Error('the fixture names no song');
  }
  return { ...identity, albumKey: '101 girls night\u001fjessie j' };
};

const run = (
  state: ISongSoundState,
  steps: Array<[number, TSongSoundEvent]>,
): { state: ISongSoundState; effects: TSongSoundEffect[] } => {
  let current = state;
  const effects: TSongSoundEffect[] = [];
  steps.forEach(([now, event]) => {
    const [next, produced] = reduceSongSound(current, event, now);
    current = next;
    effects.push(...produced);
  });
  return { state: current, effects };
};
const applies = (effects: TSongSoundEffect[]) =>
  effects.filter((effect) => effect.kind === 'apply');

/**
 * Album sounds on, Song sounds off (Ivan's switches when he reported it): a
 * song of the album playing its Pop, and then his hand on the preset, back to
 * his own K-pop.
 */
const playingAlbumThenChanged = () => {
  const lent = run(
    {
      ...getInitialSongSoundState({ songs: false, albums: true }),
      deviceId: 'main',
      live: own,
    },
    [
      [0, { kind: 'nowPlaying', identity: song(), isPlaying: true }],
      [
        1,
        {
          kind: 'matched',
          identity: song(),
          album: { sound: { presetId: 'pop' }, title: '101 Girls Night' },
        },
      ],
    ],
  );
  // An apply is answered for the very sound it asked for, by the object.
  const asked = lent.state.pending;
  if (!asked) {
    throw new Error('the album’s sound was not put on');
  }
  return run(lent.state, [
    [2, { kind: 'applied', asked, landed: albumPop }],
    [3, { kind: 'soundChanged', sound: own }],
  ]);
};

describe('Auto EQ song sounds: a pick made here', () => {
  it('starts from a song playing its album’s sound and changed by hand since', () => {
    const { state } = playingAlbumThenChanged();
    expect(state.session?.owner).toBe('album');
    expect(isSongSoundChanged(state)).toBe(true);
  });

  it('plays the album’s sound picked again at once, over the change', () => {
    const { state } = playingAlbumThenChanged();
    const picked = run(state, [[4, { kind: 'picked' }]]);
    expect(picked.effects).toEqual([
      { kind: 'lookup', identity: song(), isPick: true },
    ]);
    const answered = run(picked.state, [
      [
        5,
        {
          kind: 'matched',
          identity: song(),
          album: { sound: { presetId: 'pop' }, title: '101 Girls Night' },
          isPick: true,
        },
      ],
    ]);
    expect(applies(answered.effects)).toEqual([
      { kind: 'apply', sound: albumPop, isLent: true, presetOnly: true },
    ]);
  });

  it('control: the same answer to a look-up that is not a pick keeps the change', () => {
    const { state } = playingAlbumThenChanged();
    const asked = run(state, [
      [4, { kind: 'reconsider' }],
      [
        5,
        {
          kind: 'matched',
          identity: song(),
          album: { sound: { presetId: 'pop' }, title: '101 Girls Night' },
        },
      ],
    ]);
    expect(asked.effects).toContainEqual({ kind: 'lookup', identity: song() });
    expect(applies(asked.effects)).toEqual([]);
    expect(isSongSoundChanged(asked.state)).toBe(true);
  });

  it('with nothing playing, a pick looks nothing up', () => {
    const idle = getInitialSongSoundState({ songs: false, albums: true });
    const [, effects] = reduceSongSound(
      { ...idle, deviceId: 'main', live: own },
      { kind: 'picked' },
      0,
    );
    expect(effects).toEqual([]);
  });
});

describe('Auto EQ song sounds: which songs a pick reaches', () => {
  it('reaches a song picked, and a song of the album set', () => {
    expect(pickCovers(song(), { keys: ['library:other', song().key] })).toBe(
      true,
    );
    expect(
      pickCovers(song(), { albumKey: '101 girls night\u001fjessie j' }),
    ).toBe(true);
  });

  it('control: a pick of other songs, or of another album, does not reach it', () => {
    expect(pickCovers(song(), { keys: ['library:other'] })).toBe(false);
    expect(
      pickCovers(song(), { albumKey: '30 stars\u001fvarious artists' }),
    ).toBe(false);
    expect(
      pickCovers({ ...song(), albumKey: undefined }, { albumKey: '' }),
    ).toBe(false);
    expect(pickCovers(song(), {})).toBe(false);
  });
});
