/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

describe('euphoria unlock', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts locked on a fresh install', () => {
    const mode = load();
    expect(mode.isEuphoriaAchieved()).toBe(false);
  });

  it('cannot be switched on before it has been earned', () => {
    // The whole reward is that the first x10 is a surprise. A switch that
    // works before anyone reaches it puts the surprise on the titlebar.
    const mode = load();
    mode.setEuphoriaEnabled(true);
    expect(mode.isEuphoriaEnabled()).toBe(false);
  });

  it('unlocks once, and stays unlocked across restarts', () => {
    const first = load();
    first.winEuphoria();
    expect(first.isEuphoriaAchieved()).toBe(true);

    // A fresh module, as if the app had been reopened.
    const second = load();
    expect(second.isEuphoriaAchieved()).toBe(true);
  });

  it('switches the look on at the moment it is won', () => {
    // Winning is when the mode is worth seeing. Unlocking a switch and leaving
    // it off would mean the reward for thirty-six perfect taps is a button.
    const mode = load();
    mode.winEuphoria();
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('can be switched off after winning, which is the whole point', () => {
    // This is the bug that prompted the two-flag split. The mode used to be
    // "the streak is at the ceiling OR the switch is on", and a streak does
    // not reset when somebody stops playing — so the first half stayed true
    // indefinitely and the switch could never turn anything off.
    const mode = load();
    mode.winEuphoria();
    mode.toggleEuphoriaEnabled();
    expect(mode.isEuphoriaEnabled()).toBe(false);
    expect(mode.isEuphoriaAchieved()).toBe(true);
    mode.toggleEuphoriaEnabled();
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('keeps the achievement when the look is switched off', () => {
    // Turning the colour off is not giving the trophy back.
    const mode = load();
    mode.winEuphoria();
    mode.setEuphoriaEnabled(false);
    expect(mode.isEuphoriaAchieved()).toBe(true);
  });

  it('switches back on when a later run wins it again', () => {
    const mode = load();
    mode.winEuphoria();
    mode.setEuphoriaEnabled(false);
    mode.winEuphoria();
    expect(mode.isEuphoriaEnabled()).toBe(true);
  });

  it('resolves to the switch once won, and to the run before that', () => {
    // The rule the whole app reads. Before winning, a run at the ceiling
    // lights it up on its own — that first arrival is the surprise. After
    // winning, the switch decides and the run has no say, which is what makes
    // it possible to turn off.
    const mode = load();
    const atCeiling = true;
    expect(mode.useIsEuphoric).toBeDefined();

    // Exercised through the plain functions, since the hook needs a renderer.
    const resolve = (isEarned: boolean) =>
      mode.isEuphoriaAchieved() ? mode.isEuphoriaEnabled() : isEarned;

    expect(resolve(atCeiling)).toBe(true);
    mode.winEuphoria();
    expect(resolve(atCeiling)).toBe(true);
    mode.setEuphoriaEnabled(false);
    // Still at the ceiling, and still off. This is the fix.
    expect(resolve(atCeiling)).toBe(false);
  });

  it('does not remember being switched on', () => {
    // Reaching the ceiling is an achievement and outlives the app; leaving the
    // rainbow on is a mood. An equaliser that reopens in full spectrum every
    // morning because of one click last week is the wrong default.
    const first = load();
    first.winEuphoria();
    first.setEuphoriaEnabled(true);

    const second = load();
    expect(second.isEuphoriaAchieved()).toBe(true);
    expect(second.isEuphoriaEnabled()).toBe(false);
  });

  it('is given back by the development reset', () => {
    const mode = load();
    mode.winEuphoria();
    mode.setEuphoriaEnabled(true);
    mode.resetEuphoriaMode();
    expect(mode.isEuphoriaAchieved()).toBe(false);
    expect(mode.isEuphoriaEnabled()).toBe(false);
    // And it does not come back on the next launch.
    expect(load().isEuphoriaAchieved()).toBe(false);
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
      expect(mode.isEuphoriaAchieved()).toBe(false);
      expect(() => mode.winEuphoria()).not.toThrow();
      // Unlocked for this session even though it could not be written.
      expect(mode.isEuphoriaAchieved()).toBe(true);
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
