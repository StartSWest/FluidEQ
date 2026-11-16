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

import MenuIcon from '../../icons/MenuIcon';
import { useTranslation } from '../../utils/I18nContext';
import { CloseGlyph } from './LibraryTagSongPanel';

interface ILibrarySelectionBarProps {
  trackIds: readonly string[];
  onEditTags: (trackIds: readonly string[]) => void;
  onQueueTracks?: (trackIds: readonly string[]) => void;
  onClear: () => void;
}

/**
 * The bar that rises over the list while two or more rows are lit with
 * Ctrl or Shift: what can be done to all of them at once, the suggested
 * one loud.
 */
const LibrarySelectionBar = ({
  trackIds,
  onEditTags,
  onQueueTracks,
  onClear,
}: ILibrarySelectionBarProps) => {
  const { t } = useTranslation();
  return (
    <div
      className="library-selection-bar"
      role="toolbar"
      aria-label={t('library.tags.selection.count', { count: trackIds.length })}
    >
      <b>{t('library.tags.selection.count', { count: trackIds.length })}</b>
      <button
        type="button"
        className="button small"
        onClick={() => onEditTags(trackIds)}
      >
        <MenuIcon name="pencil" />
        {t('library.tags.selection.edit')}
      </button>
      {onQueueTracks && (
        <button
          type="button"
          className="button small subtle"
          onClick={() => {
            onQueueTracks(trackIds);
            onClear();
          }}
        >
          <MenuIcon name="queueAdd" />
          {t('library.queueAdd')}
        </button>
      )}
      <button
        type="button"
        className="library-tags__icon-button"
        aria-label={t('library.tags.selection.clear')}
        title={t('library.tags.selection.clear')}
        onClick={onClear}
      >
        <CloseGlyph />
      </button>
    </div>
  );
};

export default LibrarySelectionBar;
