/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { isSongSoundChanged } from 'common/songSoundChoices';
import { ISongSound } from 'common/songSound';
import {
  getInitialSongSoundState,
  ISongSoundParts,
  ISongSoundState,
  TSongSoundEvent,
} from 'common/songSoundRecorder';
import {
  identity,
  kinds,
  later,
  run,
  sound,
} from '../../utils/songSoundFixtures';

// Ivan, 2026-11-26: "it started as kpop but it was playing and chose album
// ballad and is not changing it". A song of the album played his own K-pop;
// Ballad chosen for its album in the Library has to go on at once, and
// "Changed" with Restore is only ever his own hand after it, never the choice
// itself, and never a Ballad that could not be put on.

const PARTS: ISongSoundParts[] = [
  { songs: true, albums: true },
  { songs: false, albums: true },
];
const ALBUM_KEY = 'slow songs\u001fartist';
const song = {
  ...identity('library', 'ballad-1', 'Song', 'Artist'),
  albumKey: ALBUM_KEY,
};
/** His own sound: K-pop over his bands. */
const own: ISongSound = { ...sound('kPop'), filters: sound('kPop', 2).filters };
/** Ballad picked as a preset alone: his bands under it. */
const balladOverOwn: ISongSound = { ...own, presetId: 'ballad' };
const ballad = { sound: { presetId: 'ballad' }, title: 'Slow Songs' };

/** The song playing his own sound: nothing is kept for it yet. */
const playingOwn = (parts: ISongSoundParts) =>
  run({ ...getInitialSongSoundState(parts), deviceId: 'main', live: own }, [
    [0, { kind: 'nowPlaying', identity: song, isPlaying: true }],
    [later, { kind: 'tick' }],
    [later + 1, { kind: 'matched', identity: song }],
  ]);

/**
 * Ballad kept for the album while the song plays: main says what is kept
 * changed (`reconsider`, before its reply) and the menu then says it was a
 * pick (`picked`), and both look-ups are answered with the album's Ballad,
 * in the order given.
 */
const pickBallad = (state: ISongSoundState, pickAnsweredFirst = false) => {
  const asked = run(state, [
    [later + 2, { kind: 'reconsider' }],
    [later + 3, { kind: 'picked' }],
  ]);
  const plain: TSongSoundEvent = {
    kind: 'matched',
    identity: song,
    album: ballad,
  };
  const pick: TSongSoundEvent = { ...plain, isPick: true };
  const answers = pickAnsweredFirst ? [pick, plain] : [plain, pick];
  const answered = run(
    asked.state,
    answers.map((event, at): [number, TSongSoundEvent] => [
      later + 4 + at,
      event,
    ]),
  );
  return { asked, answered };
};

/** What main answers for the last sound asked: landed, or refused. */
const answerApply = (
  state: ISongSoundState,
  landed: ISongSound | undefined,
) => {
  const { pending } = state;
  if (!pending) {
    throw new Error('nothing was asked for');
  }
  return run(state, [
    [
      later + 10,
      landed
        ? { kind: 'applied', asked: pending, landed }
        : { kind: 'applied', asked: pending },
    ],
  ]);
};

describe.each(PARTS)(
  'Auto EQ: an album sound chosen while its album plays (%o)',
  (parts) => {
    it('starts from the song playing his own K-pop, nothing saved', () => {
      const { state } = playingOwn(parts);
      expect(state.session?.owner).toBeUndefined();
      expect(isSongSoundChanged(state)).toBe(false);
    });

    it.each([false, true])(
      'goes on at once as a preset over his bands, and is not "Changed" once it lands (pick answered first: %s)',
      (pickAnsweredFirst) => {
        const { asked, answered } = pickBallad(
          playingOwn(parts).state,
          pickAnsweredFirst,
        );
        expect(kinds(asked.effects, 'lookup')).toEqual([
          { kind: 'lookup', identity: song },
          { kind: 'lookup', identity: song, isPick: true },
        ]);
        const putOn = kinds(answered.effects, 'apply');
        expect(putOn.length).toBeGreaterThan(0);
        putOn.forEach((effect) =>
          expect(effect).toEqual({
            kind: 'apply',
            sound: balladOverOwn,
            isLent: true,
            presetOnly: true,
          }),
        );
        const landed = answerApply(answered.state, balladOverOwn);
        const heard = run(landed.state, [
          [later + 11, { kind: 'soundChanged', sound: balladOverOwn }],
        ]);
        expect(heard.state.session?.owner).toBe('album');
        expect(heard.state.live?.presetId).toBe('ballad');
        expect(isSongSoundChanged(heard.state)).toBe(false);
        expect(heard.state.working?.[song.key]).toBeUndefined();
      },
    );

    it('control: his own hand on the preset after it is "Changed", and Restore puts Ballad back', () => {
      const { answered } = pickBallad(playingOwn(parts).state);
      const landed = answerApply(answered.state, balladOverOwn);
      const rock: ISongSound = { ...own, presetId: 'rock' };
      const changed = run(landed.state, [
        [later + 11, { kind: 'soundChanged', sound: rock }],
      ]);
      expect(isSongSoundChanged(changed.state)).toBe(true);
      const restored = run(changed.state, [[later + 12, { kind: 'revert' }]]);
      expect(kinds(restored.effects, 'apply')).toEqual([
        { kind: 'apply', sound: balladOverOwn, isLent: true },
      ]);
    });

    it('a Ballad main refused never went on: not "Changed", nothing offered, and his own sound handed back', () => {
      const { answered } = pickBallad(playingOwn(parts).state);
      const refused = answerApply(answered.state, undefined);
      expect(refused.state.session?.owner).toBeUndefined();
      expect(isSongSoundChanged(refused.state)).toBe(false);
      // Whatever main still held lent ends, with his own sound exactly.
      expect(kinds(refused.effects, 'apply')).toEqual([
        { kind: 'apply', sound: own, isLent: false },
      ]);
      // His hand on the EQ from here is his own EQ, not a change to Ballad.
      const handedBack = answerApply(refused.state, own);
      const moved = run(handedBack.state, [
        [
          later + 11,
          { kind: 'soundChanged', sound: { ...own, presetId: 'rock' } },
        ],
      ]);
      expect(isSongSoundChanged(moved.state)).toBe(false);
      expect(moved.state.working?.[song.key]).toBeUndefined();
    });

    it('control: the same ask landed is the album’s sound, owned and lent', () => {
      const { answered } = pickBallad(playingOwn(parts).state);
      const landed = answerApply(answered.state, balladOverOwn);
      expect(landed.state.session?.owner).toBe('album');
      expect(landed.state.session?.goingOn).toBeUndefined();
      expect(kinds(landed.effects, 'apply')).toEqual([]);
    });

    it('a refused Restore leaves the change offered; the control, landed, is no change', () => {
      const { answered } = pickBallad(playingOwn(parts).state);
      const landed = answerApply(answered.state, balladOverOwn);
      const changed = run(landed.state, [
        [
          later + 11,
          { kind: 'soundChanged', sound: { ...own, presetId: 'rock' } },
        ],
        [later + 12, { kind: 'revert' }],
      ]);
      const refused = answerApply(changed.state, undefined);
      expect(refused.state.session?.owner).toBe('album');
      expect(isSongSoundChanged(refused.state)).toBe(true);
      const restored = answerApply(changed.state, balladOverOwn);
      expect(isSongSoundChanged(restored.state)).toBe(false);
    });
  },
);
