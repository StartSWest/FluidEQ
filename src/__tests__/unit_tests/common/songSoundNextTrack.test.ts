/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
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
