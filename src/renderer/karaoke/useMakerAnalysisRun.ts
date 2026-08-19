/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, MutableRefObject, SetStateAction, useRef } from 'react';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { reportError, reportInfo } from '../utils/logger';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { flattenTokens } from './makerProjectEdits';
import {
  IKaraokeMakerAnalysisResult,
  analyzeKaraokeMakerAudio,
} from './makerAnalysis';
import {
  IKaraokeMakerDownloadSummary,
  IKaraokeMakerWhisperLogEntry,
  IKaraokeMakerWhisperTranscribeProgress,
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  TKaraokeMakerWhisperStage,
  applyBasicPitchMelody,
  applyDetectedPitchMelody,
  applyTranscriptAsLyrics,
  applyWhisperTranscript,
  formatKaraokeMakerWhisperLog,
  getKaraokeWhisperSessionSnapshot,
  karaokeMakerVocalAnalysisWindows,
  refreshKaraokeWhisperDownloaded,
  releaseKaraokeWhisperModel,
  transcribeKaraokeWithWhisper,
} from './makerAi';
import { plainLyrics } from './useKaraokeMakerLyricsDraft';
import {
  analyzeKaraokeWithSwiftF0,
  SWIFT_F0_PROVENANCE,
} from './makerAi/swiftF0Notes';

/** Whether this Whisper run has to fetch the model, load it, or neither. */
export interface IWhisperRunProfile {
  needsDownload: boolean;
  needsLoad: boolean;
}

/**
 * Running the two models against the song, and putting the answers back.
 *
 * Four hundred lines of one component, and the only part of it that talks to
 * anything slow: a download that can take minutes, a transcription that can be
 * cancelled halfway, and a pitch pass over the whole file. Everything here is
 * about a run — starting one, reporting it, abandoning it, and deciding what
 * happens next when it finishes.
 *
 * It reads as many setters as it does because a run has that much to say: a
 * stage, a percentage, a download rate, a message, an error, a retry offer.
 * They are separate pieces of component state and passing them individually is
 * what says so.
 */
export interface IMakerAnalysisRunParams extends Pick<
  ReturnType<typeof useKaraokeMakerProject>,
  'project' | 'projectRef' | 'setProject' | 'pushHistory'
> {
  /** The audio being analysed — the song, or a cleaner vocal stem for it. */
  analysisFile: File;
  tokens: IKaraokeMakerToken[];
  t: ReturnType<typeof useTranslation>['t'];

  /**
   * Aborts the run in flight.
   *
   * Owned by the component rather than here, because unmounting the editor has
   * to cancel a transcription too, and that teardown does not go through this
   * hook.
   */
  analysisAbortRef: MutableRefObject<AbortController | undefined>;
  /** True while the lyrics dialog is driving the run rather than the toolbar. */
  lyricsWorkflowActiveRef: MutableRefObject<boolean>;
  /** Whether finishing a transcription should go straight on to the melody. */
  prepareAfterWhisperRef: MutableRefObject<boolean>;

  openLyricsEditor: () => void;
  startLineEntrySync: (preferredTokenId?: string) => void;
  setNotice: (message?: string) => void;
  /**
   * Turns a thrown error into something a user can read.
   *
   * Stays in the component: the import and export paths raise the same errors
   * and need the same wording, and neither goes through this hook.
   */
  localizeMakerError: (
    error: unknown,
    context: 'analysis' | 'export' | 'import' | 'whisper',
  ) => string;

  setAnalysisProgress: Dispatch<SetStateAction<number | undefined>>;
  setAnalysisMessage: Dispatch<SetStateAction<string | undefined>>;
  setAnalysisError: Dispatch<SetStateAction<string | undefined>>;
  setAnalysisRetry: Dispatch<
    SetStateAction<'whisper' | 'whisper-runtime' | undefined>
  >;
  setAnalysisResult: Dispatch<
    SetStateAction<IKaraokeMakerAnalysisResult | undefined>
  >;
  setWhisperStage: Dispatch<
    SetStateAction<TKaraokeMakerWhisperStage | undefined>
  >;
  setWhisperRunProfile: Dispatch<SetStateAction<IWhisperRunProfile>>;
  setWhisperConsentOpen: Dispatch<SetStateAction<boolean>>;
  setDownloadProgress: Dispatch<
    SetStateAction<
      (IKaraokeMakerDownloadSummary & { bytesPerSecond?: number }) | undefined
    >
  >;
  setLyricsOpen: Dispatch<SetStateAction<boolean>>;
  setLyricsDraft: Dispatch<SetStateAction<string>>;
  setLyricsWorkflowActive: Dispatch<SetStateAction<boolean>>;
  setToolPanel: Dispatch<
    SetStateAction<'timing' | 'edit' | 'analysis' | undefined>
  >;
}

export const useMakerAnalysisRun = ({
  analysisAbortRef,
  analysisFile,
  localizeMakerError,
  lyricsWorkflowActiveRef,
  openLyricsEditor,
  prepareAfterWhisperRef,
  project,
  projectRef,
  pushHistory,
  setAnalysisError,
  setAnalysisMessage,
  setAnalysisProgress,
  setAnalysisResult,
  setAnalysisRetry,
  setDownloadProgress,
  setLyricsDraft,
  setLyricsOpen,
  setLyricsWorkflowActive,
  setNotice,
  setProject,
  setToolPanel,
  setWhisperConsentOpen,
  setWhisperRunProfile,
  setWhisperStage,
  startLineEntrySync,
  t,
  tokens,
}: IMakerAnalysisRunParams) => {
  /**
   * The last download sample, for turning bytes into a rate.
   *
   * Lives here because only this hook reads it: a rate is a property of the
   * run, not of the editor.
   */
  const downloadSampleRef = useRef<
    | {
        loadedBytes: number;
        sampledAt: number;
        bytesPerSecond?: number;
      }
    | undefined
  >(undefined);

  const cancelAnalysis = () => {
    const controller = analysisAbortRef.current;
    if (!controller) {
      return;
    }
    controller.abort();
    analysisAbortRef.current = undefined;
    setAnalysisProgress(undefined);
    setAnalysisMessage(undefined);
    setWhisperStage(undefined);
    setDownloadProgress(undefined);
    downloadSampleRef.current = undefined;
    if (lyricsWorkflowActiveRef.current) {
      lyricsWorkflowActiveRef.current = false;
      setLyricsWorkflowActive(false);
    }
  };

  const receiveWhisperLog = (entry: IKaraokeMakerWhisperLogEntry) => {
    const formatted = formatKaraokeMakerWhisperLog(entry);
    if (entry.level === 'error') {
      reportError(`[karaoke][whisper] ${entry.event}`, formatted);
      return;
    }
    // eslint-disable-next-line no-console
    console.info('[karaoke][whisper]', entry.event, entry);
    reportInfo(`[karaoke][whisper] ${formatted}`);
  };

  const runBasicPitch = async (
    baseProject?: IKaraokeMakerProject,
    preserveTranscriptSuccess = false,
  ) => {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setAnalysisProgress(0);
    setAnalysisMessage(t('karaoke.maker.basicPitchRunning'));
    setAnalysisError(undefined);
    setAnalysisRetry(undefined);
    if (!preserveTranscriptSuccess) {
      setNotice(undefined);
    }
    setWhisperStage(undefined);
    setDownloadProgress(undefined);
    downloadSampleRef.current = undefined;
    try {
      reportInfo(
        `[karaoke][melody] swift-f0.start file=${analysisFile.name} bytes=${analysisFile.size}`,
      );
      try {
        // SwiftF0 asks the monophonic question the Maker actually has —
        // where is THE voice — where Basic Pitch transcribed harmonics and
        // breath as extra notes. Basic Pitch remains the fallback below.
        const notes = await analyzeKaraokeWithSwiftF0(
          analysisFile,
          setAnalysisProgress,
          controller.signal,
          karaokeMakerVocalAnalysisWindows(baseProject ?? projectRef.current),
          setDownloadProgress,
        );
        const publishBase = baseProject ?? projectRef.current;
        const next = touchKaraokeMakerProject(
          applyBasicPitchMelody(publishBase, notes, true, SWIFT_F0_PROVENANCE),
        );
        projectRef.current = next;
        pushHistory(publishBase);
        setProject(next);
        const generatedNoteCount = next.melody.notes.filter(
          (note) => note.source !== 'manual',
        ).length;
        reportInfo(
          `[karaoke][melody] melody.complete candidates=${notes.length} guideNotes=${generatedNoteCount}`,
        );
        setNotice(
          t('karaoke.maker.basicPitchFound', { count: generatedNoteCount }),
        );
        if (lyricsWorkflowActiveRef.current) {
          lyricsWorkflowActiveRef.current = false;
          setLyricsWorkflowActive(false);
          setLyricsOpen(false);
        }
      } catch (basicPitchError) {
        if ((basicPitchError as Error).name === 'AbortError') {
          throw basicPitchError;
        }
        reportError(
          '[karaoke][melody] melody.failed; using local detector',
          basicPitchError,
        );
        setAnalysisMessage(t('karaoke.maker.analysisRunning'));
        setAnalysisProgress(0);
        reportInfo(
          `[karaoke][melody] local-fallback.start file=${analysisFile.name} bytes=${analysisFile.size}`,
        );
        const fallback = await analyzeKaraokeMakerAudio(
          analysisFile,
          setAnalysisProgress,
          controller.signal,
        );
        setAnalysisResult(fallback);
        const publishBase = baseProject ?? projectRef.current;
        const next = touchKaraokeMakerProject(
          applyDetectedPitchMelody(
            {
              ...publishBase,
              audio: { ...publishBase.audio, durationMs: fallback.durationMs },
              analysis: {
                ...publishBase.analysis,
                waveform: fallback.waveform,
                lastRunAt: new Date().toISOString(),
              },
            },
            fallback.notes,
            true,
          ),
        );
        projectRef.current = next;
        pushHistory(publishBase);
        setProject(next);
        const generatedNoteCount = next.melody.notes.filter(
          (note) => note.source !== 'manual',
        ).length;
        reportInfo(
          `[karaoke][melody] local-fallback.complete candidates=${fallback.notes.length} guideNotes=${generatedNoteCount}`,
        );
        setNotice(
          t('karaoke.maker.analysisFound', { count: generatedNoteCount }),
        );
        if (lyricsWorkflowActiveRef.current) {
          lyricsWorkflowActiveRef.current = false;
          setLyricsWorkflowActive(false);
          setLyricsOpen(false);
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        reportError('[karaoke][melody] analysis.failed', error);
        if (!preserveTranscriptSuccess || lyricsWorkflowActiveRef.current) {
          setAnalysisError(localizeMakerError(error, 'analysis'));
        }
      }
      if (lyricsWorkflowActiveRef.current) {
        lyricsWorkflowActiveRef.current = false;
        setLyricsWorkflowActive(false);
      }
    } finally {
      if (analysisAbortRef.current === controller) {
        setAnalysisProgress(undefined);
        setAnalysisMessage(undefined);
        analysisAbortRef.current = undefined;
      }
    }
  };

  const requestWhisper = async (continueWithMelody: boolean) => {
    // This guard is intentionally redundant with the hidden controls. It keeps
    // stale callbacks, restored UI state, or future callers from launching the
    // disabled detector while its alignment quality is under review.
    if (!KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED) {
      return;
    }
    // No reference lyrics is no longer a refusal: with nothing to align
    // against, the transcript itself becomes the editable lyric sheet, timed
    // word by word. Reference text still gives the better result — alignment
    // cannot hallucinate — so it remains the preferred path when present.
    prepareAfterWhisperRef.current = continueWithMelody;
    setToolPanel(undefined);
    const downloaded =
      getKaraokeWhisperSessionSnapshot().downloaded ||
      (await refreshKaraokeWhisperDownloaded());
    if (downloaded) {
      await runWhisper();
      return;
    }
    if (lyricsWorkflowActiveRef.current) {
      setLyricsOpen(false);
    }
    setWhisperConsentOpen(true);
  };

  const prepareKaraoke = () => {
    const needsWordTiming =
      !tokens.length ||
      tokens.some(
        (token) => token.startMs === undefined || token.endMs === undefined,
      );
    if (needsWordTiming) {
      if (!tokens.length) {
        openLyricsEditor();
        setNotice(t('karaoke.maker.lyricsRequired'));
      } else {
        startLineEntrySync();
      }
      return;
    }
    if (project.melody.notes.length) {
      setNotice(t('karaoke.maker.prepared'));
      setToolPanel(undefined);
      return;
    }
    setToolPanel(undefined);
    runBasicPitch().catch(() => undefined);
  };

  const releaseWhisperNow = async () => {
    const released = await releaseKaraokeWhisperModel();
    setNotice(
      t(
        released
          ? 'karaoke.maker.memoryReleased'
          : 'karaoke.maker.memoryReleaseBusy',
      ),
    );
  };

  async function runWhisper() {
    setWhisperConsentOpen(false);
    if (lyricsWorkflowActiveRef.current) {
      setLyricsOpen(true);
    }
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setAnalysisProgress(0);
    setAnalysisMessage(t('karaoke.maker.whisperPreparing'));
    setWhisperStage('decode');
    const sessionAtStart = getKaraokeWhisperSessionSnapshot();
    setWhisperRunProfile({
      needsDownload: !sessionAtStart.downloaded,
      needsLoad: !sessionAtStart.inMemory,
    });
    setDownloadProgress(undefined);
    downloadSampleRef.current = undefined;
    setAnalysisError(undefined);
    setAnalysisRetry(undefined);
    setNotice(undefined);
    const includeMelody = prepareAfterWhisperRef.current;
    const whisperProgressShare = includeMelody ? 0.72 : 1;
    try {
      const transcript = await transcribeKaraokeWithWhisper(
        analysisFile,
        (
          progress,
          message,
          download,
          stage,
          transcription?: IKaraokeMakerWhisperTranscribeProgress,
        ) => {
          setAnalysisProgress(progress * whisperProgressShare);
          if (download?.summary) {
            const { summary } = download;
            const complete =
              summary.fileCount > 0 &&
              summary.completeFiles === summary.fileCount;
            const sampledAt = performance.now();
            const previous = downloadSampleRef.current;
            const elapsedSeconds = previous
              ? (sampledAt - previous.sampledAt) / 1_000
              : 0;
            const instantaneousSpeed =
              previous && elapsedSeconds > 0.12
                ? Math.max(
                    0,
                    (summary.loadedBytes - previous.loadedBytes) /
                      elapsedSeconds,
                  )
                : undefined;
            let bytesPerSecond = complete
              ? undefined
              : previous?.bytesPerSecond;
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
              progress < 0.42
                ? t('karaoke.maker.downloadingWhisper')
                : t('karaoke.maker.whisperTranscribing');
            if (
              ['progress', 'download', 'downloading', 'initiate'].includes(
                status,
              )
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
        },
        controller.signal,
        receiveWhisperLog,
        projectRef.current.lyrics.language,
      );
      const beforeTranscript = projectRef.current;
      let completedProject = flattenTokens(beforeTranscript).length
        ? applyWhisperTranscript(beforeTranscript, transcript)
        : applyTranscriptAsLyrics(beforeTranscript, transcript);
      let generatedNoteCount: number | undefined;
      let melodyError: unknown;
      if (includeMelody) {
        prepareAfterWhisperRef.current = false;
        setWhisperStage(undefined);
        setAnalysisMessage(t('karaoke.maker.basicPitchRunning'));
        reportInfo(
          `[karaoke][melody] lyric-guided.start file=${analysisFile.name} bytes=${analysisFile.size}`,
        );
        try {
          const windows = karaokeMakerVocalAnalysisWindows(completedProject);
          const notes = await analyzeKaraokeWithSwiftF0(
            analysisFile,
            (progress) => setAnalysisProgress(0.72 + progress * 0.28),
            controller.signal,
            windows,
            setDownloadProgress,
          );
          // The notes were detected from this same take, so a word Whisper
          // left unplaced can be put on the pitch that was actually sung
          // rather than left for the user to drag. Words Whisper did place
          // are above the doubt threshold and are locked out of the repair.
          completedProject = touchKaraokeMakerProject(
            applyBasicPitchMelody(
              completedProject,
              notes,
              true,
              SWIFT_F0_PROVENANCE,
            ),
          );
          generatedNoteCount = completedProject.melody.notes.filter(
            (note) => note.source !== 'manual',
          ).length;
          reportInfo(
            `[karaoke][melody] lyric-guided.complete windows=${windows.length} candidates=${notes.length} guideNotes=${generatedNoteCount}`,
          );
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            throw error;
          }
          melodyError = error;
          reportError('[karaoke][melody] lyric-guided.failed', error);
        }
      }
      projectRef.current = completedProject;
      pushHistory(beforeTranscript);
      setLyricsDraft(plainLyrics(completedProject));
      setProject(completedProject);
      if (melodyError) {
        setAnalysisError(localizeMakerError(melodyError, 'analysis'));
      }
      if (generatedNoteCount !== undefined) {
        setNotice(
          t('karaoke.maker.basicPitchFound', { count: generatedNoteCount }),
        );
      } else {
        setNotice(
          t('karaoke.maker.whisperMatched', {
            count: completedProject.lyrics.lines
              .filter((line) => line.kind !== 'section')
              .flatMap((line) => line.tokens)
              .filter(
                (token) =>
                  token.startMs !== undefined && token.endMs !== undefined,
              ).length,
          }),
        );
      }
      if (lyricsWorkflowActiveRef.current) {
        lyricsWorkflowActiveRef.current = false;
        setLyricsWorkflowActive(false);
        setLyricsOpen(false);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        reportError('[karaoke][whisper] run.failed', error);
        setAnalysisError(localizeMakerError(error, 'whisper'));
        const detail = error instanceof Error ? error.message : String(error);
        setAnalysisRetry(
          /Local Whisper WASM runtime failed/i.test(detail)
            ? 'whisper-runtime'
            : 'whisper',
        );
      }
      if (lyricsWorkflowActiveRef.current) {
        lyricsWorkflowActiveRef.current = false;
        setLyricsWorkflowActive(false);
      }
    } finally {
      if (analysisAbortRef.current === controller) {
        setAnalysisProgress(undefined);
        setAnalysisMessage(undefined);
        setWhisperStage(undefined);
        setDownloadProgress(undefined);
        downloadSampleRef.current = undefined;
        analysisAbortRef.current = undefined;
      }
    }
  }

  return {
    cancelAnalysis,
    prepareKaraoke,
    releaseWhisperNow,
    requestWhisper,
    runBasicPitch,
    runWhisper,
  };
};
