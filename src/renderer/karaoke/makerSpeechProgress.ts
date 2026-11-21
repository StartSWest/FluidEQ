/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useTranslation } from '../utils/I18nContext';
import {
  IKaraokeMakerDownloadProgress,
  IKaraokeMakerDownloadSummary,
  IKaraokeMakerWhisperTranscribeProgress,
  TKaraokeMakerWhisperStage,
} from './makerAi';

/** The last download sample, for turning bytes into a rate. */
export interface IMakerDownloadSample {
  loadedBytes: number;
  sampledAt: number;
  bytesPerSecond?: number;
}

interface IMakerSpeechProgressInput {
  t: ReturnType<typeof useTranslation>['t'];
  /** How much of the whole bar the speech model's work takes. */
  whisperProgressShare: number;
  downloadSampleRef: MutableRefObject<IMakerDownloadSample | undefined>;
  setAnalysisProgress: Dispatch<SetStateAction<number | undefined>>;
  setAnalysisMessage: Dispatch<SetStateAction<string | undefined>>;
  setWhisperStage: Dispatch<
    SetStateAction<TKaraokeMakerWhisperStage | undefined>
  >;
  setDownloadProgress: Dispatch<
    SetStateAction<
      (IKaraokeMakerDownloadSummary & { bytesPerSecond?: number }) | undefined
    >
  >;
}

/**
 * What a job for the speech model reports while it runs, put on screen.
 *
 * A run can hold two such jobs — timing the words inside the lines a lyric
 * file gave, then transcribing whatever has no time at all — and each gets
 * its own stretch of the bar (`from`, `span`). `timingGivenLines` is the
 * first of the two: the same stages, and a message that says what is
 * happening to the user's own words rather than "detecting".
 *
 * Out of `useMakerAnalysisRun`, where it was one callback written inline:
 * it reads nothing of the run but the setters it is handed.
 */
const createMakerSpeechProgress =
  ({
    t,
    whisperProgressShare,
    downloadSampleRef,
    setAnalysisProgress,
    setAnalysisMessage,
    setWhisperStage,
    setDownloadProgress,
  }: IMakerSpeechProgressInput) =>
  (from: number, span: number, timingGivenLines: boolean) =>
  (
    jobProgress: number,
    message?: string,
    download?: IKaraokeMakerDownloadProgress,
    stage?: TKaraokeMakerWhisperStage,
    transcription?: IKaraokeMakerWhisperTranscribeProgress,
  ) => {
    const progress = from + jobProgress * span;
    setAnalysisProgress(progress * whisperProgressShare);
    if (download?.summary) {
      const { summary } = download;
      const complete =
        summary.fileCount > 0 && summary.completeFiles === summary.fileCount;
      const sampledAt = performance.now();
      const previous = downloadSampleRef.current;
      const elapsedSeconds = previous
        ? (sampledAt - previous.sampledAt) / 1_000
        : 0;
      const instantaneousSpeed =
        previous && elapsedSeconds > 0.12
          ? Math.max(
              0,
              (summary.loadedBytes - previous.loadedBytes) / elapsedSeconds,
            )
          : undefined;
      let bytesPerSecond = complete ? undefined : previous?.bytesPerSecond;
      if (!complete && instantaneousSpeed !== undefined) {
        bytesPerSecond =
          previous?.bytesPerSecond === undefined
            ? instantaneousSpeed
            : previous.bytesPerSecond * 0.72 + instantaneousSpeed * 0.28;
      }
      if (!previous || elapsedSeconds > 0.12 || complete) {
        downloadSampleRef.current = {
          loadedBytes: summary.loadedBytes,
          sampledAt,
          bytesPerSecond,
        };
      }
      setDownloadProgress({
        ...summary,
        bytesPerSecond,
      });
    }
    if (stage) {
      // The file list belongs to the download and to nothing after it.
      // It used to be set and never cleared, so seven completed rows sat
      // over the transcription for the rest of the run, still claiming
      // to be the thing in progress.
      if (stage !== 'download') {
        setDownloadProgress(undefined);
        downloadSampleRef.current = undefined;
      }
      setWhisperStage(stage);
      let localizedMessage = t('karaoke.maker.whisperComplete');
      if (stage === 'decode') {
        localizedMessage = t('karaoke.maker.whisperDecoding');
      } else if (stage === 'download') {
        localizedMessage = t('karaoke.maker.downloadingWhisper');
      } else if (stage === 'load') {
        localizedMessage = t('karaoke.maker.loadingWhisper');
      } else if (stage === 'transcribe' && timingGivenLines) {
        localizedMessage = t('karaoke.maker.aligningInsideLines', {
          chunk: transcription?.completedChunks ?? 0,
          chunks: transcription?.totalChunks ?? 1,
        });
      } else if (stage === 'transcribe') {
        localizedMessage = transcription
          ? t('karaoke.maker.whisperTranscribingProgress', {
              pass: transcription.pass,
              passes: transcription.totalPasses,
              chunk: transcription.completedChunks,
              chunks: transcription.totalChunks,
            })
          : t('karaoke.maker.whisperTranscribing');
      }
      setAnalysisMessage(localizedMessage);
    } else if (message) {
      const status = message.trim().toLowerCase();
      let localizedMessage =
        jobProgress < 0.42
          ? t('karaoke.maker.downloadingWhisper')
          : t('karaoke.maker.whisperTranscribing');
      if (
        ['progress', 'download', 'downloading', 'initiate'].includes(status)
      ) {
        localizedMessage = t('karaoke.maker.downloadingWhisper');
      } else if (['done', 'ready'].includes(status)) {
        localizedMessage = t('karaoke.maker.loadingWhisper');
      } else if (status === 'decoding audio') {
        localizedMessage = t('karaoke.maker.whisperDecoding');
      } else if (status === 'loading the opt-in whisper model') {
        localizedMessage = t('karaoke.maker.loadingWhisper');
      } else if (status === 'transcribing locally') {
        localizedMessage = t('karaoke.maker.whisperTranscribing');
      } else if (status === 'transcription complete') {
        localizedMessage = t('karaoke.maker.whisperComplete');
      }
      setAnalysisMessage(localizedMessage);
    }
  };

export default createMakerSpeechProgress;
