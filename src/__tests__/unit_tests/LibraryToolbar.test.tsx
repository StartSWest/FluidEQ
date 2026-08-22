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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryScanProgress from '../../renderer/library/LibraryScanProgress';
import LibraryToolbar from '../../renderer/library/LibraryToolbar';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const wrap = (node: React.ReactNode) =>
  render(<I18nProvider>{node}</I18nProvider>);

describe('the library toolbar', () => {
  it('reports which browse mode is current', async () => {
    const onBrowseMode = jest.fn();
    wrap(
      <LibraryToolbar
        browseMode="album"
        viewMode="grid"
        sort="title"
        sortDirection="asc"
        query=""
        onBrowseMode={onBrowseMode}
        onViewMode={jest.fn()}
        onSort={jest.fn()}
        onSortDirection={jest.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Albums' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Artists' }));
    expect(onBrowseMode).toHaveBeenCalledWith('artist');
  });

  it('carries a chip per shelf, each labelled and wired the same way', async () => {
    const onBrowseMode = jest.fn();
    wrap(
      <LibraryToolbar
        browseMode="album"
        viewMode="grid"
        sort="title"
        sortDirection="asc"
        query=""
        onBrowseMode={onBrowseMode}
        onViewMode={jest.fn()}
        onSort={jest.fn()}
        onSortDirection={jest.fn()}
      />,
    );
    // Every browse mode the library has, named rather than counted and in
    // the order they are drawn, so this says which one went missing — or
    // which one moved — rather than only that the count changed.
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Albums',
      'Artists',
      'Songs',
      // The folder shelf has two readings and its chip says which one is on.
      // The tree is what it opens with — named after its shape, because
      // 'Folders' and 'Directories' are the same word to most readers.
      'Tree',
      'Videos',
      // Last on purpose: the five before it are readings of what is on disk,
      // and this is the only shelf the reader built themselves. Adding it
      // ahead of them would move every chip somebody already knows the
      // position of.
      'Playlists',
    ]);
    const videos = screen.getByRole('tab', { name: 'Videos' });
    expect(videos).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(videos);
    expect(onBrowseMode).toHaveBeenCalledWith('video');
    await userEvent.click(screen.getByRole('tab', { name: 'Playlists' }));
    expect(onBrowseMode).toHaveBeenCalledWith('playlist');
  });

  it('passes what was typed straight through', async () => {
    const onQuery = jest.fn();
    wrap(
      <LibraryToolbar
        browseMode="song"
        viewMode="list"
        sort="title"
        sortDirection="asc"
        query=""
        onBrowseMode={jest.fn()}
        onViewMode={jest.fn()}
        onSort={jest.fn()}
        onSortDirection={jest.fn()}
        onQuery={onQuery}
      />,
    );
    await userEvent.type(screen.getByRole('searchbox'), 'blue');
    expect(onQuery).toHaveBeenCalled();
  });

  it('draws the search box straight after the shelf chips', () => {
    // Its POSITION is the fix, so its position is what this pins. The bar
    // wraps, and last in the order meant the box changed lines whenever
    // anything beside it collapsed — first line, second, or third depending
    // on the width. Second in the order, it shares the shelf chips' line at
    // every width instead of moving under the reader.
    wrap(
      <LibraryToolbar
        browseMode="song"
        viewMode="list"
        sort="title"
        sortDirection="asc"
        query=""
        onBrowseMode={jest.fn()}
        onViewMode={jest.fn()}
        onSort={jest.fn()}
        onSortDirection={jest.fn()}
        onQuery={jest.fn()}
      />,
    );
    const bar = document.querySelector('.library-toolbar');
    const groups = [...(bar?.children ?? [])]
      .map((el) => el.className.toString())
      .filter((name) => name.startsWith('library-toolbar__'));
    expect(groups[0]).toContain('browse-modes');
    expect(groups[1]).toContain('search');
  });
});

describe('a scan in progress', () => {
  it('shows what it is doing and offers to stop from the first second', async () => {
    // A long action that shows nothing is a bug regardless of what runs
    // underneath it.
    const onCancel = jest.fn();
    wrap(
      <LibraryScanProgress
        progress={{
          rootId: 'r',
          seen: 3,
          parsed: 1,
          karaokeSkipped: 0,
          current: 'a.mp3',
          isDone: false,
        }}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Reading a.mp3')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 files')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
