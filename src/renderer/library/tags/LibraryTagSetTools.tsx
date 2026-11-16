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

import { useState } from 'react';
import type { ITrackTagSheet } from '../../../common/library/tagFields';
import { useTranslation } from '../../utils/I18nContext';
import { LibraryTagInput } from './LibraryTagField';
import type { ISheetGroup } from './tagGroups';
import {
  capitalsFixed,
  type ISetState,
  renumbered,
  titledFromFileNames,
  titlesReplaced,
} from './tagSetModel';

interface ILibraryTagSetToolsProps {
  groups: readonly ISheetGroup[];
  ordered: readonly ITrackTagSheet[];
  onState: (update: (state: ISetState) => ISetState) => void;
}

/**
 * The sheet's tools, offline and undoable by Discard: number by the order on
 * screen, titles out of file names, capitals fixed with Spanish and English
 * in mind, and find & replace across the titles.
 */
const LibraryTagSetTools = ({
  groups,
  ordered,
  onState,
}: ILibraryTagSetToolsProps) => {
  const { t } = useTranslation();
  const [isReplacing, setIsReplacing] = useState(false);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  return (
    <div className="library-tags-set__tools">
      <div className="library-tags-set__tool-row">
        <span className="library-tags__group is-inline">
          {t('library.tags.set.songs')}
        </span>
        <button
          type="button"
          className="button small subtle"
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
        <button
          type="button"
          className="button small subtle"
          onClick={() =>
            onState((state) => titledFromFileNames(state, ordered))
          }
        >
          {t('library.tags.set.fromFileNames')}
        </button>
        <button
          type="button"
          className="button small subtle"
          onClick={() => onState((state) => capitalsFixed(state, ordered))}
        >
          {t('library.tags.set.fixCapitals')}
        </button>
        <button
          type="button"
          className={`button small subtle${isReplacing ? ' is-on' : ''}`}
          aria-expanded={isReplacing}
          onClick={() => setIsReplacing((open) => !open)}
        >
          {t('library.tags.set.findReplace')}
        </button>
      </div>
      {isReplacing && (
        <div className="library-tags-set__replace">
          <LibraryTagInput
            value={find}
            onChange={setFind}
            isEdited={false}
            placeholder={t('library.tags.set.find')}
            ariaLabel={t('library.tags.set.find')}
          />
          <LibraryTagInput
            value={replace}
            onChange={setReplace}
            isEdited={false}
            placeholder={t('library.tags.set.replaceWith')}
            ariaLabel={t('library.tags.set.replaceWith')}
          />
          <button
            type="button"
            className="button small"
            disabled={find === ''}
            onClick={() =>
              onState((state) => titlesReplaced(state, ordered, find, replace))
            }
          >
            {t('library.tags.set.replaceAll')}
          </button>
        </div>
      )}
    </div>
  );
};

export default LibraryTagSetTools;
