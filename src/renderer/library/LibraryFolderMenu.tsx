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
import type {
  ILibraryFolderItem,
  ILibraryListQuery,
} from '../../common/library/query';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import LibraryTrackMenu from './LibraryTrackMenu';
import { useLibraryPlayerSessionIfAny } from './player/LibraryPlayerContext';
import { useTagEditorIfAny } from './tags/TagEditorContext';

/** The most songs one folder's menu acts on; past it the editor would be
 * a spreadsheet nobody can work through, and main refuses a bigger write. */
const MAX_FOLDER_SONGS = 5000;

/** Songs handed to the queue at a press, as a press on a shelf does
 * (`useViewQueue`): the queue names the folder and refills itself from it
 * as it plays, so a folder of fourteen thousand plays whole and is never
 * held whole. */
const QUEUE_WINDOW = 200;

/** Every song beneath a folder, in the order its files lie. */
const songsBeneath = (folderId: string): ILibraryListQuery => ({
  shelf: 'tracks',
  scope: { beneath: folderId, kind: 'audio' },
  natural: 'path',
  direction: 'asc',
});

/** The window of `ids` around `index`, sliding back at the end. */
const windowAt = (ids: readonly string[], index: number): string[] => {
  const start = Math.max(
    0,
    Math.min(index - QUEUE_WINDOW / 2, ids.length - QUEUE_WINDOW),
  );
  return ids.slice(start, start + QUEUE_WINDOW);
};

interface ILibraryFolderMenuProps {
  anchor: HTMLElement | null;
  folder: ILibraryFolderItem | undefined;
  /** How the folder is spelled on screen (a root as it was added). */
  label: string;
  onClose: () => void;
}

/**
 * A folder's right-click in the Folders tree: the album page's own menu for
 * every song beneath it (Ivan, 2026-11-17: "same options as the album ...
 * dots menu, but the ones that make sense"), with Play, Shuffle and Add to
 * Up Next first — the tree has no header with those buttons — and Show in
 * Explorer opening the folder itself. Grouped by the menu's own rules:
 * play, keep, edit, open.
 */
const LibraryFolderMenu = ({
  anchor,
  folder,
  label,
  onClose,
}: ILibraryFolderMenuProps) => {
  const editor = useTagEditorIfAny();
  const session = useLibraryPlayerSessionIfAny();
  const [ids, setIds] = useState<readonly string[]>([]);

  // The folder's songs, asked for once per folder opened on.
  useEffect(() => {
    setIds([]);
    if (folder === undefined) {
      return undefined;
    }
    let isCurrent = true;
    window.electron.ipcRenderer
      .queryLibrary({
        type: 'ids',
        query: songsBeneath(folder.id),
        offset: 0,
        limit: Math.max(1, Math.min(folder.trackCount, MAX_FOLDER_SONGS)),
      })
      .then((found) => {
        if (isCurrent) {
          setIds(found);
        }
        return undefined;
      })
      .catch(() => {
        if (isCurrent) {
          onClose();
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [folder, onClose]);

  const isOpen = folder !== undefined && ids.length > 0;
  // Closes on a press elsewhere and on Escape, as the Library's menus do.
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

  if (folder === undefined || ids.length === 0) {
    return null;
  }
  const [first] = ids;
  const query = songsBeneath(folder.id);
  /** Starts the song at `index` with the folder as its queue's list. */
  const playFrom = (index: number) => {
    const start = ids[index];
    if (session === undefined || start === undefined) {
      return;
    }
    const around = windowAt(ids, index);
    session.playTracks(around, start);
    session.retargetQueue(around, JSON.stringify(query));
  };

  return (
    <LibraryTrackMenu
      anchor={anchor}
      isOpen={isOpen}
      trackIds={ids}
      heading={label}
      // Only when the ask was cut: the tree's count may hold videos too.
      songCount={ids.length < MAX_FOLDER_SONGS ? undefined : folder.trackCount}
      onPlay={session ? () => playFrom(0) : undefined}
      onShuffle={
        session
          ? () => {
              playFrom(Math.floor(Math.random() * ids.length));
              session.setShuffle(true);
            }
          : undefined
      }
      onQueueTracks={session ? session.appendToQueue : undefined}
      onRevealFolder={
        first === undefined
          ? undefined
          : () => {
              window.electron.ipcRenderer
                .revealLibraryFolder(folder.id, first)
                .catch(() => undefined);
              onClose();
            }
      }
      onEditTags={
        editor
          ? (trackIds) => editor.openSet('folder', trackIds, label, folder.id)
          : undefined
      }
      onFixTags={
        editor
          ? (trackIds) => editor.openFix('folder', trackIds, label, folder.id)
          : undefined
      }
      onClose={onClose}
    />
  );
};

export default LibraryFolderMenu;
