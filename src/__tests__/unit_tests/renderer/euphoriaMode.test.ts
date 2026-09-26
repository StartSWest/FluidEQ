/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

/**
 * Rainbow mode: nothing to unlock, on unless switched off (Ivan, 2026-09-26:
 * "rainbow mode is always on", then "let's keep the normal mode and the
 * rainbow mode"). The switch lives in the Window colours menu and the app
 * menu (`RainbowSwitch`).
 */
describe('Rainbow mode, on by default and switchable', () => {
  beforeEach(() => window.localStorage.clear());

  it('is won and switched on from a fresh install', () => {
    const mode = load();
    expect(mode.isEuphoriaAchieved()).toBe(true);
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('switches off and on, and remembers the choice across restarts', () => {
    const first = load();
    first.setEuphoriaEnabled(false);
    expect(first.isEuphoriaEnabled()).toBe(false);
    expect(load().isEuphoriaEnabled()).toBe(false);

    const second = load();
    second.toggleEuphoriaEnabled();
    expect(second.isEuphoriaEnabled()).toBe(true);
    expect(load().isEuphoriaEnabled()).toBe(true);
  });

  // The key the mode was a prize under is not read: somebody who switched
  // it off back then starts on, like everybody else.
  it('starts on whatever an older version stored', () => {
    window.localStorage.setItem('fluideq-euphoria-reached', 'false');
    window.localStorage.setItem('fluideq-euphoria-enabled', 'false');
    expect(load().isEuphoriaEnabled()).toBe(true);
    // The control: its own key does switch it off.
    window.localStorage.setItem('fluideq-rainbow', 'off');
    expect(load().isEuphoriaEnabled()).toBe(false);
  });

  it('switches back on when a run wins it', () => {
    const mode = load();
    mode.setEuphoriaEnabled(false);
    mode.winEuphoria();
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('resolves to the switch whatever the run says', () => {
    // The rule the whole app reads (`useIsEuphoric`), through the plain
    // functions, since the hook needs a renderer.
    const mode = load();
    const resolve = (isEarned: boolean) =>
      mode.isEuphoriaAchieved() ? mode.isEuphoriaEnabled() : isEarned;
    mode.setEuphoriaEnabled(false);
    expect(resolve(true)).toBe(false);
    mode.setEuphoriaEnabled(true);
    expect(resolve(false)).toBe(true);
  });

  it('is put back on by the development reset, which clears every key', () => {
    window.localStorage.setItem('fluideq-euphoria-reached', 'true');
    window.localStorage.setItem('fluideq-euphoria-enabled', 'false');
    const mode = load();
    mode.setEuphoriaEnabled(false);
    mode.resetEuphoriaMode();
    [
      'fluideq-euphoria-reached',
      'fluideq-euphoria-enabled',
      'fluideq-rainbow',
    ].forEach((key) => expect(window.localStorage.getItem(key)).toBeNull());
    expect(mode.isEuphoriaEnabled()).toBe(true);
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
      const mode = load();
      expect(mode.isEuphoriaEnabled()).toBe(true);
      expect(() => mode.setEuphoriaEnabled(false)).not.toThrow();
      // The session still follows the choice it could not remember.
      expect(mode.isEuphoriaEnabled()).toBe(false);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
