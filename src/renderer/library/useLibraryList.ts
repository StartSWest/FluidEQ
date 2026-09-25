/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A list the library answers a page at a time, as the views draw it.
 *
 * The window never holds a whole list. A view says which rows are on screen
 * (`want`) and reads them back (`at`); the pages under those rows are asked
 * of the store in main and the ones far from them are dropped, so scrolling
 * through fourteen thousand songs keeps a few hundred of them here at a time.
 *
 * When the library changes (`summary.version`), the pages on screen are asked
 * for again and the rows they held stay drawn until the answer lands — a scan
 * batch refreshes the rows in place instead of blanking them. One ask per
 * page at a time: a change that lands while a page is out is caught by
 * comparing the version the answer was read at, so a scan's run of changes
 * costs as many asks as main can answer, never one per change.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  ILibraryListQuery,
  TLibraryListItem,
} from '../../common/library/query';
import { useLibrary } from './LibraryContext';

/** Rows asked for at once: a screen of the tallest pane, twice. */
export const LIBRARY_PAGE_ROWS = 100;

/**
 * Pages kept either side of the rows on screen. Enough that scrolling back a
 * little finds its rows still here; few enough that the list never grows into
 * the library.
 */
const KEPT_PAGES_AROUND = 4;

export interface ILibraryList {
  /** What was asked, or nothing while there is no list to ask for. */
  readonly query: ILibraryListQuery | undefined;
  /** Rows in the list, headings included; 0 until the first answer. */
  readonly count: number;
  /** Rows, from the top, that are the reader's own folder's matches. */
  readonly nearCount: number;
  /** Songs, from the top, the query's `mark` lit. */
  readonly markedCount: number;
  /** The list asked for has answered at least once. */
  readonly isLoaded: boolean;
  /** The row at `index`, or nothing while its page is out. */
  readonly at: (index: number) => TLibraryListItem | undefined;
  /** These rows are on screen: have them, and keep what is near them. */
  readonly want: (start: number, end: number) => void;
  /** Where a row with this id is among the rows held, or -1. */
  readonly indexOf: (id: string) => number;
}

interface IPage {
  /** The store version the page was read at. */
  version: number;
  items: TLibraryListItem[];
}

interface IListState {
  key: string;
  query: ILibraryListQuery | undefined;
  total: number;
  nearCount: number;
  markedCount: number;
  /** The version `total` was read at: an older answer never overrides it. */
  totalVersion: number;
  isLoaded: boolean;
  pages: Map<number, IPage>;
  inflight: Set<number>;
}

const listKey = (query: ILibraryListQuery | undefined): string =>
  query === undefined ? '' : JSON.stringify(query);

const emptyState = (query: ILibraryListQuery | undefined): IListState => ({
  key: listKey(query),
  query,
  total: 0,
  nearCount: 0,
  markedCount: 0,
  totalVersion: -1,
  isLoaded: false,
  pages: new Map(),
  inflight: new Set(),
});

/** The id a row answers to, for finding it again: a song's or a group's. */
const itemId = (item: TLibraryListItem): string | undefined => {
  if (item.kind === 'track') {
    return item.track.id;
  }
  return item.kind === 'heading' ? undefined : item.id;
};

export const useLibraryList = (
  query: ILibraryListQuery | undefined,
): ILibraryList => {
  const { summary } = useLibrary();
  const { version } = summary;
  /** Moves whenever a page lands, so what is returned is a new list then. */
  const [tick, render] = useReducer((count: number) => count + 1, 0);
  const key = listKey(query);

  const stateRef = useRef<IListState>(emptyState(query));
  /**
   * What is drawn: the list asked for once it has answered, and until then
   * the one before it — but only a list of the same shelf, whose rows the
   * view draws the same way. Typing in the search box keeps the last answer
   * on screen while the next is read, instead of blanking the list at every
   * key.
   */
  const shownRef = useRef<IListState>(stateRef.current);
  if (stateRef.current.key !== key) {
    const previous = stateRef.current;
    stateRef.current = emptyState(query);
    shownRef.current =
      previous.isLoaded && previous.query?.shelf === query?.shelf
        ? previous
        : stateRef.current;
  }
  const wantedRef = useRef({ start: 0, end: LIBRARY_PAGE_ROWS });
  const versionRef = useRef(version);
  versionRef.current = version;

  /** Drops the pages far from the rows on screen. */
  const evict = useCallback((state: IListState) => {
    const { start, end } = wantedRef.current;
    const low = Math.floor(start / LIBRARY_PAGE_ROWS) - KEPT_PAGES_AROUND;
    const high =
      Math.floor(Math.max(start, end - 1) / LIBRARY_PAGE_ROWS) +
      KEPT_PAGES_AROUND;
    Array.from(state.pages.keys()).forEach((page) => {
      if (page < low || page > high) {
        state.pages.delete(page);
      }
    });
  }, []);

  const ask = useCallback(
    (state: IListState, page: number) => {
      const { query: asked } = state;
      if (asked === undefined || state.inflight.has(page)) {
        return;
      }
      state.inflight.add(page);
      window.electron.ipcRenderer
        .queryLibrary({
          type: 'page',
          query: asked,
          offset: page * LIBRARY_PAGE_ROWS,
          limit: LIBRARY_PAGE_ROWS,
        })
        .then((answer) => {
          state.inflight.delete(page);
          state.pages.set(page, {
            version: answer.version,
            items: answer.items,
          });
          if (answer.version >= state.totalVersion) {
            state.total = answer.total;
            state.nearCount = answer.nearCount;
            state.markedCount = answer.markedCount;
            state.totalVersion = answer.version;
          }
          state.isLoaded = true;
          // An answer for a list the reader has left is kept with that list
          // and drawn by nothing.
          if (stateRef.current !== state) {
            return undefined;
          }
          shownRef.current = state;
          evict(state);
          render();
          // The library moved on while this was out: ask again, once.
          if (answer.version < versionRef.current) {
            ask(state, page);
          }
          return undefined;
        })
        .catch((error: unknown) => {
          state.inflight.delete(page);
          // eslint-disable-next-line no-console -- context-rich error before it is dropped; the rows stay as they were
          console.error('Could not read a page of the library', asked, error);
        });
    },
    [evict],
  );

  /** Asks for every page under the rows on screen that is missing or stale. */
  const ensure = useCallback(() => {
    const state = stateRef.current;
    if (state.query === undefined) {
      return;
    }
    const { start, end } = wantedRef.current;
    const first = Math.floor(start / LIBRARY_PAGE_ROWS);
    // Past the end of a list that has answered there is nothing to ask for;
    // one that has not is asked for everything on screen at once.
    const last = Math.min(
      Math.floor(Math.max(start, end - 1) / LIBRARY_PAGE_ROWS),
      state.isLoaded
        ? Math.max(0, Math.ceil(state.total / LIBRARY_PAGE_ROWS) - 1)
        : Number.MAX_SAFE_INTEGER,
    );
    for (let page = first; page <= last; page += 1) {
      const held = state.pages.get(page);
      if (held === undefined || held.version < versionRef.current) {
        ask(state, page);
      }
    }
  }, [ask]);

  // A new list, or the library changed under this one.
  useEffect(() => {
    ensure();
  }, [key, version, ensure]);

  const want = useCallback(
    (start: number, end: number) => {
      const { current } = wantedRef;
      if (current.start === start && current.end === end) {
        return;
      }
      wantedRef.current = { start, end };
      ensure();
    },
    [ensure],
  );

  const shown = shownRef.current;
  const at = useCallback((index: number): TLibraryListItem | undefined => {
    const page = shownRef.current.pages.get(
      Math.floor(index / LIBRARY_PAGE_ROWS),
    );
    return page?.items[index % LIBRARY_PAGE_ROWS];
  }, []);

  const indexOf = useCallback((id: string): number => {
    let found = -1;
    shownRef.current.pages.forEach((page, number) => {
      if (found !== -1) {
        return;
      }
      const offset = page.items.findIndex((item) => itemId(item) === id);
      if (offset !== -1) {
        found = number * LIBRARY_PAGE_ROWS + offset;
      }
    });
    return found;
  }, []);

  return useMemo(
    () => ({
      query: shown.query,
      count: shown.total,
      nearCount: shown.nearCount,
      markedCount: shown.markedCount,
      isLoaded: stateRef.current.isLoaded,
      at,
      want,
      indexOf,
    }),
    // A fresh object whenever what is drawn changes — a page landing is a
    // `tick`, because the pages themselves are held, not state — so a view
    // memoised on the list draws the rows that just arrived.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `shown` is a ref's value; `tick` is what moves with it
    [tick, key, at, want, indexOf],
  );
};
