/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import MenuIcon from '../icons/MenuIcon';
import { prefersReducedMotion } from '../utils/bandReveal';
import { useTranslation } from '../utils/I18nContext';
import LibraryArtistHeading from './LibraryArtistHeading';
import LibraryCoverArt from './LibraryCoverArt';
import { countText } from './libraryFormat';
import type { ILibraryList } from './useLibraryList';
import useAlbumTileMenu from './useAlbumTileMenu';

/** Tiles mounted before the row has been measured: a wide window's worth. */
const FIRST_TILES = 16;

/** Tiles kept mounted past each edge of the row, so a page turn lands on
 * covers already drawn. */
const OVERSCAN_TILES = 8;

interface IRowShape {
  /** A tile and the gap after it, in pixels; 0 until measured. */
  step: number;
  gap: number;
  start: number;
  end: number;
}

/**
 * THE ARTIST'S RECORDS, newest first, as one row of covers over their songs.
 *
 * One row and not a grid that wraps: the songs under it scroll in a table of
 * their own (`LibraryListView`), and a wrapped grid of thirty records would
 * leave that table no room on a laptop's screen. The row scrolls sideways —
 * a wheel, a touchpad, the scrollbar, or the two arrows at the end of its
 * heading, which page it by its own width and stand down at either end.
 *
 * Only the covers near the visible stretch are mounted and asked for, as the
 * table mounts only its visible rows: "Various Artists" can be the album
 * artist of hundreds of compilations, and the unknown artist of more.
 *
 * Each record is the grid's own tile (`.library-grid__tile`), so a cover here
 * looks and answers like one on the Albums shelf: a press opens the album,
 * a right click its menu.
 */
const LibraryArtistAlbums = ({
  list,
  onOpenAlbum,
}: {
  /** The artist's records (`albumCredit`), a page at a time. */
  list: ILibraryList;
  onOpenAlbum: ((albumId: string) => void) | undefined;
}) => {
  const { t } = useTranslation();
  const albumMenu = useAlbumTileMenu();
  const railRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { count, want } = list;
  const [shape, setShape] = useState<IRowShape>({
    step: 0,
    gap: 0,
    start: 0,
    end: FIRST_TILES,
  });
  // Whether the row runs on past either edge: an arrow is there to press only
  // then. Read from the row on every scroll and change of size, never from a
  // guess at how far a smooth scroll has got.
  const [pages, setPages] = useState({ canBack: false, canOn: false });

  /** What the row shows now: its tiles' size, the stretch in view, and
   * whether there is more either side of it. */
  const readRow = useCallback(() => {
    const rail = railRef.current;
    const tile = trackRef.current?.querySelector<HTMLElement>(
      '.library-grid__tile',
    );
    if (!rail) {
      return;
    }
    const canBack = rail.scrollLeft > 1;
    const canOn = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1;
    setPages((shown) =>
      shown.canBack === canBack && shown.canOn === canOn
        ? shown
        : { canBack, canOn },
    );
    if (!tile || trackRef.current === null) {
      return;
    }
    const gap = parseFloat(getComputedStyle(trackRef.current).columnGap) || 0;
    const step = tile.offsetWidth + gap;
    if (step <= 0) {
      return;
    }
    const start = Math.max(
      0,
      Math.floor(rail.scrollLeft / step) - OVERSCAN_TILES,
    );
    const end =
      Math.ceil((rail.scrollLeft + rail.clientWidth) / step) + OVERSCAN_TILES;
    setShape((shown) =>
      shown.step === step &&
      shown.gap === gap &&
      shown.start === start &&
      shown.end === end
        ? shown
        : { step, gap, start, end },
    );
  }, []);

  useLayoutEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      return undefined;
    }
    readRow();
    const observer = new ResizeObserver(readRow);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [readRow, count]);

  const first = Math.min(shape.start, count);
  const last = Math.min(shape.end, count);
  useEffect(() => {
    if (last > first) {
      want(first, last);
    }
  }, [first, last, want]);

  /** The row a page on, or back, as far as it goes. */
  const turnPage = (direction: -1 | 1) => {
    const rail = railRef.current;
    rail?.scrollBy({
      left: direction * rail.clientWidth * 0.9,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  // Measured, the track is as long as every tile and holds the ones in view
  // after a run of padding for those before them; unmeasured, the first few.
  const trackStyle =
    shape.step > 0
      ? {
          width: Math.max(0, (count - first) * shape.step - shape.gap),
          paddingLeft: first * shape.step,
        }
      : undefined;
  const label = t('library.browse.album');
  const tiles: ReactNode[] = [];
  for (let index = first; index < last; index += 1) {
    const item = list.at(index);
    if (item?.kind !== 'album') {
      // Its page is still out: the tile's own shape, empty.
      tiles.push(
        <span
          key={`pending-${index}`}
          aria-hidden="true"
          className="library-grid__tile library-grid__tile--placeholder"
        >
          <span className="library-grid__art">
            <span className="library-cover-art library-cover-art--tile" />
          </span>
          <span className="library-grid__title"> </span>
          <small className="library-grid__subtitle"> </small>
        </span>,
      );
    } else {
      const title = item.title || t('library.unknownAlbum');
      const facts = [
        item.year === undefined ? '' : String(item.year),
        countText(t, 'library.trackCount', item.trackCount),
      ]
        .filter(Boolean)
        .join(' · ');
      tiles.push(
        <button
          key={item.id}
          type="button"
          className="library-grid__tile"
          title={title}
          disabled={onOpenAlbum === undefined}
          onClick={() => onOpenAlbum?.(item.id)}
          onContextMenu={(event) => {
            event.preventDefault();
            albumMenu.open(event.currentTarget, {
              id: item.id,
              title: item.title,
              artist: item.artist,
              trackCount: item.trackCount,
            });
          }}
        >
          <span className="library-grid__art">
            <LibraryCoverArt artId={item.artId} label={title} size="tile" />
          </span>
          <span className="library-grid__title">{title}</span>
          <small className="library-grid__subtitle">{facts}</small>
        </button>,
      );
    }
  }

  return (
    <section className="library-artist__albums" aria-label={label}>
      <LibraryArtistHeading icon="album" label={label} count={count}>
        {(pages.canBack || pages.canOn) && (
          <span className="library-artist__pager">
            <button
              type="button"
              className="library-hero__button is-icon"
              aria-label={t('library.artist.scrollBack')}
              title={t('library.artist.scrollBack')}
              disabled={!pages.canBack}
              onClick={() => turnPage(-1)}
            >
              <MenuIcon name="back" />
            </button>
            <button
              type="button"
              className="library-hero__button is-icon"
              aria-label={t('library.artist.scrollOn')}
              title={t('library.artist.scrollOn')}
              disabled={!pages.canOn}
              onClick={() => turnPage(1)}
            >
              <MenuIcon name="forward" />
            </button>
          </span>
        )}
      </LibraryArtistHeading>
      <div className="library-artist__rail" ref={railRef} onScroll={readRow}>
        <div
          className="library-artist__track"
          ref={trackRef}
          style={trackStyle}
        >
          {tiles}
        </div>
      </div>
      {albumMenu.menu}
    </section>
  );
};

export default LibraryArtistAlbums;
