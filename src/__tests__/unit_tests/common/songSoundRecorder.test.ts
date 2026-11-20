/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import { ISongSound } from 'common/songSound';
import { SONG_EQ_SETTLE_MS } from 'common/songEqTiming';
import {
  getInitialSongSoundState,
  ISongSoundParts,
  ISongSoundState,
  reduceSongSound,
  TSongSoundEffect,
  TSongSoundEvent,
} from 'common/songSoundRecorder';

// Auto EQ's song and album sounds (Ivan, 2026-11-19/20): in the Library a
// song's own sound, then its album's, then the listener's own; a change made
// while a saved sound plays is filed for the song, and a change made over the
// listener's own sound stays theirs unless "Save for this song" is pressed.

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
const original = sound('music');
const remembered = sound('cinema', 3);
const nextRemembered = sound('game', -2);
const albumSound = sound('vocal', 1);
const edited = sound('rock', 5);
const identity = (...args: Parameters<typeof buildSongIdentity>) => {
  const song = buildSongIdentity(...args);
  if (!song) {
    throw new Error('the fixture names no song');
  }
  return song;
};
const songA = identity('library', 'a', 'Song A', 'Artist');
const songB = identity('library', 'b', 'Song B', 'Artist');
const settledAt = SONG_EQ_SETTLE_MS;
const BOTH: ISongSoundParts = { songs: true, albums: true };
const album = (saved = albumSound) => ({ sound: saved, title: 'Night Album' });

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
const playing = (song: ISongIdentity = songA, parts: ISongSoundParts = BOTH) =>
  run(
    { ...getInitialSongSoundState(parts), deviceId: 'main', live: original },
    [
      [0, { kind: 'nowPlaying', identity: song, isPlaying: true }],
      [settledAt, { kind: 'tick' }],
    ],
  );
/** Song A playing its own saved sound, landed. */
const borrowed = () =>
  run(playing().state, [
    [settledAt + 1, { kind: 'matched', identity: songA, song: remembered }],
    [settledAt + 2, { kind: 'applied', asked: remembered, landed: remembered }],
  ]);
/** Song A playing its album's sound, landed. */
const onAlbum = (parts: ISongSoundParts = BOTH) =>
  run(playing(songA, parts).state, [
    [settledAt + 1, { kind: 'matched', identity: songA, album: album() }],
    [settledAt + 2, { kind: 'applied', asked: albumSound, landed: albumSound }],
  ]);

describe('Auto EQ song sounds: what is looked up', () => {
  it('looks a song up once it has settled, and files nothing for an untouched play', () => {
    const started = playing();
    expect(started.effects).toEqual([{ kind: 'lookup', identity: songA }]);
    const stopped = run(started.state, [[settledAt + 10, { kind: 'closing' }]]);
    expect(stopped.effects).toEqual([]);
  });

  it('looks nothing up while both parts are off', () => {
    const off = playing(songA, { songs: false, albums: false });
    expect(off.effects).toEqual([]);
    expect(off.state.isOn).toBe(false);
  });

  it('looks up a song that settled before the output was known, once it is', () => {
    const early = run({ ...getInitialSongSoundState(BOTH), live: original }, [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [settledAt, { kind: 'tick' }],
    ]);
    expect(early.effects).toEqual([]);
    const known = run(early.state, [
      [settledAt + 1, { kind: 'deviceChanged', deviceId: 'main' }],
    ]);
    expect(known.effects).toEqual([{ kind: 'lookup', identity: songA }]);
  });
});

describe('Auto EQ song sounds: the listener’s own sound', () => {
  it('files nothing when a song with no saved sound is changed', () => {
    const result = run(playing().state, [
      [settledAt + 1, { kind: 'matched', identity: songA }],
      [settledAt + 2, { kind: 'soundChanged', sound: edited }],
      [settledAt + 3, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(kinds(result.effects, 'save')).toEqual([]);
    expect(kinds(result.effects, 'willSave')).toEqual([]);
    expect(kinds(result.effects, 'apply')).toEqual([]);
  });

  it('"Save for this song" files what plays at once, and a later change at the song’s end', () => {
    const saved = run(playing().state, [
      [settledAt + 1, { kind: 'matched', identity: songA }],
      [settledAt + 2, { kind: 'saveNow' }],
    ]);
    expect(saved.effects).toEqual([
      { kind: 'save', identity: songA, sound: original, isPlay: false },
    ]);
    expect(saved.state.session?.owner).toBe('song');
    const ended = run(saved.state, [
      [settledAt + 3, { kind: 'soundChanged', sound: edited }],
      [settledAt + 4, { kind: 'closing' }],
    ]);
    expect(kinds(ended.effects, 'save')).toEqual([
      { kind: 'save', identity: songA, sound: edited, isPlay: true },
    ]);
    // It was the listener's own sound already: nothing to hand back.
    expect(kinds(ended.effects, 'apply')).toEqual([]);
  });

  it('"Save for this song" does nothing while the song is still settling or Song sounds is off', () => {
    const settling = run(
      { ...getInitialSongSoundState(BOTH), deviceId: 'main', live: original },
      [
        [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
        [1, { kind: 'saveNow' }],
      ],
    );
    expect(settling.effects).toEqual([]);
    const songsOff = run(playing(songA, { songs: false, albums: true }).state, [
      [settledAt + 1, { kind: 'saveNow' }],
    ]);
    expect(songsOff.effects).toEqual([]);
  });
});

describe('Auto EQ song sounds: a song’s own sound', () => {
  it('lends a song’s sound, announces it, and hands the listener’s back at its end', () => {
    const lent = borrowed();
    expect(lent.effects).toContainEqual({
      kind: 'apply',
      sound: remembered,
      isLent: true,
    });
    expect(lent.effects).toContainEqual({
      kind: 'notice',
      identity: songA,
      owner: 'song',
      sound: remembered,
    });
    const stopped = run(lent.state, [[settledAt + 3, { kind: 'closing' }]]);
    expect(stopped.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('files a change made while the song’s sound plays, and says so when the preset changes', () => {
    const result = run(borrowed().state, [
      [settledAt + 3, { kind: 'soundChanged', sound: edited }],
      [settledAt + 4, { kind: 'closing' }],
    ]);
    expect(kinds(result.effects, 'willSave')).toEqual([
      { kind: 'willSave', identity: songA, presetId: 'rock', owner: 'song' },
    ]);
    expect(kinds(result.effects, 'save')).toEqual([
      { kind: 'save', identity: songA, sound: edited, isPlay: true },
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('plays a preset picked in the Library over the listener’s own Tone and bands', () => {
    const picked = run(playing().state, [
      [
        settledAt + 1,
        { kind: 'matched', identity: songA, song: { presetId: 'cinema' } },
      ],
    ]);
    expect(kinds(picked.effects, 'apply')).toEqual([
      {
        kind: 'apply',
        sound: { ...original, presetId: 'cinema' },
        isLent: true,
      },
    ]);
  });

  it('moves between saved songs without a moment of a third sound', () => {
    const switched = run(borrowed().state, [
      [settledAt + 3, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [2 * settledAt + 3, { kind: 'tick' }],
      [
        2 * settledAt + 4,
        { kind: 'matched', identity: songB, song: nextRemembered },
      ],
      [
        2 * settledAt + 5,
        { kind: 'applied', asked: nextRemembered, landed: nextRemembered },
      ],
    ]);
    expect(kinds(switched.effects, 'apply')).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    const ended = run(switched.state, [
      [2 * settledAt + 6, { kind: 'closing' }],
    ]);
    expect(ended.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('asked again with the sound it already holds, keeps a change made over it', () => {
    const result = run(borrowed().state, [
      [settledAt + 3, { kind: 'soundChanged', sound: edited }],
      [settledAt + 4, { kind: 'reconsider' }],
      [settledAt + 5, { kind: 'matched', identity: songA, song: remembered }],
      [settledAt + 6, { kind: 'closing' }],
    ]);
    expect(result.effects).toContainEqual({ kind: 'lookup', identity: songA });
    // The saved sound is not lent a second time over the change...
    expect(
      kinds(result.effects, 'apply').filter(
        (effect) => effect.kind === 'apply' && effect.isLent,
      ),
    ).toEqual([]);
    // ...and the change is filed at the end.
    expect(kinds(result.effects, 'save')).toEqual([
      { kind: 'save', identity: songA, sound: edited, isPlay: true },
    ]);
  });

  it('a pick made in the Library while the song plays reaches it at once', () => {
    const result = run(borrowed().state, [
      [settledAt + 3, { kind: 'reconsider' }],
      [
        settledAt + 4,
        { kind: 'matched', identity: songA, song: nextRemembered },
      ],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    expect(kinds(result.effects, 'notice')).toHaveLength(1);
  });

  it('forgetting the playing song hands the listener’s sound back and files nothing', () => {
    const result = run(borrowed().state, [
      [settledAt + 3, { kind: 'forget' }],
      [settledAt + 4, { kind: 'applied', asked: original, landed: original }],
      [settledAt + 5, { kind: 'soundChanged', sound: edited }],
      [settledAt + 6, { kind: 'closing' }],
    ]);
    expect(result.effects).toEqual([
      { kind: 'forget', identity: songA },
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });
});

describe('Auto EQ song sounds: an album’s sound', () => {
  it('plays the album’s sound for a song with none of its own, named in the notice', () => {
    const result = onAlbum();
    expect(result.effects).toContainEqual({
      kind: 'apply',
      sound: albumSound,
      isLent: true,
    });
    expect(result.effects).toContainEqual({
      kind: 'notice',
      identity: songA,
      owner: 'album',
      sound: albumSound,
      albumTitle: 'Night Album',
    });
  });

  it('a song’s own sound beats its album’s', () => {
    const result = run(playing().state, [
      [
        settledAt + 1,
        { kind: 'matched', identity: songA, song: remembered, album: album() },
      ],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: remembered, isLent: true },
    ]);
    expect(result.state.session?.owner).toBe('song');
  });

  it('with Song sounds off, a song with a sound of its own plays its album’s', () => {
    const result = run(playing(songA, { songs: false, albums: true }).state, [
      [
        settledAt + 1,
        { kind: 'matched', identity: songA, song: remembered, album: album() },
      ],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: albumSound, isLent: true },
    ]);
    expect(result.state.session?.owner).toBe('album');
  });

  it('a change over the album’s sound is filed for the song alone', () => {
    const result = run(onAlbum().state, [
      [settledAt + 3, { kind: 'soundChanged', sound: edited }],
      [settledAt + 4, { kind: 'closing' }],
    ]);
    expect(kinds(result.effects, 'willSave')).toEqual([
      { kind: 'willSave', identity: songA, presetId: 'rock', owner: 'album' },
    ]);
    expect(kinds(result.effects, 'save')).toEqual([
      { kind: 'save', identity: songA, sound: edited, isPlay: true },
    ]);
  });

  it('with Song sounds off, a change over the album’s sound is filed nowhere', () => {
    const result = run(onAlbum({ songs: false, albums: true }).state, [
      [settledAt + 3, { kind: 'soundChanged', sound: edited }],
      [settledAt + 4, { kind: 'closing' }],
    ]);
    expect(kinds(result.effects, 'willSave')).toEqual([]);
    expect(kinds(result.effects, 'save')).toEqual([]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('turning Album sounds off gives the listener’s sound back once the song is asked again', () => {
    const switched = run(onAlbum().state, [
      [
        settledAt + 3,
        { kind: 'switched', parts: { songs: true, albums: false } },
      ],
    ]);
    expect(switched.effects).toEqual([{ kind: 'lookup', identity: songA }]);
    const answered = run(switched.state, [
      [settledAt + 4, { kind: 'matched', identity: songA, album: album() }],
    ]);
    expect(answered.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    expect(answered.state.session?.owner).toBeUndefined();
  });
});

describe('Auto EQ song sounds: switches, outputs and other hands', () => {
  it('turning both parts off gives the listener’s sound back and files later changes nowhere', () => {
    const disabled = run(borrowed().state, [
      [
        settledAt + 3,
        { kind: 'switched', parts: { songs: false, albums: false } },
      ],
      [settledAt + 4, { kind: 'applied', asked: original, landed: original }],
      [settledAt + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [settledAt + 6, { kind: 'closing' }],
    ]);
    expect(disabled.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    expect(disabled.state.isOn).toBe(false);
  });

  it('releases a loan on a change of output without carrying the song’s sound there', () => {
    const changed = run(borrowed().state, [
      [settledAt + 3, { kind: 'deviceChanged', deviceId: 'second' }],
      [2 * settledAt + 4, { kind: 'tick' }],
      [2 * settledAt + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [2 * settledAt + 6, { kind: 'closing' }],
    ]);
    expect(changed.effects).toEqual([{ kind: 'release' }]);
    expect(changed.state.deviceId).toBe('second');
  });

  it('ignores the answer about a song no longer open, and an apply nobody waits for', () => {
    const waiting = run(playing(songB).state, [
      [settledAt + 1, { kind: 'matched', identity: songA, song: remembered }],
      [
        settledAt + 2,
        { kind: 'matched', identity: songB, song: nextRemembered },
      ],
      [
        settledAt + 3,
        { kind: 'applied', asked: remembered, landed: remembered },
      ],
    ]);
    expect(kinds(waiting.effects, 'apply')).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    expect(waiting.state.pending).toBe(nextRemembered);
    expect(waiting.state.live).toBe(original);
  });

  it('a profile loaded gives the song’s sound back and is never filed as the song’s change', () => {
    const yielded = run(borrowed().state, [
      [settledAt + 3, { kind: 'yield' }],
      [settledAt + 4, { kind: 'applied', asked: original, landed: original }],
      [settledAt + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [settledAt + 6, { kind: 'closing' }],
    ]);
    expect(yielded.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('saving a profile keeps what plays after the song ends', () => {
    const kept = run(borrowed().state, [
      [settledAt + 3, { kind: 'keep' }],
      [settledAt + 4, { kind: 'closing' }],
    ]);
    expect(kept.effects).toEqual([{ kind: 'keep' }]);
    expect(kept.state.live).toBe(remembered);
  });

  it('a saved sound that failed to go on is not read as the listener’s change', () => {
    const failed = run(playing().state, [
      [settledAt + 1, { kind: 'matched', identity: songA, song: remembered }],
      [
        settledAt + 2,
        { kind: 'applied', asked: remembered, landed: undefined },
      ],
      [settledAt + 3, { kind: 'closing' }],
    ]);
    expect(kinds(failed.effects, 'save')).toEqual([]);
    expect(failed.state.pending).toBeUndefined();
    expect(failed.state.live).toBe(original);
    expect(failed.effects).toContainEqual({ kind: 'keep' });
  });
});
