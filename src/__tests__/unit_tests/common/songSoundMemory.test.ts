/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import { buildSongIdentity, libraryTrackIdentity } from 'common/songIdentity';
import { ISongSound } from 'common/songSound';
import {
  ALBUM_SOUND_MAX_ENTRIES,
  canKeepSongSound,
  forgetAlbumSounds,
  forgetSongSound,
  forgetSongSoundsOf,
  getDefaultSongSoundSettings,
  isAlbumKey,
  libraryTrackIdOf,
  lookupAlbumSound,
  lookupSongSound,
  nameSongSound,
  saveSongSound,
  setAlbumSound,
  songSoundIndex,
  soundScopeOf,
  toSongSoundEntry,
} from 'common/songSoundMemory';

// Where Auto EQ keeps song and album sounds: one store for every output, in
// two worlds — the Library's and other players' — that never meet.

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
const identity = (...args: Parameters<typeof buildSongIdentity>) => {
  const song = buildSongIdentity(...args);
  if (!song) {
    throw new Error('the fixture names no song');
  }
  return song;
};
const librarySong = identity('library', 'track-1', 'Song', 'Artist');
const spotifySong = identity('system', 'Spotify.exe', 'Song', 'Artist');
const empty = getDefaultSongSoundSettings;
const PLAY = { isPlay: true };
const PICK = { isPlay: false };

describe('Auto EQ’s store of song sounds', () => {
  it('reads which world a song belongs to from where it plays', () => {
    expect(soundScopeOf('library')).toBe('library');
    expect(soundScopeOf('karaoke')).toBe('library');
    expect(soundScopeOf('system')).toBe('other');
    expect(soundScopeOf('media')).toBe('other');
    expect(soundScopeOf('remote')).toBe('other');
  });

  it('keeps one sound per song, counting a play only when it is filed at the song’s end', () => {
    const picked = saveSongSound(
      empty(),
      librarySong,
      'library',
      sound('music'),
      10,
      PICK,
    );
    expect(lookupSongSound(picked, librarySong, 'library')).toMatchObject({
      sound: sound('music'),
      plays: 0,
      updatedAt: 10,
    });
    const played = saveSongSound(
      picked,
      librarySong,
      'library',
      sound('cinema', 2),
      20,
      PLAY,
    );
    expect(lookupSongSound(played, librarySong, 'library')).toMatchObject({
      sound: sound('cinema', 2),
      plays: 1,
      updatedAt: 20,
    });
  });

  it('never answers a Library song with another player’s save, nor the other way round', () => {
    // The two share an alias: the same title and artist.
    expect(librarySong.alias).toBe(spotifySong.alias);
    const fromLibrary = saveSongSound(
      empty(),
      librarySong,
      'library',
      sound('music'),
      10,
      PICK,
    );
    expect(lookupSongSound(fromLibrary, spotifySong, 'other')).toBeUndefined();

    const both = saveSongSound(
      fromLibrary,
      spotifySong,
      'other',
      sound('cinema'),
      20,
      PLAY,
    );
    expect(lookupSongSound(both, librarySong, 'library')?.sound).toEqual(
      sound('music'),
    );
    expect(lookupSongSound(both, spotifySong, 'other')?.sound).toEqual(
      sound('cinema'),
    );
  });

  it('keeps a Library song’s track id, carries it over a save that has none, and never gives one to another player’s song', () => {
    const named = saveSongSound(
      empty(),
      librarySong,
      'library',
      sound('music'),
      10,
      { isPlay: false, trackId: 'track-1' },
    );
    const resaved = saveSongSound(
      named,
      librarySong,
      'library',
      sound('cinema'),
      20,
      PLAY,
    );
    expect(lookupSongSound(resaved, librarySong, 'library')?.trackId).toBe(
      'track-1',
    );
    const other = saveSongSound(
      empty(),
      spotifySong,
      'other',
      sound('music'),
      10,
      { isPlay: true, trackId: 'nope' },
    );
    expect(lookupSongSound(other, spotifySong, 'other')).not.toHaveProperty(
      'trackId',
    );
  });

  it('forgets a song only in its own world', () => {
    const both = saveSongSound(
      saveSongSound(empty(), librarySong, 'library', sound('music'), 10, PICK),
      spotifySong,
      'other',
      sound('cinema'),
      20,
      PLAY,
    );
    const forgotten = forgetSongSound(both, spotifySong, 'other');
    expect(lookupSongSound(forgotten, spotifySong, 'other')).toBeUndefined();
    expect(lookupSongSound(forgotten, librarySong, 'library')?.sound).toEqual(
      sound('music'),
    );
    // Nothing of that world kept: the same store comes back.
    expect(forgetSongSound(forgotten, spotifySong, 'other')).toBe(forgotten);
  });

  it('"Forget all" takes one world’s songs and leaves the other’s', () => {
    const both = saveSongSound(
      saveSongSound(empty(), librarySong, 'library', sound('music'), 10, PICK),
      spotifySong,
      'other',
      sound('cinema'),
      20,
      PLAY,
    );
    const withoutOther = forgetSongSoundsOf(both, 'other');
    expect(lookupSongSound(withoutOther, spotifySong, 'other')).toBeUndefined();
    expect(lookupSongSound(withoutOther, librarySong, 'library')).toBeDefined();
    expect(forgetSongSoundsOf(withoutOther, 'other')).toBe(withoutOther);
  });

  it('keeps a saved sound for songs, never for a film, a video or a page with no artist', () => {
    expect(canKeepSongSound(librarySong)).toBe(true);
    expect(canKeepSongSound(spotifySong)).toBe(true);
    expect(canKeepSongSound(identity('karaoke', 'k', 'Song', 'Artist'))).toBe(
      true,
    );
    expect(
      canKeepSongSound(identity('media', 'https://example.com/v', 'A stream')),
    ).toBe(false);
    const film = libraryTrackIdentity({
      id: 'film',
      title: 'A Film',
      artist: 'Studio',
      album: '',
      albumArtist: '',
      kind: 'video',
    });
    expect(film && canKeepSongSound(film)).toBe(false);
  });

  it('reads a stored entry whole or not at all, with a track id only in the Library', () => {
    const stored = {
      sound: { presetId: 'cinema' },
      scope: 'other',
      trackId: 'leaked',
      title: '',
      plays: 2,
      updatedAt: 5,
    };
    expect(toSongSoundEntry(stored)).toEqual({
      sound: { presetId: 'cinema' },
      scope: 'other',
      title: '',
      plays: 2,
      updatedAt: 5,
    });
    expect(
      toSongSoundEntry({ ...stored, scope: 'everywhere' }),
    ).toBeUndefined();
    expect(
      toSongSoundEntry({ ...stored, sound: { presetId: '' } }),
    ).toBeUndefined();
    expect(toSongSoundEntry({ ...stored, plays: Infinity })).toBeUndefined();
  });
});

describe('Auto EQ’s album sounds', () => {
  const entry = (presetId: string, updatedAt: number) => ({
    title: 'Night Album',
    artist: 'Artist',
    sound: { presetId },
    updatedAt,
  });

  it('sets, reads and takes away an album’s sound by the Library’s album key', () => {
    const set = setAlbumSound(empty(), 'album-1', entry('vocal', 1));
    expect(lookupAlbumSound(set, 'album-1')?.sound).toEqual({
      presetId: 'vocal',
    });
    const removed = setAlbumSound(set, 'album-1', undefined);
    expect(lookupAlbumSound(removed, 'album-1')).toBeUndefined();
    expect(forgetAlbumSounds(set).albums).toEqual({});
    expect(forgetAlbumSounds(removed)).toBe(removed);
  });

  it('never takes an object’s own internals for an album', () => {
    expect(isAlbumKey('')).toBe(false);
    expect(isAlbumKey('__proto__')).toBe(false);
    expect(isAlbumKey('constructor')).toBe(false);
    expect(isAlbumKey('prototype')).toBe(false);
    expect(isAlbumKey('artist|album')).toBe(true);
    expect(lookupAlbumSound(empty(), 'constructor')).toBeUndefined();
    expect(lookupAlbumSound(empty(), 'toString')).toBeUndefined();
  });

  it('keeps inside its ceiling by letting the oldest album go', () => {
    let settings = empty();
    for (let index = 0; index <= ALBUM_SOUND_MAX_ENTRIES; index += 1) {
      settings = setAlbumSound(
        settings,
        `album-${index}`,
        entry('vocal', index),
      );
    }
    expect(Object.keys(settings.albums)).toHaveLength(ALBUM_SOUND_MAX_ENTRIES);
    expect(lookupAlbumSound(settings, 'album-0')).toBeUndefined();
    expect(
      lookupAlbumSound(settings, `album-${ALBUM_SOUND_MAX_ENTRIES}`),
    ).toBeDefined();
  });
});

describe('what the Library and Manage are shown', () => {
  it('lists named Library songs and every album, counts other players’ songs and flags an unnamed one', () => {
    let settings = saveSongSound(
      empty(),
      librarySong,
      'library',
      sound('music'),
      10,
      { isPlay: false, trackId: 'track-1' },
    );
    settings = saveSongSound(
      settings,
      identity('library', 'track-2', 'Other Song', 'Artist'),
      'library',
      { presetId: 'cinema' },
      20,
      PICK,
    );
    settings = saveSongSound(
      settings,
      spotifySong,
      'other',
      sound('game'),
      30,
      PLAY,
    );
    settings = setAlbumSound(settings, 'album-1', {
      title: 'Night Album',
      artist: 'Artist',
      sound: { presetId: 'vocal' },
      updatedAt: 40,
    });
    expect(songSoundIndex(settings)).toEqual({
      songs: [
        {
          trackId: 'track-1',
          title: 'Song',
          artist: 'Artist',
          presetId: 'music',
          isWhole: true,
          updatedAt: 10,
        },
      ],
      albums: [
        {
          key: 'album-1',
          title: 'Night Album',
          artist: 'Artist',
          presetId: 'vocal',
          isWhole: false,
        },
      ],
      otherCount: 1,
      hasUnnamed: true,
    });
  });

  it('names a Library song kept without its track id, and nothing else, leaving its save time', () => {
    const unnamed = saveSongSound(
      empty(),
      librarySong,
      'library',
      sound('music'),
      10,
      PICK,
    );
    const named = nameSongSound(unnamed, librarySong.key, 'track-1');
    expect(lookupSongSound(named, librarySong, 'library')).toMatchObject({
      trackId: 'track-1',
      updatedAt: 10,
    });
    // Already named, another player's, or not there: untouched.
    expect(nameSongSound(named, librarySong.key, 'track-9')).toBe(named);
    const other = saveSongSound(
      empty(),
      spotifySong,
      'other',
      sound('music'),
      10,
      PLAY,
    );
    expect(nameSongSound(other, spotifySong.key, 'track-1')).toBe(other);
    expect(nameSongSound(unnamed, 'missing', 'track-1')).toBe(unnamed);
  });

  it('reads a Library song’s track id from its key, and no other player’s', () => {
    expect(libraryTrackIdOf(librarySong)).toBe('track-1');
    expect(libraryTrackIdOf(spotifySong)).toBeUndefined();
  });
});
