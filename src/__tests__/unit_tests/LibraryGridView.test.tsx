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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ILibraryTrack } from '../../common/library/types';
import LibraryGridView from '../../renderer/library/LibraryGridView';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'r',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

describe('the library as a grid', () => {
  it('draws a tile per album and opens the one that was clicked', async () => {
    const onOpenAlbum = jest.fn();
    render(
      <I18nProvider>
        <LibraryGridView
          tracks={[
            track({ title: 'A', album: 'Kind', artist: 'Miles' }),
            track({ title: 'B', album: 'Bitches', artist: 'Miles' }),
          ]}
          browseMode="album"
          onOpenAlbum={onOpenAlbum}
          onOpenArtist={jest.fn()}
          onPlayTrack={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await userEvent.click(screen.getByText('Kind'));
    expect(onOpenAlbum).toHaveBeenCalled();
  });

  it('gives an untagged album a tile rather than a blank square', () => {
    // Nothing here has an artId, so every tile is generated. A grid of empty
    // squares reads as a failed load. `libraryTileInitials` takes the first
    // letter of each of the first two words, so 'Unknown album' (the
    // `library.unknownAlbum` string this untagged track falls back to)
    // yields 'UA', not 'UN' — see `src/common/library/artwork.ts`.
    render(
      <I18nProvider>
        <LibraryGridView
          tracks={[track({ title: 'A' })]}
          browseMode="album"
          onOpenAlbum={jest.fn()}
          onOpenArtist={jest.fn()}
          onPlayTrack={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('UA')).toBeInTheDocument();
  });
});
