/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IKaraokeMakerAnalysisNote } from '../makerAnalysis';
import { IKaraokeMakerLicenseRecord } from '../../../common/karaoke/makerProject';
import { decodeMono } from './audio';
import { IKaraokeMakerAnalysisWindow } from './analysisWindows';
import { IKaraokeMakerDownloadSummary } from './whisperProgress';
import { karaokeMakerNotesFromPitchContour } from './pitchContourNotes';

export const SWIFT_F0_PROVENANCE: IKaraokeMakerLicenseRecord = {
  component: 'SwiftF0 vocal pitch model',
  version: 'lars76/swift-f0 (bundled)',
  license: 'MIT',
  sourceUrl: 'https://github.com/lars76/swift-f0',
};

/**
 * Detect the sung melody with SwiftF0, one note at a time.
 *
 * Basic Pitch answered "which notes are sounding" — a polyphonic question the
 * karaoke Maker never asks, and its wrong answers (harmonics as chords,
 * breath as grace notes) were the weakest part of every result. This asks the
 * monophonic question: where is THE voice, and when does it move. The model
 * returns a pitch and a confidence every 16 ms; turning that contour into
 * notes is `pitchContourNotes`, which is a pure function of the contour and
 * can be run on one without a model, a worker or a file.
 *
 * Reads the audio FILE — playback volume and the guide-vocal fader shape what
 * is heard, never what is analysed.
 */
export const analyzeKaraokeWithSwiftF0 = async (
  file: File,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
  analysisWindows?: readonly IKaraokeMakerAnalysisWindow[],
  /**
   * The file-by-file detail behind the one-time RMVPE download.
   *
   * Separate from `onProgress`, which carries a single number and so can only
   * ever produce a bare bar. This is what lets the shared download panel name
   * the file and its size.
   */
  onDownload?: (summary: IKaraokeMakerDownloadSummary) => void,
  /** The bundled detector completed the run after the optional fetch failed. */
  onDownloadError?: () => void,
): Promise<IKaraokeMakerAnalysisNote[]> => {
  onProgress(0.02);
  const samples = await decodeMono(file, 16_000);
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.2);
  // The one-time RMVPE download reports through here; detection after it is
  // seconds. Which model answered decides the voiced threshold and the
  // provenance the caller records.
  const unsubscribe = window.electron.ipcRenderer.onKaraokePitchProgress(
    ({ stage, fraction, loadedBytes, totalBytes, file: downloadFile }) => {
      onProgress(
        stage === 'download' ? 0.2 + fraction * 0.4 : 0.6 + fraction * 0.3,
      );
      // Shaped as the same summary the speech model produces, so the one
      // file-by-file panel can draw either without knowing which model it is
      // looking at. One entry, because this is one file — the panel handles a
      // list of any length and a list of one is still far better than a bare
      // percentage on a 361MB fetch.
      if (stage === 'download' && onDownload && downloadFile) {
        const entry = {
          file: downloadFile,
          loadedBytes: loadedBytes ?? 0,
          totalBytes: totalBytes || undefined,
          complete: fraction >= 1,
        };
        onDownload({
          files: [entry],
          loadedBytes: entry.loadedBytes,
          totalBytes: entry.totalBytes,
          completeFiles: entry.complete ? 1 : 0,
          fileCount: 1,
          progress: fraction,
        });
      }
    },
  );
  let reply;
  try {
    reply = await window.electron.ipcRenderer.detectKaraokePitch(samples);
  } finally {
    unsubscribe();
  }
  if (reply.rmvpeDownloadFailed) {
    onDownloadError?.();
  }
  const { pitchHz, confidence, hopSeconds, voicedThreshold } = reply;
  if (signal?.aborted) {
    throw new DOMException('Analysis cancelled.', 'AbortError');
  }
  onProgress(0.8);
  const notes = karaokeMakerNotesFromPitchContour(
    pitchHz,
    confidence,
    hopSeconds * 1_000,
    voicedThreshold,
    analysisWindows,
  );
  onProgress(1);
  return notes;
};
