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

import { DragEvent, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import { useLibrary } from './LibraryContext';
import LibraryEmptyState from './LibraryEmptyState';
import '../styles/Library.scss';

interface ILibraryWorkspaceProps {
  /** Hidden instead of unmounted, matching KaraokeWorkspace and VideoBrowser:
   * once a track is playing here, leaving the tab must not stop it. */
  isHidden: boolean;
}

/**
 * A dropped file's absolute path, resolved the way `KaraokeWorkspace` does.
 *
 * `webUtils.getPathForFile` is the only source of it — `File.path` was
 * removed from Electron. A folder dropped from the OS arrives as a `File`
 * too, with no readable content, so this is exactly as far as the renderer
 * goes: it hands the raw path across and main decides what is a directory.
 */
const droppedFilePath = (file: File): string => {
  try {
    return window.electron?.ipcRenderer.getPathForFile?.(file) ?? '';
  } catch {
    return '';
  }
};

const LibraryWorkspace = ({ isHidden }: ILibraryWorkspaceProps) => {
  const { t } = useTranslation();
  const { index, wasReset, addFolder, addFolderPaths } = useLibrary();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isResetNoticeDismissed, setIsResetNoticeDismissed] = useState(false);

  const karaokeSkippedCount = index.roots.reduce(
    (total, root) => total + root.karaokeSkipped,
    0,
  );

  const handleAddFolder = () => {
    addFolder().catch(() => undefined);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    // Required for the element to accept the drop at all; the browser refuses
    // by default.
    event.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const paths = Array.from(event.dataTransfer.files)
      .map(droppedFilePath)
      .filter((path): path is string => path.length > 0);
    if (paths.length) {
      addFolderPaths(paths).catch(() => undefined);
    }
  };

  return (
    <section
      className={`library-workspace workspace-tab-panel workspace-tab-panel--library${
        isHidden ? ' is-hidden' : ''
      }${isDragOver ? ' is-drag-over' : ''}`}
      aria-label={t('tabs.library')}
      aria-hidden={isHidden}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* A library that silently emptied itself after a bad shutdown is the
          worst version of this failure — surfaced once, dismissibly, rather
          than folded into the empty state below where it would read as
          nothing had ever been added. */}
      {wasReset && !isResetNoticeDismissed && (
        <div className="library-workspace__notice" role="status">
          <span>{t('library.indexReset')}</span>
          <button
            type="button"
            aria-label={t('app.dismiss')}
            onClick={() => setIsResetNoticeDismissed(true)}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </div>
      )}
      {index.tracks.length === 0 && (
        <LibraryEmptyState
          karaokeSkippedCount={karaokeSkippedCount}
          onAddFolder={handleAddFolder}
        />
      )}
    </section>
  );
};

export default LibraryWorkspace;
