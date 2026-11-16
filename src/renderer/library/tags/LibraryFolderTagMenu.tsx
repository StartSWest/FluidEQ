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

import { useEffect, useState } from 'react';
import type { ILibraryFolderItem } from '../../../common/library/query';
import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../../widgets/AnchoredMenu';
import { countText } from '../libraryFormat';
import { useTagEditorIfAny } from './TagEditorContext';

/** The most songs one folder editor opens on; past it the editor would be
 * a spreadsheet nobody can work through, and main refuses a bigger write. */
const MAX_FOLDER_SONGS = 5000;

interface ILibraryFolderTagMenuProps {
  anchor: HTMLElement | null;
  folder: ILibraryFolderItem | undefined;
  /** How the folder is spelled on screen (a root as it was added). */
  label: string;
  onClose: () => void;
}

/**
 * A folder's right-click in the Folders tree: its songs, everything beneath
 * it, on the tag editor page. Its own menu rather than the song menu,
 * because a folder is not a set of songs the tree has already read.
 */
const LibraryFolderTagMenu = ({
  anchor,
  folder,
  label,
  onClose,
}: ILibraryFolderTagMenuProps) => {
  const { t } = useTranslation();
  const editor = useTagEditorIfAny();
  const [isLoading, setIsLoading] = useState(false);
  const isOpen = folder !== undefined && editor !== undefined;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onDown = (event: MouseEvent) => {
      if (!isInsideAnchoredMenu(event.target)) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const edit = () => {
    setIsLoading(true);
    window.electron.ipcRenderer
      .queryLibrary({
        type: 'ids',
        query: {
          shelf: 'tracks',
          scope: { beneath: folder.id, kind: 'audio' },
          natural: 'path',
          direction: 'asc',
        },
        offset: 0,
        limit: MAX_FOLDER_SONGS,
      })
      .then((ids) => {
        setIsLoading(false);
        if (ids.length > 0) {
          editor.openSet('folder', ids, label, folder.id);
        }
        onClose();
        return undefined;
      })
      .catch(() => {
        setIsLoading(false);
        onClose();
      });
  };

  return (
    <AnchoredMenu
      anchor={anchor}
      isOpen
      className="library-list__menu"
      ariaLabel={t('library.trackActions')}
    >
      <p className="library-list__menu-subject">
        {`${label} · ${countText(t, 'library.trackCount', folder.trackCount)}`}
      </p>
      <button
        type="button"
        className={isLoading ? 'is-busy' : undefined}
        disabled={isLoading}
        aria-busy={isLoading}
        onClick={edit}
      >
        <MenuIcon name="pencil" className="library-list__menu-icon" />
        <span>
          {folder.trackCount === 1
            ? t('library.tags.menu.edit')
            : t('library.tags.menu.editMany', { count: folder.trackCount })}
        </span>
      </button>
    </AnchoredMenu>
  );
};

export default LibraryFolderTagMenu;
