/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import { ISongSound, ISongSoundEntry } from 'common/songSound';
import { SONG_EQ_SETTLE_MS } from 'common/songEqTiming';
import {
  getInitialSongSoundState,
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
const original = sound('music');
const remembered = sound('cinema', 3);
const nextRemembered = sound('game', -2);
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
const entry = (saved: ISongSound): ISongSoundEntry => ({
  sound: saved,
  title: 'Remembered song',
  plays: 1,
  updatedAt: 1,
});

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
const playing = (identity: ISongIdentity = songA) =>
  run({ ...getInitialSongSoundState(true), deviceId: 'main', live: original }, [
    [0, { kind: 'nowPlaying', identity, isPlaying: true }],
    [settledAt, { kind: 'tick' }],
  ]);
const borrowed = () =>
  run(playing().state, [
    [
      settledAt + 1,
      { kind: 'matched', identity: songA, entry: entry(remembered) },
    ],
    [settledAt + 2, { kind: 'applied', asked: remembered, landed: remembered }],
  ]);

describe('song sound lifecycle', () => {
  it('looks up on the owning output and never saves untouched playback', () => {
    const started = playing();
    expect(started.effects).toEqual([
      { kind: 'lookup', deviceId: 'main', identity: songA },
    ]);
    const stopped = run(started.state, [[settledAt + 10, { kind: 'closing' }]]);
    expect(stopped.effects).toEqual([]);
  });

  it('files a deliberate edit to the song and output where it was made', () => {
    const edited = sound('game', 5);
    const result = run(playing().state, [
      [settledAt + 1, { kind: 'soundChanged', sound: edited }],
      [settledAt + 2, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(result.effects).toContainEqual({
      kind: 'save',
      deviceId: 'main',
      identity: songA,
      sound: edited,
    });
    expect(result.effects.filter((effect) => effect.kind === 'apply')).toEqual(
      [],
    );
  });

  it('lends remembered sound and returns the original without saving the automatic change', () => {
    const lent = borrowed();
    expect(lent.effects).toContainEqual({
      kind: 'apply',
      sound: remembered,
      isLent: true,
    });
    const stopped = run(lent.state, [[settledAt + 3, { kind: 'closing' }]]);
    expect(stopped.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('moves between remembered songs without briefly applying a third sound', () => {
    const switched = run(borrowed().state, [
      [settledAt + 3, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [2 * settledAt + 3, { kind: 'tick' }],
      [
        2 * settledAt + 4,
        { kind: 'matched', identity: songB, entry: entry(nextRemembered) },
      ],
      [
        2 * settledAt + 5,
        { kind: 'applied', asked: nextRemembered, landed: nextRemembered },
      ],
    ]);
    expect(
      switched.effects.filter((effect) => effect.kind === 'apply'),
    ).toEqual([{ kind: 'apply', sound: nextRemembered, isLent: true }]);
    const ended = run(switched.state, [
      [2 * settledAt + 6, { kind: 'closing' }],
    ]);
    expect(ended.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
  });

  it('releases a loan on output change without sending the old sound to the new output', () => {
    const changed = run(borrowed().state, [
      [settledAt + 3, { kind: 'deviceChanged', deviceId: 'second' }],
      [2 * settledAt + 4, { kind: 'tick' }],
      [2 * settledAt + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [2 * settledAt + 6, { kind: 'closing' }],
    ]);
    expect(changed.effects).toEqual([{ kind: 'release' }]);
    expect(changed.state.deviceId).toBe('second');
  });

  it('turning memory off returns the original and does not save later edits', () => {
    const disabled = run(borrowed().state, [
      [settledAt + 3, { kind: 'switched', isOn: false }],
      [settledAt + 4, { kind: 'applied', asked: original, landed: original }],
      [settledAt + 5, { kind: 'soundChanged', sound: nextRemembered }],
      [settledAt + 6, { kind: 'closing' }],
    ]);
    expect(disabled.effects).toEqual([
      { kind: 'apply', sound: original, isLent: false },
    ]);
    expect(disabled.state.isOn).toBe(false);
  });

  it('ignores a previous song lookup and an older apply completion', () => {
    const waiting = run(playing(songB).state, [
      [
        settledAt + 1,
        { kind: 'matched', identity: songA, entry: entry(remembered) },
      ],
      [
        settledAt + 2,
        { kind: 'matched', identity: songB, entry: entry(nextRemembered) },
      ],
      [
        settledAt + 3,
        { kind: 'applied', asked: remembered, landed: remembered },
      ],
    ]);
    expect(waiting.effects.filter((effect) => effect.kind === 'apply')).toEqual(
      [{ kind: 'apply', sound: nextRemembered, isLent: true }],
    );
    expect(waiting.state.pending).toBe(nextRemembered);
    expect(waiting.state.live).toBe(original);
  });

  it('a profile action gives borrowed sound back and is never recorded as a song edit', () => {
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

  it('saving a profile keeps its sound after the song finishes', () => {
    const kept = run(borrowed().state, [
      [settledAt + 3, { kind: 'keep' }],
      [settledAt + 4, { kind: 'closing' }],
    ]);
    expect(kept.effects).toEqual([{ kind: 'keep' }]);
    expect(kept.state.live).toBe(remembered);
  });

  it('a failed recalled preset does not become a false user edit', () => {
    const failed = run(playing().state, [
      [
        settledAt + 1,
        { kind: 'matched', identity: songA, entry: entry(remembered) },
      ],
      [
        settledAt + 2,
        { kind: 'applied', asked: remembered, landed: undefined },
      ],
      [settledAt + 3, { kind: 'closing' }],
    ]);
    expect(failed.effects.filter((effect) => effect.kind === 'save')).toEqual(
      [],
    );
    expect(failed.state.pending).toBeUndefined();
    expect(failed.state.live).toBe(original);
    expect(failed.effects).toContainEqual({ kind: 'keep' });
  });
});
