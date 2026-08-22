/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DEFAULT_VOLUME,
  readStoredVolume,
  writeStoredVolume,
} from '../../../renderer/library/player/playbackMemory';

const KEY = 'fluideq.library.volume';

describe('volume memory', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts at unity when nothing has been stored', () => {
    expect(readStoredVolume()).toBe(DEFAULT_VOLUME);
    expect(DEFAULT_VOLUME).toBe(1);
  });

  it('round-trips a level the user set', () => {
    writeStoredVolume(0.17);
    expect(readStoredVolume()).toBeCloseTo(0.17, 6);
  });

  it('remembers silence rather than treating it as absent', () => {
    writeStoredVolume(0);
    expect(readStoredVolume()).toBe(0);
  });

  /**
   * Every one of these would otherwise reach `element.volume`, which throws on
   * a value outside 0..1 and would take playback down with it.
   */
  it.each([
    ['not a number', 'loud'],
    ['above the range', '1.5'],
    ['below the range', '-0.2'],
    ['empty', ''],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
  ])('falls back to unity for a stored value that is %s', (_label, stored) => {
    window.localStorage.setItem(KEY, stored);
    expect(readStoredVolume()).toBe(DEFAULT_VOLUME);
  });

  it('survives a storage that refuses to be read', () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage disabled');
      });
    expect(readStoredVolume()).toBe(DEFAULT_VOLUME);
    getItem.mockRestore();
  });

  it('survives a storage that refuses to be written', () => {
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });
    expect(() => writeStoredVolume(0.4)).not.toThrow();
    setItem.mockRestore();
  });

  /**
   * The volume is a preference, the queue is a session.
   *
   * Kept under its own key so clearing what was playing does not also reset
   * how loud the app is — a small annoyance, but one that would repeat.
   */
  it('is stored apart from the playback memory', () => {
    writeStoredVolume(0.42);
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    expect(window.localStorage.getItem('fluideq.library.playback')).toBeNull();
  });
});
