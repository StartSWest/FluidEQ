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

import { useEffect, useRef, useState } from 'react';
import type { ILibraryRoot } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import MenuIcon from '../icons/MenuIcon';

interface ILibraryFolderActionsProps {
  roots: readonly ILibraryRoot[];
  isScanning: boolean;
  onAddFolder: () => void;
  onRescan: () => void;
  /** Re-reads every candidate regardless of whether it changed — the escape
   * hatch for a tagger's preserve-mtime option and for a cover whose cached
   * `artId` outlived the file `storeArtwork` wrote it to. Rare enough that it
   * sits beside Rescan rather than replacing it. */
  onForceRescan: () => void;
  onRemoveRoot: (rootId: string) => void;
}

/**
 * Add folder, Rescan, and the Folders menu — the only place the roots are
 * manageable.
 *
 * Pulled out of `LibraryWorkspace` on purpose: this is dense interactive JSX
 * with its own open/close state, the root list, and the remove/offline
 * logic, and `LibraryWorkspace` is the orchestrator that holds the toolbar's
 * modes — not where that belongs. Kept out of `LibraryToolbar` for the
 * opposite reason (see that component's own comment): everything here needs
 * `useLibrary()`'s roots and actions, which would make `LibraryToolbar`
 * untestable without a `LibraryProvider`, breaking the brief's own 8-prop
 * contract and its given test.
 *
 * Prop-driven and context-free, the same shape as `LibraryToolbar` — every
 * root, the scanning flag, and every action arrive as props, so this is
 * testable on its own with no provider either.
 */
const LibraryFolderActions = ({
  roots,
  isScanning,
  onAddFolder,
  onRescan,
  onForceRescan,
  onRemoveRoot,
}: ILibraryFolderActionsProps) => {
  const { t } = useTranslation();
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

  return (
    <div className="library-toolbar__actions">
      {/* The Media tab's chips, same as the browse and view rows — see
          `.library-toolbar__chip`. Emphasis still follows recommendation:
          adding music is the recommendation and wears the accent, rescanning
          what is already there is the fallback and wears the plain chip. */}
      <button
        type="button"
        className="library-toolbar__chip library-toolbar__chip--accent"
        onClick={onAddFolder}
      >
        <MenuIcon name="folder" className="library-toolbar__action-icon" />
        <span>{t('library.add')}</span>
      </button>
      <button
        type="button"
        className="library-toolbar__chip"
        disabled={isScanning}
        onClick={onRescan}
      >
        <MenuIcon name="restart" className="library-toolbar__action-icon" />
        <span>{t('library.rescan')}</span>
      </button>
      {/* Rare enough to sit quietly beside Rescan rather than replace it —
          most rescans should stay the cheap, incremental kind. Icon only:
          two chips a word apart both reading "rescan" is a row nobody can
          scan, and the distinction lives in the tooltip either way. */}
      <button
        type="button"
        className="library-toolbar__chip library-toolbar__chip--icon"
        disabled={isScanning}
        aria-label={t('library.rescan.force')}
        title={t('library.rescan.force')}
        onClick={onForceRescan}
      >
        <MenuIcon name="restartAll" className="library-toolbar__action-icon" />
      </button>
      {/* The only place the roots are manageable. Nothing to manage with
          zero of them, so the control does not appear until there is. */}
      {roots.length > 0 && (
        <>
          <button
            type="button"
            ref={foldersMenuAnchorRef}
            className={`library-toolbar__chip${
              isFoldersMenuOpen ? ' is-active' : ''
            }`}
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
            {roots.map((root) => (
              <div key={root.id} className="library-folders-menu__item">
                <div className="library-folders-menu__path-group">
                  <span
                    className="library-folders-menu__path"
                    title={root.path}
                  >
                    {root.path}
                  </span>
                  {/* A folder on an unplugged drive keeps its tracks — they
                      are dimmed elsewhere in the library, not gone — and
                      this is where that gets explained. */}
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
                  onClick={() => onRemoveRoot(root.id)}
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
  );
};

export default LibraryFolderActions;
