/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { getInitialSongSoundState } from 'common/songSoundRecorder';
import {
  isSongSoundOn,
  resetSongSoundSession,
  setSongSoundOn,
} from 'renderer/audio/songSoundSession';
import { forgetSettings } from 'renderer/utils/settingsReset';

describe('song sound preference', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSongSoundSession();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    resetSongSoundSession();
  });

  it('starts off until the listener enables it', () => {
    expect(getInitialSongSoundState().isOn).toBe(false);
    expect(isSongSoundOn()).toBe(false);
  });

  it.each(['true', 'false'])('keeps the explicit saved choice %s', (saved) => {
    localStorage.setItem('fluideq.songSound', saved);
    resetSongSoundSession();
    expect(isSongSoundOn()).toBe(saved === 'true');
  });

  it('starts off when storage cannot be read', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is unavailable');
    });
    resetSongSoundSession();
    expect(isSongSoundOn()).toBe(false);
  });

  it('returns to off after Reset all settings and the next load', () => {
    setSongSoundOn(true);
    expect(isSongSoundOn()).toBe(true);
    expect(localStorage.getItem('fluideq.songSound')).toBe('true');

    forgetSettings(localStorage);
    resetSongSoundSession();

    expect(localStorage.getItem('fluideq.songSound')).toBeNull();
    expect(isSongSoundOn()).toBe(false);
  });
});
