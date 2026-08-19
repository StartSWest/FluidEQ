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
 * The percentage the bar below shows, factored out as a plain function so a
 * test can assert its shape against a real captured progress sequence
 * without rendering the component. `parsed > 0` rather than `seen > 0` is
 * the gate — see the component doc below for why.
 */
export const libraryScanPercent = (
  progress: Pick<ILibraryScanProgress, 'seen' | 'parsed'>,
): number =>
  progress.parsed > 0
    ? Math.min(100, Math.round((progress.parsed / progress.seen) * 100))
    : 0;

/**
 * The strip pinned under the toolbar while a scan runs.
 *
 * Not a modal, on purpose: `LibraryWorkspace` mounts this beside the content
 * rather than over it, so the library underneath stays visible and usable,
 * and leaving the tab does not stop the walk — the same "backgroundable"
 * requirement `KaraokeMakerAnalysisPanels` follows for transcription.
 *
 * `seen` and `parsed` come from a two-phase scan (see `libraryScanner.ts`):
 * phase one discovers every candidate file and grows `seen` to a real total
 * before phase two ever starts, and only then does `parsed` begin to climb.
 * So the bar is indeterminate exactly while `parsed` is still zero — that
 * covers both "nothing has happened yet" and "still discovering, `seen` is
 * not final yet" in one honest state — and determinate from the moment
 * parsing starts, at which point `seen` cannot move again and the ratio
 * climbs to exactly 100% on the last file. No clamp: a clamp over a number
 * that is now genuinely monotonic would only exist to hide a future bug.
 */
const LibraryScanProgress = ({
  progress,
  onCancel,
}: ILibraryScanProgressProps) => {
  const { t } = useTranslation();
  const { seen, parsed, current, karaokeSkipped } = progress;
  const hasEstimate = parsed > 0;
  const percent = libraryScanPercent(progress);

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
