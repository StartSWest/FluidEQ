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

interface ILibraryRootsMenuProps {
  roots: readonly ILibraryRoot[];
  onAddFolder: () => void;
  onRemoveRoot: (rootId: string) => void;
}

/**
 * Add folder, and the folders the library reads — the only place the roots
 * are managed — at the foot of the rail, under the shelves they feed.
 *
 * They stood at the right of the toolbar, which the redesign gives to finding
 * and arranging music alone (search, view, sort). Adding a folder is about
 * what the library holds, the same question the rail answers, so it lives at
 * the rail's end where the tree of those very folders opens above it.
 *
 * Prop-driven and context-free, so it is testable with no provider above it.
 */
const LibraryRootsMenu = ({
  roots,
  onAddFolder,
  onRemoveRoot,
}: ILibraryRootsMenuProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  // A press elsewhere, or Escape, puts it away — the portalled menu is asked
  // about separately, or pressing inside it would count as outside.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (
        !anchorRef.current?.contains(event.target as Node) &&
        !isInsideAnchoredMenu(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="library-rail__foot">
      <button
        type="button"
        className="library-rail__item library-rail__item--add"
        title={t('library.add')}
        onClick={onAddFolder}
      >
        <MenuIcon name="plus" className="library-rail__icon" />
        <span className="library-rail__label">{t('library.add')}</span>
      </button>
      {roots.length > 0 && (
        <>
          <button
            type="button"
            ref={anchorRef}
            className={`library-rail__item${isOpen ? ' is-open' : ''}`}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            title={t('library.roots.manage')}
            onClick={() => setIsOpen((open) => !open)}
          >
            <MenuIcon name="folderTree" className="library-rail__icon" />
            <span className="library-rail__label">
              {t('library.roots.manage')}
            </span>
          </button>
          <AnchoredMenu
            anchor={anchorRef.current}
            isOpen={isOpen}
            align="left"
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

export default LibraryRootsMenu;
