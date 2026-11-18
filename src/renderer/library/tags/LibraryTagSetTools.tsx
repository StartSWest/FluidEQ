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

import type { ReactNode } from 'react';
import type { ITrackTagSheet } from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import { LibraryTagInput } from './LibraryTagField';
import type { ISheetGroup } from './tagGroups';
import { type ISetState, renumbered, titlesReplaced } from './tagSetModel';

export interface IFindReplace {
  find: string;
  replace: string;
}

interface ILibraryTagSetToolsProps {
  groups: readonly ISheetGroup[];
  ordered: readonly ITrackTagSheet[];
  finding: IFindReplace;
  onFinding: (finding: IFindReplace) => void;
  /** Songs whose title holds what is searched for. */
  found: number;
  onState: (update: (state: ISetState) => ISetState) => void;
  /** The file names' choice (`LibraryTagFileNames`), between the two. */
  fileNames: ReactNode;
}

/**
 * The songs' tools, one toolbar over the table (Ivan, 2026-11-18: "to be
 * responsive and in the same line"): find and replace across the titles
 * with how many songs it found, the file names' choice, and Renumber at the
 * far end. It wraps whole groups, the boxes giving way first. The titles
 * show what is found, and what replaces it, as it is typed
 * (`LibraryTagSheet`). Everything here is undone by Discard.
 */
const LibraryTagSetTools = ({
  groups,
  ordered,
  finding,
  onFinding,
  found,
  onState,
  fileNames,
}: ILibraryTagSetToolsProps) => {
  const { t } = useTranslation();
  let foundText = '';
  if (finding.find !== '') {
    if (found === 0) {
      foundText = t('library.tags.set.foundNone');
    } else {
      foundText =
        found === 1
          ? t('library.tags.set.foundOne')
          : t('library.tags.set.found', { count: found });
    }
  }
  return (
    <div className="library-tags-set__tools">
      {/* The table under it says these are its songs: the group is named for
          a screen reader, never with a heading of its own on the line. */}
      <div
        className="library-tags-set__replace"
        role="group"
        aria-label={t('library.tags.set.songs')}
      >
        <LibraryTagInput
          value={finding.find}
          onChange={(find) => onFinding({ ...finding, find })}
          isEdited={false}
          placeholder={t('library.tags.set.find')}
          ariaLabel={t('library.tags.set.find')}
          trail={
            // How many titles hold it, at the box's end as a find bar
            // counts: said after the button it took a line of its own
            // whenever the toolbar was not wide, and the table jumped
            // down as the first letter was typed. The sentence is the
            // tooltip, and what a screen reader hears (below).
            finding.find === '' ? undefined : (
              <span
                className={`library-tags-set__found${found === 0 ? ' is-none' : ''}`}
                title={foundText}
                aria-hidden="true"
              >
                {found}
              </span>
            )
          }
        />
        <LibraryTagInput
          value={finding.replace}
          onChange={(replace) => onFinding({ ...finding, replace })}
          isEdited={false}
          placeholder={t('library.tags.set.replaceWith')}
          ariaLabel={t('library.tags.set.replaceWith')}
        />
        {/* The suggested action once a search has found something; until
            then the quiet outline, so an unavailable press is not the
            loudest thing on the line. */}
        <button
          type="button"
          className={`button small${found === 0 ? ' subtle' : ''}`}
          disabled={found === 0}
          onClick={() => {
            onState((state) =>
              titlesReplaced(state, ordered, finding.find, finding.replace),
            );
            onFinding({ find: '', replace: '' });
          }}
        >
          {t('library.tags.set.replaceAll')}
        </button>
        <span className="library-tags-set__found-said" aria-live="polite">
          {foundText}
        </span>
      </div>
      {fileNames}
      <button
        type="button"
        className="button small subtle library-tags-set__renumber"
        onClick={() =>
          onState((state) =>
            renumbered(
              state,
              groups.map((group) => group.sheets),
            ),
          )
        }
      >
        {t('library.tags.set.renumber')}
      </button>
    </div>
  );
};

export default LibraryTagSetTools;
