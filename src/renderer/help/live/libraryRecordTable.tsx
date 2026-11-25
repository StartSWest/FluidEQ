/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { CSSProperties } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import LibraryColumnChooser from '../../library/LibraryColumnChooser';
import LibraryPlayingBars from '../../library/LibraryPlayingBars';
import {
  COLUMN_LABEL_KEYS,
  columnTemplate,
  formatOf,
  NUMERIC_COLUMNS,
  type TLibraryColumn,
} from '../../library/libraryColumns';
import { formatDuration } from '../../library/tags/tagTime';
import { useTranslation } from '../../utils/I18nContext';
import { HELP_PLAYING, HELP_RECORD_SONGS } from './libraryFigureData';

/**
 * The record's details table for Help's Library drawings, playing the
 * made-up record's second song: the header and the rows as
 * `LibraryListView` and `LibraryTrackRow` draw them, class for class — the
 * list reads the store, and a row asks the library which of its artist
 * names open a page — with the table's own column chooser at the end.
 */

const nothing = () => undefined;

/** The columns a table this narrow keeps, in the table's own order. */
const COLUMNS: readonly TLibraryColumn[] = [
  'artist',
  'format',
  'plays',
  'time',
];

/** How often each song was played, so the Plays column reads as used. */
const PLAYS = [14, 31, 22, 9, 12, 7, 18, 5, 11, 6];

/**
 * One song, as `LibraryTrackRow` draws it: the number cell that plays it
 * (the bars while it plays), the title with its Favourites star, the
 * columns, and the row's menu. The row asks main which artist names open a
 * page; here the name is drawn as one that does.
 */
const SongRow = ({
  song,
  plays,
  isEven,
  isFavorite,
}: {
  song: (typeof HELP_RECORD_SONGS)[number];
  plays: number;
  isEven: boolean;
  isFavorite: boolean;
}) => {
  const { t } = useTranslation();
  const isPlaying = song.id === HELP_PLAYING.id;
  const cell = (column: TLibraryColumn) => {
    switch (column) {
      case 'artist':
        return <span className="library-artist-link">{song.artist}</span>;
      case 'format':
        return (
          <span className="library-list__format">{formatOf(song.path)}</span>
        );
      case 'plays':
        return plays;
      default:
        return formatDuration(song.durationMs ?? 0);
    }
  };
  return (
    <div
      role="row"
      aria-selected={isPlaying}
      className={`library-list__row${isEven ? ' is-even' : ''}${
        isPlaying
          ? ' library-list__row--selected library-list__row--playing'
          : ''
      }`}
    >
      <span role="cell" className="library-list__col library-list__col--no">
        <button
          type="button"
          className="library-list__no-play"
          aria-label={`${t('library.play')} — ${song.title}`}
        >
          {isPlaying ? (
            <span className="library-list__playing-mark">
              <LibraryPlayingBars />
            </span>
          ) : (
            <span className="library-list__track-no">{song.trackNo}</span>
          )}
          <span className="library-list__no-glyph" aria-hidden="true">
            <MenuIcon name="play" className="library-list__badge-icon" />
          </span>
        </button>
      </span>
      <span role="cell" className="library-list__col library-list__col--title">
        <span className="library-list__title-text">
          <span className="library-list__title-label">{song.title}</span>
          {isFavorite && (
            <span className="library-list__badge library-list__badge--favorite">
              <MenuIcon name="star" className="library-list__badge-icon" />
            </span>
          )}
        </span>
      </span>
      {COLUMNS.map((column) => (
        <span
          key={column}
          role="cell"
          className={`library-list__col library-list__col--${column}${
            NUMERIC_COLUMNS.has(column) ? ' is-numeric' : ''
          }`}
        >
          {cell(column)}
        </span>
      ))}
      <span role="cell" className="library-list__col library-list__col--menu">
        <button
          type="button"
          className="library-list__row-menu"
          aria-label={t('library.trackMenu')}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="8" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="13" cy="8" r="1.4" />
          </svg>
        </button>
      </span>
    </div>
  );
};

const RecordTable = () => {
  const { t } = useTranslation();
  return (
    <div
      className="library-list library-list--songs"
      role="table"
      aria-label={t('tabs.library')}
      style={{ '--library-columns': columnTemplate(COLUMNS) } as CSSProperties}
    >
      <div className="library-list__header" role="row">
        <span
          role="columnheader"
          className="library-list__col library-list__col--no is-numeric is-sorted"
          title={t('library.column.trackNo')}
        >
          <button type="button" className="library-list__sort is-active">
            <span className="library-list__sort-label">#</span>
            <span className="library-list__sort-arrow" aria-hidden="true">
              ↑
            </span>
          </button>
        </span>
        <span
          role="columnheader"
          className="library-list__col library-list__col--title"
        >
          <button type="button" className="library-list__sort">
            <span className="library-list__sort-label">
              {t('library.column.title')}
            </span>
          </button>
        </span>
        {COLUMNS.map((column) => (
          <span
            key={column}
            role="columnheader"
            className={`library-list__col library-list__col--${column}${
              NUMERIC_COLUMNS.has(column) ? ' is-numeric' : ''
            }`}
          >
            <span className="library-list__sort-label">
              {t(COLUMN_LABEL_KEYS[column])}
            </span>
          </span>
        ))}
        <span
          role="columnheader"
          className="library-list__col library-list__col--menu"
        >
          <LibraryColumnChooser columns={COLUMNS} onToggle={nothing} />
        </span>
      </div>
      <div className="library-list__body" role="rowgroup">
        {HELP_RECORD_SONGS.map((song, at) => (
          <SongRow
            key={song.id}
            song={song}
            plays={PLAYS[at] ?? 0}
            isEven={at % 2 === 1}
            isFavorite={at === 1 || at === 6}
          />
        ))}
      </div>
    </div>
  );
};

export default RecordTable;
