/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One row of a shelf of things you open rather than play — an album, an
 * artist, a genre, a folder, a playlist — and the row standing in for one
 * whose page has not come back yet.
 *
 * One component for the five shelves. They were five copies of the same
 * markup in `LibraryListView`, differing in the picture, the second line and
 * whether the title spans the table; those are what this takes.
 */

import { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from '../utils/I18nContext';
import MenuIcon from '../icons/MenuIcon';
import LibraryCoverArt from './LibraryCoverArt';
import LibraryFolderArt from './LibraryFolderArt';

interface ILibraryListGroupRowProps {
  id: string;
  title: string;
  subtitle: string;
  artId?: string;
  /** A directory is drawn as a folder, not as the first cover under it —
   * see `LibraryFolderArt`. */
  isFolder?: boolean;
  isPending: boolean;
  isSelected: boolean;
  /** The one playlist that is always there, marked as such. */
  isBuiltIn?: boolean;
  /** Cells after the title — an album's artist, year and length. Without
   * them the title spans the table. */
  cells?: ReactNode;
  onOpen: (id: string) => void;
}

const LibraryListGroupRow = ({
  id,
  title,
  subtitle,
  artId,
  isFolder = false,
  isPending,
  isSelected,
  isBuiltIn = false,
  cells,
  onOpen,
}: ILibraryListGroupRowProps) => {
  const { t } = useTranslation();
  const activate = () => onOpen(id);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Enter mirrors the click, so the table is driveable without a mouse.
    if (event.key === 'Enter') {
      activate();
    }
  };
  return (
    <div
      role="row"
      tabIndex={0}
      aria-selected={isSelected}
      className={`library-list__row${isPending ? ' library-list__row--pending' : ''}${
        isSelected ? ' library-list__row--selected' : ''
      }`}
      onClick={activate}
      onKeyDown={onKeyDown}
    >
      <span role="cell" className="library-list__col library-list__col--art">
        {isFolder ? (
          <LibraryFolderArt artId={artId} label={title} size="row" />
        ) : (
          <LibraryCoverArt artId={artId} label={title} size="row" />
        )}
      </span>
      <span
        role="cell"
        className={`library-list__col library-list__col--title${
          cells === undefined ? ' library-list__col--span' : ''
        }`}
      >
        <span className="library-list__title-text">
          {isBuiltIn && (
            <span
              className="library-list__badge library-list__badge--favorite"
              title={t('library.playlist.builtIn')}
            >
              <MenuIcon name="star" className="library-list__badge-icon" />
            </span>
          )}
          <span className="library-list__title-label">{title}</span>
          {/* Every song grouped here is still unread — the same quiet mark a
              song row carries: information, not a problem. */}
          {isPending && (
            <span
              className="library-list__badge library-list__badge--pending"
              title={t('library.pending')}
            >
              <MenuIcon name="pending" className="library-list__badge-icon" />
            </span>
          )}
        </span>
        <small className="library-list__subtitle">{subtitle}</small>
      </span>
      {cells}
    </div>
  );
};

/** A row whose page is still out: the row's shape, so a fast scroll shows the
 * table filling in rather than blank space. */
export const LibraryListPlaceholderRow = () => (
  <div
    role="row"
    aria-hidden="true"
    className="library-list__row library-list__row--placeholder"
  >
    <span className="library-list__col library-list__col--art">
      <span className="library-list__placeholder-art" />
    </span>
    <span className="library-list__col library-list__col--title library-list__col--span">
      <span className="library-list__placeholder-text" />
    </span>
  </div>
);

export default LibraryListGroupRow;
