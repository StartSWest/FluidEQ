/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Dispatch, MutableRefObject, SetStateAction, useRef } from 'react';
import {
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  karaokeMakerCloseGivenWordEnds,
  karaokeMakerKeepGivenLyrics,
  karaokeMakerLockGivenTiming,
  karaokeMakerLyricSyncKind,
  karaokeMakerLyricSyncPlan,
  touchKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { reportError, reportInfo } from '../utils/logger';
import { useTranslation } from '../utils/I18nContext';
import useKaraokeMakerProject from './useKaraokeMakerProject';
import { flattenTokens } from './makerProjectEdits';
import {
  IKaraokeMakerAnalysisNote,
  analyzeKaraokeMakerAudio,
} from './makerAnalysis';
import {
  IKaraokeMakerDownloadSummary,
  IKaraokeMakerWhisperLogEntry,
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  TKaraokeMakerWhisperStage,
  applyBasicPitchMelody,
  applyDetectedPitchMelody,
  applyTranscriptAsLyrics,
  decodeMono,
  IKaraokeMakerVocalRest,
  karaokeMakerVocalRests,
  karaokeMakerVoiceOnsets,
  applyWhisperTranscript,
  formatKaraokeMakerWhisperLog,
  getKaraokeWhisperSessionSnapshot,
  karaokeMakerVocalAnalysisWindows,
  refreshKaraokeWhisperDownloaded,
  releaseKaraokeWhisperModel,
  transcribeKaraokeWithWhisper,
} from './makerAi';
import { plainLyrics } from './useKaraokeMakerLyricsDraft';
import { analyzeKaraokeWithSwiftF0 } from './makerAi/swiftF0Notes';
import alignKaraokeLinesWithWhisper from './makerAi/whisperAlign';
import createMakerSpeechProgress, {
  IMakerDownloadSample,
} from './makerSpeechProgress';
import {
  applyKaraokeMakerLineAlignment,
  karaokeMakerLinesForAlignment,
} from './makerAi/lineAlignment';
import {
  mergeKaraokeMakerDetectionRepair,
  protectKaraokeMakerTimedWordsForDetection,
} from './makerDetectionRepair';

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
    SetStateAction<'whisper' | 'whisper-runtime' | 'pitch' | undefined>
  >;
  setAnalysisNotes: Dispatch<
    SetStateAction<IKaraokeMakerAnalysisNote[] | undefined>
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
  setAnalysisNotes,
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
  const downloadSampleRef = useRef<IMakerDownloadSample | undefined>(undefined);
  /**
   * A normal Detect run is a repair pass once the user has usable timing.
   *
   * Keep this beside the run state instead of in React state: accepting the
   * model-download prompt and retrying Whisper both resume the same requested
   * operation later, without needing to render this implementation detail.
   */
  const repairMissingTimingRef = useRef(false);
  /** Original project kept until a combined repair's melody pass succeeds. */
  const detectionRepairBaselineRef = useRef<IKaraokeMakerProject | undefined>(
    undefined,
  );

  const cancelAnalysis = () => {
    repairMissingTimingRef.current = false;
    detectionRepairBaselineRef.current = undefined;
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
    reportInfo(`[karaoke][whisper] ${formatted}`);
  };

  /**
   * The melody pass, held to what the song was given.
   *
   * A word with a given time is locked for the pass and put back exactly
   * after it; the one thing added to it is an end the file left out, which a
   * note needs to know how long the word is sung.
   */
  const melodyKeepingGivenLyrics = (
    current: IKaraokeMakerProject,
    apply: (locked: IKaraokeMakerProject) => IKaraokeMakerProject,
  ): IKaraokeMakerProject => {
    const given = karaokeMakerCloseGivenWordEnds(current);
    return karaokeMakerKeepGivenLyrics(
      given,
      apply(karaokeMakerLockGivenTiming(given)),
    );
  };

  const runBasicPitch = async (
    baseProject?: IKaraokeMakerProject,
    preserveTranscriptSuccess = false,
    /** Every word already had a given time: say so when the notes land. */
    keptWordTimings = false,
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
        // RMVPE, or SwiftF0 without it, asks the monophonic question the
        // Maker actually has — where is THE voice — where Basic Pitch
        // transcribed harmonics and breath as extra notes. Whichever answered
        // signs the project.
        const { notes, provenance, sung } = await analyzeKaraokeWithSwiftF0(
          analysisFile,
          setAnalysisProgress,
          controller.signal,
          karaokeMakerVocalAnalysisWindows(baseProject ?? projectRef.current),
          setDownloadProgress,
          () => {
            setAnalysisError(t('karaoke.maker.pitchDownloadError'));
            setAnalysisRetry('pitch');
          },
        );
        const publishBase = baseProject ?? projectRef.current;
        const repairBaseline = baseProject
          ? undefined
          : detectionRepairBaselineRef.current;
        const next = touchKaraokeMakerProject(
          melodyKeepingGivenLyrics(publishBase, (locked) =>
            repairBaseline
              ? mergeKaraokeMakerDetectionRepair(
                  repairBaseline,
                  applyBasicPitchMelody(locked, notes, true, provenance, sung),
                )
              : applyBasicPitchMelody(locked, notes, true, provenance, sung),
          ),
        );
        projectRef.current = next;
        pushHistory(publishBase);
        setProject(next);
        detectionRepairBaselineRef.current = undefined;
        const generatedNoteCount = next.melody.notes.filter(
          (note) => note.source !== 'manual',
        ).length;
        reportInfo(
          `[karaoke][melody] melody.complete candidates=${notes.length} guideNotes=${generatedNoteCount}`,
        );
        const found = t('karaoke.maker.basicPitchFound', {
          count: generatedNoteCount,
        });
        setNotice(
          keptWordTimings
            ? `${t('karaoke.maker.keptWordTimings')} ${found}`
            : found,
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
        setAnalysisNotes(fallback.notes);
        const publishBase = baseProject ?? projectRef.current;
        const repairBaseline = baseProject
          ? undefined
          : detectionRepairBaselineRef.current;
        const next = touchKaraokeMakerProject(
          melodyKeepingGivenLyrics(
            {
              ...publishBase,
              audio: {
                ...publishBase.audio,
                durationMs: fallback.durationMs,
              },
              analysis: {
                ...publishBase.analysis,
                waveform: fallback.waveform,
                lastRunAt: new Date().toISOString(),
              },
            },
            (locked) =>
              repairBaseline
                ? mergeKaraokeMakerDetectionRepair(
                    repairBaseline,
                    applyDetectedPitchMelody(locked, fallback.notes, true),
                  )
                : applyDetectedPitchMelody(locked, fallback.notes, true),
          ),
        );
        projectRef.current = next;
        pushHistory(publishBase);
        setProject(next);
        detectionRepairBaselineRef.current = undefined;
        const generatedNoteCount = next.melody.notes.filter(
          (note) => note.source !== 'manual',
        ).length;
        reportInfo(
          `[karaoke][melody] local-fallback.complete candidates=${fallback.notes.length} guideNotes=${generatedNoteCount}`,
        );
        const found = t('karaoke.maker.analysisFound', {
          count: generatedNoteCount,
        });
        setNotice(
          keptWordTimings
            ? `${t('karaoke.maker.keptWordTimings')} ${found}`
            : found,
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
        // The download outlived the run that owned it. SwiftF0 reports the
        // RMVPE fetch through `setDownloadProgress` and has no later stage to
        // clear it with — unlike Whisper, which clears on its first non-
        // download stage — so a summary set here survived until the NEXT run
        // wiped it at the top. Invisible while the only reader was a panel
        // that draws during a run, and a lie the moment anything else asks
        // whether a model is working.
        setDownloadProgress(undefined);
        downloadSampleRef.current = undefined;
        analysisAbortRef.current = undefined;
      }
    }
  };

  const requestWhisper = async (
    continueWithMelody: boolean,
    repairMissingTiming = false,
  ) => {
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
    repairMissingTimingRef.current = repairMissingTiming;
    if (!repairMissingTiming) {
      detectionRepairBaselineRef.current = undefined;
    }
    setToolPanel(undefined);
    // A song whose every word came with a time has nothing for the speech
    // model to do: no words to find and none to place. Asking it anyway is
    // how those times were lost — it re-timed each word from what it heard.
    // The notes are all that is missing, and they need no download.
    if (
      karaokeMakerLyricSyncKind(
        karaokeMakerLyricSyncPlan(projectRef.current),
      ) === 'word'
    ) {
      repairMissingTimingRef.current = false;
      detectionRepairBaselineRef.current = undefined;
      prepareAfterWhisperRef.current = false;
      if (continueWithMelody) {
        await runBasicPitch(undefined, false, true);
        return;
      }
      setNotice(t('karaoke.maker.keptWordTimingsOnly'));
      return;
    }
    // Lines that only lack a word between timed ones need no model either:
    // the run fills them, and there is nothing to download for it.
    const waiting = projectRef.current;
    const waitingSync = karaokeMakerLyricSyncPlan(waiting);
    if (
      flattenTokens(waiting).length > 0 &&
      waitingSync.open === 0 &&
      karaokeMakerLinesForAlignment(waiting).length === 0
    ) {
      await runWhisper();
      return;
    }
    // The cache is the evidence. The session flag describes what was present
    // earlier and must not short-circuit this check after eviction or a manual
    // model reset.
    const downloaded = await refreshKaraokeWhisperDownloaded();
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
    const repairMissingTiming = repairMissingTimingRef.current;
    const beforeTranscript = projectRef.current;
    detectionRepairBaselineRef.current = repairMissingTiming
      ? beforeTranscript
      : undefined;
    const whisperProgressShare = includeMelody ? 0.72 : 1;
    // What the lyrics arrived with decides what the speech model is asked.
    // Lines the file timed have their words timed inside them, with the text
    // given and nothing transcribed; only lines with no time at all, or a
    // song with no lyrics, are transcribed. Words that already have a given
    // time are asked about by neither.
    const sync = karaokeMakerLyricSyncPlan(beforeTranscript);
    const hasLyrics = flattenTokens(beforeTranscript).length > 0;
    const needsAlignment = sync.line > 0;
    const needsTranscript = !hasLyrics || sync.open > 0;
    // A line that only lacks a word between timed ones is filled between
    // them and asks the model nothing; the model is run for the lines that
    // have no word timed at all.
    const alignmentLines = needsAlignment
      ? karaokeMakerLinesForAlignment(beforeTranscript)
      : [];
    let alignmentShare = 0;
    if (alignmentLines.length) {
      alignmentShare = needsTranscript ? 0.5 : 1;
    }
    const speechProgress = createMakerSpeechProgress({
      t,
      whisperProgressShare,
      downloadSampleRef,
      setAnalysisProgress,
      setAnalysisMessage,
      setWhisperStage,
      setDownloadProgress,
    });
    try {
      const lineResults = alignmentLines.length
        ? await alignKaraokeLinesWithWhisper(
            analysisFile,
            alignmentLines,
            speechProgress(0, alignmentShare, true),
            controller.signal,
            receiveWhisperLog,
            beforeTranscript.lyrics.language,
          )
        : [];
      const transcript = needsTranscript
        ? await transcribeKaraokeWithWhisper(
            analysisFile,
            speechProgress(alignmentShare, 1 - alignmentShare, false),
            controller.signal,
            receiveWhisperLog,
            projectRef.current.lyrics.language,
            // Only the authoring path chooses line breaks, so only it pays
            // for the second decode that reveals them.
            !hasLyrics,
          )
        : undefined;
      // Where the singer actually stops, read from the isolated voice. The
      // decode is the one Whisper already paid for — `decodeMono` caches per
      // file — so this costs a pass over the samples and nothing else.
      let vocalRests: IKaraokeMakerVocalRest[] = [];
      let voiceOnsets: number[] = [];
      try {
        const voice = await decodeMono(analysisFile, 16_000);
        vocalRests = karaokeMakerVocalRests(voice, 16_000);
        // Where each sound begins, which is where a word begins. The stem is
        // sample-aligned with the song, so an instant found here is that
        // instant in the song — no timestamp is involved.
        voiceOnsets = karaokeMakerVoiceOnsets(voice, 16_000);
        reportInfo(
          `[karaoke][whisper] vocal.rests count=${vocalRests.length} onsets=${voiceOnsets.length}`,
        );
      } catch (error) {
        // Line breaks fall back to Whisper's own gaps and punctuation.
        reportInfo(`[karaoke][whisper] vocal.rests.failed ${String(error)}`);
      }
      // Fitting the transcript onto the lyrics is work, and it used to happen
      // after the bar had already reached the end of its transcription share
      // and said so. On an ordinary song it is imperceptible; on one that
      // repeats a line a hundred times it was the only thing still running.
      setAnalysisMessage(t('karaoke.maker.whisperAligning'));
      // The lines the file timed, with their words now timed inside them.
      // From here on this is what the song was given: every later step is
      // held to it by `karaokeMakerKeepGivenLyrics`.
      const lineOutcome = needsAlignment
        ? applyKaraokeMakerLineAlignment(
            beforeTranscript,
            lineResults,
            vocalRests,
          )
        : undefined;
      const givenProject = lineOutcome?.project ?? beforeTranscript;
      if (lineOutcome) {
        reportInfo(
          `[karaoke][whisper] given-lines aligned=${lineOutcome.aligned} spread=${lineOutcome.spread}`,
        );
      }
      let completedProject = givenProject;
      if (transcript) {
        const alignmentProject = repairMissingTiming
          ? protectKaraokeMakerTimedWordsForDetection(givenProject)
          : karaokeMakerLockGivenTiming(givenProject);
        completedProject = hasLyrics
          ? applyWhisperTranscript(
              alignmentProject,
              transcript,
              vocalRests,
              voiceOnsets,
            )
          : applyTranscriptAsLyrics(
              alignmentProject,
              transcript,
              vocalRests,
              transcript.segments ?? [],
              voiceOnsets,
            );
        if (repairMissingTiming) {
          completedProject = mergeKaraokeMakerDetectionRepair(
            beforeTranscript,
            completedProject,
          );
        }
        completedProject = karaokeMakerKeepGivenLyrics(
          givenProject,
          completedProject,
        );
      }
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
          const { notes, provenance, sung } = await analyzeKaraokeWithSwiftF0(
            analysisFile,
            (progress) => setAnalysisProgress(0.72 + progress * 0.28),
            controller.signal,
            windows,
            setDownloadProgress,
            () => {
              setAnalysisError(t('karaoke.maker.pitchDownloadError'));
              setAnalysisRetry('pitch');
            },
          );
          // The notes were detected from this same take, so a word Whisper
          // left unplaced can be put on the pitch that was actually sung
          // rather than left for the user to drag. Words Whisper did place
          // are above the doubt threshold and are locked out of the repair.
          // Words the song was given are not Whisper's to begin with: they
          // are locked for the pass and put back exactly after it.
          const beforeMelody = completedProject;
          completedProject = touchKaraokeMakerProject(
            applyBasicPitchMelody(
              karaokeMakerLockGivenTiming(beforeMelody),
              notes,
              needsTranscript,
              provenance,
              sung,
            ),
          );
          if (repairMissingTiming) {
            completedProject = touchKaraokeMakerProject(
              mergeKaraokeMakerDetectionRepair(
                beforeTranscript,
                completedProject,
              ),
            );
          }
          completedProject = karaokeMakerKeepGivenLyrics(
            beforeMelody,
            completedProject,
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
      repairMissingTimingRef.current = false;
      if (!includeMelody || !melodyError) {
        detectionRepairBaselineRef.current = undefined;
      }
      if (melodyError) {
        setAnalysisError(localizeMakerError(melodyError, 'analysis'));
      }
      // What was kept is said before what was found: a song that came with
      // its own timing has to be told it still has it.
      const sentences: string[] = [];
      if (lineOutcome && sync.word > 0) {
        sentences.push(t('karaoke.maker.keptWordTimings'));
      }
      if (lineOutcome) {
        sentences.push(
          lineOutcome.spread > 0
            ? t('karaoke.maker.timedInsideLinesSpread', {
                count: lineOutcome.aligned + lineOutcome.spread,
                spread: lineOutcome.spread,
              })
            : t('karaoke.maker.timedInsideLines', {
                count: lineOutcome.aligned,
              }),
        );
      }
      if (generatedNoteCount !== undefined) {
        sentences.push(
          t('karaoke.maker.basicPitchFound', { count: generatedNoteCount }),
        );
      } else if (transcript) {
        sentences.push(
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
      setNotice(sentences.join(' '));
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
