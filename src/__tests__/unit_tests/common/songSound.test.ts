/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { FilterTypeEnum, IFiltersMap } from 'common/constants';
import {
  ISongSound,
  isWholeSound,
  sameSongSound,
  soundToPlay,
  toSavedSound,
  toSongSound,
} from 'common/songSound';

// What a saved sound is (Auto EQ): a whole sound — preset, Tone and bands —
// or a preset alone, picked in the Library, that plays over the listener's
// own Tone and bands. Where it is kept is `songSoundMemory.test.ts`.

const filters = (gain: number): IFiltersMap => ({
  bass: {
    id: 'bass',
    frequency: 100,
    gain,
    quality: 1,
    type: FilterTypeEnum.PK,
  },
  treble: {
    id: 'treble',
    frequency: 8000,
    gain: 0,
    quality: 1,
    type: FilterTypeEnum.PK,
  },
});

const sound = (presetId: string, gain: number): ISongSound => ({
  presetId,
  filters: filters(gain),
  tone: { bass: gain, mid: 0, treble: 0 },
});

describe('a song’s sound', () => {
  it('compares what is heard, whatever order the bands come back in and however a flat Tone is spelled', () => {
    const first = sound('music', 0);
    const reordered = {
      presetId: 'music',
      filters: { treble: first.filters.treble, bass: first.filters.bass },
    };
    expect(sameSongSound(first, reordered)).toBe(true);
    expect(
      sameSongSound(first, {
        ...reordered,
        filters: {
          ...reordered.filters,
          bass: { ...first.filters.bass, isEnabled: false },
        },
      }),
    ).toBe(false);
    expect(sameSongSound(first, sound('cinema', 0))).toBe(false);
    expect(sameSongSound(first, sound('music', 1))).toBe(false);
  });

  it('rejects the whole stored sound when any band does not read', () => {
    const valid = sound('music', 2);
    expect(toSongSound(valid)).toEqual(valid);
    expect(
      toSongSound({
        ...valid,
        filters: { ...valid.filters, broken: { gain: 2 } },
      }),
    ).toBeUndefined();
    expect(toSongSound({ ...valid, filters: {} })).toBeUndefined();
    expect(
      toSongSound({ ...valid, presetId: 'x'.repeat(121) }),
    ).toBeUndefined();
  });
});

describe('a saved sound', () => {
  it('reads a whole sound and a preset alone apart', () => {
    const whole = sound('music', 2);
    expect(toSavedSound(whole)).toEqual(whole);
    expect(toSavedSound({ presetId: 'cinema' })).toEqual({
      presetId: 'cinema',
    });
    expect(isWholeSound(whole)).toBe(true);
    expect(isWholeSound({ presetId: 'cinema' })).toBe(false);
  });

  it('never plays a whole sound with broken bands as its preset alone', () => {
    expect(
      toSavedSound({ presetId: 'music', filters: { broken: { gain: 2 } } }),
    ).toBeUndefined();
  });

  it('refuses a pick of nothing and anything that is not a sound', () => {
    expect(toSavedSound({ presetId: '' })).toBeUndefined();
    expect(toSavedSound({ presetId: 'x'.repeat(121) })).toBeUndefined();
    expect(toSavedSound({ presetId: 3 })).toBeUndefined();
    expect(toSavedSound([{ presetId: 'music' }])).toBeUndefined();
    expect(toSavedSound(null)).toBeUndefined();
    expect(toSavedSound('music')).toBeUndefined();
  });

  it('plays a preset alone over the listener’s own Tone and bands, and a whole sound as it is', () => {
    const own = sound('music', 4);
    const whole = sound('cinema', -2);
    expect(soundToPlay({ presetId: 'vocal' }, own)).toEqual({
      ...own,
      presetId: 'vocal',
    });
    expect(soundToPlay(whole, own)).toBe(whole);
  });
});
