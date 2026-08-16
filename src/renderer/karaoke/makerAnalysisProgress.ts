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

import {
  IKaraokeMakerDownloadSummary,
  TKaraokeMakerWhisperStage,
} from './makerAi';

/** The stages a run passes through, in the order the panel lists them. */
const WHISPER_STAGE_ORDER: Exclude<TKaraokeMakerWhisperStage, 'complete'>[] = [
  'decode',
  'download',
  'load',
  'transcribe',
];

/** Drops to whole megabytes past 100, where a decimal place is noise. */
export const formatMegabytes = (bytes: number): string => {
  const megabytes = Math.max(0, bytes) / (1024 * 1024);
  return megabytes >= 100 ? megabytes.toFixed(0) : megabytes.toFixed(1);
};

export interface IAnalysisProgressInput {
  /** 0..1 for the analysis itself, or undefined when nothing is running. */
  analysisProgress?: number;
  whisperStage?: TKaraokeMakerWhisperStage;
  downloadProgress?: IKaraokeMakerDownloadSummary & {
    bytesPerSecond?: number;
  };
  /** Which stages this particular run will actually pass through. */
  runProfile: { needsDownload: boolean; needsLoad: boolean };
}

export interface IAnalysisProgressView {
  fraction: number;
  /** True when there is genuinely no way to know how far along it is. */
  isIndeterminate: boolean;
  downloadRate: string;
  stages: Exclude<TKaraokeMakerWhisperStage, 'complete'>[];
}

/**
 * What the progress panel shows, derived from what the run is doing.
 *
 * Pure, and separated from the run itself because it is the half that can be
 * reasoned about without an AbortController. Transcription is a long
 * asynchronous job with cancellation, retries and three different failure
 * modes; this is arithmetic on its status.
 *
 * Two decisions live here that are easy to get wrong by hand:
 *
 *  - The bar shows the *download* fraction while downloading and the analysis
 *    fraction otherwise, because during a download the analysis has not started
 *    and its 0 would read as a stalled run.
 *  - Loading is indeterminate, and so is a download that has not reported a
 *    fraction yet. A determinate bar sitting at zero looks broken; a moving
 *    indeterminate one looks busy, which is the truth.
 *
 * Stages the run will skip are dropped from the list rather than shown greyed:
 * a model already on disk never downloads, and listing a step that will not
 * happen invites waiting for it.
 */
export const karaokeMakerAnalysisProgress = ({
  analysisProgress,
  whisperStage,
  downloadProgress,
  runProfile,
}: IAnalysisProgressInput): IAnalysisProgressView => {
  const downloadFraction =
    whisperStage === 'download' && downloadProgress?.progress !== undefined
      ? downloadProgress.progress
      : undefined;

  let downloadRate = '— MB/s';
  if (
    downloadProgress &&
    downloadProgress.fileCount > 0 &&
    downloadProgress.completeFiles === downloadProgress.fileCount
  ) {
    downloadRate = '✓';
  } else if (downloadProgress?.bytesPerSecond !== undefined) {
    downloadRate = `${formatMegabytes(downloadProgress.bytesPerSecond)} MB/s`;
  }

  return {
    fraction: downloadFraction ?? analysisProgress ?? 0,
    isIndeterminate:
      whisperStage === 'load' ||
      (whisperStage === 'download' && downloadFraction === undefined),
    downloadRate,
    stages: WHISPER_STAGE_ORDER.filter(
      (stage) =>
        (stage !== 'download' || runProfile.needsDownload) &&
        (stage !== 'load' || runProfile.needsLoad),
    ),
  };
};
