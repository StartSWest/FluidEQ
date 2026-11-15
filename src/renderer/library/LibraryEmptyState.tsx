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

import { useTranslation } from '../utils/I18nContext';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';

/** What the Library does once it has music, one line each. */
const FEATURES = [
  { icon: 'eqBars', label: 'library.empty.feature.sound' },
  { icon: 'notes', label: 'library.empty.feature.lyrics' },
  { icon: 'viewCoverFlow', label: 'library.empty.feature.browse' },
] as const satisfies readonly { icon: MenuIconName; label: string }[];

interface ILibraryEmptyStateProps {
  /**
   * Sum of every root's `karaokeSkipped`.
   *
   * Zero for a library with no roots yet — the ordinary first-run case — so
   * the karaoke line only appears once there is something it would actually
   * explain.
   */
  karaokeSkippedCount: number;
  onAddFolder: () => void;
}

/**
 * The only screen an empty library has, beside the shelf rail.
 *
 * The rail stands to its left from the first run (Ivan, 2026-11-15: "make
 * sure we show the list on the left so it is not that empty"), so the
 * shelves a folder will fill are already in their places. This is the drop
 * target made visible — a dashed frame the whole card answers when a folder
 * is dragged over it (`is-drag-over`) — with a stack of sleeves for a
 * picture, the one action that fills it, and three lines on what the
 * Library does once it has music. Emphasis follows recommendation: Add
 * folder is the only loud control on it.
 */
const LibraryEmptyState = ({
  karaokeSkippedCount,
  onAddFolder,
}: ILibraryEmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <div className="library-empty">
      <div className="library-empty__card">
        <div className="library-empty__art" aria-hidden="true">
          <span className="library-empty__sleeve library-empty__sleeve--left" />
          <span className="library-empty__sleeve library-empty__sleeve--right" />
          {/* The record turns inside a frame that keeps its light still. */}
          <span className="library-empty__disc">
            <span className="library-empty__vinyl" />
          </span>
          <span className="library-empty__sleeve library-empty__sleeve--front">
            <MenuIcon name="folder" className="library-empty__sleeve-icon" />
          </span>
        </div>
        <h2>{t('library.empty.title')}</h2>
        <p>{t('library.empty.body')}</p>
        <button
          type="button"
          className="button small library-empty__add"
          onClick={onAddFolder}
        >
          <MenuIcon name="folder" className="library-empty__add-icon" />
          <span>{t('library.empty.add')}</span>
        </button>
        <small className="library-empty__hint">{t('library.empty.drop')}</small>
        <ul className="library-empty__features">
          {FEATURES.map(({ icon, label }) => (
            <li key={label} className="library-empty__feature">
              <MenuIcon name={icon} className="library-empty__feature-icon" />
              <span>{t(label)}</span>
            </li>
          ))}
        </ul>
        {karaokeSkippedCount > 0 && (
          <p className="library-empty__karaoke-note">
            {t('library.karaokeSkipped', { count: karaokeSkippedCount })}
          </p>
        )}
      </div>
    </div>
  );
};

export default LibraryEmptyState;
