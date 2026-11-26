/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { isSongSoundChanged } from 'common/songSoundChoices';
import { ISongSound } from 'common/songSound';
import { ISongSoundState, TSongSoundEffect } from 'common/songSoundRecorder';
import { SONG_SOUND_WORKING_MAX } from 'common/songSoundWorking';
import {
  borrowed,
  edited,
  identity,
  kinds,
  later,
  nextRemembered,
  original,
  playing,
  remembered,
  run,
  songA,
  songB,
  sound,
} from '../../utils/songSoundFixtures';

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
        presetOnly: true,
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
