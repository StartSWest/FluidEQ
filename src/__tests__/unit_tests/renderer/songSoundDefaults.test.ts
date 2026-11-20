/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { getInitialSongSoundState } from 'common/songSoundRecorder';
import {
  AUTO_EQ_MOVED_NOTE_KEY,
  AUTO_EQ_PARTS_KEY,
  OLD_SONG_SOUND_KEY,
  isAutoEqMovedNoteDue,
  markAutoEqMovedNoteSeen,
} from 'renderer/audio/autoEqParts';
import {
  readSongSoundParts,
  resetSongSoundSession,
  setSongSoundParts,
} from 'renderer/audio/songSoundSession';
import { forgetSettings } from 'renderer/utils/settingsReset';

// Auto EQ's two switches for saved sounds, Song sounds and Album sounds, as
// this machine keeps them — and what the Output panel's old "Remember each
// song's sound" switch carries over into them.

const OFF = { songs: false, albums: false };
const BOTH = { songs: true, albums: true };

describe('Auto EQ’s song and album switches', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSongSoundSession();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    resetSongSoundSession();
  });

  it('start off until the listener turns them on', () => {
    expect(getInitialSongSoundState().isOn).toBe(false);
    expect(readSongSoundParts()).toEqual(OFF);
  });

  it('keep each switch apart', () => {
    setSongSoundParts({ songs: false, albums: true });
    resetSongSoundSession();
    expect(readSongSoundParts()).toEqual({ songs: false, albums: true });
    expect(JSON.parse(localStorage.getItem(AUTO_EQ_PARTS_KEY) ?? '')).toEqual({
      songs: false,
      albums: true,
    });
  });

  it.each([
    ['true', BOTH],
    ['false', OFF],
  ])('carry the old switch’s choice %s over as both parts', (saved, parts) => {
    localStorage.setItem(OLD_SONG_SOUND_KEY, saved);
    resetSongSoundSession();
    expect(readSongSoundParts()).toEqual(parts);
  });

  it('follow the new switches over the old one once they are set', () => {
    localStorage.setItem(OLD_SONG_SOUND_KEY, 'true');
    localStorage.setItem(
      AUTO_EQ_PARTS_KEY,
      JSON.stringify({ songs: true, albums: false }),
    );
    resetSongSoundSession();
    expect(readSongSoundParts()).toEqual({ songs: true, albums: false });
  });

  it('read a kept value that is not theirs as off', () => {
    localStorage.setItem(AUTO_EQ_PARTS_KEY, '{ broken');
    resetSongSoundSession();
    expect(readSongSoundParts()).toEqual(OFF);
    localStorage.setItem(AUTO_EQ_PARTS_KEY, JSON.stringify({ songs: 'yes' }));
    resetSongSoundSession();
    expect(readSongSoundParts()).toEqual(OFF);
  });

  it('start off when storage cannot be read', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });
    resetSongSoundSession();
    expect(readSongSoundParts()).toEqual(OFF);
  });

  it('return to off after Reset all settings and the next load', () => {
    localStorage.setItem(OLD_SONG_SOUND_KEY, 'true');
    setSongSoundParts({ songs: true, albums: false });
    expect(readSongSoundParts()).toEqual({ songs: true, albums: false });

    forgetSettings(localStorage);
    resetSongSoundSession();

    expect(localStorage.getItem(AUTO_EQ_PARTS_KEY)).toBeNull();
    expect(localStorage.getItem(OLD_SONG_SOUND_KEY)).toBeNull();
    expect(readSongSoundParts()).toEqual(OFF);
  });
});

describe('the note that the old switch moved', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('is shown once, only to whoever had the old switch on', () => {
    expect(isAutoEqMovedNoteDue()).toBe(false);
    localStorage.setItem(OLD_SONG_SOUND_KEY, 'false');
    expect(isAutoEqMovedNoteDue()).toBe(false);

    localStorage.setItem(OLD_SONG_SOUND_KEY, 'true');
    expect(isAutoEqMovedNoteDue()).toBe(true);
    markAutoEqMovedNoteSeen();
    expect(localStorage.getItem(AUTO_EQ_MOVED_NOTE_KEY)).toBe('true');
    expect(isAutoEqMovedNoteDue()).toBe(false);
  });
});
