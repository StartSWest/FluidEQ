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

import type { ILibraryTotals } from '../../common/library/query';
import type { ILibraryScanProgress } from '../../common/library/types';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { formatCount, formatLength } from './libraryFormat';
import { libraryHiddenScan, libraryScanPercent } from './LibraryScanProgress';
import { type ILibraryShelfCounts } from './useLibraryAnswer';

interface ILibraryStatusLineProps {
  /** The songs of what is on screen, summed; nothing while asked. */
  shown: ILibraryTotals | undefined;
  /** What the shown run is made of: the Videos shelf counts videos. */
  shownKind: 'song' | 'video';
  counts: ILibraryShelfCounts;
  isScanning: boolean;
  progress: ILibraryScanProgress | undefined;
  isScanNoticeHidden: boolean;
  onShowScan: () => void;
  onRescan: () => void;
  onForceRescan: () => void;
}

/**
 * THE QUIET LINE UNDER THE LIBRARY (Ivan, 2026-11-14: the "A + C" design).
 *
 * What is on screen — how many songs and how long they last — then what the
 * whole library holds, then whether it is up to date. The scan's state is
 * where Rescan lives now: the button that starts a scan stands beside the
 * line that says how the last one went, and while one runs with its notice
 * put away, the state itself is the press that brings the notice back, Stop
 * included — closed, nothing else showed the scan or could stop it.
 */
const LibraryStatusLine = ({
  shown,
  shownKind,
  counts,
  isScanning,
  progress,
  isScanNoticeHidden,
  onShowScan,
  onRescan,
  onForceRescan,
}: ILibraryStatusLineProps) => {
  const { t, locale } = useTranslation();
  const songs = (count: number) =>
    t(count === 1 ? 'library.status.songsOne' : 'library.status.songs', {
      count: formatCount(count, locale),
    });
  const shownCount = (count: number) =>
    shownKind === 'video'
      ? t(count === 1 ? 'library.status.videosOne' : 'library.status.videos', {
          count: formatCount(count, locale),
        })
      : songs(count);
  const hiddenScan = libraryHiddenScan({
    isScanning,
    isScanNoticeHidden,
    progress,
  });
  let scanLabel = t('library.status.upToDate');
  if (isScanning) {
    scanLabel =
      progress !== undefined && progress.parsed > 0
        ? t('library.scan.chip', { percent: libraryScanPercent(progress) })
        : t('library.scan.chipFinding');
  }

  return (
    <footer className="library-status">
      {shown !== undefined && (
        <span className="library-status__part">
          {shown.count > 0
            ? `${shownCount(shown.count)} · ${formatLength(
                shown.durationMs,
                t,
              )}`
            : shownCount(0)}
        </span>
      )}
      {counts.album !== undefined && (
        <span className="library-status__part library-status__part--library">
          {t(
            counts.album === 1
              ? 'library.status.albumsOne'
              : 'library.status.albums',
            { count: formatCount(counts.album, locale) },
          )}
          {' · '}
          {songs(counts.song)}
        </span>
      )}
      <span className="library-status__scan">
        {hiddenScan ? (
          <button
            type="button"
            className="library-status__state is-scanning is-link"
            title={t('library.scan.show')}
            onClick={onShowScan}
          >
            {scanLabel}
          </button>
        ) : (
          <span
            className={`library-status__state${
              isScanning ? ' is-scanning' : ''
            }`}
          >
            {scanLabel}
          </span>
        )}
        <button
          type="button"
          className="library-status__action"
          disabled={isScanning}
          aria-label={t('library.rescan')}
          title={t('library.rescan')}
          onClick={onRescan}
        >
          <MenuIcon name="restart" className="library-status__icon" />
        </button>
        {/* Rare enough to sit quietly beside Rescan rather than replace it:
            most rescans should stay the cheap, incremental kind. */}
        <button
          type="button"
          className="library-status__action"
          disabled={isScanning}
          aria-label={t('library.rescan.force')}
          title={t('library.rescan.force')}
          onClick={onForceRescan}
        >
          <MenuIcon name="restartAll" className="library-status__icon" />
        </button>
      </span>
    </footer>
  );
};

export default LibraryStatusLine;
