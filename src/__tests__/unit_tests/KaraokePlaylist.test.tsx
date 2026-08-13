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

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { IKaraokePlaylistItem } from '../../common/karaoke/files';
import KaraokePlaylist from '../../renderer/karaoke/KaraokePlaylist';

const item = (title: string): IKaraokePlaylistItem => ({
  id: title.toLowerCase(),
  title,
  relativePath: `${title}.mp3`,
  audio: new File(['audio'], `${title}.mp3`),
});

describe('KaraokePlaylist', () => {
  it('selects, keyboard-reorders, and removes songs accessibly', () => {
    const items = [item('First'), item('Second')];
    const onSelect = jest.fn();
    const onMove = jest.fn();
    const onRemove = jest.fn();
    const onCollapse = jest.fn();
    render(
      <KaraokePlaylist
        items={items}
        selectedId={items[0].id}
        onToggleFolderGrouping={jest.fn()}
        onSelect={onSelect}
        onMove={onMove}
        onRemove={onRemove}
        onCollapse={onCollapse}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Playlist' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Select First' }),
    ).toHaveAttribute('aria-current', 'true');
    const collapse = screen.getByRole('button', {
      name: 'Collapse playlist',
    });
    expect(collapse).toBeVisible();
    expect(collapse.closest('.karaoke-playlist')).toBeInTheDocument();
    fireEvent.click(collapse);
    expect(onCollapse).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Select Second' }));
    expect(onSelect).toHaveBeenCalledWith('second');

    fireEvent.click(screen.getByRole('button', { name: 'Move First down' }));
    expect(onMove).toHaveBeenCalledWith('first', 'second');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Second' }));
    expect(onRemove).toHaveBeenCalledWith('second');
  });

  it('groups the view by containing folder only when requested', () => {
    const loose = item('Loose');
    const first = { ...item('First'), relativePath: 'Artist/Album/First.mp3' };
    const second = {
      ...item('Second'),
      relativePath: 'Artist/Album/Second.mp3',
    };
    const live = {
      ...item('Concert'),
      relativePath: 'Artist/Live/Concert.mp3',
    };
    const items = [first, loose, live, second];
    const onToggleFolderGrouping = jest.fn();
    const onSelect = jest.fn();
    const onMove = jest.fn();
    const onRemove = jest.fn();
    const onCollapse = jest.fn();
    const playlist = (groupByFolder = false) => (
      <KaraokePlaylist
        items={items}
        selectedId={first.id}
        groupByFolder={groupByFolder}
        onToggleFolderGrouping={onToggleFolderGrouping}
        onSelect={onSelect}
        onMove={onMove}
        onRemove={onRemove}
        onCollapse={onCollapse}
      />
    );
    const { rerender } = render(playlist());

    expect(screen.queryByText('Artist')).not.toBeInTheDocument();

    rerender(playlist(true));

    expect(screen.getByText('Artist')).toBeVisible();
    expect(screen.getByText('Album')).toBeVisible();
    expect(screen.getByText('Live')).toBeVisible();
    expect(screen.getByText('Loose files')).toBeVisible();
  });
});
