/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which rows of a table are mounted, and where each table was left.
 *
 * Only the rows near the viewport are ever in the document. Everything else
 * is two empty blocks standing in for it, sized from a row height measured
 * off a real row — which is also what lets a reveal jump straight to a row
 * ten thousand down without mounting the ten thousand above it.
 *
 * This was tried once before and reverted, for two reasons worth naming
 * because both are fixed here rather than tolerated. The spacers were sized
 * from an ASSUMED row height, so every row that disagreed with it by a pixel
 * walked the scrollbar away from the content; every kind of row now takes its
 * height from `_libraryMetrics.scss`, and this measures one anyway. And
 * dragging the scrollbar quickly outran React, because that version still
 * built an element for all fourteen thousand rows on every window change;
 * the table now builds elements for the window only.
 */

import {
  RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

/**
 * Viewports mounted beyond the visible one, each way — more than a flick can
 * cross between two scroll events.
 */
const OVERSCAN_VIEWPORTS = 3;

/**
 * One row's height before one has been measured: what `.library-list__row`
 * sets. Wrong here costs one frame of a slightly misjudged window, never a
 * wrong scrollbar.
 */
const ROW_HEIGHT = 46;

/** Rows mounted before anything has been measured — enough to fill the
 * tallest pane this app is usable in. */
const FIRST_WINDOW_ROWS = 60;

/**
 * The most rows a table will mount, whatever it is told about the pane.
 * Seven viewports of a tall screen is a few hundred rows; nothing legitimate
 * ever asks for more, and the thing that once asked for more was a bug — see
 * `rowWindowFor`. A ceiling made of arithmetic cannot be wrong the way one
 * made of a measurement can.
 */
const MAX_WINDOW_ROWS = 600;

/**
 * Which rows belong on screen, from numbers alone.
 *
 * Pure, exported and tested, because getting it wrong once cost the whole
 * app: `paneHeight` is a measurement, and a measurement can be absurd. A
 * layout that stopped constraining the pane left the scroll container as tall
 * as its own content — `clientHeight` came back as the full 647,542px of a
 * fourteen-thousand-row list, which this multiplied by seven and obediently
 * mounted. Reported as the window freezing and the app reaching 5GB on a
 * resize. Nobody can read more than a screenful, so a scroll container taller
 * than the screen is a layout fault and `screenHeight` caps what is believed;
 * `MAX_WINDOW_ROWS` caps the result regardless.
 */
export const rowWindowFor = ({
  scrollTop,
  paneHeight,
  screenHeight,
  rowHeight,
  count,
}: {
  scrollTop: number;
  /** The scroll container's own `clientHeight`. Zero before it is laid out. */
  paneHeight: number;
  screenHeight: number;
  rowHeight: number;
  count: number;
}): { start: number; end: number } => {
  // A body that has not been laid out yet reports nothing; a screenful is a
  // better guess than none, and the observer that calls this corrects it.
  const viewport = Math.min(
    paneHeight || rowHeight * FIRST_WINDOW_ROWS,
    screenHeight,
  );
  const overscan = viewport * OVERSCAN_VIEWPORTS;
  const top = Math.max(0, scrollTop - overscan);
  const bottom = scrollTop + viewport + overscan;
  const start = Math.max(0, Math.min(Math.floor(top / rowHeight), count));
  return {
    start,
    end: Math.max(
      start,
      Math.min(Math.ceil(bottom / rowHeight), count, start + MAX_WINDOW_ROWS),
    ),
  };
};

/**
 * Where each table was left, keyed by what it was showing.
 *
 * Module-level and deliberately not React state: opening an album unmounts
 * the whole view — the drill-in replaces it rather than covering it — so
 * anything held inside the component is gone by the time the reader presses
 * Back. Capped, because the key holds the search text and the box writes a
 * new one on every keystroke.
 */
const rememberedListState = new Map<
  string,
  { scrollTop: number; activeId?: string }
>();

/** Tables whose place is worth keeping. Past this the least recently
 * written one goes. */
const REMEMBERED_LISTS = 200;

/** Writes a place. Re-inserting rather than assigning makes `Map`'s
 * insertion order a recency order, so what is evicted is what nobody came
 * back to. */
const rememberList = (
  key: string,
  value: { scrollTop: number; activeId?: string },
): void => {
  rememberedListState.delete(key);
  rememberedListState.set(key, value);
  if (rememberedListState.size > REMEMBERED_LISTS) {
    const oldest = rememberedListState.keys().next();
    if (!oldest.done) {
      rememberedListState.delete(oldest.value);
    }
  }
};

export interface IListWindow {
  /** The half-open slice of rows that is mounted. */
  readonly start: number;
  readonly end: number;
  readonly rowHeight: number;
  /** The row the reader last opened out of this table. */
  readonly activeId: string | undefined;
  readonly setActiveId: (id: string | undefined) => void;
  /** Records the row being opened, before the view is torn down for it. */
  readonly rememberActive: (id: string) => void;
  /** The scroll handler. */
  readonly onScroll: (element: HTMLDivElement) => void;
  /** Scrolls so row `index` is centred, and remembers it. */
  readonly scrollToRow: (index: number) => void;
}

/**
 * The window over `count` rows of the scroll container `bodyRef` points at,
 * and the memory of where the table keyed `resetKey` was left. `onReset` runs
 * whenever the table becomes a different table — the view's own state that
 * belongs to one list (a selection) goes with it.
 */
export const useListWindow = ({
  bodyRef,
  count,
  resetKey,
  onReset,
}: {
  bodyRef: RefObject<HTMLDivElement | null>;
  count: number;
  resetKey: string;
  onReset?: () => void;
}): IListWindow => {
  const [rowWindow, setRowWindow] = useState({
    start: 0,
    end: FIRST_WINDOW_ROWS,
  });
  const rowWindowRef = useRef(rowWindow);
  rowWindowRef.current = rowWindow;
  const countRef = useRef(count);
  countRef.current = count;
  /** The row count the mounted window was last worked out for. */
  const windowCountRef = useRef(-1);
  const rowHeightRef = useRef(ROW_HEIGHT);
  /** True while the restore below is assigning, so the scroll events that
   * assignment fires do not write a half-restored value back. */
  const isRestoringRef = useRef(false);
  const [activeId, setActiveId] = useState<string | undefined>(
    () => rememberedListState.get(resetKey)?.activeId,
  );
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;

  const windowFor = useCallback((element: HTMLElement) => {
    windowCountRef.current = countRef.current;
    return rowWindowFor({
      scrollTop: element.scrollTop,
      paneHeight: element.clientHeight,
      screenHeight: window.innerHeight,
      rowHeight: rowHeightRef.current,
      count: countRef.current,
    });
  }, []);

  /** Re-renders only for a genuinely different window: scroll fires every
   * frame, and the answer changes every few hundred pixels. */
  const applyWindow = useCallback((next: { start: number; end: number }) => {
    const { current } = rowWindowRef;
    if (next.start === current.start && next.end === current.end) {
      return;
    }
    rowWindowRef.current = next;
    setRowWindow(next);
  }, []);

  /**
   * Where the reader is, recorded as they go — never off an element being
   * torn down, whose `scrollTop` an ancestor collapsing for one frame has
   * already zeroed. Saving zero looks exactly like never having scrolled.
   */
  const remember = useCallback(
    (element: HTMLDivElement) => {
      if (isRestoringRef.current) {
        return;
      }
      rememberList(resetKey, {
        scrollTop: element.scrollTop,
        activeId: rememberedListState.get(resetKey)?.activeId,
      });
    },
    [resetKey],
  );

  const rememberActive = useCallback(
    (id: string) => {
      setActiveId(id);
      rememberList(resetKey, {
        scrollTop:
          bodyRef.current?.scrollTop ??
          rememberedListState.get(resetKey)?.scrollTop ??
          0,
        activeId: id,
      });
    },
    [bodyRef, resetKey],
  );

  /**
   * Back to where the reader left this table, or to the top. A layout effect:
   * coming back is a fresh mount, and restoring after paint shows one frame
   * of the top before it jumps. Keyed on what the table MEANS, never on its
   * rows, which change under a scan several times a second.
   */
  useLayoutEffect(() => {
    const element = bodyRef.current;
    const remembered = rememberedListState.get(resetKey);
    if (!element) {
      return;
    }
    isRestoringRef.current = true;
    setActiveId(remembered?.activeId);
    onResetRef.current?.();
    // `scrollTop` rather than `scrollTo`, which jsdom does not implement.
    element.scrollTop = remembered?.scrollTop ?? 0;
    applyWindow(windowFor(element));
    isRestoringRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new table, and only that
  }, [resetKey]);

  /** A real row's height and the pane's, measured and watched: a pane that
   * changes height without the window doing so is caught too. */
  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) {
      return undefined;
    }
    const measure = () => {
      const row = element.querySelector('.library-list__row');
      const height = row?.getBoundingClientRect().height ?? 0;
      if (height > 0) {
        rowHeightRef.current = height;
      }
      applyWindow(windowFor(element));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [applyWindow, bodyRef, windowFor]);

  /**
   * A window worked out for a different number of rows than there now are:
   * a table that grew with no scroll or resize — a folder of three albums
   * left for the library's thousand — kept three rows over the new height.
   * After every render, because it costs a comparison when nothing changed.
   */
  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (element && windowCountRef.current !== countRef.current) {
      applyWindow(windowFor(element));
    }
  });

  const onScroll = useCallback(
    (element: HTMLDivElement) => {
      applyWindow(windowFor(element));
      remember(element);
    },
    [applyWindow, remember, windowFor],
  );

  const scrollToRow = useCallback(
    (index: number) => {
      const element = bodyRef.current;
      if (!element) {
        return;
      }
      const rowHeight = rowHeightRef.current;
      // Centred, and never past either end.
      element.scrollTop = Math.max(
        0,
        index * rowHeight - (element.clientHeight - rowHeight) / 2,
      );
      applyWindow(windowFor(element));
      remember(element);
    },
    [applyWindow, bodyRef, remember, windowFor],
  );

  const start = Math.min(rowWindow.start, count);
  return {
    start,
    end: Math.min(Math.max(rowWindow.end, start), count),
    rowHeight: rowHeightRef.current,
    activeId,
    setActiveId,
    rememberActive,
    onScroll,
    scrollToRow,
  };
};
