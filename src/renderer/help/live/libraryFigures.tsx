/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState, type CSSProperties, type ReactNode } from 'react';
import type {
  TLibraryBrowseMode,
  TLibraryViewMode,
} from 'common/library/types';
import Chevron from '../../icons/Chevron';
import MenuIcon from '../../icons/MenuIcon';
import LibraryCoverArt from '../../library/LibraryCoverArt';
import LibrarySearchField from '../../library/LibrarySearchField';
import LibraryPlaceBar, {
  type ILibraryPlaceRecord,
} from '../../library/LibraryPlaceBar';
import LibraryShelfRail from '../../library/LibraryShelfRail';
import LibraryStatusLine from '../../library/LibraryStatusLine';
import LibraryTopBar from '../../library/LibraryTopBar';
import { LibraryUpNextChip } from '../../library/LibraryUpNext';
import { countText, formatLength } from '../../library/libraryFormat';
import { useTranslation } from '../../utils/I18nContext';
import libraryFilterHistory from '../../utils/libraryFilterHistory';
import StudioRail from '../../widgets/StudioRail';
import {
  HELP_ALBUMS,
  HELP_COUNTS,
  HELP_PLAYLISTS,
  HELP_RAIL,
  HELP_RECORD,
  HELP_RECORD_SONGS,
  HELP_ROOTS,
  HELP_UP_NEXT,
} from './libraryFigureData';
import RecordTable from './libraryRecordTable';
import { UpNextPane } from './libraryPaneFigures';

/**
 * The Library chapters' page (`helpChapters/listen.ts`), drawn by the page's
 * own parts from a made-up collection (`libraryFigureData`): the studio rail
 * with the shelves, the top bar, the place bar and the status line are the
 * Library's own components, fed made-up counts and handlers that do
 * nothing. The shelf and the record read the reader's library through the
 * store, so the grid's tiles, the record's hero and its table are their
 * markup, class for class (`LibraryGridView`, `LibraryDetailHeader`,
 * `LibraryListView`), with drawn covers handed to `LibraryCoverArt`.
 */

const nothing = () => undefined;

const SHELF_LABEL_KEYS = {
  album: 'library.browse.album',
  artist: 'library.browse.artist',
  genre: 'library.browse.genre',
  song: 'library.browse.song',
  folder: 'library.browse.folder',
  video: 'library.videos',
  playlist: 'library.browse.playlist',
} as const;

/** What a queue of the made-up record counts: the rest, then the picks. */
const UP_NEXT_COUNT = HELP_UP_NEXT.rest.length + HELP_UP_NEXT.added.length;

/** The record's songs and how long they last, summed. */
const RECORD_TOTALS = {
  count: HELP_RECORD_SONGS.length,
  durationMs: HELP_RECORD_SONGS.reduce(
    (sum, song) => sum + (song.durationMs ?? 0),
    0,
  ),
};

/** The whole shelf's, as the status line counts what is on screen. */
const SHELF_TOTALS = { count: HELP_COUNTS.song, durationMs: 312_000_000 };

interface ILibraryShellProps {
  browseMode: TLibraryBrowseMode;
  viewMode: TLibraryViewMode;
  /** The record open on the shelf, the place bar's last step. */
  record?: ILibraryPlaceRecord;
  /**
   * The side column: Up next open, or the tag editor's changes in its place
   * (`has-changes-panel`); absent leaves Up next folded.
   */
  side?: { kind: 'upNext' | 'changes'; pane: ReactNode };
  /** The rail folded to its glyphs by its pin, for a page that needs room. */
  isRailFolded?: boolean;
  height: number;
  children: ReactNode;
}

/**
 * The Library tab as `LibraryWorkspaceView` lays it out: the rail, the
 * column under its bar and breadcrumb, the side column, the status line.
 */
export const LibraryShell = ({
  browseMode,
  viewMode,
  record,
  side,
  isRailFolded = false,
  height,
  children,
}: ILibraryShellProps) => {
  const { t } = useTranslation();
  const [isPinned, setPinned] = useState(!isRailFolded);
  const isOpen = side?.kind === 'upNext';
  return (
    <section
      className={`library-workspace workspace-tab-panel workspace-tab-panel--library has-library${
        isOpen ? ' has-up-next' : ''
      }${side?.kind === 'changes' ? ' has-changes-panel' : ''}`}
      aria-label={t('tabs.library')}
      style={{ height, '--up-next-width': '300px' } as CSSProperties}
    >
      <StudioRail
        rail={HELP_RAIL}
        isPinned={isPinned}
        onPinnedChange={setPinned}
        heading={t('library.rail.library')}
      >
        <LibraryShelfRail
          browseMode={browseMode}
          counts={HELP_COUNTS}
          roots={HELP_ROOTS}
          playlists={HELP_PLAYLISTS}
          openFolderPath={undefined}
          openPlaylistId={undefined}
          onBrowseMode={nothing}
          onOpenFolder={nothing}
          onShowPlaylist={nothing}
          onAddFolder={nothing}
          onRemoveRoot={nothing}
        />
      </StudioRail>
      <div className="library-main">
        <div className="library-head">
          <LibraryTopBar
            browseMode={browseMode}
            viewMode={viewMode}
            sort="added"
            sortDirection="desc"
            onViewMode={nothing}
            onSort={record === undefined ? nothing : undefined}
            onSortDirection={record === undefined ? nothing : undefined}
            query=""
            onQuery={nothing}
            history={{
              canGoBack: record !== undefined,
              canGoForward: false,
              onGoBack: nothing,
              onGoForward: nothing,
            }}
            tail={
              <LibraryUpNextChip
                isOpen={isOpen}
                count={UP_NEXT_COUNT}
                onToggle={nothing}
              />
            }
          />
          <LibraryPlaceBar
            shelf={t(SHELF_LABEL_KEYS[browseMode])}
            folderPath={undefined}
            roots={HELP_ROOTS}
            record={record}
            onAllMusic={nothing}
            onOpenFolder={nothing}
          />
        </div>
        {children}
      </div>
      <div className="library-side">{side?.pane}</div>
      <LibraryStatusLine
        shown={record === undefined ? SHELF_TOTALS : RECORD_TOTALS}
        shownKind="song"
        counts={HELP_COUNTS}
        isScanning={false}
        progress={undefined}
        isScanNoticeHidden={false}
        onShowScan={nothing}
        onRescan={nothing}
        onForceRescan={nothing}
      />
    </section>
  );
};

/** The Albums shelf in Grid, as `LibraryGridView` draws an album's tile. */
const AlbumGrid = () => {
  const { t } = useTranslation();
  return (
    <div className="library-grid" aria-label={t('tabs.library')}>
      {HELP_ALBUMS.map((album) => (
        <button key={album.id} type="button" className="library-grid__tile">
          <span className="library-grid__art">
            <LibraryCoverArt
              src={album.cover}
              label={album.title}
              size="tile"
            />
          </span>
          <span className="library-grid__title">{album.title}</span>
          <small className="library-grid__subtitle">{album.artist}</small>
          <small className="library-grid__meta">
            {[
              String(album.year),
              countText(t, 'library.trackCount', album.songs),
            ].join(' · ')}
          </small>
        </button>
      ))}
    </div>
  );
};

/** The Library on Albums, in Grid, Up next folded. */
export const LibraryPageDrawing = () => (
  <LibraryShell browseMode="album" viewMode="grid" height={660}>
    <AlbumGrid />
  </LibraryShell>
);

/** The record's hero, as `LibraryDetailHeader` draws an album's. */
const RecordHero = () => {
  const { t } = useTranslation();
  return (
    <div className="library-hero">
      <LibraryCoverArt
        src={HELP_RECORD.cover}
        label={HELP_RECORD.title}
        size="cover"
      />
      <div className="library-hero__info">
        <div className="library-hero__kind">
          {`${t('library.kind.album')} · ${HELP_RECORD.genre}`}
        </div>
        <h2 className="library-hero__title">{HELP_RECORD.title}</h2>
        <div className="library-hero__who">
          <span className="library-artist-link">{HELP_RECORD.artist}</span>
        </div>
        <div className="library-hero__meta">
          {[
            String(HELP_RECORD.year),
            countText(t, 'library.trackCount', HELP_RECORD_SONGS.length),
            formatLength(RECORD_TOTALS.durationMs, t),
            'FLAC',
          ].join(' · ')}
          <span className="library-hero__meta-dot" aria-hidden="true">
            ·
          </span>
          <button type="button" className="library-hero__fix">
            <MenuIcon name="checkAll" className="library-hero__fix-icon" />
            {t('library.tags.hero.fix')}
          </button>
        </div>
        <div className="library-hero__actions">
          <button type="button" className="library-hero__button is-go">
            <MenuIcon name="playSolid" className="library-hero__button-icon" />
            <span>{t('library.play')}</span>
          </button>
          <button type="button" className="library-hero__button">
            <MenuIcon name="shuffle" className="library-hero__glyph" />
            <span>{t('library.shuffle')}</span>
          </button>
          <button type="button" className="library-hero__button">
            <MenuIcon name="queueAdd" className="library-hero__glyph" />
            <span>{t('library.queueAdd')}</span>
          </button>
          <button type="button" className="library-hero__button">
            <MenuIcon name="folder" className="library-hero__glyph" />
            <span>{t('library.reveal')}</span>
          </button>
          <button
            type="button"
            className="library-hero__button is-icon"
            aria-label={t('library.trackMenu')}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="3" cy="8" r="1.4" />
              <circle cx="8" cy="8" r="1.4" />
              <circle cx="13" cy="8" r="1.4" />
            </svg>
          </button>
          {/* `LibraryHeroSound`, with no sound set for the album. */}
          <span className="library-hero__sound">
            <span className="library-hero__sound-label">
              {t('library.sound.albumTitle')}
            </span>
            <button
              type="button"
              className="library-hero__button library-hero__sound-pick"
              aria-label={t('library.sound.albumAria', {
                album: HELP_RECORD.title,
              })}
            >
              <span>{t('library.sound.none')}</span>
              <Chevron />
            </button>
          </span>
          <div className="library-hero__filter">
            <LibrarySearchField
              value=""
              onChange={nothing}
              label={t('library.filterHere')}
              history={libraryFilterHistory}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * A record open: Neon Weather over its songs, the second playing, Up next
 * open beside it.
 */
export const LibraryRecordDrawing = () => (
  <LibraryShell
    browseMode="album"
    viewMode="list"
    record={{ kind: 'album', name: HELP_RECORD.title }}
    side={{ kind: 'upNext', pane: <UpNextPane /> }}
    height={720}
  >
    <div className="library-detail">
      <RecordHero />
      <RecordTable />
    </div>
  </LibraryShell>
);
