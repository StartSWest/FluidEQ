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
import { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';

export interface IVideoFolderGroup {
  folder: string;
  tracks: ILibraryTrack[];
}

/** How far beyond the viewport stays mounted, each way, in viewports — the
 * list view's own constant, and everything its comment says applies here. */
const OVERSCAN_VIEWPORTS = 3;

/**
 * Starting guesses only; every one is measured off the real shelf on layout.
 *
 * The column count especially: `.library-video-section__grid` is
 * `repeat(auto-fill, minmax(150px, 1fr))`, so there is no right number to
 * write down — it comes from the pane's width, exactly as in `LibraryGridView`.
 */
const TILE_HEIGHT = 196;
const HEADER_HEIGHT = 40;
const ROW_GAP = 16;
const COLUMNS = 6;

/** Rows mounted before anything has been measured, as a height rather than a
 * count: the rows here are two different sizes, so a count means nothing. */
const FIRST_WINDOW_HEIGHT = 1_400;

/**
 * The most rows this view will mount, whatever it is told about the pane.
 *
 * `LibraryListView`'s `MAX_WINDOW_ROWS` and its comment word for word: a
 * ceiling made of arithmetic cannot be wrong the way one made of a
 * measurement can, and a measurement of a scroll container really can come
 * back as the height of its own content.
 */
const MAX_WINDOW_ROWS = 400;

/** A folder heading, or one row of tiles under one. */
export type TVideoRow =
  | { kind: 'header'; key: string; folder: string }
  | { kind: 'tiles'; key: string; tracks: readonly ILibraryTrack[] };

export interface IVideoShelfMetrics {
  headerHeight: number;
  tileHeight: number;
  gap: number;
  columns: number;
}

/**
 * The shelf as a flat list of rows, which is what makes it windowable.
 *
 * Nested folders each holding their own grid cannot be windowed without
 * measuring every folder, so the nesting is flattened here instead: one
 * heading row, then a row per `columns` videos under it. The folder a row
 * belongs to survives in its key, so React never reuses a row of one folder's
 * tiles for another's.
 */
export const videoShelfRows = (
  groups: readonly IVideoFolderGroup[],
  columns: number,
): TVideoRow[] => {
  const rows: TVideoRow[] = [];
  const width = Math.max(1, columns);
  groups.forEach((group) => {
    rows.push({
      kind: 'header',
      key: `h:${group.folder}`,
      folder: group.folder,
    });
    for (let at = 0; at < group.tracks.length; at += width) {
      rows.push({
        kind: 'tiles',
        key: `t:${group.folder}:${at}`,
        tracks: group.tracks.slice(at, at + width),
      });
    }
  });
  return rows;
};

/**
 * Where every row starts, and where the last one ends.
 *
 * One entry longer than `rows`, so the end of row `i` is always `offsets[i+1]`
 * and no caller has to special-case the last one.
 */
export const videoShelfOffsets = (
  rows: readonly TVideoRow[],
  metrics: IVideoShelfMetrics,
): number[] => {
  const offsets: number[] = [0];
  rows.forEach((row, index) => {
    const height =
      row.kind === 'header' ? metrics.headerHeight : metrics.tileHeight;
    offsets.push(offsets[index] + height + metrics.gap);
  });
  return offsets;
};

/**
 * Which rows belong on screen, from numbers alone.
 *
 * Pure, exported and tested for the reason `rowWindowFor` is: `paneHeight` is
 * a measurement, and a measurement can be absurd. Two ceilings answer that —
 * `screenHeight`, because nobody can read more than a screenful so a taller
 * scroll container is a layout fault, and `MAX_WINDOW_ROWS` regardless.
 */
export const videoRowWindowFor = ({
  scrollTop,
  paneHeight,
  screenHeight,
  offsets,
}: {
  scrollTop: number;
  /** The shelf's own `clientHeight`. Zero before it is laid out. */
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

/**
 * The last path segment before the file name — `C:\V\Live\a.mp4` reports
 * `Live`. Splits on both `\` and `/`: a path arrives as Windows text, but a
 * normaliser that only handled `\` would break the moment anything is
 * written with a forward slash instead.
 *
 * Fewer than two segments (a bare filename, nothing this scanner should ever
 * actually produce) reports the empty string rather than throwing — the
 * caller groups on it like any other folder name instead of crashing on a
 * shape reality is not expected to hand it.
 */
const folderOf = (path: string): string => {
  const segments = path.split(/[\\/]+/).filter((segment) => segment.length > 0);
  return segments.length >= 2 ? segments[segments.length - 2] : '';
};

/**
 * Videos grouped by the folder they live in — the fallback grouping for a
 * kind that carries no album tag to group by. `groupIntoAlbums` keys on
 * `albumKey`; this keys on the folder name for the same reason a video has
 * no `album` field to read in the first place.
 *
 * Only `kind === 'video'` tracks are considered: `tracks` here is the same
 * already-searched, already-sorted list every other browse mode is handed
 * (see `LibraryWorkspace`'s `visibleTracks`), and that list still has audio
 * in it — the filter is this function's job, not its caller's.
 *
 * Returned sorted by folder name, so the shelf renders in a stable order
 * rather than whatever order a `Map` happened to fill during the walk.
 */
export const videoFolderGroups = (
  tracks: readonly ILibraryTrack[],
): IVideoFolderGroup[] => {
  const grouped = new Map<string, ILibraryTrack[]>();
  tracks
    .filter((track) => track.kind === 'video')
    .forEach((track) => {
      const folder = folderOf(track.path);
      const existing = grouped.get(folder);
      if (existing) {
        existing.push(track);
      } else {
        grouped.set(folder, [track]);
      }
    });
  return Array.from(grouped.entries())
    .map(([folder, members]) => ({ folder, tracks: members }))
    .sort((left, right) => left.folder.localeCompare(right.folder));
};

interface ILibraryVideoSectionProps {
  tracks: readonly ILibraryTrack[];
  onPlayTrack: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — spec §10: kept, never deleted,
   * and dimmed. Optional for the same reason `LibraryListView`'s own prop of
   * the same name is: real usage always supplies it. */
  offlineRootIds?: ReadonlySet<string>;
}

const NO_OFFLINE_ROOTS: ReadonlySet<string> = new Set();

/**
 * The video section: a shelf of its own rather than folded into the album,
 * artist or song browsing above it — `LibraryWorkspace` routes
 * `browseMode === 'video'` here and never hands that mode to
 * `LibraryListView`, `LibraryGridView` or `LibraryCoverFlow`, so none of
 * them need to know this exists.
 *
 * One heading per folder, a `LibraryCoverArt size="tile"` grid beneath it —
 * the same tile `LibraryGridView` draws for a song, reused rather than
 * redrawn, laid out under a folder heading instead of a flat grid.
 *
 * A track Chromium cannot decode (`isPlayable === false`, see
 * `isLibraryPlayable`) still gets a tile: its thumbnail or generated
 * initials, same as every playable one, rather than a hole in the shelf. A
 * grid tile has no title cell to carry the mark inline the way
 * `LibraryListView`'s row does, so the mark sits on the corner of the art
 * instead — a small badge, not a black rectangle standing in for the video
 * itself.
 */
const LibraryVideoSection = ({
  tracks,
  onPlayTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
}: ILibraryVideoSectionProps) => {
  const { t } = useTranslation();

  // Walks the whole track list, so memoised on `tracks` alone — the same
  // split `LibraryGridView`'s `items` memo makes: `onPlayTrack` and `t` are
  // resolved at render time below, never as memo dependencies, since
  // `LibraryWorkspace` hands down a fresh `onPlayTrack` closure every render.
  const groups = useMemo(() => videoFolderGroups(tracks), [tracks]);

  const shelfRef = useRef<HTMLDivElement | null>(null);
  /**
   * What the shelf actually laid out. All measured, none assumed — see
   * `IVideoShelfMetrics`.
   *
   * State rather than a ref, because the row model and every offset are built
   * from it: a measurement kept in a ref would move without rebuilding either,
   * and the shelf would reserve space for rows of a height it no longer draws.
   * It only ever changes when a number genuinely differs, so this costs one
   * render on layout and one per resize that moves something.
   */
  const [metrics, setMetrics] = useState<IVideoShelfMetrics>({
    headerHeight: HEADER_HEIGHT,
    tileHeight: TILE_HEIGHT,
    gap: ROW_GAP,
    columns: COLUMNS,
  });

  const rows = useMemo(
    () => videoShelfRows(groups, metrics.columns),
    [groups, metrics.columns],
  );
  const offsets = useMemo(
    () => videoShelfOffsets(rows, metrics),
    [rows, metrics],
  );
  /**
   * Rows mounted before anything has been measured — enough to fill the
   * tallest pane this app is usable in plus its overscan, so the first paint
   * is never short and the layout effect below always has a real heading and a
   * real tile to take its numbers from.
   */
  const [rowWindow, setRowWindow] = useState({ start: 0, end: 60 });

  /** Applies a window, and re-renders only when it is genuinely different. */
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
   * Read the real numbers off a mounted row.
   *
   * A first paint always mounts something — `FIRST_WINDOW_HEIGHT` of guessed
   * rows — so there is a real heading and a real grid to measure by the time
   * this runs, and `auto-fill` has already chosen the column count.
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
        grid?.querySelector<HTMLElement>('.library-grid__tile')?.offsetHeight ||
        TILE_HEIGHT,
      gap: parseFloat(shelf.rowGap) || ROW_GAP,
      columns: grid
        ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean)
            .length || COLUMNS
        : COLUMNS,
    };
    // Only when something actually moved: `setMetrics` rebuilds the rows and
    // every offset, and this effect runs after each of those renders. Writing
    // an equal object here would be a loop that never settles.
    setMetrics((was) =>
      was.headerHeight === measured.headerHeight &&
      was.tileHeight === measured.tileHeight &&
      was.gap === measured.gap &&
      was.columns === measured.columns
        ? was
        : measured,
    );
    applyWindow(windowFor(element));
    // `rows` rather than nothing: a folder appearing or the shelf being
    // re-entered has to re-measure, since the pane may be a different size.
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

  if (groups.length === 0) {
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

  const start = Math.min(rowWindow.start, rows.length);
  const end = Math.min(Math.max(rowWindow.end, start), rows.length);
  // The rows that are not mounted, as one empty block above and one below.
  // Taken off the offsets rather than recomputed, so the space reserved is by
  // construction the space the rows would have taken.
  const above = offsets[start] ?? 0;
  const below = Math.max(0, (offsets[rows.length] ?? 0) - (offsets[end] ?? 0));

  return (
    <div
      className="library-video-section"
      aria-label={t('library.videos')}
      ref={shelfRef}
      onScroll={(event) => applyWindow(windowFor(event.currentTarget))}
    >
      {above > 0 && <div aria-hidden="true" style={{ height: above }} />}
      {rows.slice(start, end).map((row) =>
        row.kind === 'header' ? (
          <h3 key={row.key} className="library-video-section__folder-title">
            {row.folder}
          </h3>
        ) : (
          <div key={row.key} className="library-video-section__grid">
            {row.tracks.map((track) => {
              // Spec §10: a root missing at rescan is marked offline and its
              // tracks are "kept and dimmed — never deleted", not silently
              // unplayable.
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
                    {/* Chromium has no demuxer for this container — marked
                        on the art itself, the one place a grid tile has to
                        put it. See `LibraryListView`'s inline badge for the
                        row equivalent of this same mark. */}
                    {!track.isPlayable && (
                      <span
                        className="library-video-section__unplayable"
                        title={t('library.unplayable')}
                      >
                        <MenuIcon
                          name="clear"
                          className="library-list__badge-icon"
                        />
                      </span>
                    )}
                    {/* Opposite corner from the unplayable mark above -- an
                        unreadable container is knowable from its extension
                        alone, so a video can genuinely be both unplayable
                        and still pending at once, and each needs its own
                        spot rather than one overwriting the other. Same
                        quiet restraint as `LibraryListView`'s pending badge. */}
                    {track.isPending && (
                      <span
                        className="library-video-section__pending"
                        title={t('library.pending')}
                      >
                        <MenuIcon
                          name="pending"
                          className="library-list__badge-icon"
                        />
                      </span>
                    )}
                  </span>
                  <span className="library-grid__title">{track.title}</span>
                </button>
              );
            })}
          </div>
        ),
      )}
      {below > 0 && <div aria-hidden="true" style={{ height: below }} />}
    </div>
  );
};

export default LibraryVideoSection;
