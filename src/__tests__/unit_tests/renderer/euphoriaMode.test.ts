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
 * Rainbow mode is always on (Ivan, 2026-09-26: "rainbow mode is always on",
 * "just make sure is always on and thats it"). The unlock and the switch are
 * still in the store, because everything that draws asks it; what these hold
 * is that nothing can make either answer "off".
 */
describe('Rainbow mode, always on', () => {
  beforeEach(() => window.localStorage.clear());

  it('is won and switched on from a fresh install', () => {
    const mode = load();
    expect(mode.isEuphoriaAchieved()).toBe(true);
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('is on whatever an older version stored', () => {
    window.localStorage.setItem('fluideq-euphoria-reached', 'false');
    window.localStorage.setItem('fluideq-euphoria-enabled', 'false');
    // The control: what is stored really does say off.
    expect(window.localStorage.getItem('fluideq-euphoria-enabled')).toBe(
      'false',
    );
    const mode = load();
    expect(mode.isEuphoriaAchieved()).toBe(true);
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('cannot be switched off, by the switch or by Ctrl+E', () => {
    const mode = load();
    mode.setEuphoriaEnabled(false);
    expect(mode.isEuphoriaEnabled()).toBe(true);
    mode.toggleEuphoriaEnabled();
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('stays on when a run wins it again', () => {
    const mode = load();
    mode.winEuphoria();
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('resolves to on whatever the run says', () => {
    // The rule the whole app reads (`useIsEuphoric`), through the plain
    // functions, since the hook needs a renderer.
    const mode = load();
    const resolve = (isEarned: boolean) =>
      mode.isEuphoriaAchieved() ? mode.isEuphoriaEnabled() : isEarned;
    expect(resolve(false)).toBe(true);
    expect(resolve(true)).toBe(true);
  });

  it('is kept by the development reset, which clears only what was stored', () => {
    window.localStorage.setItem('fluideq-euphoria-reached', 'true');
    window.localStorage.setItem('fluideq-euphoria-enabled', 'false');
    const mode = load();
    mode.resetEuphoriaMode();
    expect(window.localStorage.getItem('fluideq-euphoria-reached')).toBeNull();
    expect(window.localStorage.getItem('fluideq-euphoria-enabled')).toBeNull();
    expect(mode.isEuphoriaAchieved()).toBe(true);
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
      // Winning must not throw out of the render that noticed the ceiling.
      const mode = load();
      expect(mode.isEuphoriaEnabled()).toBe(true);
      expect(() => mode.winEuphoria()).not.toThrow();
      expect(mode.isEuphoriaEnabled()).toBe(true);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
