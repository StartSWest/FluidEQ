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

import { KeyboardEvent, ReactNode, useEffect, useState } from 'react';
import {
  groupIntoAlbums,
  groupIntoArtists,
} from '../../common/library/grouping';
import { ILibraryTrack, TLibraryBrowseMode } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';

interface ILibraryListViewProps {
  tracks: readonly ILibraryTrack[];
  browseMode: TLibraryBrowseMode;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistId: string) => void;
  onPlayTrack: (trackId: string) => void;
  /** Root ids currently marked `isOffline` — spec §10: kept, never deleted,
   * and dimmed. Optional, matching `NowPlayingBar`'s own `volume` prop: real
   * usage always supplies it (`LibraryWorkspace` derives it from `index.roots`),
   * and no test of this view's other behaviours needs a real one to exercise
   * them. */
  offlineRootIds?: ReadonlySet<string>;
}

const NO_OFFLINE_ROOTS: ReadonlySet<string> = new Set();

/** The five column headers this view ever shows, keyed by the existing
 * `library.column.*` translation each draws from — never a computed key,
 * which `Translate`'s literal `TranslationKey` union would reject anyway. */
const COLUMN_LABEL_KEYS = {
  title: 'library.column.title',
  artist: 'library.column.artist',
  album: 'library.column.album',
  year: 'library.column.year',
  length: 'library.column.length',
} as const;

type TListColumn = keyof typeof COLUMN_LABEL_KEYS;

/**
 * `m:ss`. Minutes are never padded and never capped at 60 — an album total
 * can run well past an hour and reads naturally as `62:04`, not `1:02:04`.
 * Anything that is not a real, non-negative duration (an unread tag,
 * `NaN`) draws blank rather than `NaN:NaN`.
 */
const formatDuration = (durationMs: number | undefined): string => {
  if (
    durationMs === undefined ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  ) {
    return '';
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * A dense, sortable row-per-entry list — the first view that shows what is
 * actually in the library.
 *
 * `browseMode` chooses WHAT is listed, not HOW a row is drawn: for `'song'`
 * the rows are tracks, already searched and sorted by the caller; for
 * `'album'`/`'artist'` they are `groupIntoAlbums`/`groupIntoArtists` grouped
 * from those same tracks, and a click opens the drill-in rather than playing
 * anything. A later task widens `TLibraryBrowseMode` with `'video'` — the
 * workspace routes that value elsewhere and never hands it to this
 * component, so any value that is not `'album'` or `'artist'` is treated as
 * `'song'` here.
 */
const LibraryListView = ({
  tracks,
  browseMode,
  onOpenAlbum,
  onOpenArtist,
  onPlayTrack,
  offlineRootIds = NO_OFFLINE_ROOTS,
}: ILibraryListViewProps) => {
  const { t } = useTranslation();
  // The row a right click or a keyboard context-menu request landed on, and
  // the element the menu hangs off — the row itself, since a context menu
  // has no persistent trigger button the way `AnchoredMenu`'s other users
  // do.
  const [trackMenu, setTrackMenu] = useState<
    { trackId: string; anchor: HTMLElement } | undefined
  >(undefined);

  // Closes on a click elsewhere and on Escape, same pattern as every other
  // menu built on `AnchoredMenu` — see `LibraryFolderActions` and
  // `MainContent.tsx`'s `eq-mode__menu` for why the portalled menu has to be
  // asked about separately from the trigger.
  useEffect(() => {
    if (!trackMenu) {
      return undefined;
    }
    const onPointerDown = (event: globalThis.MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target)) {
        setTrackMenu(undefined);
      }
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTrackMenu(undefined);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [trackMenu]);

  /** Shared by the right-click handler and the keyboard one below — both
   * just need an element to anchor the menu to and the row's track id. */
  const openTrackMenu = (anchor: HTMLElement, trackId: string) => {
    setTrackMenu({ trackId, anchor });
  };

  const reveal = (trackId: string) => {
    window.electron.ipcRenderer
      .revealLibraryTrack(trackId)
      .catch(() => undefined);
    setTrackMenu(undefined);
  };

  /** Enter mirrors the row's primary action — double click for a track,
   * single click for an album or artist — so the list is fully driveable
   * without a mouse. */
  const onActivateKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    activate: () => void,
  ) => {
    if (event.key === 'Enter') {
      activate();
    }
  };

  /** A track row's own key handler: Enter plays it, and the two Windows
   * conventions for "open the context menu here" — the dedicated Context
   * Menu key and Shift+F10 — open the same menu a right click does.
   * Without this, "Show in Explorer" would be the one action in this view a
   * keyboard user could never reach at all. */
  const onTrackRowKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    track: ILibraryTrack,
  ) => {
    if (event.key === 'Enter') {
      onPlayTrack(track.id);
      return;
    }
    if (
      event.key === 'ContextMenu' ||
      (event.shiftKey && event.key === 'F10')
    ) {
      event.preventDefault();
      openTrackMenu(event.currentTarget, track.id);
    }
  };

  const columnHeader = (column: TListColumn) => t(COLUMN_LABEL_KEYS[column]);

  /** The `role="table"` shell every branch below shares: the leading,
   * unlabelled art column, the header row, the rowgroup, and — for the
   * track branch only — the context menu portalled beside it. Pulled out
   * once the three branches turned out to repeat this exact wrapper rather
   * than differ in it; what differs is only the header cells and the rows
   * themselves, both still supplied by the branch that knows what it is
   * listing. */
  const renderTable = (
    headerCells: ReactNode,
    rows: ReactNode,
    menu?: ReactNode,
  ) => (
    <div className="library-list" role="table" aria-label={t('tabs.library')}>
      <div className="library-list__header" role="row">
        <span
          className="library-list__col library-list__col--art"
          aria-hidden="true"
        />
        {headerCells}
      </div>
      <div className="library-list__body" role="rowgroup">
        {rows}
      </div>
      {menu}
    </div>
  );

  if (browseMode === 'album') {
    const albums = groupIntoAlbums(tracks);
    return renderTable(
      <>
        <span role="columnheader" className="library-list__col">
          {columnHeader('title')}
        </span>
        <span role="columnheader" className="library-list__col">
          {columnHeader('artist')}
        </span>
        <span role="columnheader" className="library-list__col">
          {columnHeader('year')}
        </span>
        <span
          role="columnheader"
          className="library-list__col library-list__col--length"
        >
          {columnHeader('length')}
        </span>
      </>,
      albums.map((album) => {
        const activate = () => onOpenAlbum(album.id);
        const title = album.title || t('library.unknownAlbum');
        return (
          <div
            key={album.id}
            role="row"
            tabIndex={0}
            className="library-list__row"
            onClick={activate}
            onKeyDown={(event) => onActivateKeyDown(event, activate)}
          >
            <span
              role="cell"
              className="library-list__col library-list__col--art"
            >
              <LibraryCoverArt artId={album.artId} label={title} size="row" />
            </span>
            <span
              role="cell"
              className="library-list__col library-list__col--title"
            >
              <span className="library-list__title-text">
                <span className="library-list__title-label">{title}</span>
              </span>
              <small className="library-list__subtitle">
                {t('library.trackCount', { count: album.trackIds.length })}
              </small>
            </span>
            <span role="cell" className="library-list__col">
              {album.artist || t('library.unknownArtist')}
            </span>
            <span role="cell" className="library-list__col">
              {album.year ?? ''}
            </span>
            <span
              role="cell"
              className="library-list__col library-list__col--length"
            >
              {formatDuration(album.durationMs)}
            </span>
          </div>
        );
      }),
    );
  }

  if (browseMode === 'artist') {
    const artists = groupIntoArtists(tracks);
    return renderTable(
      <span
        role="columnheader"
        className="library-list__col library-list__col--span"
      >
        {columnHeader('title')}
      </span>,
      artists.map((artist) => {
        const activate = () => onOpenArtist(artist.id);
        const name = artist.name || t('library.unknownArtist');
        return (
          <div
            key={artist.id}
            role="row"
            tabIndex={0}
            className="library-list__row"
            onClick={activate}
            onKeyDown={(event) => onActivateKeyDown(event, activate)}
          >
            <span
              role="cell"
              className="library-list__col library-list__col--art"
            >
              <LibraryCoverArt artId={artist.artId} label={name} size="row" />
            </span>
            <span
              role="cell"
              className="library-list__col library-list__col--title library-list__col--span"
            >
              <span className="library-list__title-text">
                <span className="library-list__title-label">{name}</span>
              </span>
              <small className="library-list__subtitle">
                {`${t('library.albumCount', { count: artist.albumCount })} · ${t(
                  'library.trackCount',
                  { count: artist.trackCount },
                )}`}
              </small>
            </span>
          </div>
        );
      }),
    );
  }

  // 'song', and any browse mode this component does not know about yet — see
  // the doc comment above for why that fallback is deliberate.
  return renderTable(
    <>
      <span role="columnheader" className="library-list__col">
        {columnHeader('title')}
      </span>
      <span role="columnheader" className="library-list__col">
        {columnHeader('artist')}
      </span>
      <span role="columnheader" className="library-list__col">
        {columnHeader('album')}
      </span>
      <span
        role="columnheader"
        className="library-list__col library-list__col--length"
      >
        {columnHeader('length')}
      </span>
    </>,
    tracks.map((track) => {
      const activate = () => onPlayTrack(track.id);
      // Spec §10: a root missing at rescan is marked offline and its tracks
      // are "kept and dimmed — never deleted", not silently unplayable.
      const isOffline = offlineRootIds.has(track.rootId);
      return (
        <div
          key={track.id}
          role="row"
          tabIndex={0}
          className={`library-list__row${isOffline ? ' library-list__row--offline' : ''}`}
          title={isOffline ? t('library.root.offline') : undefined}
          onDoubleClick={activate}
          onKeyDown={(event) => onTrackRowKeyDown(event, track)}
          onContextMenu={(event) => {
            event.preventDefault();
            openTrackMenu(event.currentTarget, track.id);
          }}
        >
          <span
            role="cell"
            className="library-list__col library-list__col--art"
          >
            <LibraryCoverArt
              artId={track.artId}
              label={track.title}
              size="row"
            />
          </span>
          <span
            role="cell"
            className="library-list__col library-list__col--title"
          >
            <span className="library-list__title-text">
              <span className="library-list__title-label">{track.title}</span>
              {/* Chromium has no decoder for this container — marked, not
                  silently broken. */}
              {!track.isPlayable && (
                <span
                  className="library-list__badge library-list__badge--unplayable"
                  title={t('library.unplayable')}
                >
                  <MenuIcon name="clear" className="library-list__badge-icon" />
                </span>
              )}
              {/* The title above is already the cleaned filename, not a tag
                  — this says why: the file's own tags could not be read,
                  not that FluidEQ failed to read them. Quiet on purpose:
                  this is information, not something to act on. */}
              {track.hasMetadataError && (
                <span
                  className="library-list__badge library-list__badge--metadata"
                  title={t('library.metadataError')}
                >
                  <MenuIcon name="info" className="library-list__badge-icon" />
                </span>
              )}
            </span>
          </span>
          <span role="cell" className="library-list__col">
            {track.artist ?? ''}
          </span>
          <span role="cell" className="library-list__col">
            {track.album ?? ''}
          </span>
          <span
            role="cell"
            className="library-list__col library-list__col--length"
          >
            {formatDuration(track.durationMs)}
          </span>
        </div>
      );
    }),
    <AnchoredMenu
      anchor={trackMenu?.anchor ?? null}
      isOpen={Boolean(trackMenu)}
      className="library-list__menu"
      ariaLabel={t('library.reveal')}
    >
      <button
        type="button"
        onClick={() => {
          if (trackMenu) {
            reveal(trackMenu.trackId);
          }
        }}
      >
        <MenuIcon name="external" className="library-list__menu-icon" />
        <span>{t('library.reveal')}</span>
      </button>
    </AnchoredMenu>,
  );
};

export default LibraryListView;
