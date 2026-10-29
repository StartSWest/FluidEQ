/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook, waitFor } from '@testing-library/react';
import type { ILibraryListQuery } from '../../../common/library/query';
import { useViewQueue } from '../../../renderer/library/useViewQueue';

jest.mock('../../../renderer/library/useLibraryList', () => ({
  useLibraryList: () => ({ isLoaded: true, count: 0 }),
}));

/**
 * What plays next is the list a song was played in, not the list on screen.
 * Following the screen at every change of song replaced a playlist started
 * from the amp with the Library's Songs shelf, hidden behind it (Ivan,
 * 2026-10-25: "fix the weird issue on upnext when playing playlist").
 */
const songs: ILibraryListQuery = {
  shelf: 'tracks',
  scope: {},
  sort: 'title',
  direction: 'asc',
};
const albums: ILibraryListQuery = {
  shelf: 'tracks',
  scope: {},
  sort: 'album',
  direction: 'asc',
};
const playlist: ILibraryListQuery = {
  shelf: 'tracks',
  scope: { ids: ['p1', 'p2', 'p3'] },
  natural: 'ids',
  direction: 'asc',
};
const LISTS = new Map<string, string[]>([
  [JSON.stringify(songs), ['s1', 'p1', 's2', 'p2', 's3']],
  [JSON.stringify(albums), ['p2', 's9', 'p1']],
  [JSON.stringify(playlist), ['p1', 'p2', 'p3']],
]);

const queryLibrary = jest.fn(
  async (request: {
    type: string;
    query: ILibraryListQuery;
    id?: string;
    offset?: number;
    limit?: number;
  }) => {
    const list = LISTS.get(JSON.stringify(request.query)) ?? [];
    if (request.type === 'position') {
      return list.indexOf(request.id ?? '');
    }
    if (request.type === 'ids') {
      const offset = request.offset ?? 0;
      return list.slice(offset, offset + (request.limit ?? list.length));
    }
    return 0;
  },
);

const playTracks = jest.fn();
const retargetQueue = jest.fn();
const topUpQueue = jest.fn();

interface IProps {
  shelfQuery: ILibraryListQuery | undefined;
  playingTrackId: string | undefined;
  queueSource: string | undefined;
}

const mount = (initial: IProps) =>
  renderHook(
    (props: IProps) =>
      useViewQueue({
        recordQuery: undefined,
        upNextIds: [],
        isScanning: false,
        playTracks,
        retargetQueue,
        topUpQueue,
        ...props,
      }),
    { initialProps: initial },
  );

const settle = () => act(async () => undefined);

beforeEach(() => {
  queryLibrary.mockClear();
  playTracks.mockClear();
  retargetQueue.mockClear();
  topUpQueue.mockClear();
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { queryLibrary },
  };
});

describe('the queue a press starts', () => {
  it('is the list the song was pressed in', async () => {
    const hook = mount({
      shelfQuery: songs,
      playingTrackId: undefined,
      queueSource: undefined,
    });
    act(() => hook.result.current.playTrack('s2'));
    expect(playTracks).toHaveBeenCalledWith(['s2'], 's2');
    await waitFor(() =>
      expect(retargetQueue).toHaveBeenCalledWith(
        ['s1', 'p1', 's2', 'p2', 's3'],
        JSON.stringify(songs),
      ),
    );
  });
});

describe('a playlist played from the amp, with the Library on Songs', () => {
  it('is never replaced at a change of song', async () => {
    // Started elsewhere: the queue names no list of the Library's.
    const hook = mount({
      shelfQuery: songs,
      playingTrackId: 'p1',
      queueSource: undefined,
    });
    await settle();
    hook.rerender({
      shelfQuery: songs,
      playingTrackId: 'p2',
      queueSource: undefined,
    });
    await settle();
    expect(retargetQueue).not.toHaveBeenCalled();
    expect(topUpQueue).not.toHaveBeenCalled();
  });
});

describe('a queue aimed at a playlist', () => {
  const source = JSON.stringify(playlist);

  it('stays the playlist while the Library shows another shelf', async () => {
    const hook = mount({
      shelfQuery: playlist,
      playingTrackId: 'p1',
      queueSource: source,
    });
    await settle();
    hook.rerender({
      shelfQuery: albums,
      playingTrackId: 'p1',
      queueSource: source,
    });
    await settle();
    expect(retargetQueue).not.toHaveBeenCalled();
  });

  it('is topped up from the playlist at a change of song, whatever is on screen', async () => {
    const hook = mount({
      shelfQuery: albums,
      playingTrackId: 'p1',
      queueSource: source,
    });
    await settle();
    topUpQueue.mockClear();
    hook.rerender({
      shelfQuery: albums,
      playingTrackId: 'p2',
      queueSource: source,
    });
    await waitFor(() =>
      expect(topUpQueue).toHaveBeenCalledWith(['p1', 'p2', 'p3'], source),
    );
    expect(retargetQueue).not.toHaveBeenCalled();
  });
});
