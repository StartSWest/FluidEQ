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

import { useTranslation } from '../../utils/I18nContext';
import type { ISheetGroup } from './tagGroups';

export interface IAlbumToFix {
  group: ISheetGroup;
  /** How many values Fix would change in it, its folder picture counted. */
  changes: number;
}

interface ILibraryTagFixAlbumListProps {
  albums: readonly IAlbumToFix[];
  onFix: (group: ISheetGroup) => void;
}

/**
 * A folder of several albums asked to be fixed: one line per album with how
 * much Fix found in it, and Fix, which opens that album in the editor with
 * the proposals typed in. One album at a time, because an album's name and
 * artist are typed once for its songs and a folder's albums each have their
 * own.
 */
const LibraryTagFixAlbumList = ({
  albums,
  onFix,
}: ILibraryTagFixAlbumListProps) => {
  const { t } = useTranslation();
  return (
    <section className="library-tags-fix-albums">
      <h3 className="library-tags__group">
        {t('library.tags.fix.albums', { count: albums.length })}
      </h3>
      {albums.map(({ group, changes }) => (
        <div key={group.key} className="library-tags-fix-albums__row">
          <div className="library-tags-fix-albums__name">
            <b>{group.label}</b>
            <span>
              {group.sheets.length === 1
                ? t('library.trackCountOne')
                : t('library.trackCount', { count: group.sheets.length })}
            </span>
          </div>
          <span
            className={`library-tags-fix-albums__state${changes === 0 ? ' is-none' : ''}`}
          >
            {changes === 0 && t('library.tags.fix.albumNothing')}
            {changes === 1 && t('library.tags.fix.albumChangesOne')}
            {changes > 1 &&
              t('library.tags.fix.albumChanges', { count: changes })}
          </span>
          <button
            type="button"
            className={`button small${changes === 0 ? ' subtle' : ''}`}
            onClick={() => onFix(group)}
          >
            {changes === 0
              ? t('library.tags.fix.openAlbum')
              : t('library.tags.fix.fixAlbum')}
          </button>
        </div>
      ))}
    </section>
  );
};

export default LibraryTagFixAlbumList;
