/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { isSongSoundChanged } from 'common/songSoundChoices';
import { ISongSound, TSavedSound } from 'common/songSound';
import { ISongSoundState } from 'common/songSoundRecorder';
import {
  albumSound,
  kinds,
  later,
  original,
  playing,
  run,
  songA,
  songB,
  sound,
} from '../../utils/songSoundFixtures';

// Ivan, 2026-11-26, Album sounds on and Song sounds off, a band moved: "it
// cannot say changed ... I am not modifying the album song preset or the
// song song ... I am just updating the main eq". A preset picked for a song
// or an album in the Library is a preset alone: it covers the preset, and the
// bands and Tone under it stay the listener's own EQ.

/** Song A playing its album's sound as the Library keeps it, landed. */
const onAlbumWith = (saved: TSavedSound, landed: ISongSound) => {
  const parts = { songs: false, albums: true };
  const lent = run(playing(songA, parts).state, [
    [
      later + 1,
      { kind: 'matched', identity: songA, album: { sound: saved, title: 'X' } },
    ],
  ]);
  const asked = lent.state.pending;
  if (!asked) {
    throw new Error('the album’s sound was not put on');
  }
  return {
    effects: lent.effects,
    state: run(lent.state, [[later + 2, { kind: 'applied', asked, landed }]])
      .state,
  };
};
const popOverOwn: ISongSound = { ...original, presetId: 'pop' };
/** The bands with one moved, under the preset named. */
const moved = (presetId: string): ISongSound => sound(presetId, 7);

describe('Auto EQ song sounds: a preset alone covers the preset, and the bands stay the listener’s', () => {
  it('lends a preset alone as a preset alone, over the listener’s own bands', () => {
    const { effects } = onAlbumWith({ presetId: 'pop' }, popOverOwn);
    expect(kinds(effects, 'apply')).toEqual([
      { kind: 'apply', sound: popOverOwn, isLent: true, presetOnly: true },
    ]);
  });

  it('a band moved under it is the listener’s own EQ: not "Changed", and theirs at the end', () => {
    const { state } = onAlbumWith({ presetId: 'pop' }, popOverOwn);
    const edited = run(state, [
      [later + 3, { kind: 'soundChanged', sound: moved('pop') }],
    ]);
    expect(isSongSoundChanged(edited.state)).toBe(false);
    expect(edited.state.working?.[songA.key]).toBeUndefined();
    // The song's end hands back the preset; the bands were never lent.
    const ended = run(edited.state, [[later + 4, { kind: 'closing' }]]);
    expect(kinds(ended.effects, 'apply')).toEqual([
      { kind: 'apply', sound: moved('music'), isLent: false },
    ]);
    // The control: over an album's whole sound, a band moved is a change to it.
    const whole = onAlbumWith(albumSound, albumSound);
    const changed = run(whole.state, [
      [later + 3, { kind: 'soundChanged', sound: moved('vocal') }],
    ]);
    expect(isSongSoundChanged(changed.state)).toBe(true);
  });

  it('a preset picked over it is the song’s change, and plays again over the listener’s bands', () => {
    const { state } = onAlbumWith({ presetId: 'pop' }, popOverOwn);
    const rock: ISongSound = { ...original, presetId: 'rock' };
    const changed = run(state, [
      [later + 3, { kind: 'soundChanged', sound: rock }],
    ]);
    expect(isSongSoundChanged(changed.state)).toBe(true);
    // Song B, then song A again after the listener moved a band of their own.
    const ownMoved = moved('music');
    const handed = run(changed.state, [
      [later + 4, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [later + 5, { kind: 'matched', identity: songB }],
    ]).state;
    const own = handed.pending;
    if (!own) {
      throw new Error('the listener’s own was not handed back');
    }
    const back: ISongSoundState = run(handed, [
      [later + 6, { kind: 'applied', asked: own, landed: own }],
      [later + 7, { kind: 'soundChanged', sound: ownMoved }],
    ]).state;
    const again = run(back, [
      [later + 8, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [
        later + 9,
        {
          kind: 'matched',
          identity: songA,
          album: { sound: { presetId: 'pop' }, title: 'X' },
        },
      ],
    ]);
    expect(kinds(again.effects, 'apply')).toEqual([
      {
        kind: 'apply',
        sound: { ...ownMoved, presetId: 'rock' },
        isLent: true,
        presetOnly: true,
      },
    ]);
  });

  it('"Save for this song" over it lends what plays whole from then on', () => {
    const songsToo = { songs: true, albums: true };
    const lent = run(playing(songA, songsToo).state, [
      [
        later + 1,
        {
          kind: 'matched',
          identity: songA,
          album: { sound: { presetId: 'pop' }, title: 'X' },
        },
      ],
    ]);
    const asked = lent.state.pending;
    if (!asked) {
      throw new Error('the album’s sound was not put on');
    }
    const saved = run(lent.state, [
      [later + 2, { kind: 'applied', asked, landed: popOverOwn }],
      [later + 3, { kind: 'saveNow' }],
    ]);
    expect(saved.effects).toEqual([
      { kind: 'save', identity: songA, sound: popOverOwn },
      { kind: 'apply', sound: popOverOwn, isLent: true },
    ]);
    expect(saved.state.session?.isPresetOnly).toBe(false);
  });
});
