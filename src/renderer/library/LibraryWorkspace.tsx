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

import { DragEvent, useEffect, useRef, useState } from 'react';
import type {
  TLibraryBrowseMode,
  TLibrarySort,
  TLibraryViewMode,
} from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';
import { useLibrary } from './LibraryContext';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryScanProgress from './LibraryScanProgress';
import LibraryToolbar from './LibraryToolbar';
import '../styles/Library.scss';

const BROWSE_MODE_KEY = 'fluideq.library.browseMode';
const VIEW_MODE_KEY = 'fluideq.library.viewMode';
const SORT_KEY = 'fluideq.library.sort';

const BROWSE_MODES: readonly TLibraryBrowseMode[] = ['album', 'artist', 'song'];
const VIEW_MODES: readonly TLibraryViewMode[] = ['list', 'grid', 'coverflow'];
const SORTS: readonly TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
];

/**
 * A stored mode, validated against the values that actually exist.
 *
 * Same refusal `App.tsx`'s `readWorkspaceTab` applies to a stored tab name: a
 * user-editable value can hold a name an older build wrote that this one no
 * longer has, and trusting it verbatim would put the toolbar in a mode
 * nothing renders.
 */
const readPersistedMode = <T extends string>(
  key: string,
  validValues: readonly T[],
  fallback: T,
): T => {
  try {
    const stored = window.localStorage.getItem(key);
    return validValues.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
};

const writePersistedMode = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not worth failing a mode change over.
  }
};

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
  const {
    index,
    wasReset,
    isScanning,
    progress,
    addFolder,
    addFolderPaths,
    rescan,
    cancelScan,
    removeRoot,
  } = useLibrary();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isResetNoticeDismissed, setIsResetNoticeDismissed] = useState(false);

  // The toolbar's own state. Held here rather than inside `LibraryToolbar` so
  // that component stays a pure controlled view, testable without a
  // `LibraryProvider` above it.
  const [browseMode, setBrowseMode] = useState<TLibraryBrowseMode>(() =>
    readPersistedMode(BROWSE_MODE_KEY, BROWSE_MODES, 'album'),
  );
  const [viewMode, setViewMode] = useState<TLibraryViewMode>(() =>
    readPersistedMode(VIEW_MODE_KEY, VIEW_MODES, 'grid'),
  );
  const [sort, setSort] = useState<TLibrarySort>(() =>
    readPersistedMode(SORT_KEY, SORTS, 'title'),
  );
  const [query, setQuery] = useState('');

  useEffect(
    () => writePersistedMode(BROWSE_MODE_KEY, browseMode),
    [browseMode],
  );
  useEffect(() => writePersistedMode(VIEW_MODE_KEY, viewMode), [viewMode]);
  useEffect(() => writePersistedMode(SORT_KEY, sort), [sort]);

  const [isFoldersMenuOpen, setIsFoldersMenuOpen] = useState(false);
  const foldersMenuAnchorRef = useRef<HTMLButtonElement>(null);

  // Closes on a click elsewhere and on Escape, like every other menu built on
  // `AnchoredMenu` — see `MainContent.tsx`'s `eq-mode__menu` for the pattern
  // this copies, including why the portalled menu is asked about separately.
  useEffect(() => {
    if (!isFoldersMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !foldersMenuAnchorRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsFoldersMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFoldersMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFoldersMenuOpen]);

  const karaokeSkippedCount = index.roots.reduce(
    (total, root) => total + root.karaokeSkipped,
    0,
  );

  const handleAddFolder = () => {
    addFolder().catch(() => undefined);
  };

  const handleRescan = () => {
    rescan().catch(() => undefined);
  };

  const handleRemoveRoot = (rootId: string) => {
    removeRoot(rootId).catch(() => undefined);
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
      <div className="library-toolbar-row">
        <LibraryToolbar
          browseMode={browseMode}
          viewMode={viewMode}
          sort={sort}
          query={query}
          onBrowseMode={setBrowseMode}
          onViewMode={setViewMode}
          onSort={setSort}
          onQuery={setQuery}
        />
        <div className="library-toolbar__actions">
          {/* Emphasis follows recommendation: adding music is the
              recommendation, rescanning what is already there is the
              fallback. */}
          <button
            type="button"
            className="button small"
            onClick={handleAddFolder}
          >
            <MenuIcon name="folder" className="library-toolbar__action-icon" />
            <span>{t('library.add')}</span>
          </button>
          <button
            type="button"
            className="button small subtle"
            disabled={isScanning}
            onClick={handleRescan}
          >
            <MenuIcon name="restart" className="library-toolbar__action-icon" />
            <span>{t('library.rescan')}</span>
          </button>
          {/* The only place the roots are manageable. Nothing to manage with
              zero of them, so the control does not appear until there is. */}
          {index.roots.length > 0 && (
            <>
              <button
                type="button"
                ref={foldersMenuAnchorRef}
                className="button small subtle"
                aria-expanded={isFoldersMenuOpen}
                onClick={() => setIsFoldersMenuOpen((open) => !open)}
              >
                <MenuIcon
                  name="folderTree"
                  className="library-toolbar__action-icon"
                />
                <span>{t('library.roots')}</span>
              </button>
              <AnchoredMenu
                anchor={foldersMenuAnchorRef.current}
                isOpen={isFoldersMenuOpen}
                className="library-folders-menu"
                ariaLabel={t('library.roots')}
              >
                {index.roots.map((root) => (
                  <div key={root.id} className="library-folders-menu__item">
                    <div className="library-folders-menu__path-group">
                      <span
                        className="library-folders-menu__path"
                        title={root.path}
                      >
                        {root.path}
                      </span>
                      {/* A folder on an unplugged drive keeps its tracks —
                          they are dimmed elsewhere in the library, not gone —
                          and this is where that gets explained. */}
                      {root.isOffline && (
                        <span className="library-folders-menu__offline">
                          {t('library.root.offline')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="library-folders-menu__remove"
                      aria-label={t('library.root.remove')}
                      onClick={() => handleRemoveRoot(root.id)}
                    >
                      <svg viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M3 3l6 6M9 3l-6 6" />
                      </svg>
                    </button>
                  </div>
                ))}
              </AnchoredMenu>
            </>
          )}
        </div>
      </div>
      {/* Pinned under the toolbar rather than a modal: the scan is
          backgroundable simply by leaving the tab, which only works if
          nothing here blocks the rest of the workspace. */}
      {isScanning && progress && (
        <LibraryScanProgress progress={progress} onCancel={cancelScan} />
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
