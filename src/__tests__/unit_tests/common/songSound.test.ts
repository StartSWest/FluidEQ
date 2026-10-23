/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum, IFiltersMap } from 'common/constants';
import { buildSongIdentity } from 'common/songIdentity';
import {
  forgetSongSound,
  getDefaultSongSoundSettings,
  ISongSound,
  lookupSongSound,
  sameSongSound,
  saveSongSound,
  toSongSound,
} from 'common/songSound';

const filters = (gain: number): IFiltersMap => ({
  bass: {
    id: 'bass',
    frequency: 100,
    gain,
    quality: 1,
    type: FilterTypeEnum.PK,
  },
  treble: {
    id: 'treble',
    frequency: 8000,
    gain: 0,
    quality: 1,
    type: FilterTypeEnum.PK,
  },
});

const sound = (presetId: string, gain: number): ISongSound => ({
  presetId,
  filters: filters(gain),
  tone: { bass: gain, mid: 0, treble: 0 },
});

const identity = (...args: Parameters<typeof buildSongIdentity>) => {
  const song = buildSongIdentity(...args);
  if (!song) {
    throw new Error('the fixture names no song');
  }
  return song;
};
const librarySong = identity('library', 'file-a', 'Song', 'Artist');
const systemSong = identity('system', 'session-a', 'Song', 'Artist');

describe('per-output remembered song sound', () => {
  it('keeps separate sounds and play counts for the same song on two outputs', () => {
    const mainSound = sound('music', 2);
    const secondSound = sound('cinema', -3);
    const first = saveSongSound(
      getDefaultSongSoundSettings(),
      'main',
      librarySong,
      mainSound,
      10,
    );
    const both = saveSongSound(first, 'second', librarySong, secondSound, 20);
    const changed = saveSongSound(
      both,
      'second',
      librarySong,
      sound('game', 4),
      30,
    );

    expect(lookupSongSound(changed, 'main', librarySong)).toMatchObject({
      sound: mainSound,
      plays: 1,
      updatedAt: 10,
    });
    expect(lookupSongSound(changed, 'second', librarySong)).toMatchObject({
      sound: sound('game', 4),
      plays: 2,
      updatedAt: 30,
    });
    expect(lookupSongSound(both, 'second', librarySong)?.sound).toEqual(
      secondSound,
    );
    expect(lookupSongSound(first, 'second', librarySong)).toBeUndefined();
  });

  it('forgets the alias-matched song only on the requested output', () => {
    expect(librarySong.alias).toBe(systemSong.alias);
    const original = saveSongSound(
      saveSongSound(
        getDefaultSongSoundSettings(),
        'main',
        librarySong,
        sound('music', 2),
        10,
      ),
      'second',
      librarySong,
      sound('cinema', -3),
      20,
    );
    expect(lookupSongSound(original, 'second', systemSong)).toBeDefined();
    const forgotten = forgetSongSound(original, 'second', systemSong);
    expect(lookupSongSound(forgotten, 'second', librarySong)).toBeUndefined();
    expect(lookupSongSound(forgotten, 'second', systemSong)).toBeUndefined();
    expect(lookupSongSound(forgotten, 'main', systemSong)?.sound.presetId).toBe(
      'music',
    );
    expect(lookupSongSound(original, 'second', systemSong)).toBeDefined();
  });

  it('compares audible values independent of band order and flat Tone representation', () => {
    const first = sound('music', 0);
    const reordered = {
      presetId: 'music',
      filters: { treble: first.filters.treble, bass: first.filters.bass },
    };
    expect(sameSongSound(first, reordered)).toBe(true);
    expect(
      sameSongSound(first, {
        ...reordered,
        filters: {
          ...reordered.filters,
          bass: { ...first.filters.bass, isEnabled: false },
        },
      }),
    ).toBe(false);
    expect(sameSongSound(first, sound('cinema', 0))).toBe(false);
    expect(sameSongSound(first, sound('music', 1))).toBe(false);
  });

  it('rejects the whole stored curve if any band is invalid', () => {
    const valid = sound('music', 2);
    expect(toSongSound(valid)).toEqual(valid);
    expect(
      toSongSound({
        ...valid,
        filters: { ...valid.filters, broken: { gain: 2 } },
      }),
    ).toBeUndefined();
    expect(toSongSound({ ...valid, filters: {} })).toBeUndefined();
    expect(
      toSongSound({ ...valid, presetId: 'x'.repeat(121) }),
    ).toBeUndefined();
  });
});
