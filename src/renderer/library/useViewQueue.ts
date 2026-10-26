/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What plays next is the list a song was played in.
 *
 * A press on a song makes the list it was pressed in the queue — a record's
 * own list when one is open and has somewhere to go, the shelf's songs
 * otherwise. Nothing restarts: `retargetQueue` keeps the playing song and its
 * place. After that the queue is its own list: a change of song tops it up
 * from that list (`topUpQueue`), whatever is on screen, and browsing changes
 * nothing.
 *
 * IT USED TO FOLLOW THE SCREEN, at every change of view and every change of
 * song, so a playlist started from the amp — with the Library hidden behind
 * it on the Songs shelf — was replaced at its first song by the two hundred
 * songs either side of it on that shelf, and one played in the Library was
 * replaced the moment somebody looked at another shelf (Ivan, 2026-10-25:
 * "fix the weird issue on upnext when playing playlist").
 *
 * The list is the store's, so the queue is a window of it asked for by id
 * around the playing song — the store says where the song stands and hands
 * back the ids either side of it. The queue names its list by the list's own
 * query (`ILibraryQueue.source`), which is how it is asked for again after
 * the view has moved on, and after a restart.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * The list a queue names itself by, read back as the query it was.
 *
 * A queue is aimed with its list's query spelled out (`JSON.stringify`), so
 * the name is enough to ask for the list again. Anything else — a queue
 * started from the amp's playlists, which carries its whole list and names
 * none, or a name from an older build — answers nothing, and that queue is
 * simply not topped up. Main checks every request it is handed, so the shape
 * is only looked at here as far as telling a query from some other text.
 */
const queryOfSource = (
  source: string | undefined,
): ILibraryListQuery | undefined => {
  if (source === undefined) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(source);
    return typeof value === 'object' &&
      value !== null &&
      typeof (value as { shelf?: unknown }).shelf === 'string'
      ? (value as ILibraryListQuery)
      : undefined;
  } catch {
    return undefined;
  }
};

export interface IViewQueue {
  /**
   * How much of the queue's own list is still to come that the queue has NOT
   * got — the queue is a window, and the panel adds this to the rows it
   * holds. Nothing when the queue names no list, or the list no longer holds
   * the playing song: then its rows are the whole honest count.
   */
  restTotal: number | undefined;
  /** Plays a song pressed on screen, the list it was pressed in its queue. */
  playTrack: (trackId: string) => void;
}

export const useViewQueue = ({
  recordQuery,
  shelfQuery,
  playingTrackId,
  queueSource,
  upNextIds,
  isScanning,
  playTracks,
  retargetQueue,
  topUpQueue,
}: {
  /** The songs of the record open on screen, in its own order, if any. */
  recordQuery: ILibraryListQuery | undefined;
  /** The shelf's songs, in the shelf's order. */
  shelfQuery: ILibraryListQuery | undefined;
  playingTrackId: string | undefined;
  /** The list the queue plays, as it names it (`ILibraryQueue.source`). */
  queueSource: string | undefined;
  /** What the queue is carrying ahead of the playhead. */
  upNextIds: readonly string[];
  isScanning: boolean;
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
  retargetQueue: (trackIds: readonly string[], listKey: string) => void;
  topUpQueue: (trackIds: readonly string[], listKey: string) => void;
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

  /**
   * The latest press: which song, and a count that moves with every press,
   * so pressing the song that is already on the transport — paused, say —
   * aims the queue it just replaced.
   */
  const [press, setPress] = useState<{ trackId: string; count: number }>();
  /** The press whose list has been asked for, so each is asked for once. */
  const askedPressRef = useRef(0);

  // THE LIST A PRESS WAS MADE IN, ONCE PER PRESS. Not cancelled by the view
  // moving on while the store answers — the press was made in this list —
  // only by a newer press.
  useEffect(() => {
    if (
      press === undefined ||
      press.count === askedPressRef.current ||
      viewQuery === undefined
    ) {
      return;
    }
    askedPressRef.current = press.count;
    const { count } = press;
    windowAround(viewQuery, press.trackId)
      .then((ids) => {
        if (ids !== undefined && count === askedPressRef.current) {
          retargetQueue(ids, viewKey);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the song plays as a queue of itself
        console.error(
          'Could not put the list it was played in under the song',
          error,
        );
      });
    // `viewQuery` is what `viewKey` spells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [press, viewKey, retargetQueue]);

  // A CHANGE OF SONG TOPS THE QUEUE UP FROM ITS OWN LIST, never from the one
  // on screen. Read through a ref so a press re-aiming the queue — the song
  // the same, the name new — asks nothing more.
  const queueSourceRef = useRef(queueSource);
  queueSourceRef.current = queueSource;
  useEffect(() => {
    const source = queueSourceRef.current;
    const query = queryOfSource(source);
    if (playingTrackId === undefined || source === undefined || !query) {
      return undefined;
    }
    let isCurrent = true;
    windowAround(query, playingTrackId)
      .then((ids) => {
        if (isCurrent && ids !== undefined) {
          topUpQueue(ids, source);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the queue stays as it was
        console.error('Could not top the queue up from its list', error);
      });
    return () => {
      isCurrent = false;
    };
  }, [playingTrackId, topUpQueue]);

  const [restTotal, setRestTotal] = useState<number | undefined>(undefined);
  const upNextKey = upNextIds.join('\n');
  useEffect(() => {
    const query = queryOfSource(queueSource);
    if (playingTrackId === undefined || !query) {
      setRestTotal(undefined);
      return undefined;
    }
    let isCurrent = true;
    ipc()
      .queryLibrary({
        type: 'rest',
        query,
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
  }, [playingTrackId, queueSource, upNextKey, isScanning]);

  /**
   * The song starts at once, as a queue of itself; the list it was pressed
   * in follows a moment later, when the store has said where the song stands
   * in it — the first effect above, which the press moves along.
   */
  const playTrack = useCallback(
    (trackId: string) => {
      playTracks([trackId], trackId);
      setPress((current) => ({ trackId, count: (current?.count ?? 0) + 1 }));
    },
    [playTracks],
  );

  return { restTotal, playTrack };
};
