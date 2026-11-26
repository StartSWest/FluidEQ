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

// The sounds, songs and steps Auto EQ's song-sound reducer tests share
// (`songSoundRecorder.test.ts`, `songSoundOwnEq.test.ts`).

export const sound = (presetId: string, gain = 0): ISongSound => ({
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
export const original = sound('music');
export const remembered = sound('cinema', 3);
export const nextRemembered = sound('game', -2);
export const albumSound = sound('vocal', 1);
export const edited = sound('rock', 5);
export const identity = (...args: Parameters<typeof buildSongIdentity>) => {
  const song = buildSongIdentity(...args);
  if (!song) {
    throw new Error('the fixture names no song');
  }
  return song;
};
export const songA = identity('library', 'a', 'Song A', 'Artist');
export const songB = identity('library', 'b', 'Song B', 'Artist');
/** A moment into a song, for what follows its start. */
export const later = 2_000;
export const BOTH: ISongSoundParts = { songs: true, albums: true };
export const album = (saved = albumSound) => ({
  sound: saved,
  title: 'Night Album',
});

export const run = (
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
export const kinds = (
  effects: TSongSoundEffect[],
  kind: TSongSoundEffect['kind'],
) => effects.filter((effect) => effect.kind === kind);
export const playing = (
  song: ISongIdentity = songA,
  parts: ISongSoundParts = BOTH,
) =>
  run(
    { ...getInitialSongSoundState(parts), deviceId: 'main', live: original },
    [
      [0, { kind: 'nowPlaying', identity: song, isPlaying: true }],
      [later, { kind: 'tick' }],
    ],
  );
/** Song A playing its own saved sound, landed. */
export const borrowed = () =>
  run(playing().state, [
    [later + 1, { kind: 'matched', identity: songA, song: remembered }],
    [later + 2, { kind: 'applied', asked: remembered, landed: remembered }],
  ]);
/** Song A playing its album's sound, landed. */
export const onAlbum = (parts: ISongSoundParts = BOTH) =>
  run(playing(songA, parts).state, [
    [later + 1, { kind: 'matched', identity: songA, album: album() }],
    [later + 2, { kind: 'applied', asked: albumSound, landed: albumSound }],
  ]);
