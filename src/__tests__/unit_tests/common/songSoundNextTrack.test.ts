/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import {
  buildSongIdentity,
  ISongIdentity,
  libraryTrackIdentity,
} from 'common/songIdentity';
import {
  getDefaultSongSoundSettings,
  lookupAlbumSound,
  setAlbumSound,
} from 'common/songSoundMemory';
import { ISongSound } from 'common/songSound';
import {
  getInitialSongSoundState,
  ISongSoundParts,
  ISongSoundState,
  reduceSongSound,
  TSongSoundEffect,
  TSongSoundEvent,
} from 'common/songSoundRecorder';

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
const songA = identity('library', 'a', 'Song A', 'Artist');
const songB = identity('library', 'b', 'Song B', 'Artist');

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
const kinds = (effects: TSongSoundEffect[], kind: TSongSoundEffect['kind']) =>
  effects.filter((effect) => effect.kind === kind);

describe('Auto EQ song sounds: the next song of an album set to a sound', () => {
  // Ivan, 2026-11-20: song A of an album set to Pop, Music picked by hand,
  // then song B of the same album "loaded K-pop", his sound from before. The
  // Library names the next track before it plays, `isPlaying` false for a
  // moment, and that used to hand K-pop back at once, ahead of song B's
  // answer.
  const kPop = sound('kPop');
  const pop = sound('pop');
  const music = sound('music', 2);
  const ALBUMS: ISongSoundParts = { songs: false, albums: true };
  const girlsAlbum = { sound: { presetId: 'pop' }, title: '101 Girls Night' };
  const asIn = (song: ISongIdentity) => ({ ...song, albumKey: 'girls' });
  const trackA = asIn(songA);
  const trackB = asIn(songB);
  /** Song A playing the album's Pop over K-pop, then Music by hand. */
  const musicOverAlbum = () => {
    const lent = run(
      { ...getInitialSongSoundState(ALBUMS), deviceId: 'main', live: kPop },
      [
        [0, { kind: 'nowPlaying', identity: trackA, isPlaying: true }],
        [1, { kind: 'matched', identity: trackA, album: girlsAlbum }],
      ],
    );
    const asked = lent.state.pending;
    if (!asked) {
      throw new Error('the album’s sound was not put on');
    }
    return run(lent.state, [
      [2, { kind: 'applied', asked, landed: pop }],
      [3, { kind: 'soundChanged', sound: music }],
    ]);
  };
  /** The Library's change of track: named first, then playing. */
  const nextTrack = (state: ISongSoundState, album?: typeof girlsAlbum) =>
    run(state, [
      [4, { kind: 'nowPlaying', identity: trackB, isPlaying: false }],
      [5, { kind: 'nowPlaying', identity: trackB, isPlaying: true }],
      [6, { kind: 'matched', identity: trackB, album }],
    ]);

  it('plays song B’s album Pop, with no moment of another sound before it', () => {
    const result = nextTrack(musicOverAlbum().state, girlsAlbum);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: { ...music, presetId: 'pop' }, isLent: true },
    ]);
    expect(result.state.session?.owner).toBe('album');
  });

  it('hands back nothing while song B is named and not yet playing', () => {
    const named = run(musicOverAlbum().state, [
      [4, { kind: 'nowPlaying', identity: trackB, isPlaying: false }],
    ]);
    expect(kinds(named.effects, 'apply')).toEqual([]);
  });

  it('control: a song B with nothing saved plays Music, the last pick, never K-pop', () => {
    const result = nextTrack(musicOverAlbum().state);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: music, isLent: false },
    ]);
  });

  it('control: with no pick during song A, a song B with nothing saved plays K-pop again', () => {
    const untouched = run(
      { ...getInitialSongSoundState(ALBUMS), deviceId: 'main', live: kPop },
      [
        [0, { kind: 'nowPlaying', identity: trackA, isPlaying: true }],
        [1, { kind: 'matched', identity: trackA, album: girlsAlbum }],
      ],
    );
    const asked = untouched.state.pending;
    if (!asked) {
      throw new Error('the album’s sound was not put on');
    }
    const landed = run(untouched.state, [
      [2, { kind: 'applied', asked, landed: pop }],
    ]);
    const result = nextTrack(landed.state);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: kPop, isLent: false },
    ]);
  });
});

describe('Auto EQ song sounds: an album sound after the last one, its sound read again between songs', () => {
  // Ivan, 2026-11-20, "Exitos" (album sound Ballad), his own sound K-pop:
  // "kpop? what the heck". Between two songs the window reported the album's
  // Ballad again, unchanged, and it was taken as his pick: the next song of
  // the album then handed "his" Ballad back instead of lending it, and a
  // hand-back puts back the rack and curve held for him — K-pop — while the
  // card said the album's sound played.
  const exitos = (id: string, artist: string): ISongIdentity => {
    const identity = libraryTrackIdentity({
      id,
      title: `Song ${id}`,
      artist,
      album: 'Exitos',
      kind: 'audio',
    });
    if (!identity) {
      throw new Error('the fixture names no song');
    }
    return identity;
  };
  const songA = exitos('a', 'Silvana Di Lorenzo');
  const songB = exitos('b', 'Silvana Di Lorenzo');
  const other = exitos('c', 'Los Iracundos');
  const kPop = sound('kPop', 2);
  const music = sound('music', -3);
  const entry = (artist: string, presetId: string) => ({
    title: 'Exitos',
    artist,
    sound: { presetId },
    updatedAt: 1,
  });
  // Two albums of one title, the other one set to K-pop, as main keeps them.
  const memory = setAlbumSound(
    setAlbumSound(
      getDefaultSongSoundSettings(),
      songA.albumKey ?? '',
      entry('Silvana Di Lorenzo', 'ballad'),
    ),
    other.albumKey ?? '',
    entry('Los Iracundos', 'kPop'),
  );
  /** Main's answer for a song: its album's sound, by the album's own key. */
  const answer = (song: ISongIdentity): TSongSoundEvent => {
    const found =
      song.albumKey === undefined
        ? undefined
        : lookupAlbumSound(memory, song.albumKey);
    if (!found || 'eqId' in found.sound) {
      throw new Error('the album has no preset of its own');
    }
    return {
      kind: 'matched',
      identity: song,
      album: { sound: found.sound, title: found.title },
    };
  };
  /** Song A plays the album's Ballad, landed and heard, then song B is named. */
  const toSongB = (between: ISongSound) => {
    const lent = run(
      {
        ...getInitialSongSoundState({ songs: false, albums: true }),
        deviceId: 'main',
        live: kPop,
      },
      [
        [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
        [1, answer(songA)],
      ],
    );
    const asked = lent.state.pending;
    if (!asked) {
      throw new Error('the album’s sound was not put on');
    }
    return run(lent.state, [
      [2, { kind: 'applied', asked, landed: asked }],
      [3, { kind: 'soundChanged', sound: asked }],
      [4, { kind: 'nowPlaying', identity: songB, isPlaying: false }],
      [5, { kind: 'soundChanged', sound: between }],
      [6, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [7, answer(songB)],
    ]);
  };

  it('looks the album up by its own key, never by its title', () => {
    expect(lookupAlbumSound(memory, songA.albumKey ?? '')?.sound).toEqual({
      presetId: 'ballad',
    });
    expect(songA.albumKey).not.toBe(other.albumKey);
  });

  it('keeps the album’s Ballad lent for song B, his K-pop still his', () => {
    const ballad = { ...kPop, presetId: 'ballad' };
    // The same sound again, as a new object, the way the window re-reads it.
    const result = toSongB({ ...ballad, filters: { ...ballad.filters } });
    expect(
      kinds(result.effects, 'apply').filter(
        (effect) => effect.kind === 'apply' && !effect.isLent,
      ),
    ).toEqual([]);
    expect(result.state.session?.owner).toBe('album');
    expect(result.state.session?.handBack).toEqual(kPop);
    expect(result.state.live?.presetId).toBe('ballad');
  });

  it('control: a sound picked by hand between the songs is his, and the album’s plays over it', () => {
    const result = toSongB(music);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: { ...music, presetId: 'ballad' }, isLent: true },
    ]);
    expect(result.state.session?.handBack).toEqual(music);
  });
});
