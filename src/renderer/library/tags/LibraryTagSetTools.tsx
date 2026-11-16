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
}

/**
 * The songs' own line, all on one row (Ivan, 2026-11-16: "aligned in the
 * same line, the left and right"): the heading, find and replace across the
 * titles with how many songs it found, and Renumber at the far end. The
 * titles show what is found, and what replaces it, as it is typed
 * (`LibraryTagSheet`). Everything here is undone by Discard.
 */
const LibraryTagSetTools = ({
  groups,
  ordered,
  finding,
  onFinding,
  found,
  onState,
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
      <span className="library-tags__group is-inline">
        {t('library.tags.set.songs')}
      </span>
      <div className="library-tags-set__replace">
        <LibraryTagInput
          value={finding.find}
          onChange={(find) => onFinding({ ...finding, find })}
          isEdited={false}
          placeholder={t('library.tags.set.find')}
          ariaLabel={t('library.tags.set.find')}
        />
        <LibraryTagInput
          value={finding.replace}
          onChange={(replace) => onFinding({ ...finding, replace })}
          isEdited={false}
          placeholder={t('library.tags.set.replaceWith')}
          ariaLabel={t('library.tags.set.replaceWith')}
        />
        <button
          type="button"
          className="button small"
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
        <span
          className={`library-tags-set__found${found === 0 ? ' is-none' : ''}`}
          aria-live="polite"
        >
          {foundText}
        </span>
      </div>
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
