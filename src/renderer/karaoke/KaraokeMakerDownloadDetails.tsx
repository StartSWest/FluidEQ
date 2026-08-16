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
import { IKaraokeMakerDownloadSummary } from './makerAi';
import { formatMegabytes } from './makerAnalysisProgress';

/** The last path segment, since the manifest carries full remote paths. */
const whisperDownloadFileName = (file?: string): string | undefined => {
  const parts = file?.split(/[\\/]/).filter(Boolean);
  return parts?.[parts.length - 1];
};

interface IKaraokeMakerDownloadDetailsProps {
  progress: IKaraokeMakerDownloadSummary;
  /** Pre-formatted, because the rate is smoothed where the run measures it. */
  rate: string;
}

/**
 * File-by-file progress while the speech model is fetched.
 *
 * Shown once, the first time somebody asks for transcription, and never again
 * on that machine — which is exactly why it is worth being specific. A single
 * bar for a multi-hundred-megabyte download over an unknown connection is
 * indistinguishable from a hang, so this lists every file with its own bar.
 *
 * A file with no known total gets an indeterminate bar rather than a zero: the
 * server does not always send a content length, and a bar pinned at 0% while
 * bytes are arriving is a lie about the only thing the user wants to know.
 */
const KaraokeMakerDownloadDetails = ({
  progress,
  rate,
}: IKaraokeMakerDownloadDetailsProps) => {
  const { t } = useTranslation();

  return (
    <div className="karaoke-maker__download-details">
      <div className="karaoke-maker__download-overall">
        <strong>{t('karaoke.maker.downloadOverall')}</strong>
        <span>
          {t('karaoke.maker.downloadFiles', {
            complete: progress.completeFiles,
            total: progress.fileCount,
          })}
        </span>
        <span>
          {formatMegabytes(progress.loadedBytes)} MB
          {progress.totalBytes !== undefined &&
            ` / ${formatMegabytes(progress.totalBytes)} MB`}
        </span>
        <span>{rate}</span>
      </div>
      <div className="karaoke-maker__download-files">
        {progress.files.map((entry) => {
          const fileProgress =
            entry.totalBytes !== undefined && entry.totalBytes > 0
              ? Math.min(1, entry.loadedBytes / entry.totalBytes)
              : undefined;
          const fileName = whisperDownloadFileName(entry.file) ?? entry.file;
          let fileProgressLabel = '…';
          let fileProgressValue: number | undefined;
          if (entry.complete) {
            fileProgressLabel = '✓';
            fileProgressValue = 100;
          } else if (fileProgress !== undefined) {
            fileProgressValue = Math.round(fileProgress * 100);
            fileProgressLabel = `${fileProgressValue}%`;
          }
          return (
            <div className="karaoke-maker__download-file-row" key={entry.file}>
              <div className="karaoke-maker__download-stats">
                <span
                  className="karaoke-maker__download-file"
                  title={entry.file}
                >
                  {fileName}
                </span>
                <span>
                  {formatMegabytes(entry.loadedBytes)} MB
                  {entry.totalBytes !== undefined &&
                    ` / ${formatMegabytes(entry.totalBytes)} MB`}
                </span>
                <span
                  className={
                    entry.complete
                      ? 'karaoke-maker__download-complete'
                      : undefined
                  }
                >
                  {fileProgressLabel}
                </span>
              </div>
              <div
                className={`karaoke-maker__download-file-progress${
                  fileProgress === undefined && !entry.complete
                    ? ' is-indeterminate'
                    : ''
                }`}
                role="progressbar"
                aria-label={fileName}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={fileProgressValue}
              >
                <span
                  style={
                    fileProgress === undefined
                      ? undefined
                      : { width: `${fileProgress * 100}%` }
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KaraokeMakerDownloadDetails;
