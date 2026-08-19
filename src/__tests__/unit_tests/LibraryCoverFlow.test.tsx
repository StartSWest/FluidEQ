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
import LibraryCoverFlow, {
  COVER_FLOW_NEIGHBOURS,
  coverFlowTransform,
} from '../../renderer/library/LibraryCoverFlow';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const albumTracks = (count: number): ILibraryTrack[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `t${index}`,
    rootId: 'r',
    path: `C:\\Music\\${index}.mp3`,
    kind: 'audio' as const,
    isPlayable: true,
    title: `Song ${index}`,
    album: `Album ${index}`,
    artist: 'Artist',
    sizeBytes: 1,
    mtimeMs: 1,
    addedAt: 1,
  }));

describe('the cover flow geometry', () => {
  it('leaves the centre cover facing the viewer', () => {
    expect(coverFlowTransform(0)).toContain('rotateY(0deg)');
  });

  it('turns the two sides towards the middle, not the same way', () => {
    expect(coverFlowTransform(-1)).toContain('rotateY(60deg)');
    expect(coverFlowTransform(1)).toContain('rotateY(-60deg)');
  });

  it('pushes distant covers back rather than only sideways', () => {
    // Without translateZ the row is a flat fan. The depth is the effect.
    expect(coverFlowTransform(2)).toMatch(/translateZ\(-\d/);
  });
});

describe('cover flow', () => {
  it('mounts a window of covers, not the whole library', async () => {
    // 400 albums must animate like 20. Everything past the window is not
    // rendered at all.
    render(
      <I18nProvider>
        <LibraryCoverFlow
          tracks={albumTracks(400)}
          browseMode="album"
          onOpenAlbum={jest.fn()}
          onOpenArtist={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(
      COVER_FLOW_NEIGHBOURS * 2 + 1,
    );
  });

  it('moves with the arrow keys', async () => {
    render(
      <I18nProvider>
        <LibraryCoverFlow
          tracks={albumTracks(5)}
          browseMode="album"
          onOpenAlbum={jest.fn()}
          onOpenArtist={jest.fn()}
        />
      </I18nProvider>,
    );
    const stage = screen.getByRole('listbox');
    stage.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Album 1',
    );
  });

  it('opens the centre cover on Enter', async () => {
    const onOpenAlbum = jest.fn();
    render(
      <I18nProvider>
        <LibraryCoverFlow
          tracks={albumTracks(5)}
          browseMode="album"
          onOpenAlbum={onOpenAlbum}
          onOpenArtist={jest.fn()}
        />
      </I18nProvider>,
    );
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpenAlbum).toHaveBeenCalled();
  });
});
