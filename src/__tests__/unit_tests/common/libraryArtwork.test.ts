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

import {
  libraryTileHue,
  libraryTileInitials,
} from '../../../common/library/artwork';

describe('the tile drawn when a track has no cover', () => {
  it('takes initials from the first two words', () => {
    expect(libraryTileInitials('Kind of Blue')).toBe('KO');
    expect(libraryTileInitials('Nevermind')).toBe('NE');
  });

  it('always returns something, for any label at all', () => {
    // A grid of empty squares is what this exists to prevent, so an empty
    // answer is a bug rather than an edge case.
    expect(libraryTileInitials('')).toBe('?');
    expect(libraryTileInitials('   ')).toBe('?');
    expect(libraryTileInitials('日本語')).toHaveLength(2);
  });

  it('gives the same label the same hue every launch', () => {
    // The colour is derived, not stored. If it were random the library would
    // reshuffle its own colours on every start.
    expect(libraryTileHue('Kind of Blue')).toBe(libraryTileHue('Kind of Blue'));
    expect(libraryTileHue('Kind of Blue')).not.toBe(
      libraryTileHue('Nevermind'),
    );
  });

  it('stays inside the colour wheel', () => {
    ['', 'a', 'Kind of Blue', '日本語', 'x'.repeat(400)].forEach((label) => {
      const hue = libraryTileHue(label);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });
  });
});
