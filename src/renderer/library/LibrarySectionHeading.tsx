/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The headings a search from inside a folder is split under: that folder's
 * matches, then everything else (`libraryRows.ts`). One label, drawn as a row
 * of the table and as a band across the grid — two components, because a
 * table row and a band of a grid are different elements with different roles.
 */

import { folderDisplayName } from '../../common/library/grouping';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { ILibrarySectionRow, TLibrarySection } from './libraryRows';
import '../styles/LibrarySections.scss';

/** What a section heading says, for the folder the reader stands in. */
export const useSectionLabel = (): ((
  section: TLibrarySection,
  folderPath: string | undefined,
) => string) => {
  const { t } = useTranslation();
  return (section, folderPath) => {
    const folder =
      folderPath === undefined ? '' : folderDisplayName(folderPath);
    if (section === 'near') {
      return t('library.search.near', { folder });
    }
    if (section === 'nearEmpty') {
      return t('library.search.nearEmpty', { folder });
    }
    return t('library.search.elsewhere');
  };
};

const SectionContent = ({
  row,
  folderPath,
}: {
  row: ILibrarySectionRow;
  folderPath: string | undefined;
}) => {
  const label = useSectionLabel();
  return (
    <>
      <MenuIcon
        name={row.section === 'elsewhere' ? 'folderTree' : 'folder'}
        className="library-section__icon"
      />
      <span className="library-section__label">
        {label(row.section, folderPath)}
      </span>
      {row.count !== undefined && (
        <span className="library-section__count">{row.count}</span>
      )}
      <span className="library-section__rule" aria-hidden="true" />
    </>
  );
};

/** A heading as a row of the song and shelf tables: the table's own height. */
export const LibrarySectionRow = ({
  row,
  folderPath,
}: {
  row: ILibrarySectionRow;
  folderPath: string | undefined;
}) => (
  <div
    role="row"
    className={`library-section library-section--row library-section--${row.section}`}
  >
    <span role="cell" className="library-section__cell">
      <SectionContent row={row} folderPath={folderPath} />
    </span>
  </div>
);

/** A heading as a band across every column of the grid. */
export const LibrarySectionBand = ({
  row,
  folderPath,
  height,
}: {
  row: ILibrarySectionRow;
  folderPath: string | undefined;
  /** The band's height, which the grid's windowing counts with. */
  height: number;
}) => (
  <div
    role="heading"
    aria-level={3}
    className={`library-section library-section--band library-section--${row.section}`}
    style={{ height }}
  >
    <SectionContent row={row} folderPath={folderPath} />
  </div>
);
