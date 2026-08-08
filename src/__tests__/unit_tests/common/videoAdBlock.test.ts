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

import {
  VIDEO_AD_BLOCK_DEFAULT,
  isAdBlockRevealChord,
} from '../../../common/videoAdBlock';

const chord = (over: Partial<Parameters<typeof isAdBlockRevealChord>[0]>) => ({
  code: 'KeyB',
  ctrlKey: true,
  shiftKey: true,
  altKey: true,
  ...over,
});

describe('ad blocker default', () => {
  /**
   * Not a preference. A fresh install has to meet the sites with their
   * advertising intact, because the alternative is the app having decided
   * something on the user's behalf that is theirs to decide.
   */
  it('is off', () => {
    expect(VIDEO_AD_BLOCK_DEFAULT).toBe(false);
  });
});

describe('the chord that reveals the switch', () => {
  it('is Ctrl+Shift+Alt+B', () => {
    expect(isAdBlockRevealChord(chord({}))).toBe(true);
  });

  /**
   * Every modifier is load-bearing. Alt especially: it is what keeps this from
   * ever being half of a shortcut something else in the app owns, and dropping
   * it in a refactor would be silent.
   */
  it('needs all three modifiers', () => {
    expect(isAdBlockRevealChord(chord({ altKey: false }))).toBe(false);
    expect(isAdBlockRevealChord(chord({ ctrlKey: false }))).toBe(false);
    expect(isAdBlockRevealChord(chord({ shiftKey: false }))).toBe(false);
  });

  it('ignores every other key', () => {
    expect(isAdBlockRevealChord(chord({ code: 'KeyE' }))).toBe(false);
    expect(isAdBlockRevealChord(chord({ code: 'KeyV' }))).toBe(false);
  });
});
