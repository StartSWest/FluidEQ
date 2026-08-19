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

import { useRef } from 'react';
import type { ILibraryScanProgress } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';

interface ILibraryScanProgressProps {
  progress: ILibraryScanProgress;
  onCancel: () => void;
}

/**
 * The strip pinned under the toolbar while a scan runs.
 *
 * Not a modal, on purpose: `LibraryWorkspace` mounts this beside the content
 * rather than over it, so the library underneath stays visible and usable,
 * and leaving the tab does not stop the walk — the same "backgroundable"
 * requirement `KaraokeMakerAnalysisPanels` follows for transcription.
 *
 * `seen` is not a total; the walk and the parse interleave, so a determinate
 * bar is only honest once there is something to estimate against.
 */
const LibraryScanProgress = ({
  progress,
  onCancel,
}: ILibraryScanProgressProps) => {
  const { t } = useTranslation();
  const { seen, parsed, current, karaokeSkipped, rootId } = progress;
  const hasEstimate = seen > 0;
  const rawPercent = hasEstimate
    ? Math.min(100, Math.round((parsed / seen) * 100))
    : 0;

  // `seen` grows the moment a newly discovered directory adds its files to
  // the count, before any of them is read — see `libraryScanner.ts`. That is
  // what makes the estimate honest, and it is also what can make it dip: a
  // large directory found right after a small, nearly-finished one lowers the
  // ratio even though real progress kept moving forward. A bar that visibly
  // slides backward reads as broken regardless of why, so the displayed
  // percentage is held at its high-water mark for as long as `rootId` stays
  // the same — one root is `scanLibraryRoot`'s own unit of work, so that is
  // "a single scan" here.
  const rootIdRef = useRef(rootId);
  const maxPercentRef = useRef(0);
  if (rootIdRef.current !== rootId) {
    rootIdRef.current = rootId;
    maxPercentRef.current = 0;
  }
  if (hasEstimate && rawPercent > maxPercentRef.current) {
    maxPercentRef.current = rawPercent;
  }
  const percent = hasEstimate ? maxPercentRef.current : 0;

  const runningLabel = t('library.scan.running', { name: current ?? '' });

  return (
    <div className="library-scan-progress" role="status">
      <div className="library-scan-progress__copy">
        {/* Nothing to name yet, right at the first tick before any file has
            been opened — the count line below still appears immediately. */}
        {current && <strong>{runningLabel}</strong>}
        <span>{t('library.scan.counted', { parsed, seen })}</span>
        {karaokeSkipped > 0 && (
          <span className="library-scan-progress__karaoke">
            {t('library.karaokeSkipped', { count: karaokeSkipped })}
          </span>
        )}
      </div>
      <div
        className={`library-scan-progress__bar${
          hasEstimate ? '' : ' is-indeterminate'
        }`}
        role="progressbar"
        aria-label={runningLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={hasEstimate ? percent : undefined}
      >
        <span style={hasEstimate ? { width: `${percent}%` } : undefined} />
      </div>
      <button type="button" className="button small subtle" onClick={onCancel}>
        {t('library.scan.cancel')}
      </button>
    </div>
  );
};

export default LibraryScanProgress;
