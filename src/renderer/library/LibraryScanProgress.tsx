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
  const { seen, parsed, current, karaokeSkipped } = progress;
  const hasEstimate = seen > 0;
  const percent = hasEstimate
    ? Math.min(100, Math.round((parsed / seen) * 100))
    : 0;
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
