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

import type { IFixLine } from '../../../common/library/tagFix';
import { useTranslation } from '../../utils/I18nContext';
import type { ISheetGroup } from './tagGroups';

export interface IAlbumLines {
  group: ISheetGroup;
  lines: IFixLine[];
}

interface ILibraryTagFixAlbumListProps {
  albums: readonly IAlbumLines[];
  isOff: (line: IFixLine) => boolean;
  onReview: (key: string) => void;
}

/**
 * A folder of several albums: each one with what it would change and a
 * Review that opens its own lines. One write takes all of them.
 */
const LibraryTagFixAlbumList = ({
  albums,
  isOff,
  onReview,
}: ILibraryTagFixAlbumListProps) => {
  const { t } = useTranslation();
  return (
    <section className="library-tags-fix__card">
      <h3 className="library-tags-fix__card-title">
        {t('library.tags.fix.albums', { count: albums.length })}
      </h3>
      {albums.map((album) => {
        const on = album.lines.filter((line) => !isOff(line)).length;
        return (
          <div key={album.group.key} className="library-tags-fix__album">
            <div className="library-tags-fix__album-name">
              <b>{album.group.label}</b>
              <span>
                {album.group.sheets.length === 1
                  ? t('library.trackCountOne')
                  : t('library.trackCount', {
                      count: album.group.sheets.length,
                    })}
              </span>
            </div>
            <span className="library-tags-fix__album-state">
              {on === 0 && t('library.tags.fix.albumNothing')}
              {on === 1 && t('library.tags.fix.albumChangesOne')}
              {on > 1 && t('library.tags.fix.albumChanges', { count: on })}
            </span>
            {album.lines.length > 0 && (
              <button
                type="button"
                className="button small subtle"
                onClick={() => onReview(album.group.key)}
              >
                {t('library.tags.fix.review')}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
};

export default LibraryTagFixAlbumList;
