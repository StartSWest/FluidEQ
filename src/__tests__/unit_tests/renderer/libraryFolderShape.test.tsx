/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { cleanup, render, screen } from '@testing-library/react';
import type { ILibraryListQuery } from 'common/library/query';
import LibraryDetail from 'renderer/library/LibraryDetail';

/**
 * An opened folder draws the record header only once it is known to hold
 * songs of its own (Ivan, 2026-11-14: "when exploring on tree view there is
 * a glitch that shows the album header for a millisecond then it shows the
 * folder tree"). Its two lists answer a moment after it opens; until they
 * do, the panel keeps what the last folder was, and on a first open shows
 * no header at all.
 */
interface IFakeList {
  isLoaded: boolean;
  count: number;
}
let mockPlace: IFakeList = { isLoaded: false, count: 0 };
let mockChildren: IFakeList = { isLoaded: false, count: 0 };

jest.mock('renderer/library/useLibraryList', () => ({
  useLibraryList: (query: ILibraryListQuery | undefined) => {
    const scope = (query?.scope ?? {}) as Record<string, unknown>;
    let shape: IFakeList = { isLoaded: true, count: 0 };
    if (query?.shelf === 'children') {
      shape = mockChildren;
    } else if (query?.shelf === 'tracks' && 'folder' in scope) {
      shape = mockPlace;
    } else if (query?.shelf === 'tracks' && 'beneath' in scope) {
      // Something is beneath every folder here: none is ever orphaned.
      shape = { isLoaded: true, count: 5 };
    }
    return {
      ...shape,
      query,
      nearCount: 0,
      markedCount: 0,
      at: () => undefined,
      want: () => undefined,
      indexOf: () => -1,
    };
  },
}));
jest.mock('renderer/library/PlaylistContext', () => ({
  usePlaylists: () => ({ playlists: [], isFavorite: () => false }),
}));
jest.mock('renderer/library/LibraryDetailHeader', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => (
    <div data-testid="record-header">{title}</div>
  ),
}));
jest.mock('renderer/library/LibraryListView', () => ({
  __esModule: true,
  default: () => <div data-testid="folder-list" />,
}));
jest.mock('renderer/library/LibraryGridView', () => ({
  __esModule: true,
  default: () => <div data-testid="folder-grid" />,
}));

const panel = (folderPath: string) => (
  <LibraryDetail
    folderPath={folderPath}
    onBack={() => undefined}
    onPlayTrack={() => undefined}
    onOpenFolder={() => undefined}
  />
);
const header = () => screen.queryByTestId('record-header');

beforeEach(() => {
  mockPlace = { isLoaded: false, count: 0 };
  mockChildren = { isLoaded: false, count: 0 };
});
afterEach(cleanup);

describe('an opened folder', () => {
  it('draws no header while it has not answered, on a first open', () => {
    render(panel('D:/Music'));
    expect(header()).toBeNull();
  });

  it('never draws a header over a folder that holds only folders', () => {
    const view = render(panel('D:/Music'));
    mockPlace = { isLoaded: true, count: 0 };
    mockChildren = { isLoaded: true, count: 4 };
    view.rerender(panel('D:/Music'));
    expect(header()).toBeNull();
    expect(screen.getByTestId('folder-list')).toBeInTheDocument();
    // Into a subfolder: its lists have not answered, and the one before it
    // still says "only folders". Nothing flashes in between.
    mockPlace = { isLoaded: false, count: 0 };
    mockChildren = { isLoaded: false, count: 4 };
    view.rerender(panel('D:/Music/Rock'));
    expect(header()).toBeNull();
  });

  it('draws its header once it is known to hold songs of its own', () => {
    const view = render(panel('D:/Music/Rock/Album'));
    mockPlace = { isLoaded: true, count: 9 };
    mockChildren = { isLoaded: true, count: 0 };
    view.rerender(panel('D:/Music/Rock/Album'));
    expect(header()).toHaveTextContent('Album');
  });

  it('keeps the header up from one record to the next, with no blink between', () => {
    const view = render(panel('D:/Music/Rock/One'));
    mockPlace = { isLoaded: true, count: 9 };
    mockChildren = { isLoaded: true, count: 0 };
    view.rerender(panel('D:/Music/Rock/One'));
    mockPlace = { isLoaded: false, count: 9 };
    mockChildren = { isLoaded: false, count: 0 };
    view.rerender(panel('D:/Music/Rock/Two'));
    expect(header()).toHaveTextContent('Two');
  });
});
