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
import type { ILibraryTrack } from '../../../common/library/types';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import LibraryCoverArt from '../LibraryCoverArt';
import LibraryTagCover from './LibraryTagCover';
import type { IDraftCover } from './tagDrafts';

interface ILibraryTagSetCoverProps {
  sheets: readonly ITrackTagSheet[];
  tracks: ReadonlyMap<string, ILibraryTrack | null>;
  cover: IDraftCover | null | undefined;
  onCover: (cover: IDraftCover | null | undefined) => void;
}

/**
 * One cover for every song. Where the songs disagree today the picture is a
 * stack of what they carry, so "2 different covers" is seen as well as read;
 * a picture dropped, pasted or chosen goes to all of them.
 */
const LibraryTagSetCover = ({
  sheets,
  tracks,
  cover,
  onCover,
}: ILibraryTagSetCoverProps) => {
  const { t } = useTranslation();
  const artIds = sheets.map((sheet) => tracks.get(sheet.trackId)?.artId);
  const distinct = [
    ...new Set(artIds.filter((id): id is string => id !== undefined)),
  ];
  const without = sheets.filter((sheet) => sheet.cover === undefined).length;
  const isMixed = distinct.length > 1 || (distinct.length === 1 && without > 0);

  let caption: { title: string; note: string };
  if (cover) {
    caption = {
      title: `${cover.width} × ${cover.height}`,
      note: t('library.tags.set.coverToAll', { count: sheets.length }),
    };
  } else if (cover === null) {
    caption = {
      title: t('library.tags.cover.removed'),
      note: t('library.tags.set.coverToAll', { count: sheets.length }),
    };
  } else if (distinct.length === 0) {
    caption = { title: t('library.tags.set.coverNoneAll'), note: '' };
  } else if (isMixed) {
    caption = {
      title: t('library.tags.set.coversMixed', {
        count: distinct.length + (without > 0 ? 1 : 0),
      }),
      note:
        without > 0 ? t('library.tags.set.coversNone', { count: without }) : '',
    };
  } else {
    caption = { title: t('library.tags.set.coverOne'), note: '' };
  }

  const stack = isMixed ? (
    <span className="library-tags-stack" aria-hidden="true">
      {[distinct[1], undefined, distinct[0]].map((artId, index) => (
        <span
          key={artId ?? `none-${index}`}
          className={`library-tags-stack__card is-${index}`}
        >
          {artId === undefined ? (
            <span className="library-tags__cover-none">
              <MenuIcon name="song" />
            </span>
          ) : (
            <LibraryCoverArt artId={artId} label="" size="cover" />
          )}
        </span>
      ))}
    </span>
  ) : undefined;

  return (
    <LibraryTagCover
      artId={distinct[0]}
      folderOf={sheets[0]?.trackId}
      label={sheets[0]?.fields.album ?? ''}
      draft={cover}
      size="set"
      stack={stack}
      canRemove={distinct.length > 0}
      onPick={(picked) => {
        if (cover && cover !== picked) {
          URL.revokeObjectURL(cover.url);
        }
        onCover(picked === null && distinct.length === 0 ? undefined : picked);
      }}
      caption={
        <div className="library-tags-set__cover-caption">
          <b>{caption.title}</b>
          {caption.note && <span>{caption.note}</span>}
        </div>
      }
    />
  );
};

export default LibraryTagSetCover;
