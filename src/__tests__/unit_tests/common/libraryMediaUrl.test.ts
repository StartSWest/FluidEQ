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
  libraryMediaUrl,
  librarySizedArtUrl,
  parseLibraryMediaUrl,
} from '../../../common/library/mediaUrl';

describe('the media URL the renderer is handed', () => {
  it('round-trips a track and a cover', () => {
    expect(parseLibraryMediaUrl(libraryMediaUrl('track', 'abc123'))).toEqual({
      kind: 'track',
      id: 'abc123',
    });
    expect(parseLibraryMediaUrl(libraryMediaUrl('art', 'def456'))).toEqual({
      kind: 'art',
      id: 'def456',
    });
  });

  it('refuses anything that is not one of those two shapes', () => {
    // Everything this scheme will ever serve is addressed by an id. A URL
    // carrying a path is not a request it can answer.
    expect(
      parseLibraryMediaUrl('fluideq-media://track/../../secret'),
    ).toBeUndefined();
    expect(parseLibraryMediaUrl('fluideq-media://other/abc')).toBeUndefined();
    expect(
      parseLibraryMediaUrl('file:///C:/Windows/notepad.exe'),
    ).toBeUndefined();
    expect(parseLibraryMediaUrl('fluideq-media://track/')).toBeUndefined();
    expect(parseLibraryMediaUrl('')).toBeUndefined();
  });

  it('lets a cover name one of its sizes, and nothing else carry a query', () => {
    expect(parseLibraryMediaUrl(librarySizedArtUrl('def456', 'small'))).toEqual(
      {
        kind: 'art',
        id: 'def456',
        size: 'small',
      },
    );
    expect(
      parseLibraryMediaUrl(librarySizedArtUrl('def456', 'medium')),
    ).toEqual({ kind: 'art', id: 'def456', size: 'medium' });
    // A song has no sizes, a size the cache does not make is not one, and
    // no other query is part of the grammar.
    expect(
      parseLibraryMediaUrl('fluideq-media://track/abc123?size=small'),
    ).toBeUndefined();
    expect(
      parseLibraryMediaUrl('fluideq-media://art/def456?size=huge'),
    ).toBeUndefined();
    expect(
      parseLibraryMediaUrl('fluideq-media://art/def456?path=../x'),
    ).toBeUndefined();
    expect(
      parseLibraryMediaUrl('fluideq-media://art/def456?size=small&x=1'),
    ).toBeUndefined();
  });
});
