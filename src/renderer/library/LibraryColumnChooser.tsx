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
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import {
  COLUMN_LABEL_KEYS,
  OPTIONAL_COLUMNS,
  type TLibraryColumn,
} from './libraryColumns';

/**
 * The details table's column chooser: the `⋮` at the end of its header, a
 * menu of the columns with a tick on those shown (the mockup's `th.pick`).
 * `#` and Title are not in it — a table without them is not a table of songs.
 */
const LibraryColumnChooser = ({
  columns,
  onToggle,
}: {
  columns: readonly TLibraryColumn[];
  onToggle: (column: TLibraryColumn) => void;
}) => {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // A press elsewhere or Escape puts it away; the portalled menu is asked
  // about separately, or a tick inside it would count as outside.
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
    <>
      <button
        type="button"
        ref={anchorRef}
        className={`library-list__chooser${isOpen ? ' is-open' : ''}`}
        aria-label={t('library.columns.choose')}
        title={t('library.columns.choose')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="3" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="8" cy="13" r="1.4" />
        </svg>
      </button>
      <AnchoredMenu
        anchor={anchorRef.current}
        isOpen={isOpen}
        className="library-list__menu library-columns-menu"
        ariaLabel={t('library.columns.choose')}
      >
        {OPTIONAL_COLUMNS.map((column) => {
          const isShown = columns.includes(column);
          return (
            <button
              key={column}
              type="button"
              role="menuitemcheckbox"
              aria-checked={isShown}
              // The menu stays open: choosing columns is several presses.
              onClick={() => onToggle(column)}
            >
              <span
                className={`library-columns-menu__tick${
                  isShown ? ' is-on' : ''
                }`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 16 16">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              </span>
              <span>{t(COLUMN_LABEL_KEYS[column])}</span>
            </button>
          );
        })}
      </AnchoredMenu>
    </>
  );
};

export default LibraryColumnChooser;
