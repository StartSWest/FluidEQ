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

import { type DragEvent, type ReactNode, useEffect, useState } from 'react';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import LibraryCoverArt from '../LibraryCoverArt';
import {
  coverFileOfDrop,
  readCoverBlob,
  readCoverFromClipboard,
  type TCoverRead,
} from './tagCover';
import type { IDraftCover } from './tagDrafts';
import { coverSearchUrl, openInBrowser } from './tagWebSearch';

interface ILibraryTagCoverProps {
  /** The Library's thumbnail of what the file carries now. */
  artId?: string;
  /** A song whose folder the file dialog opens in: the album's own. */
  folderOf: string | undefined;
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
  /**
   * The covers the songs carry today, one per picture, offered in the menu
   * so one of them can be given to every song (Ivan, 2026-11-16: "4
   * portadas distintas ... poder escoger ... y que se cambien en todas").
   */
  choices?: ReadonlyArray<{ trackId: string; artId: string }>;
  /** The album and its artist, for a cover search opened in the browser. */
  search?: { artist?: string; album?: string };
  size: 'panel' | 'set';
}

/**
 * The cover as the editor shows it: the picture (the new one while it is
 * waiting to be written), a drop target, and one press on it for a menu of
 * Choose, Paste and Remove. Three buttons stacked under the picture read as
 * clutter (Ivan, 2026-11-16). What a pick refused is said under it.
 */
const LibraryTagCover = ({
  artId,
  folderOf,
  label,
  draft,
  onPick,
  caption,
  canRemove,
  stack,
  choices = [],
  search,
  size,
}: ILibraryTagCoverProps) => {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  // After a search opened in the browser: how a picture found there comes in.
  const [isSearchHintShown, setIsSearchHintShown] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Closes on a press elsewhere and on Escape, as the Library's menus do.
  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }
    const onDown = (event: MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target) && event.target !== anchor) {
        setIsMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isMenuOpen, anchor]);

  const take = (read: TCoverRead) => {
    if (read.state === 'ok') {
      setRefusal(undefined);
      setIsSearchHintShown(false);
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

  const pickInFolder = async (): Promise<TCoverRead> => {
    const picked =
      await window.electron.ipcRenderer.pickLibraryTagCover(folderOf);
    if (picked.state === 'ok') {
      return readCoverBlob(new Blob([new Uint8Array(picked.bytes)]));
    }
    // A cancelled dialog says nothing; a refused file says why.
    return picked.state === 'refused'
      ? { state: 'refused' }
      : { state: 'none' };
  };

  const choose = () => {
    setIsMenuOpen(false);
    pickInFolder()
      .then((read) => (read.state === 'none' ? undefined : take(read)))
      .catch(() => setRefusal(t('library.tags.cover.refused')));
  };

  const takeSongCover = (trackId: string) => {
    setIsMenuOpen(false);
    window.electron.ipcRenderer
      .readLibraryTagTrackCover(trackId)
      .then((picked) =>
        picked.state === 'ok'
          ? readCoverBlob(new Blob([new Uint8Array(picked.bytes)]))
          : { state: 'refused' as const },
      )
      .then(take)
      .catch(() => setRefusal(t('library.tags.cover.refused')));
  };

  const paste = () => {
    setIsMenuOpen(false);
    readCoverFromClipboard()
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
        <button
          ref={setAnchor}
          type="button"
          className="library-tags__cover-button"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label={t('library.tags.cover.change')}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {picture()}
          <span className="library-tags__cover-change" aria-hidden="true">
            <MenuIcon name="image" />
            {t('library.tags.cover.changeShort')}
          </span>
        </button>
        <span className="library-tags__cover-drop" aria-hidden="true">
          <MenuIcon name="image" />
          {t('library.tags.cover.dropHint')}
        </span>
      </div>
      <AnchoredMenu
        anchor={anchor}
        isOpen={isMenuOpen}
        className="library-list__menu"
        ariaLabel={t('library.tags.cover.change')}
      >
        {choices.length > 1 && (
          <>
            <p className="library-list__menu-subject">
              {t('library.tags.cover.useOne')}
            </p>
            <div className="library-tags__cover-choices">
              {choices.map((choice) => (
                <button
                  key={choice.artId}
                  type="button"
                  className="library-tags__cover-choice"
                  aria-label={t('library.tags.cover.useThis')}
                  title={t('library.tags.cover.useThis')}
                  onClick={() => takeSongCover(choice.trackId)}
                >
                  <LibraryCoverArt artId={choice.artId} label="" size="cover" />
                </button>
              ))}
            </div>
            <div className="library-list__menu-rule" role="none" />
          </>
        )}
        <button type="button" onClick={choose}>
          <MenuIcon name="folder" className="library-list__menu-icon" />
          <span>{t('library.tags.cover.chooseImage')}</span>
        </button>
        <button type="button" onClick={paste}>
          <MenuIcon name="copyText" className="library-list__menu-icon" />
          <span>{t('library.tags.cover.pasteImage')}</span>
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              setIsSearchHintShown(true);
              openInBrowser(coverSearchUrl(search.artist, search.album));
            }}
          >
            <MenuIcon name="external" className="library-list__menu-icon" />
            <span>{t('library.tags.cover.searchWeb')}</span>
          </button>
        )}
        {(canRemove || draft) && draft !== null && (
          <button
            type="button"
            onClick={() => {
              setIsMenuOpen(false);
              onPick(null);
            }}
          >
            <MenuIcon name="trash" className="library-list__menu-icon" />
            <span>{t('library.tags.cover.removeCover')}</span>
          </button>
        )}
      </AnchoredMenu>
      <div className="library-tags__cover-side">
        {caption}
        {refusal && (
          <p className="library-tags__note is-warning" role="alert">
            {refusal}
          </p>
        )}
        {isSearchHintShown && !refusal && (
          <p className="library-tags__note" role="status">
            {t('library.tags.cover.searchHint')}
          </p>
        )}
      </div>
    </div>
  );
};

export default LibraryTagCover;
