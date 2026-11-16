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

import { type DragEvent, type ReactNode, useRef, useState } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import LibraryCoverArt from '../LibraryCoverArt';
import {
  coverFileOfDrop,
  readCoverBlob,
  readCoverFromClipboard,
  type TCoverRead,
} from './tagCover';
import type { IDraftCover } from './tagDrafts';

interface ILibraryTagCoverProps {
  /** The Library's thumbnail of what the file carries now. */
  artId?: string;
  label: string;
  /** A picture chosen and not written yet; `null` for one being removed. */
  draft: IDraftCover | null | undefined;
  onPick: (cover: IDraftCover | null) => void;
  /** What goes under the picture: the facts line. */
  caption: ReactNode;
  /** True when there is a cover to remove. */
  canRemove: boolean;
  /** The stack of differing covers an album shows, in place of one. */
  stack?: ReactNode;
  size: 'panel' | 'set';
}

/**
 * The cover as the editor shows it: the picture (the new one while it is
 * waiting to be written), a drop target over it, and Choose, Paste and
 * Remove. What a pick refused is said under the buttons, not swallowed.
 */
const LibraryTagCover = ({
  artId,
  label,
  draft,
  onPick,
  caption,
  canRemove,
  stack,
  size,
}: ILibraryTagCoverProps) => {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  const take = (read: TCoverRead) => {
    if (read.state === 'ok') {
      setRefusal(undefined);
      onPick(read.cover);
    } else if (read.state === 'refused') {
      setRefusal(t('library.tags.cover.refused'));
    } else {
      setRefusal(t('library.tags.cover.emptyClipboard'));
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
    const file = coverFileOfDrop(event.dataTransfer);
    if (file === undefined) {
      return;
    }
    // Taken here: the card's own drop would read an image as a folder.
    event.preventDefault();
    readCoverBlob(file)
      .then(take)
      .catch(() => undefined);
  };

  const picture = () => {
    if (draft) {
      return <img className="library-tags__cover-img" src={draft.url} alt="" />;
    }
    if (draft === null) {
      return (
        <span className="library-tags__cover-none" aria-hidden="true">
          <MenuIcon name="song" />
        </span>
      );
    }
    return (
      stack ?? <LibraryCoverArt artId={artId} label={label} size="cover" />
    );
  };

  return (
    <div className={`library-tags__cover is-${size}`}>
      <div
        className={`library-tags__cover-frame${isDragOver ? ' is-drag-over' : ''}`}
        onDragOver={(event) => {
          if (
            Array.from(event.dataTransfer.items).some(
              (item) => item.kind === 'file',
            )
          ) {
            event.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
      >
        {picture()}
        <span className="library-tags__cover-drop" aria-hidden="true">
          <MenuIcon name="image" />
          {t('library.tags.cover.dropHint')}
        </span>
      </div>
      <div className="library-tags__cover-side">
        {caption}
        <div className="library-tags__cover-actions">
          <button
            type="button"
            className="button small subtle"
            onClick={() => fileInput.current?.click()}
          >
            {t(
              // Replace what is there; choose where there is nothing yet.
              canRemove || draft
                ? 'library.tags.cover.replace'
                : 'library.tags.cover.choose',
            )}
          </button>
          <button
            type="button"
            className="button small subtle"
            onClick={() => {
              readCoverFromClipboard()
                .then(take)
                .catch(() => undefined);
            }}
          >
            {t('library.tags.cover.paste')}
          </button>
          {(canRemove || draft) && draft !== null && (
            <button
              type="button"
              className="button small subtle"
              onClick={() => onPick(null)}
            >
              {t('library.tags.cover.remove')}
            </button>
          )}
        </div>
        {refusal && (
          <p className="library-tags__note is-warning" role="alert">
            {refusal}
          </p>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // eslint-disable-next-line no-param-reassign -- the same file picked twice must still change
            event.target.value = '';
            if (file) {
              readCoverBlob(file)
                .then(take)
                .catch(() => undefined);
            }
          }}
        />
      </div>
    </div>
  );
};

export default LibraryTagCover;
