/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

const load = () => {
  let mod: typeof import('renderer/utils/euphoriaMode');
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    mod = require('renderer/utils/euphoriaMode');
  });
  return mod!;
};

describe('euphoria unlock', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts locked on a fresh install', () => {
    const mode = load();
    expect(mode.hasReachedEuphoria()).toBe(false);
  });

  it('cannot be switched on before it has been earned', () => {
    // The whole reward is that the first x10 is a surprise. A switch that
    // works before anyone reaches it puts the surprise on the titlebar.
    const mode = load();
    mode.setEuphoriaForced(true);
    expect(mode.isEuphoriaForced()).toBe(false);
  });

  it('unlocks once, and stays unlocked across restarts', () => {
    const first = load();
    first.markEuphoriaReached();
    expect(first.hasReachedEuphoria()).toBe(true);

    // A fresh module, as if the app had been reopened.
    const second = load();
    expect(second.hasReachedEuphoria()).toBe(true);
  });

  it('toggles freely once unlocked', () => {
    const mode = load();
    mode.markEuphoriaReached();
    mode.toggleEuphoriaForced();
    expect(mode.isEuphoriaForced()).toBe(true);
    mode.toggleEuphoriaForced();
    expect(mode.isEuphoriaForced()).toBe(false);
  });

  it('does not remember being switched on', () => {
    // Reaching the ceiling is an achievement and outlives the app; leaving the
    // rainbow on is a mood. An equaliser that reopens in full spectrum every
    // morning because of one click last week is the wrong default.
    const first = load();
    first.markEuphoriaReached();
    first.setEuphoriaForced(true);

    const second = load();
    expect(second.hasReachedEuphoria()).toBe(true);
    expect(second.isEuphoriaForced()).toBe(false);
  });

  it('is given back by the development reset', () => {
    const mode = load();
    mode.markEuphoriaReached();
    mode.setEuphoriaForced(true);
    mode.resetEuphoriaMode();
    expect(mode.hasReachedEuphoria()).toBe(false);
    expect(mode.isEuphoriaForced()).toBe(false);
    // And it does not come back on the next launch.
    expect(load().hasReachedEuphoria()).toBe(false);
  });

  it('survives storage being unavailable', () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    const setItem = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('denied');
      });
    try {
      // Locked is the safe direction to fail in, and marking it must not throw
      // out of the render that noticed the ceiling.
      const mode = load();
      expect(mode.hasReachedEuphoria()).toBe(false);
      expect(() => mode.markEuphoriaReached()).not.toThrow();
      // Unlocked for this session even though it could not be written.
      expect(mode.hasReachedEuphoria()).toBe(true);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
