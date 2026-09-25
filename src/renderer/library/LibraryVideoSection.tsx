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

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import { LibrarySectionBand } from './LibrarySectionHeading';
import { useLibrary } from './LibraryContext';
import { librarySectionsOf, TLibrarySection } from './libraryRows';
import type { ILibraryList } from './useLibraryList';

/** How far beyond the viewport stays mounted, each way, in viewports. */
const OVERSCAN_VIEWPORTS = 3;

/**
 * Starting guesses only; every one is measured off the real shelf on layout.
 * The column count especially: `.library-video-section__grid` is
 * `repeat(auto-fill, minmax(150px, 1fr))`, so it comes from the pane's width.
 */
const TILE_HEIGHT = 196;
const HEADER_HEIGHT = 40;
const ROW_GAP = 16;
const COLUMNS = 6;

/** Rows mounted before anything has been measured, as a height: the rows are
 * two different sizes, so a count means nothing. */
const FIRST_WINDOW_HEIGHT = 1_400;

/** The most rows this view will mount, whatever it is told about the pane —
 * a ceiling made of arithmetic cannot be wrong the way a measurement can. */
const MAX_WINDOW_ROWS = 400;

/** One folder's run of videos: its heading's row, and the rows under it. */
export interface IVideoRun {
  heading: number;
  first: number;
  count: number;
}

/** The runs, from where each folder heading stands in a list of `total`. */
export const videoRunsOf = (
  headings: readonly number[],
  total: number,
): IVideoRun[] =>
  headings.map((heading, at) => {
    const next = at + 1 < headings.length ? headings[at + 1] : total;
    return {
      heading,
      first: heading + 1,
      count: Math.max(0, next - heading - 1),
    };
  });

/** A search's section heading, a folder heading, or one row of tiles. */
export type TVideoRow =
  | { kind: 'section'; key: string; section: TLibrarySection }
  | { kind: 'header'; key: string; heading: number }
  | { kind: 'tiles'; key: string; first: number; count: number };

export interface IVideoShelfMetrics {
  headerHeight: number;
  tileHeight: number;
  gap: number;
  columns: number;
}

/**
 * The shelf as a flat list of rows, which is what makes it windowable:
 * nested folders each holding their own grid cannot be windowed without
 * measuring every folder, so the nesting is flattened here — a heading row,
 * then a row per `columns` videos under it. A search from inside a folder
 * puts its section headings before the run they open.
 */
export const videoShelfRows = (
  runs: readonly IVideoRun[],
  columns: number,
  sections: readonly { before: number; section: TLibrarySection }[] = [],
): TVideoRow[] => {
  const rows: TVideoRow[] = [];
  const width = Math.max(1, columns);
  const sectionsBefore = (row: number) => {
    sections
      .filter((entry) => entry.before === row)
      .forEach((entry) =>
        rows.push({
          kind: 'section',
          key: `s:${entry.section}`,
          section: entry.section,
        }),
      );
  };
  if (runs.length === 0) {
    sectionsBefore(0);
  }
  runs.forEach((run) => {
    sectionsBefore(run.heading);
    rows.push({
      kind: 'header',
      key: `h:${run.heading}`,
      heading: run.heading,
    });
    for (let at = 0; at < run.count; at += width) {
      rows.push({
        kind: 'tiles',
        key: `t:${run.heading}:${at}`,
        first: run.first + at,
        count: Math.min(width, run.count - at),
      });
    }
  });
  return rows;
};

/** Where every row starts, and where the last one ends — one entry longer
 * than `rows`, so the end of row `i` is always `offsets[i+1]`. */
export const videoShelfOffsets = (
  rows: readonly TVideoRow[],
  metrics: IVideoShelfMetrics,
): number[] => {
  const offsets: number[] = [0];
  rows.forEach((row, index) => {
    const height =
      row.kind === 'tiles' ? metrics.tileHeight : metrics.headerHeight;
    offsets.push(offsets[index] + height + metrics.gap);
  });
  return offsets;
};

/**
 * Which rows belong on screen, from numbers alone. Pure and tested for the
 * reason `rowWindowFor` is: `paneHeight` is a measurement and can be absurd,
 * so the screen caps what is believed and `MAX_WINDOW_ROWS` the result.
 */
export const videoRowWindowFor = ({
  scrollTop,
  paneHeight,
  screenHeight,
  offsets,
}: {
  scrollTop: number;
  paneHeight: number;
  screenHeight: number;
  offsets: readonly number[];
}): { start: number; end: number } => {
  const count = Math.max(0, offsets.length - 1);
  const viewport = Math.min(paneHeight || FIRST_WINDOW_HEIGHT, screenHeight);
  const overscan = viewport * OVERSCAN_VIEWPORTS;
  const top = Math.max(0, scrollTop - overscan);
  const bottom = scrollTop + viewport + overscan;
  let start = 0;
  while (start < count && offsets[start + 1] <= top) {
    start += 1;
  }
  let end = start;
  while (
    end < count &&
    offsets[end] < bottom &&
    end - start < MAX_WINDOW_ROWS
  ) {
    end += 1;
  }
  return { start, end };
};

/** A folder heading's name: the last segment of its path. */
const folderName = (folder: string): string =>
  folder.split('/').filter(Boolean).pop() ?? folder;

interface ILibraryVideoSectionProps {
  /** Every video in scope, a page at a time, by folder: ordered by path and
   * with a heading over each folder's run. */
  list: ILibraryList;
  onPlayTrack: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — kept, never deleted, dimmed. */
  offlineRootIds?: ReadonlySet<string>;
}

const NO_OFFLINE_ROOTS: ReadonlySet<string> = new Set();

/**
 * The video shelf: a shelf of its own rather than folded into the album,
 * artist or song browsing — `LibraryWorkspace` routes `browseMode ===
 * 'video'` here and to nothing else.
 *
 * One heading per folder, a tile grid beneath it — the tile `LibraryGridView`
 * draws for a song, laid out under a folder heading. A video Chromium cannot
 * decode still gets its tile, marked on the corner of the art: a grid tile
 * has no title cell to carry the mark inline the way a row does.
 *
 * Where each folder's run starts is asked of the store (`headings`); the
 * videos themselves come a page at a time, the pages under the rows on
 * screen, so a shelf of thousands keeps a few hundred here.
 */
const LibraryVideoSection = ({
  list,
  onPlayTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
}: ILibraryVideoSectionProps) => {
  const { t } = useTranslation();
  const { summary } = useLibrary();
  const shelfRef = useRef<HTMLDivElement | null>(null);

  /**
   * Where each folder heading stands. Asked again when the list or the
   * library changes; the last answer stands until the next lands, so a scan
   * batch never empties the shelf for a round trip.
   */
  const [headings, setHeadings] = useState<readonly number[]>([]);
  const listKey = list.query === undefined ? '' : JSON.stringify(list.query);
  useEffect(() => {
    const asked = list.query;
    if (asked === undefined) {
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .queryLibrary({ type: 'headings', query: asked })
      .then((found) => {
        if (isCurrent) {
          setHeadings(found);
        }
        return undefined;
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
    // `list.query` is what `listKey` spells.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, summary.version]);

  /**
   * What the shelf actually laid out, measured. State rather than a ref,
   * because the rows and every offset are built from it: a measurement kept
   * in a ref would move without rebuilding either.
   */
  const [metrics, setMetrics] = useState<IVideoShelfMetrics>({
    headerHeight: HEADER_HEIGHT,
    tileHeight: TILE_HEIGHT,
    gap: ROW_GAP,
    columns: COLUMNS,
  });

  const sections = useMemo(() => librarySectionsOf(list), [list]);
  const runs = useMemo(
    () => videoRunsOf(headings, list.count),
    [headings, list.count],
  );
  const rows = useMemo(
    () => videoShelfRows(runs, metrics.columns, sections),
    [runs, metrics.columns, sections],
  );
  const offsets = useMemo(
    () => videoShelfOffsets(rows, metrics),
    [rows, metrics],
  );
  const [rowWindow, setRowWindow] = useState({ start: 0, end: 60 });

  const applyWindow = useCallback((next: { start: number; end: number }) => {
    setRowWindow((was) =>
      was.start === next.start && was.end === next.end ? was : next,
    );
  }, []);

  const windowFor = useCallback(
    (element: HTMLElement) =>
      videoRowWindowFor({
        scrollTop: element.scrollTop,
        paneHeight: element.clientHeight,
        screenHeight: window.innerHeight,
        offsets,
      }),
    [offsets],
  );

  /**
   * The real numbers, read off a mounted heading and a mounted tile — a real
   * one: a tile whose page is still out is drawn the same size, but measuring
   * it would be trusting the copy over the thing.
   */
  useLayoutEffect(() => {
    const element = shelfRef.current;
    if (!element) {
      return;
    }
    const grid = element.querySelector<HTMLElement>(
      '.library-video-section__grid',
    );
    const header = element.querySelector<HTMLElement>(
      '.library-video-section__folder-title',
    );
    const shelf = getComputedStyle(element);
    const measured: IVideoShelfMetrics = {
      headerHeight: header?.offsetHeight || HEADER_HEIGHT,
      tileHeight:
        grid?.querySelector<HTMLElement>(
          '.library-grid__tile:not(.library-grid__tile--placeholder)',
        )?.offsetHeight || TILE_HEIGHT,
      gap: parseFloat(shelf.rowGap) || ROW_GAP,
      columns: grid
        ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean)
            .length || COLUMNS
        : COLUMNS,
    };
    // Only when something moved: every write rebuilds the rows and offsets,
    // and this runs after each of those renders — an equal object would be a
    // loop that never settles.
    setMetrics((was) =>
      was.headerHeight === measured.headerHeight &&
      was.tileHeight === measured.tileHeight &&
      was.gap === measured.gap &&
      was.columns === measured.columns
        ? was
        : measured,
    );
    applyWindow(windowFor(element));
  }, [rows, applyWindow, windowFor]);

  /** A pane that changes size changes how many rows belong on screen. */
  useEffect(() => {
    const element = shelfRef.current;
    if (!element || typeof ResizeObserver !== 'function') {
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      applyWindow(windowFor(element));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [applyWindow, windowFor]);

  const start = Math.min(rowWindow.start, rows.length);
  const end = Math.min(Math.max(rowWindow.end, start), rows.length);
  const mounted = rows.slice(start, end);

  // The pages under the rows on screen: from the first heading or tile
  // mounted to the last tile.
  useEffect(() => {
    let low = Number.MAX_SAFE_INTEGER;
    let high = 0;
    mounted.forEach((row) => {
      if (row.kind === 'header') {
        low = Math.min(low, row.heading);
        high = Math.max(high, row.heading + 1);
      } else if (row.kind === 'tiles') {
        low = Math.min(low, row.first);
        high = Math.max(high, row.first + row.count);
      }
    });
    list.want(low === Number.MAX_SAFE_INTEGER ? 0 : low, Math.max(high, 1));
    // The mounted slice is what `start`, `end` and `rows` spell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, start, end, rows]);

  if (list.isLoaded && list.count === 0) {
    return (
      <div
        className="library-video-section is-empty"
        aria-label={t('library.videos')}
      >
        <p className="library-video-section__empty">
          {t('library.videos.empty')}
        </p>
      </div>
    );
  }

  // The rows not mounted, as one empty block above and one below — taken off
  // the offsets, minus one gap each, because a spacer is itself a flex child
  // and the shelf puts a gap after it.
  const above = Math.max(0, (offsets[start] ?? 0) - metrics.gap);
  const below = Math.max(
    0,
    (offsets[rows.length] ?? 0) - (offsets[end] ?? 0) - metrics.gap,
  );

  const renderTile = (row: number) => {
    const item = list.at(row);
    if (item?.kind !== 'track') {
      return (
        <span
          key={`pending-${row}`}
          aria-hidden="true"
          className="library-grid__tile library-grid__tile--placeholder"
        >
          <span className="library-video-section__art">
            <span className="library-cover-art library-cover-art--tile" />
          </span>
          <span className="library-grid__title">{' '}</span>
        </span>
      );
    }
    const { track } = item;
    // A root missing at rescan is kept and dimmed, never deleted.
    const isOffline = offlineRootIds.has(track.rootId);
    const tileClassName = [
      'library-grid__tile',
      isOffline ? 'library-grid__tile--offline' : '',
      track.isPending ? 'library-grid__tile--pending' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={track.id}
        type="button"
        className={tileClassName}
        title={isOffline ? t('library.root.offline') : undefined}
        onClick={() => onPlayTrack(track.id)}
      >
        <span className="library-video-section__art">
          <LibraryCoverArt
            artId={track.artId}
            label={track.title}
            size="tile"
          />
          {/* Chromium has no demuxer for this container — marked on the art
              itself, the one place a grid tile has to put it. */}
          {!track.isPlayable && (
            <span
              className="library-video-section__unplayable"
              title={t('library.unplayable')}
            >
              <MenuIcon name="clear" className="library-list__badge-icon" />
            </span>
          )}
          {/* Opposite corner from the unplayable mark: a video can be both
              unplayable and still pending, and each needs its own spot. */}
          {track.isPending && (
            <span
              className="library-video-section__pending"
              title={t('library.pending')}
            >
              <MenuIcon name="pending" className="library-list__badge-icon" />
            </span>
          )}
        </span>
        <span className="library-grid__title">{track.title}</span>
      </button>
    );
  };

  return (
    <div
      className="library-video-section"
      aria-label={t('library.videos')}
      ref={shelfRef}
      onScroll={(event) => applyWindow(windowFor(event.currentTarget))}
    >
      {above > 0 && (
        <div
          className="library-video-section__spacer"
          aria-hidden="true"
          style={{ height: above }}
        />
      )}
      {mounted.map((row) => {
        if (row.kind === 'section') {
          return (
            <LibrarySectionBand
              key={row.key}
              row={{ kind: 'section', section: row.section }}
              folderPath={list.query?.near}
              height={metrics.headerHeight}
            />
          );
        }
        if (row.kind === 'header') {
          const heading = list.at(row.heading);
          return (
            <h3 key={row.key} className="library-video-section__folder-title">
              {heading?.kind === 'heading' ? folderName(heading.folder) : ' '}
            </h3>
          );
        }
        const tiles = [];
        for (let at = row.first; at < row.first + row.count; at += 1) {
          tiles.push(renderTile(at));
        }
        return (
          <div key={row.key} className="library-video-section__grid">
            {tiles}
          </div>
        );
      })}
      {below > 0 && (
        <div
          className="library-video-section__spacer"
          aria-hidden="true"
          style={{ height: below }}
        />
      )}
    </div>
  );
};

export default LibraryVideoSection;
