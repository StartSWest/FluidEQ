/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What plays next follows what is on screen.
 *
 * The same files group differently on every shelf, so the album that follows
 * this song is not the folder that follows it and neither is what the Songs
 * list has next. Leaving the queue frozen at whatever was open when Play was
 * pressed made Next answer for a screen the reader had left. So the queue is
 * re-aimed at the list on screen — a record's own list when one is open and
 * has somewhere to go, the shelf's songs otherwise — on every change of view
 * and every change of song. Nothing restarts: `retargetQueue` keeps the
 * playing song and its place, and does nothing when that song is not in the
 * new list. The list is named by the view's own key, so a change of song —
 * the same list asked for again — only tops the queue up and keeps the order
 * the listener made in Up Next; only a change of view re-aims it.
 *
 * The list is the store's, so the queue is a window of it asked for by id
 * around the playing song — the store says where the song stands and hands
 * back the ids either side of it.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ILibraryListQuery } from '../../common/library/query';
import { useLibraryList } from './useLibraryList';

/**
 * The most songs a queue ever holds.
 *
 * The Songs shelf of a real collection is tens of thousands of rows, and a
 * queue is not a copy of the library. Two hundred is a hundred either side
 * of what is playing — some ten hours ahead, further than anybody listens in
 * a sitting — and it refills itself: every change of song asks for the window
 * again, and the songs it brings that the queue has never held join behind
 * what is already ahead (`extendQueue`), so the hundred ahead are replenished
 * from the full list as they are used without the queue being rebuilt.
 */
const QUEUE_WINDOW = 200;

/** Read at each ask rather than once: the bridge is the window's, and a
 * test puts its own in place after this module has loaded. */
const ipc = () => window.electron.ipcRenderer;

/** The window of `query`'s ids around `trackId`, or nothing when the list
 * does not hold it. At the end of a list the window slides back, so it still
 * holds as much as it can. */
const windowAround = async (
  query: ILibraryListQuery,
  trackId: string,
): Promise<string[] | undefined> => {
  const at = await ipc().queryLibrary({ type: 'position', query, id: trackId });
  if (at < 0) {
    return undefined;
  }
  const offset = Math.max(0, at - QUEUE_WINDOW / 2);
  const ids = await ipc().queryLibrary({
    type: 'ids',
    query,
    offset,
    limit: QUEUE_WINDOW,
  });
  const short = QUEUE_WINDOW - ids.length;
  if (short <= 0 || offset === 0) {
    return ids;
  }
  const before = Math.max(0, offset - short);
  const earlier = await ipc().queryLibrary({
    type: 'ids',
    query,
    offset: before,
    limit: offset - before,
  });
  return [...earlier, ...ids];
};

export interface IViewQueue {
  /**
   * How much of the list is still to come that the queue has NOT got — the
   * queue is a window, and the panel adds this to the rows it holds.
   * Nothing when the playing song is not on this list: then the queue is its
   * own list and its rows are the whole honest count.
   */
  restTotal: number | undefined;
  /** Plays a song pressed on screen, the list it was pressed in its queue. */
  playTrack: (trackId: string) => void;
}

export const useViewQueue = ({
  recordQuery,
  shelfQuery,
  playingTrackId,
  upNextIds,
  isScanning,
  playTracks,
  retargetQueue,
}: {
  /** The songs of the record open on screen, in its own order, if any. */
  recordQuery: ILibraryListQuery | undefined;
  /** The shelf's songs, in the shelf's order. */
  shelfQuery: ILibraryListQuery | undefined;
  playingTrackId: string | undefined;
  /** What the queue is carrying ahead of the playhead. */
  upNextIds: readonly string[];
  isScanning: boolean;
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
  retargetQueue: (trackIds: readonly string[], listKey: string) => void;
}): IViewQueue => {
  /**
   * A QUEUE OF ONE IS NOT A QUEUE, AND IT FAILS SILENTLY: `advanceQueue`
   * clamps, so Next and Previous answer with nothing and the end of the song
   * is the end of the queue. A record of one song — a folder of loose files
   * tagged as one-track albums is ordinary — is therefore no queue, and the
   * shelf is used instead.
   */
  const record = useLibraryList(recordQuery);
  /** The record's list once it has said it has somewhere to go; nothing
   * while it has not answered, so the queue is not aimed at the shelf first
   * and at the record a moment later. */
  const viewQueryOf = (): ILibraryListQuery | undefined => {
    if (recordQuery === undefined) {
      return shelfQuery;
    }
    if (!record.isLoaded) {
      return undefined;
    }
    return record.count > 1 ? recordQuery : shelfQuery;
  };
  const viewQuery = viewQueryOf();
  const viewKey = viewQuery === undefined ? '' : JSON.stringify(viewQuery);

  /** Moved by every press, so pressing the song that is already on the
   * transport — paused, say — re-aims the queue it just replaced. */
  const [pressed, setPressed] = useState(0);

  useEffect(() => {
    if (playingTrackId === undefined || viewQuery === undefined) {
      return undefined;
    }
    let isCurrent = true;
    windowAround(viewQuery, playingTrackId)
      .then((ids) => {
        if (isCurrent && ids !== undefined) {
          retargetQueue(ids, viewKey);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the queue stays as it was
        console.error('Could not aim the queue at the list on screen', error);
      });
    return () => {
      isCurrent = false;
    };
    // `viewQuery` is what `viewKey` spells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingTrackId, viewKey, pressed, retargetQueue]);

  const [restTotal, setRestTotal] = useState<number | undefined>(undefined);
  const upNextKey = upNextIds.join('\n');
  useEffect(() => {
    if (playingTrackId === undefined || viewQuery === undefined) {
      setRestTotal(undefined);
      return undefined;
    }
    let isCurrent = true;
    ipc()
      .queryLibrary({
        type: 'rest',
        query: viewQuery,
        afterId: playingTrackId,
        exclude: upNextIds,
      })
      .then((rest) => {
        if (isCurrent) {
          setRestTotal(rest < 0 ? undefined : rest);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
    // Counted again when the list, the song or the queue changes — and once
    // more when a scan ends, never at each of its batches, which would walk
    // the list several times a second for a number nobody watches move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingTrackId, viewKey, upNextKey, isScanning]);

  /**
   * The song starts at once, as a queue of itself; the list it was pressed
   * in follows a moment later, when the store has said where the song stands
   * in it — the effect above, which the press moves along.
   */
  const playTrack = useCallback(
    (trackId: string) => {
      playTracks([trackId], trackId);
      setPressed((count) => count + 1);
    },
    [playTracks],
  );

  return { restTotal, playTrack };
};
