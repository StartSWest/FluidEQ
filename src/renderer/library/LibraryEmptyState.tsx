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
import MenuIcon from '../icons/MenuIcon';

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
 * The only screen an empty library has.
 *
 * A centred card rather than a message pinned to the top-left of a large
 * empty panel — there is exactly one useful next step, so the whole surface
 * points at it instead of leaving it to be found.
 */
const LibraryEmptyState = ({
  karaokeSkippedCount,
  onAddFolder,
}: ILibraryEmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <div className="library-empty">
      <div className="library-empty__card">
        <h2>{t('library.empty.title')}</h2>
        <p>{t('library.empty.body')}</p>
        {/* The one action that fixes an empty library. Emphasis follows
            recommendation: this is the loud "button small", and nothing else
            on this card is. */}
        <button
          type="button"
          className="button small library-empty__add"
          onClick={onAddFolder}
        >
          <MenuIcon name="folder" className="library-empty__add-icon" />
          <span>{t('library.empty.add')}</span>
        </button>
        <small className="library-empty__hint">{t('library.empty.drop')}</small>
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
