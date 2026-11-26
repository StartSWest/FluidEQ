/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import { ISongSound } from 'common/songSound';
import { isSongSoundChanged } from 'common/songSoundChoices';
import {
  getInitialSongSoundState,
  ISongSoundParts,
  ISongSoundState,
  reduceSongSound,
  TSongSoundEffect,
  TSongSoundEvent,
} from 'common/songSoundRecorder';
import { SONG_SOUND_WORKING_MAX } from 'common/songSoundWorking';

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
/** A moment into a song, for what follows its start. */
const later = 2_000;
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
      [later, { kind: 'tick' }],
    ],
  );
/** Song A playing its own saved sound, landed. */
const borrowed = () =>
  run(playing().state, [
    [later + 1, { kind: 'matched', identity: songA, song: remembered }],
    [later + 2, { kind: 'applied', asked: remembered, landed: remembered }],
  ]);
/** Song A playing its album's sound, landed. */
const onAlbum = (parts: ISongSoundParts = BOTH) =>
  run(playing(songA, parts).state, [
    [later + 1, { kind: 'matched', identity: songA, album: album() }],
    [later + 2, { kind: 'applied', asked: albumSound, landed: albumSound }],
  ]);

describe('Auto EQ song sounds: what is looked up', () => {
  // A song is looked up the moment it is named, on the report the play bar
  // draws it from (Ivan, 2026-11-20: "is taking too much to detect the new
  // song ... despite we instantly can tell in the bottom play bar"). Another
  // program's player may say nothing more until the song ends ("is not
  // detecting always"), so nothing here reports after the song starts.
  const onDesktop = identity('system', 'chrome.exe', 'Live Song', 'Channel');
  const startedAlone = (song: ISongIdentity) =>
    run(
      { ...getInitialSongSoundState(BOTH), deviceId: 'main', live: original },
      [
        [0, { kind: 'nowPlaying', identity: song, isPlaying: true }],
        [1, { kind: 'saveNow' }],
      ],
    );

  it('looks another program’s song up as it starts, and lets "Save for this song" take it', () => {
    const desktop = startedAlone(onDesktop);
    expect(desktop.effects).toEqual([
      { kind: 'lookup', identity: onDesktop },
      { kind: 'save', identity: onDesktop, sound: original },
      { kind: 'apply', sound: original, isLent: true, asOwn: true },
    ]);
  });

  it('looks a Library song up the moment it is named too', () => {
    // It used to hold still for two seconds first.
    expect(startedAlone(songA).effects).toEqual([
      { kind: 'lookup', identity: songA },
      { kind: 'save', identity: songA, sound: original },
      { kind: 'apply', sound: original, isLent: true, asOwn: true },
    ]);
  });

  it('turns away the answer about another program’s song skipped past', () => {
    const next = identity('system', 'chrome.exe', 'Next Song', 'Channel');
    const skipped = run(startedAlone(onDesktop).state, [
      [2, { kind: 'nowPlaying', identity: next, isPlaying: true }],
      [3, { kind: 'matched', identity: onDesktop, song: remembered }],
    ]);
    expect(skipped.effects).toEqual([{ kind: 'lookup', identity: next }]);
  });

  it('files nothing for an untouched play', () => {
    const started = playing();
    expect(started.effects).toEqual([{ kind: 'lookup', identity: songA }]);
    const stopped = run(started.state, [[later + 10, { kind: 'closing' }]]);
    expect(stopped.effects).toEqual([]);
  });

  it('looks nothing up while both parts are off', () => {
    const off = playing(songA, { songs: false, albums: false });
    expect(off.effects).toEqual([]);
    expect(off.state.isOn).toBe(false);
  });

  it('looks up a song that started before the output was known, once it is', () => {
    const early = run({ ...getInitialSongSoundState(BOTH), live: original }, [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
    ]);
    expect(early.effects).toEqual([]);
    const known = run(early.state, [
      [later + 1, { kind: 'deviceChanged', deviceId: 'main' }],
    ]);
    expect(known.effects).toEqual([{ kind: 'lookup', identity: songA }]);
  });
});

describe('Auto EQ song sounds: the listener’s own sound', () => {
  it('files nothing when a song with no saved sound is changed', () => {
    const result = run(playing().state, [
      [later + 1, { kind: 'matched', identity: songA }],
      [later + 2, { kind: 'soundChanged', sound: edited }],
      [later + 3, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(kinds(result.effects, 'save')).toEqual([]);
    expect(kinds(result.effects, 'apply')).toEqual([]);
  });

  it('"Save for this song" files what plays at once, and a later change only when saved again', () => {
    const asked = run(playing().state, [
      [later + 1, { kind: 'matched', identity: songA }],
      [later + 2, { kind: 'saveNow' }],
    ]);
    // Filed, and the listener's own sound lent to the song as it is, so a
    // change made from here is the song's and never theirs.
    expect(asked.effects).toEqual([
      { kind: 'save', identity: songA, sound: original },
      { kind: 'apply', sound: original, isLent: true, asOwn: true },
    ]);
    expect(asked.state.session?.owner).toBe('song');
    const saved = run(asked.state, [
      [later + 2, { kind: 'applied', asked: original, landed: original }],
    ]);
    const changed = run(saved.state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
    ]);
    expect(isSongSoundChanged(changed.state)).toBe(true);
    const ended = run(changed.state, [[later + 4, { kind: 'closing' }]]);
    expect(kinds(ended.effects, 'save')).toEqual([]);
    // The listener's own sound comes back exactly as it was saved over.
    expect(kinds(ended.effects, 'apply')).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    const resaved = run(changed.state, [[later + 4, { kind: 'saveNow' }]]);
    expect(resaved.effects).toEqual([
      { kind: 'save', identity: songA, sound: edited },
    ]);
    expect(isSongSoundChanged(resaved.state)).toBe(false);
  });

  it('"Save for this song" does nothing before the window has heard the sound, or with Song sounds off', () => {
    const unheard = run(
      { ...getInitialSongSoundState(BOTH), deviceId: 'main' },
      [
        [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
        [1, { kind: 'saveNow' }],
      ],
    );
    expect(kinds(unheard.effects, 'save')).toEqual([]);
    const songsOff = run(playing(songA, { songs: false, albums: true }).state, [
      [later + 1, { kind: 'saveNow' }],
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
    const stopped = run(lent.state, [[later + 3, { kind: 'closing' }]]);
    expect(stopped.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('hears a change made while the song’s sound plays, and keeps it for the song only when saved', () => {
    const changed = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
    ]);
    // The control: unchanged, nothing is offered.
    expect(isSongSoundChanged(borrowed().state)).toBe(false);
    expect(isSongSoundChanged(changed.state)).toBe(true);
    // Left unsaved, nothing is filed, and the change is the song's alone: the
    // listener's own sound comes back at its end exactly as they left it.
    const ended = run(changed.state, [[later + 4, { kind: 'closing' }]]);
    expect(kinds(ended.effects, 'save')).toEqual([]);
    expect(kinds(ended.effects, 'apply')).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    // Saved, the song keeps it, and the listener's own still comes back.
    const saved = run(changed.state, [
      [later + 4, { kind: 'saveNow' }],
      [later + 5, { kind: 'closing' }],
    ]);
    expect(kinds(saved.effects, 'save')).toEqual([
      { kind: 'save', identity: songA, sound: edited },
    ]);
    expect(kinds(saved.effects, 'apply')).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('Back to saved puts the saved sound on again, lent, and files nothing', () => {
    const reverted = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'revert' }],
    ]);
    expect(reverted.effects).toEqual([
      { kind: 'apply', sound: remembered, isLent: true },
    ]);
    const landed = run(reverted.state, [
      [later + 5, { kind: 'applied', asked: remembered, landed: remembered }],
    ]);
    expect(isSongSoundChanged(landed.state)).toBe(false);
    // Unchanged, there is nothing to go back to.
    expect(
      run(borrowed().state, [[later + 3, { kind: 'revert' }]]).effects,
    ).toEqual([]);
  });

  it('Clear EQ while a saved song plays plays flat now, and the song keeps its saved sound', () => {
    const flat = sound('none');
    const result = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: flat }],
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 5, { kind: 'matched', identity: songB }],
      [later + 6, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [later + 7, { kind: 'matched', identity: songA, song: remembered }],
      [later + 8, { kind: 'applied', asked: flat, landed: flat }],
    ]);
    expect(kinds(result.effects, 'save')).toEqual([]);
    // Song B, with nothing saved, plays the listener's own, never the flat.
    expect(kinds(result.effects, 'apply')[0]).toEqual({
      kind: 'apply',
      sound: original,
      isLent: false,
    });
    // Song A comes back with its working version, lent and shown as changed
    // over the saved sound, which Back to saved puts on again.
    expect(result.effects).toContainEqual({
      kind: 'apply',
      sound: flat,
      isLent: true,
    });
    expect(result.state.session?.baseline).toEqual(remembered);
    expect(isSongSoundChanged(result.state)).toBe(true);
    expect(
      run(result.state, [[later + 9, { kind: 'revert' }]]).effects,
    ).toEqual([{ kind: 'apply', sound: remembered, isLent: true }]);
  });

  it('plays a preset picked in the Library over the listener’s own Tone and bands', () => {
    const picked = run(playing().state, [
      [
        later + 1,
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
      [later + 3, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [2 * later + 3, { kind: 'tick' }],
      [
        2 * later + 4,
        { kind: 'matched', identity: songB, song: nextRemembered },
      ],
      [
        2 * later + 5,
        { kind: 'applied', asked: nextRemembered, landed: nextRemembered },
      ],
    ]);
    expect(kinds(switched.effects, 'apply')).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    const ended = run(switched.state, [[2 * later + 6, { kind: 'closing' }]]);
    expect(ended.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('asked again with the sound it already holds, keeps a change made over it', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'reconsider' }],
      [later + 5, { kind: 'matched', identity: songA, song: remembered }],
      [later + 6, { kind: 'closing' }],
    ]);
    expect(result.effects).toContainEqual({ kind: 'lookup', identity: songA });
    // The saved sound is not lent a second time over the change...
    expect(
      kinds(result.effects, 'apply').filter(
        (effect) => effect.kind === 'apply' && effect.isLent,
      ),
    ).toEqual([]);
    // ...and the change is still there, waiting to be saved.
    expect(kinds(result.effects, 'save')).toEqual([]);
  });

  it('a pick made in the Library while the song plays reaches it at once', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'reconsider' }],
      [later + 4, { kind: 'matched', identity: songA, song: nextRemembered }],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    expect(kinds(result.effects, 'notice')).toHaveLength(1);
  });

  it('forgetting the playing song hands the listener’s sound back and files nothing', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'forget' }],
      [later + 4, { kind: 'applied', asked: original, landed: original }],
      [later + 5, { kind: 'soundChanged', sound: edited }],
      [later + 6, { kind: 'closing' }],
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
        later + 1,
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
        later + 1,
        { kind: 'matched', identity: songA, song: remembered, album: album() },
      ],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: albumSound, isLent: true },
    ]);
    expect(result.state.session?.owner).toBe('album');
  });

  it('a change over the album’s sound, saved, is the song’s alone', () => {
    const result = run(onAlbum().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'saveNow' }],
    ]);
    expect(kinds(result.effects, 'save')).toEqual([
      { kind: 'save', identity: songA, sound: edited },
    ]);
    expect(result.state.session?.owner).toBe('song');
  });

  it('with Song sounds off, a change over the album’s sound is filed nowhere', () => {
    const result = run(onAlbum({ songs: false, albums: true }).state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'closing' }],
    ]);
    expect(kinds(result.effects, 'save')).toEqual([]);
    // The change is the song's working version, never the listener's own,
    // which comes back as they left it.
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    expect(result.state.working?.[songA.key]?.sound).toEqual(edited);
  });

  it('turning Album sounds off gives the listener’s sound back once the song is asked again', () => {
    const switched = run(onAlbum().state, [
      [later + 3, { kind: 'switched', parts: { songs: true, albums: false } }],
    ]);
    expect(switched.effects).toEqual([{ kind: 'lookup', identity: songA }]);
    const answered = run(switched.state, [
      [later + 4, { kind: 'matched', identity: songA, album: album() }],
    ]);
    expect(answered.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    expect(answered.state.session?.owner).toBeUndefined();
  });
});

describe('Auto EQ song sounds: the listener’s own EQ and each song’s working version', () => {
  // Ivan, 2026-11-26, confirmed word for word: the listener's own EQ and each
  // song's sound each have a saved and a working version; the own EQ is kept
  // once, when it is left for a song's sound, and never overwritten by a
  // song; an edit while a song's sound plays goes into that song's working
  // version only. This replaced the 2026-11-20 rule that a change made during
  // a saved song became the listener's own.
  const songC = identity('library', 'c', 'Song C', 'Artist');
  /** The apply that puts the listener's own sound from before back. */
  const handedBack = { kind: 'apply', sound: original, isLent: false };
  const lentEffects = (effects: TSongSoundEffect[]) =>
    kinds(effects, 'apply').filter(
      (effect) => effect.kind === 'apply' && effect.isLent,
    );
  /** Song B starts after song A; nothing is kept for B. */
  const toUnsaved = (state: ISongSoundState, from: number) =>
    run(state, [
      [from, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [from + 1, { kind: 'matched', identity: songB }],
    ]);
  /** Song A changed by hand while its saved sound plays, then song B. */
  const changedThenB = (change: ISongSound = edited) =>
    toUnsaved(
      run(borrowed().state, [
        [later + 3, { kind: 'soundChanged', sound: change }],
      ]).state,
      later + 4,
    );
  /** Back to song A after `changedThenB`, its sound landed. */
  const backToA = (state: ISongSoundState, from: number) =>
    run(state, [
      [from, { kind: 'applied', asked: original, landed: original }],
      [from + 1, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [from + 2, { kind: 'matched', identity: songA, song: remembered }],
    ]);

  it('gives the listener’s own back unchanged after a saved song nobody touched', () => {
    // The control for every case below.
    expect(toUnsaved(borrowed().state, later + 3).effects).toContainEqual(
      handedBack,
    );
  });

  it('a change made during song A’s sound never reaches the listener’s own', () => {
    const result = changedThenB();
    expect(kinds(result.effects, 'apply')).toEqual([handedBack]);
    expect(kinds(result.effects, 'keep')).toEqual([]);
    // It is song A's working version instead.
    expect(result.state.working?.[songA.key]).toEqual({
      over: remembered,
      sound: edited,
    });
  });

  it('a preset picked during song A’s sound (the titlebar’s plate) is song A’s change', () => {
    const pop = { ...remembered, presetId: 'pop' };
    const result = changedThenB(pop);
    expect(kinds(result.effects, 'apply')).toEqual([handedBack]);
    expect(result.state.working?.[songA.key]?.sound).toEqual(pop);
  });

  it('a drag’s last step, landing after the next song is named, is song A’s too', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 5, { kind: 'soundChanged', sound: sound('rock', 6) }],
      [later + 6, { kind: 'matched', identity: songB }],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([handedBack]);
    expect(result.state.working?.[songA.key]?.sound).toEqual(sound('rock', 6));
  });

  it('a change made between two songs stays with the song whose sound still played', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 4, { kind: 'soundChanged', sound: edited }],
      [later + 5, { kind: 'matched', identity: songB }],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([handedBack]);
    expect(result.state.working?.[songA.key]?.sound).toEqual(edited);
  });

  it('a change made during song A never reaches song B’s sound, nor the song after', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 6, { kind: 'matched', identity: songB, song: nextRemembered }],
      [
        later + 7,
        { kind: 'applied', asked: nextRemembered, landed: nextRemembered },
      ],
      [later + 8, { kind: 'nowPlaying', identity: songC, isPlaying: true }],
      [later + 9, { kind: 'matched', identity: songC }],
    ]);
    // Song B is lent its own, with nothing between...
    expect(lentEffects(result.effects)).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    // ...and song C, with nothing saved, plays the listener's own.
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
      handedBack,
    ]);
    expect(result.state.working?.[songB.key]).toBeUndefined();
  });

  it('a song’s preset alone plays over the listener’s own bands, never song A’s changed ones', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [
        later + 5,
        { kind: 'matched', identity: songB, song: { presetId: 'vocal' } },
      ],
    ]);
    expect(lentEffects(result.effects)).toEqual([
      {
        kind: 'apply',
        sound: { ...original, presetId: 'vocal' },
        isLent: true,
      },
    ]);
  });

  it('a song whose saved sound is the listener’s own is lent all the same, so its changes stay its own', () => {
    const lent = run(playing().state, [
      [later + 1, { kind: 'matched', identity: songA, song: original }],
    ]);
    expect(lent.effects).toEqual([
      { kind: 'apply', sound: original, isLent: true, asOwn: true },
    ]);
    expect(lent.state.session?.owner).toBe('song');
    const ended = run(lent.state, [
      [later + 2, { kind: 'applied', asked: original, landed: original }],
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'closing' }],
    ]);
    expect(kinds(ended.effects, 'apply')).toEqual([handedBack]);
    expect(ended.state.working?.[songA.key]?.sound).toEqual(edited);
  });

  it('a later song whose sound is the listener’s own puts theirs back exactly, lent', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 5, { kind: 'matched', identity: songB, song: original }],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: original, isLent: true, asOwn: true },
    ]);
    expect(result.state.session?.handBack).toEqual(original);
  });

  it('song A comes back with its working version, shown as changed over its saved sound', () => {
    const result = backToA(changedThenB().state, later + 6);
    expect(lentEffects(result.effects)).toEqual([
      { kind: 'apply', sound: edited, isLent: true },
    ]);
    const landed = run(result.state, [
      [later + 9, { kind: 'applied', asked: edited, landed: edited }],
    ]);
    expect(landed.state.session?.baseline).toEqual(remembered);
    expect(isSongSoundChanged(landed.state)).toBe(true);
    // The control: untouched, it comes back saved and unchanged.
    const untouched = backToA(
      toUnsaved(borrowed().state, later + 3).state,
      later + 6,
    );
    expect(lentEffects(untouched.effects)).toEqual([
      { kind: 'apply', sound: remembered, isLent: true },
    ]);
  });

  it('Save makes the working version the song’s saved one', () => {
    const back = backToA(changedThenB().state, later + 6);
    const saved = run(back.state, [
      [later + 9, { kind: 'applied', asked: edited, landed: edited }],
      [later + 10, { kind: 'saveNow' }],
    ]);
    expect(kinds(saved.effects, 'save')).toEqual([
      { kind: 'save', identity: songA, sound: edited },
    ]);
    expect(saved.state.working?.[songA.key]).toBeUndefined();
    expect(isSongSoundChanged(saved.state)).toBe(false);
    // And the listener's own still comes back after it.
    expect(
      kinds(
        run(saved.state, [[later + 11, { kind: 'closing' }]]).effects,
        'apply',
      ),
    ).toEqual([handedBack]);
  });

  it('Back to saved puts the saved sound on and drops the working version', () => {
    const back = backToA(changedThenB().state, later + 6);
    const reverted = run(back.state, [
      [later + 9, { kind: 'applied', asked: edited, landed: edited }],
      [later + 10, { kind: 'revert' }],
    ]);
    expect(reverted.effects).toEqual([
      { kind: 'apply', sound: remembered, isLent: true },
    ]);
    expect(reverted.state.working?.[songA.key]).toBeUndefined();
    // Played again, it is its saved sound.
    const again = backToA(
      toUnsaved(
        run(reverted.state, [
          [
            later + 11,
            { kind: 'applied', asked: remembered, landed: remembered },
          ],
        ]).state,
        later + 12,
      ).state,
      later + 14,
    );
    expect(lentEffects(again.effects)).toEqual([
      { kind: 'apply', sound: remembered, isLent: true },
    ]);
  });

  it('a sound picked for the song replaces its working version', () => {
    const back = backToA(changedThenB().state, later + 6);
    const picked = run(back.state, [
      [later + 9, { kind: 'applied', asked: edited, landed: edited }],
      [later + 10, { kind: 'picked' }],
      [
        later + 11,
        { kind: 'matched', identity: songA, song: remembered, isPick: true },
      ],
    ]);
    expect(kinds(picked.effects, 'apply')).toEqual([
      { kind: 'apply', sound: remembered, isLent: true },
    ]);
    expect(picked.state.working?.[songA.key]).toBeUndefined();
  });

  it('a working version made over a saved sound changed since is dropped', () => {
    const result = run(changedThenB().state, [
      [later + 6, { kind: 'applied', asked: original, landed: original }],
      [later + 7, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [later + 8, { kind: 'matched', identity: songA, song: nextRemembered }],
    ]);
    expect(lentEffects(result.effects)).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    expect(result.state.working?.[songA.key]).toBeUndefined();
  });

  it('a saved EQ put on during a song’s sound is that song’s change, never the listener’s own', () => {
    const eq = sound('studio', 2);
    const result = run(borrowed().state, [
      [later + 3, { kind: 'putOn', sound: eq }],
      [later + 4, { kind: 'applied', asked: eq, landed: eq }],
      [later + 5, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 6, { kind: 'matched', identity: songB }],
    ]);
    expect(kinds(result.effects, 'apply')).toEqual([
      { kind: 'apply', sound: eq, isLent: true },
      handedBack,
    ]);
    expect(result.state.working?.[songA.key]?.sound).toEqual(eq);
    // The control: over the listener's own sound it is simply theirs.
    const own = run(playing().state, [
      [later + 1, { kind: 'matched', identity: songA }],
      [later + 2, { kind: 'putOn', sound: eq }],
    ]);
    expect(kinds(own.effects, 'apply')).toEqual([
      { kind: 'apply', sound: eq, isLent: false },
    ]);
  });

  it('switching song sounds off brings the listener’s own back at once, the change left with its song', () => {
    const result = run(borrowed().state, [
      [later + 3, { kind: 'soundChanged', sound: edited }],
      [later + 4, { kind: 'switched', parts: { songs: false, albums: false } }],
    ]);
    expect(result.effects).toEqual([handedBack]);
    expect(result.state.working?.[songA.key]?.sound).toEqual(edited);
  });

  it('writes nothing over the listener’s own on plain song changes', () => {
    const result = run(playing().state, [
      [later + 1, { kind: 'matched', identity: songA }],
      // An edit over their own sound is theirs: main keeps it, nothing here.
      [later + 2, { kind: 'soundChanged', sound: edited }],
      [later + 3, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 4, { kind: 'matched', identity: songB }],
      [later + 5, { kind: 'nowPlaying', identity: songC, isPlaying: true }],
      [later + 6, { kind: 'matched', identity: songC }],
    ]);
    expect(result.effects.filter((effect) => effect.kind !== 'lookup')).toEqual(
      [],
    );
    expect(result.state.working).toBeUndefined();
  });

  it('keeps a bounded number of working versions, dropping the oldest', () => {
    let { state } = borrowed();
    const songs = Array.from({ length: SONG_SOUND_WORKING_MAX + 1 }, (_, i) =>
      identity('library', `w${i}`, `Song ${i}`, 'Artist'),
    );
    songs.forEach((song, i) => {
      state = run(state, [
        [
          later + 10 * i,
          { kind: 'nowPlaying', identity: song, isPlaying: true },
        ],
        [
          later + 10 * i + 1,
          { kind: 'matched', identity: song, song: remembered },
        ],
        [
          later + 10 * i + 2,
          { kind: 'applied', asked: remembered, landed: remembered },
        ],
        [
          later + 10 * i + 3,
          { kind: 'soundChanged', sound: sound('rock', i % 9) },
        ],
      ]).state;
    });
    expect(Object.keys(state.working ?? {})).toHaveLength(
      SONG_SOUND_WORKING_MAX,
    );
    expect(state.working?.[songs[0].key]).toBeUndefined();
    expect(state.working?.[songs[SONG_SOUND_WORKING_MAX].key]).toBeDefined();
  });
});

describe('Auto EQ song sounds: switches, outputs and other hands', () => {
  it('turning both parts off gives the listener’s sound back and files later changes nowhere', () => {
    const disabled = run(borrowed().state, [
      [later + 3, { kind: 'switched', parts: { songs: false, albums: false } }],
      [later + 4, { kind: 'applied', asked: original, landed: original }],
      [later + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [later + 6, { kind: 'closing' }],
    ]);
    expect(disabled.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    expect(disabled.state.isOn).toBe(false);
  });

  it('releases a loan on a change of output without carrying the song’s sound there', () => {
    const changed = run(borrowed().state, [
      [later + 3, { kind: 'deviceChanged', deviceId: 'second' }],
      [2 * later + 4, { kind: 'tick' }],
      [2 * later + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [2 * later + 6, { kind: 'closing' }],
    ]);
    expect(changed.effects).toEqual([{ kind: 'release' }]);
    expect(changed.state.deviceId).toBe('second');
  });

  it('takes a loan left on another output up again when the same song still plays there', () => {
    const back = run(borrowed().state, [
      [later + 3, { kind: 'deviceChanged', deviceId: 'second' }],
      [later + 4, { kind: 'deviceChanged', deviceId: 'main' }],
    ]);
    expect(back.effects).toEqual([{ kind: 'release' }, { kind: 'release' }]);
    expect(back.state.session?.owner).toBe('song');
    expect(back.state.session?.isLoaded).toBe(false);
    // Its end hands the listener's own back on that output.
    const ended = run(back.state, [[later + 5, { kind: 'closing' }]]);
    expect(ended.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    // The control: on the other output nothing is lent, nothing handed back.
    const there = run(borrowed().state, [
      [later + 3, { kind: 'deviceChanged', deviceId: 'second' }],
      [later + 4, { kind: 'closing' }],
    ]);
    expect(there.effects).toEqual([{ kind: 'release' }]);
  });

  it('hands a loan left on another output back on the way in once its song is over', () => {
    const back = run(borrowed().state, [
      [later + 3, { kind: 'deviceChanged', deviceId: 'second' }],
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 5, { kind: 'deviceChanged', deviceId: 'main' }],
    ]);
    expect(back.effects).toContainEqual({ kind: 'return' });
    expect(back.state.parked?.main).toBeUndefined();
    // An output left with nothing lent brings nothing back.
    const plain = run(playing().state, [
      [later + 1, { kind: 'matched', identity: songA }],
      [later + 3, { kind: 'deviceChanged', deviceId: 'second' }],
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 5, { kind: 'deviceChanged', deviceId: 'main' }],
    ]);
    expect(kinds(plain.effects, 'return')).toEqual([]);
  });

  it('ignores the answer about a song no longer open, and an apply nobody waits for', () => {
    const waiting = run(playing(songB).state, [
      [later + 1, { kind: 'matched', identity: songA, song: remembered }],
      [later + 2, { kind: 'matched', identity: songB, song: nextRemembered }],
      [later + 3, { kind: 'applied', asked: remembered, landed: remembered }],
    ]);
    expect(kinds(waiting.effects, 'apply')).toEqual([
      { kind: 'apply', sound: nextRemembered, isLent: true },
    ]);
    expect(waiting.state.pending).toBe(nextRemembered);
    expect(waiting.state.live).toBe(original);
  });

  it('a profile loaded gives the song’s sound back and is never filed as the song’s change', () => {
    const yielded = run(borrowed().state, [
      [later + 3, { kind: 'yield' }],
      [later + 4, { kind: 'applied', asked: original, landed: original }],
      [later + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [later + 6, { kind: 'closing' }],
    ]);
    expect(yielded.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('saving a profile keeps what plays after the song ends', () => {
    const kept = run(borrowed().state, [
      [later + 3, { kind: 'keep' }],
      [later + 4, { kind: 'closing' }],
    ]);
    expect(kept.effects).toEqual([{ kind: 'keep' }]);
    expect(kept.state.live).toBe(remembered);
  });

  it('a saved sound that failed to go on is not read as the listener’s change', () => {
    const failed = run(playing().state, [
      [later + 1, { kind: 'matched', identity: songA, song: remembered }],
      [later + 2, { kind: 'applied', asked: remembered, landed: undefined }],
      [later + 3, { kind: 'closing' }],
    ]);
    expect(kinds(failed.effects, 'save')).toEqual([]);
    expect(failed.state.live).toBe(original);
    // Whatever main's loan took is put back exactly, even where what plays
    // already looks like it.
    expect(failed.effects).toContainEqual({
      kind: 'apply',
      sound: original,
      isLent: false,
    });
    expect(kinds(failed.effects, 'keep')).toEqual([]);
  });
});
