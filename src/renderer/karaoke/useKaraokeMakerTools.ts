/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMakerLyricsActions } from './useMakerLyricsActions';
import { useMakerLineCapture } from './useMakerLineCapture';
import { useMakerNoteEditing } from './useMakerNoteEditing';
import useCanvasWheel from './useCanvasWheel';
import useMakerStemSave from './useMakerStemSave';
import { useMakerSeparation } from './useMakerSeparation';
import useMakerStemLanes from './useMakerStemLanes';
import useMakerWizardOffer from './useMakerWizardOffer';
import { useMakerProjectFiles } from './useMakerProjectFiles';
import { useMakerLyricsEditing } from './useMakerLyricsEditing';
import { useMakerToolModes } from './useMakerToolModes';
import { useMakerAnalysisRun } from './useMakerAnalysisRun';
import makerLyricsReplace from './makerLyricsReplace';
import useMakerJobControls from './useMakerJobControls';
import makerCaptureGuide from './makerCaptureGuide';
import { type IKaraokeMakerProps } from './KaraokeMaker';
import { type TKaraokeMakerEditor } from './useKaraokeMakerEditor';

/**
 * The Maker's tools, built on the editing surface: lyric and note editing,
 * line capture, stems and the set-up wizard, project files, the analysis
 * runs and their shared controls. Runs after the editor's hooks, in the
 * order the component always ran them.
 */
const useKaraokeMakerTools = (
  editor: TKaraokeMakerEditor,
  {
    audioFile,
    isPlaying,
    onModelWorkChange,
    onPause,
    onPlay,
    onSeek,
    onStems,
    playheadMs,
    readPlayheadMs,
    song,
  }: Pick<
    IKaraokeMakerProps,
    | 'audioFile'
    | 'isPlaying'
    | 'onModelWorkChange'
    | 'onPause'
    | 'onPlay'
    | 'onSeek'
    | 'onStems'
    | 'playheadMs'
    | 'readPlayheadMs'
    | 'song'
  >,
) => {
  const {
    t,
    project,
    setProject,
    projectRef,
    commit,
    recordProvenance,
    undo,
    pushHistory,
    clearHistory,
    restoreOriginalProject,
    translationLanguage,
    tokens,
    selection,
    setSelection,
    selectedNoteIds,
    setSelectedNoteIds,
    copiedNotes,
    setCopiedNotes,
    flushEditorView,
    setViewStartMs,
    setViewDurationMs,
    setFollowViewport,
    setTimingScope,
    setPreviewOpen,
    setPreviewTextSize,
    setPreviewHeight,
    setLyricsOpen,
    lyricsDraft,
    setLyricsDraft,
    setLyricsFileName,
    setLyricsWorkflowActive,
    openLyricsDraft,
    setLyricFollowRequestKey,
    destructiveAction,
    setDestructiveAction,
    lineEntryMode,
    setLineEntryMode,
    syllableSplitDraft,
    setSyllableSplitDraft,
    lineEntrySession,
    setLineEntrySession,
    setHandPanMode,
    setNoteEditMode,
    setIsCanvasPanning,
    setIsCanvasScrubbing,
    lineEntryIndex,
    setLineEntryIndex,
    lineEntryIndexRef,
    lineEntryCapture,
    setLineEntryCapture,
    analysisProgress,
    setAnalysisProgress,
    setAnalysisMessage,
    setWhisperStage,
    setWhisperRunProfile,
    setDownloadProgress,
    setAnalysisError,
    setAnalysisRetry,
    analysisResult,
    setAnalysisResult,
    analysisFile,
    setAnalysisFile,
    setExportOpen,
    setToolPanel,
    setNotice,
    setWhisperConsentOpen,
    canvasRef,
    gesture,
    analysisAbortRef,
    prepareAfterWhisperRef,
    lyricsWorkflowActiveRef,
    wordAuditionRef,
    whenPlayheadReaches,
    cancelAudibleInteractions,
    clearLineEntryCountdown,
    startLineEntryCountdown,
    activeLyricFocus,
    effectiveDurationMs,
    lyricLines,
    maximumViewStartMs,
    selectedLyricLineId,
    visibleViewDurationMs,
    localizeMakerError,
    selectedToken,
    selectedNote,
    setStemWaveforms,
    onCanvasWheel,
  } = editor;

  // Seeding and opening the editor is the hook's; landing the caret on the word
  // the user was last looking at is the Maker's, because the selection and the
  // lyric focus are not the draft's business.
  const {
    clearLyrics,
    clearNotes,
    openLyricsEditor,
    restoreOriginal,
    selectLyricsFile,
  } = useMakerLyricsActions({
    activeLyricFocus,
    commit,
    localizeMakerError,
    openLyricsDraft,
    projectRef,
    restoreOriginalProject,
    setDestructiveAction,
    setLyricsDraft,
    setLyricsFileName,
    setNotice,
    setSelectedNoteIds,
    setSelection,
    t,
    tokens,
  });

  const {
    ignoreGuidedLine,
    markNextGuidedWord,
    recordLineEntry,
    selectGuidedLine,
  } = useMakerLineCapture({
    clearLineEntryCountdown,
    commit,
    effectiveDurationMs,
    isPlaying,
    lineEntryCapture,
    lineEntryIndex,
    lineEntryIndexRef,
    lineEntryMode,
    lineEntrySession,
    lyricLines,
    maximumViewStartMs,
    onPause,
    onPlay,
    onSeek,
    playheadMs,
    readPlayheadMs,
    selectedLyricLineId,
    setFollowViewport,
    setLineEntryCapture,
    setLineEntryIndex,
    setLineEntryMode,
    setLyricFollowRequestKey,
    setNotice,
    setPreviewOpen,
    setSelectedNoteIds,
    setSelection,
    setViewStartMs,
    startLineEntryCountdown,
    t,
    undo,
    visibleViewDurationMs,
  });

  const {
    applySyllableSplit,
    copySelectedNotes,
    deleteSelection,
    detachSelectedNotes,
    pasteCopiedNotes,
    splitNote,
    splitSelectedLyricsWord,
    toggleSyllableCutPoint,
  } = useMakerNoteEditing({
    commit,
    copiedNotes,
    effectiveDurationMs,
    lineEntryMode,
    playheadMs,
    project,
    readPlayheadMs,
    selectedNote,
    selectedNoteIds,
    selectedToken,
    selection,
    setCopiedNotes,
    setNotice,
    setSelectedNoteIds,
    setSelection,
    setSyllableSplitDraft,
    syllableSplitDraft,
    t,
  });

  useCanvasWheel({ onCanvasWheel, canvasRef });

  const { saveStem } = useMakerStemSave({
    analysisAbortRef,
    setAnalysisProgress,
    setAnalysisMessage,
    t,
    setNotice,
  });

  const { removeBackground, cancelSeparation, isSeparating, instrumental } =
    useMakerSeparation({
      audioFile,
      localizeMakerError,
      onStems,
      recordProvenance,
      setAnalysisFile,
      setAnalysisMessage,
      setAnalysisProgress,
      setNotice,
      t,
    });

  const { effectiveInstrumental, stemVocalsFile } = useMakerStemLanes({
    song,
    analysisFile,
    audioFile,
    setAnalysisFile,
    instrumental,
    setStemWaveforms,
    t,
  });

  const {
    wizardOpen,
    setWizardOpen,
    wizardStep,
    setWizardStep,
    wizardDone,
    setWizardDone,
  } = useMakerWizardOffer({ song, project });

  const { exportProject, openProject, selectVocalStem } = useMakerProjectFiles({
    clearHistory,
    flushEditorView,
    localizeMakerError,
    project,
    setAnalysisFile,
    setExportOpen,
    setFollowViewport,
    setLyricsDraft,
    setNotice,
    setPreviewHeight,
    setPreviewOpen,
    setPreviewTextSize,
    setProject,
    setSelection,
    setTimingScope,
    setViewDurationMs,
    setViewStartMs,
    t,
    translationLanguage,
  });

  const {
    auditionLyricsToken,
    moveLyricsEditorSelection,
    moveLyricsEditorWord,
    noteKindLabel,
    selectLyricsEditorToken,
    updateSelectedTokenTiming,
  } = useMakerLyricsEditing({
    cancelAudibleInteractions,
    commit,
    effectiveDurationMs,
    maximumViewStartMs,
    onPause,
    onPlay,
    onSeek,
    playheadMs,
    selectedToken,
    setSelection,
    setViewStartMs,
    t,
    tokens,
    visibleViewDurationMs,
    whenPlayheadReaches,
    wordAuditionRef,
  });

  const {
    beginLineCapture,
    startLineEntrySync,
    stopLineEntryRecording,
    toggleHandPanMode,
    toggleLineEntryMode,
    toggleNoteEditMode,
    toggleToolPanel,
  } = useMakerToolModes({
    cancelAudibleInteractions,
    clearLineEntryCountdown,
    gesture,
    lineEntryMode,
    lineEntryIndexRef,
    lyricLines,
    maximumViewStartMs,
    onPause,
    onSeek,
    selectedToken,
    setExportOpen,
    setFollowViewport,
    setHandPanMode,
    setIsCanvasPanning,
    setIsCanvasScrubbing,
    setLineEntryCapture,
    setLineEntryIndex,
    setLineEntryMode,
    setLineEntrySession,
    setLyricFollowRequestKey,
    setLyricsOpen,
    setNoteEditMode,
    setPreviewOpen,
    setSelection,
    setToolPanel,
    setViewStartMs,
    tokens,
    visibleViewDurationMs,
  });

  const {
    cancelAnalysis,
    releaseWhisperNow,
    requestWhisper,
    runBasicPitch,
    runWhisper,
  } = useMakerAnalysisRun({
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
  });

  const runWizard = async () => {
    // No lyrics needed up front any more: with nothing to align against,
    // the transcription step authors the lyric sheet itself, timed word by
    // word, and the editor opens on a result to correct.
    setWizardStep('separate');
    setWizardDone([]);
    const separated = await removeBackground();
    if (!separated) {
      // Cancelled or failed. The dialog closes rather than stalling on a step
      // that is not running; whatever finished has already been kept.
      setWizardStep(undefined);
      setWizardOpen(false);
      return;
    }
    setWizardDone(['separate']);
    setWizardStep('transcribe');
    await requestWhisper(true);
    setWizardStep(undefined);
    setWizardOpen(false);
  };

  const { replaceLyrics } = makerLyricsReplace({
    beginLineCapture,
    projectRef,
    lyricsDraft,
    setNotice,
    t,
    destructiveAction,
    setDestructiveAction,
    setLyricsOpen,
    lyricsWorkflowActiveRef,
    setLyricsWorkflowActive,
    prepareAfterWhisperRef,
    requestWhisper,
    pushHistory,
    setProject,
    setSelection,
    analysisResult,
    project,
    setAnalysisResult,
  });

  const {
    cancelCurrentWork,
    dismissAnalysisError,
    retryAnalysis,
    isModelWorking,
  } = useMakerJobControls({
    cancelSeparation,
    cancelAnalysis,
    setAnalysisError,
    setAnalysisRetry,
    runBasicPitch,
    runWhisper,
    isSeparating,
    analysisProgress,
    onModelWorkChange,
  });
  const {
    lineCaptureState,
    captureGuideLine,
    captureGuideNextLine,
    captureGuidePhase,
    captureGuideVisualState,
    captureGuideInstruction,
  } = makerCaptureGuide({
    lineEntryCapture,
    playheadMs,
    lineEntryMode,
    lyricLines,
    lineEntryIndex,
    t,
  });

  return {
    clearLyrics,
    clearNotes,
    openLyricsEditor,
    restoreOriginal,
    selectLyricsFile,
    ignoreGuidedLine,
    markNextGuidedWord,
    recordLineEntry,
    selectGuidedLine,
    applySyllableSplit,
    copySelectedNotes,
    deleteSelection,
    detachSelectedNotes,
    pasteCopiedNotes,
    splitNote,
    splitSelectedLyricsWord,
    toggleSyllableCutPoint,
    saveStem,
    removeBackground,
    isSeparating,
    effectiveInstrumental,
    stemVocalsFile,
    wizardOpen,
    setWizardOpen,
    wizardStep,
    wizardDone,
    exportProject,
    openProject,
    selectVocalStem,
    auditionLyricsToken,
    moveLyricsEditorSelection,
    moveLyricsEditorWord,
    noteKindLabel,
    selectLyricsEditorToken,
    updateSelectedTokenTiming,
    startLineEntrySync,
    stopLineEntryRecording,
    toggleHandPanMode,
    toggleLineEntryMode,
    toggleNoteEditMode,
    toggleToolPanel,
    releaseWhisperNow,
    requestWhisper,
    runBasicPitch,
    runWhisper,
    runWizard,
    replaceLyrics,
    cancelCurrentWork,
    dismissAnalysisError,
    retryAnalysis,
    isModelWorking,
    lineCaptureState,
    captureGuideLine,
    captureGuideNextLine,
    captureGuidePhase,
    captureGuideVisualState,
    captureGuideInstruction,
  };
};

export type TKaraokeMakerTools = ReturnType<typeof useKaraokeMakerTools>;

export default useKaraokeMakerTools;
