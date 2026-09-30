/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import useKaraokeNoteAudition from './useKaraokeNoteAudition';
import useKaraokeMakerProject from './useKaraokeMakerProject';
import {
  plainLyrics,
  useKaraokeMakerLyricsDraft,
} from './useKaraokeMakerLyricsDraft';
import {
  IKaraokeMakerProject,
  validateKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import useMakerTranslations from './useMakerTranslations';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import { readKaraokeMakerEditorView } from './karaokeEditorPersistence';
import { flattenTokens } from './makerProjectEdits';
import { useKaraokeMakerSelection } from './useKaraokeMakerSelection';
import { useKaraokeMakerEditorView } from './useKaraokeMakerEditorView';
import { TDestructiveMakerAction } from './KaraokeMakerConfirmDialog';
import { ISyllableSplitDraft } from './useMakerNoteEditing';
import { IGuidedLineCapture, TLineEntrySession } from './useMakerLineCapture';
import { IDragState } from './makerCanvasTypes';
import {
  getKaraokeWhisperSessionSnapshot,
  holdKaraokeWhisperModel,
  IKaraokeMakerDownloadSummary,
  refreshKaraokeWhisperDownloaded,
  subscribeKaraokeWhisperSession,
  TKaraokeMakerWhisperStage,
} from './makerAi';
import { IWhisperRunProfile } from './useMakerAnalysisRun';
import { IKaraokeMakerAnalysisNote } from './makerAnalysis';
import { useMakerCanvasGesture } from './useMakerCanvasGesture';
import { ISentenceAuditionState, useMakerKeyboard } from './useMakerKeyboard';
import useMakerAuditions from './useMakerAuditions';
import useMakerLineEntryCountdown from './useMakerLineEntryCountdown';
import { useMakerCanvasModel } from './useMakerCanvasModel';
import makerErrorText from './makerErrorText';
import useMakerSelectionDetails from './useMakerSelectionDetails';
import useMakerTimelineShift from './useMakerTimelineShift';
import useSpaceTogglesPlayback from './useSpaceTogglesPlayback';
import useMakerDismissals from './useMakerDismissals';
import useMakerViewportFollow from './useMakerViewportFollow';
import { useMakerCanvasRender } from './useMakerCanvasRender';
import { useMakerCanvasPointer } from './useMakerCanvasPointer';
import { type IKaraokeMakerProps } from './KaraokeMaker';

/**
 * The Maker's editing surface: the project and its history, the selection,
 * the editor's view and modes, auditions and the line-recording count-in,
 * the canvas's model, drawing and pointer — everything the tools and the
 * markup read, returned as one object in the order it is declared.
 */
const useKaraokeMakerEditor = ({
  audioClock,
  audioFile,
  audioRef,
  durationMs,
  isPlaying,
  onPause,
  onPlay,
  onSeek,
  playheadMs,
  readPlayheadMs,
  restoreSavedDraft,
  song,
}: Pick<
  IKaraokeMakerProps,
  | 'audioClock'
  | 'audioFile'
  | 'audioRef'
  | 'durationMs'
  | 'isPlaying'
  | 'onPause'
  | 'onPlay'
  | 'onSeek'
  | 'playheadMs'
  | 'readPlayheadMs'
  | 'restoreSavedDraft'
  | 'song'
>) => {
  const { t } = useTranslation();
  const noteAudition = useKaraokeNoteAudition();
  const controlId = useId();
  // The project, its undo history and its draft on disk. One owner for all
  // three — see the note on the hook for why they had to stop being three.
  const {
    project,
    setProject,
    projectRef,
    commit,
    recordProvenance,
    undo,
    redo,
    canUndo,
    canRedo,
    pushHistory,
    clearHistory,
    restoreOriginal: restoreOriginalProject,
    draftReady,
    restoreToast,
    dismissRestoreToast,
  } = useKaraokeMakerProject({
    song,
    audioFile,
    restoreSavedDraft,
    t,
    // A project that arrived from disk rather than from an edit: re-seed the
    // lyric editor's text from it, which is the one piece of view state derived
    // from the project rather than owned alongside it.
    onProjectAdopted: (saved) => setLyricsDraft(plainLyrics(saved)),
  });
  // Adapts `commit`'s edit-function shape to the plain next-project the
  // translation hook works with — it already has the whole replacement,
  // there is nothing left for an editor callback to compute from `current`.
  const commitProject = useCallback(
    (next: IKaraokeMakerProject) => commit(() => next),
    [commit],
  );
  const {
    language: translationLanguage,
    setLanguage: setTranslationLanguage,
    languages: translationLanguages,
    addTranslation,
    removeTranslation,
    mismatch: translationMismatch,
    clearMismatch: clearTranslationMismatch,
  } = useMakerTranslations(project, commitProject);
  const makerMelodyTarget = useMemo(() => {
    if (!project.melody.notes.length) {
      return undefined;
    }
    const tokenById = new Map(
      project.lyrics.lines.flatMap((line) =>
        line.tokens.map((token) => [token.id, token] as const),
      ),
    );
    return {
      kind: 'notes' as const,
      source: 'fluideq-maker-editor',
      coordinateSystem: 'midi-semitones' as const,
      octavePolicy: project.melody.octavePolicy,
      notes: project.melody.notes.map((note) => {
        const token = note.tokenId ? tokenById.get(note.tokenId) : undefined;
        return {
          text: token?.text ?? '',
          startsWord: token?.startsWord,
          startMs: note.startMs,
          endMs: note.endMs,
          targetMidi: note.targetMidi,
          kind: note.kind,
        };
      }),
    };
  }, [project.lyrics.lines, project.melody.notes, project.melody.octavePolicy]);
  // Called for what it does, not for what it returns: the tone plays from
  // here, and the fader that sets its level is on the bar at the foot of the
  // window with the rest of the karaoke transport.
  useKaraokeMelodyTone({
    isActive: true,
    isPlaying,
    target: makerMelodyTarget,
    playheadMs,
    readPlayheadMs,
  });
  // Read once, here, because two things seed from it: the selection below and
  // the view state the hook owns. Two reads that have to agree is one more than
  // is needed.
  const [initialEditorView] = useState(() =>
    readKaraokeMakerEditorView(project.id),
  );
  // Hoisted above the selection hook, which needs it to notice a selection
  // whose word no longer exists. Derived from the project and nothing else.
  const tokens = useMemo(() => flattenTokens(project), [project]);
  // What is selected, plus the three rules that keep it honest.
  const {
    selection,
    setSelection,
    selectedNoteIds,
    setSelectedNoteIds,
    copiedNotes,
    setCopiedNotes,
    controlLinkMode,
  } = useKaraokeMakerSelection({
    initialEditorView,
    tokens,
    notes: project.melody.notes,
    draftReady,
  });

  // Where the editor was looking, and how big the preview was. Seven values
  // that are written together, read together and persisted together.
  const {
    editorViewRef,
    editorProjectIdRef,
    flushEditorView,
    viewStartMs,
    setViewStartMs,
    viewDurationMs,
    setViewDurationMs,
    followViewport,
    setFollowViewport,
    timingScope,
    setTimingScope,
    previewOpen,
    setPreviewOpen,
    previewTextSize,
    setPreviewTextSize,
    previewHeight,
    setPreviewHeight,
  } = useKaraokeMakerEditorView(project.id, initialEditorView);
  // The lyric editor's text and whether it still matches the project. Kept
  // apart from the detection it triggers: that is a long asynchronous job, this
  // is a textarea and two derived numbers.
  const {
    isOpen: lyricsOpen,
    setOpen: setLyricsOpen,
    draft: lyricsDraft,
    setDraft: setLyricsDraft,
    fileName: lyricsFileName,
    setFileName: setLyricsFileName,
    workflowActive: lyricsWorkflowActive,
    setWorkflowActive: setLyricsWorkflowActive,
    draftWordCount: draftLyricsWordCount,
    draftChanged: lyricsDraftChanged,
    target: lyricsDraftTarget,
    openEditor: openLyricsDraft,
  } = useKaraokeMakerLyricsDraft(project, clearTranslationMismatch);
  const [lyricFollowRequestKey, setLyricFollowRequestKey] = useState(0);
  const [wordShiftMs, setWordShiftMs] = useState(0);
  const [destructiveAction, setDestructiveAction] =
    useState<TDestructiveMakerAction>();
  const [lineEntryMode, setLineEntryMode] = useState(false);
  const [syllableSplitDraft, setSyllableSplitDraft] =
    useState<ISyllableSplitDraft>();
  const [lineEntrySession, setLineEntrySession] =
    useState<TLineEntrySession>('setup');
  const [lineEntryCountdown, setLineEntryCountdown] = useState<string>();
  const [handPanMode, setHandPanMode] = useState(false);
  const [noteEditMode, setNoteEditMode] = useState<
    'select' | 'paint' | undefined
  >();
  const [hoveredEditHandle, setHoveredEditHandle] = useState<{
    kind: 'word' | 'note';
    id: string;
    behavior: IDragState['behavior'];
  }>();
  const [isPitchPanReady, setIsPitchPanReady] = useState(false);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const [isCanvasScrubbing, setIsCanvasScrubbing] = useState(false);
  const [scrubAuditionAnchorMs, setScrubAuditionAnchorMs] = useState<number>();
  const visualPlayheadMs = scrubAuditionAnchorMs ?? playheadMs;
  const [lineEntryIndex, setLineEntryIndex] = useState(0);
  const lineEntryIndexRef = useRef(lineEntryIndex);
  lineEntryIndexRef.current = lineEntryIndex;
  const [lineEntryCapture, setLineEntryCapture] =
    useState<IGuidedLineCapture>();
  const [analysisProgress, setAnalysisProgress] = useState<number>();
  const [analysisMessage, setAnalysisMessage] = useState<string>();
  const [whisperStage, setWhisperStage] = useState<TKaraokeMakerWhisperStage>();
  const [whisperRunProfile, setWhisperRunProfile] =
    useState<IWhisperRunProfile>({ needsDownload: false, needsLoad: false });
  const [downloadProgress, setDownloadProgress] = useState<
    IKaraokeMakerDownloadSummary & {
      bytesPerSecond?: number;
    }
  >();
  const [analysisError, setAnalysisError] = useState<string>();
  const [analysisRetry, setAnalysisRetry] = useState<
    'whisper' | 'whisper-runtime' | 'pitch'
  >();
  // The local detector's notes, which a lyric replacement realigns to; the
  // frames and the waveform they were found in are not kept.
  const [analysisNotes, setAnalysisNotes] =
    useState<IKaraokeMakerAnalysisNote[]>();
  const [analysisFile, setAnalysisFile] = useState<File>(audioFile);
  const [exportOpen, setExportOpen] = useState(false);
  const [toolPanel, setToolPanel] = useState<'timing' | 'edit' | 'analysis'>();
  const noticeSequenceRef = useRef(0);
  const [noticeEntry, setNoticeEntry] = useState<{
    id: number;
    message: string;
  }>();
  const setNotice = useCallback((message?: string) => {
    setNoticeEntry(
      message ? { id: (noticeSequenceRef.current += 1), message } : undefined,
    );
  }, []);
  const [whisperConsentOpen, setWhisperConsentOpen] = useState(false);
  const whisperSession = useSyncExternalStore(
    subscribeKaraokeWhisperSession,
    getKaraokeWhisperSessionSnapshot,
    getKaraokeWhisperSessionSnapshot,
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vocalStemInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const gesture = useMakerCanvasGesture();
  const sentenceAuditionRef = useRef<ISentenceAuditionState | undefined>(
    undefined,
  );
  const analysisAbortRef = useRef<AbortController | undefined>(undefined);
  const prepareAfterWhisperRef = useRef(false);
  const lyricsWorkflowActiveRef = useRef(false);
  const playheadMsRef = useRef(playheadMs);
  playheadMsRef.current = playheadMs;
  const wordFocusAnimationRef = useRef<{
    tokenId?: string;
    startedAt: number;
  }>({ startedAt: 0 });
  const renderCanvasRef = useRef<() => void>(() => undefined);
  const cancelLineEntryCountdownRef = useRef<(() => void) | undefined>(
    undefined,
  );
  /** The cancel of the word audition playing, while one is. */
  const wordAuditionRef = useRef<(() => void) | undefined>(undefined);

  const { whenPlayheadReaches, cancelAudibleInteractions } = useMakerAuditions({
    audioRef,
    audioClock,
    gesture,
    sentenceAuditionRef,
    wordAuditionRef,
    setScrubAuditionAnchorMs,
    setIsCanvasScrubbing,
    onPause,
    onSeek,
  });

  const { clearLineEntryCountdown, startLineEntryCountdown } =
    useMakerLineEntryCountdown({
      cancelLineEntryCountdownRef,
      setLineEntryCountdown,
      cancelAudibleInteractions,
      isPlaying,
      onPause,
      projectRef,
      onSeek,
      setViewStartMs,
      lineEntryIndexRef,
      setLineEntryIndex,
      setSelection,
      setLyricFollowRequestKey,
      setLineEntryCapture,
      setLineEntrySession,
      audioClock,
      onPlay,
      lineEntryMode,
    });

  useEffect(() => {
    refreshKaraokeWhisperDownloaded().catch(() => undefined);
  }, []);

  // The speech model is needed for as long as this editor is open; its
  // closing is the moment the model's memory setting is acted on.
  useEffect(() => holdKaraokeWhisperModel(), []);

  const {
    activeLyricFocus,
    activeLyricWordId,
    canvasLyricWords,
    canvasSectionGroups,
    effectiveDurationMs,
    headerHeight,
    lyricLaneHeight,
    lyricLines,
    lyricSectionTop,
    maximumViewDurationMs,
    maximumViewStartMs,
    minimumViewDurationMs,
    selectedLyricLineId,
    translationRow,
    userTouchedWordCount,
    visibleViewDurationMs,
  } = useMakerCanvasModel({
    durationMs,
    project,
    selection,
    t,
    tokens,
    translationLanguage,
    viewDurationMs,
    visualPlayheadMs,
    wordFocusAnimationRef,
  });

  const issues = useMemo(() => validateKaraokeMakerProject(project), [project]);
  const { localizeMakerError } = makerErrorText({ t });
  const {
    selectedToken,
    selectedNote,
    selectedNoteToken,
    selectedTokenTimingControls,
    canShiftFromWord,
    previewSong,
  } = useMakerSelectionDetails({
    selection,
    tokens,
    project,
    lineEntryCapture,
    lyricLines,
    song,
  });
  editorProjectIdRef.current = project.id;
  editorViewRef.current = {
    viewStartMs,
    viewDurationMs: visibleViewDurationMs,
    followViewport,
    previewOpen,
    previewTextSize,
    previewHeight,
    timingScope,
    selection,
  };

  const { shiftTimeline } = useMakerTimelineShift({
    timingScope,
    selectedToken,
    project,
    commit,
    setWordShiftMs,
    canShiftFromWord,
    setTimingScope,
  });

  useSpaceTogglesPlayback({ lineEntryMode, isPlaying, onPause, onPlay });

  useMakerKeyboard({
    cancelAudibleInteractions,
    lineEntryMode,
    onPause,
    onPlay,
    onSeek,
    playheadMsRef,
    projectRef,
    readPlayheadMs,
    selection,
    sentenceAuditionRef,
    whenPlayheadReaches,
  });

  useMakerDismissals({
    analysisAbortRef,
    toolsRef,
    setToolPanel,
    setExportOpen,
    setLineEntryMode,
    setLineEntryCapture,
    setHandPanMode,
    setIsCanvasPanning,
    setIsCanvasScrubbing,
    setSelection,
    cancelAudibleInteractions,
    gesture,
  });

  useMakerViewportFollow({
    viewDurationMs,
    visibleViewDurationMs,
    setViewDurationMs,
    setViewStartMs,
    maximumViewStartMs,
    isPlaying,
    followViewport,
    viewStartMs,
    playheadMs,
    effectiveDurationMs,
  });

  // Overview waves for the two stems, at the original's resolution, so the
  // canvas can lay all three on one time axis. Declared before the render
  // hook that consumes them; filled by `useMakerStemLanes` in the tools,
  // where the separation state lives.
  const [stemWaveforms, setStemWaveforms] = useState<{
    vocals: number[];
    instrumental: number[];
    labels: { mix: string; backing: string; voice: string };
  }>();

  useMakerCanvasRender({
    activeLyricFocus,
    activeLyricWordId,
    canvasHostRef,
    canvasLyricWords,
    canvasRef,
    canvasSectionGroups,
    stemWaveforms,
    controlLinkMode,
    effectiveDurationMs,
    gesture,
    headerHeight,
    hoveredEditHandle,
    lyricLaneHeight,
    lyricSectionTop,
    project,
    renderCanvasRef,
    selectedNoteIds,
    selection,
    translationRow,
    viewStartMs,
    visibleViewDurationMs,
    visualPlayheadMs,
    wordFocusAnimationRef,
  });

  const {
    followPlayhead,
    moveViewport,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onCanvasWheel,
    resetLyricZoom,
    resizeViewport,
  } = useMakerCanvasPointer({
    activeLyricWordId,
    cancelAudibleInteractions,
    canvasLyricWords,
    canvasRef,
    commit,
    effectiveDurationMs,
    gesture,
    handPanMode,
    headerHeight,
    lineEntryMode,
    maximumViewDurationMs,
    maximumViewStartMs,
    minimumViewDurationMs,
    noteAudition,
    noteEditMode,
    onPause,
    onPlay,
    onSeek,
    playheadMs,
    project,
    projectRef,
    pushHistory,
    readPlayheadMs,
    renderCanvasRef,
    selectedNote,
    selectedNoteIds,
    selection,
    setFollowViewport,
    setHoveredEditHandle,
    setIsCanvasPanning,
    setIsCanvasScrubbing,
    setIsPitchPanReady,
    setLyricFollowRequestKey,
    setProject,
    setScrubAuditionAnchorMs,
    setSelectedNoteIds,
    setSelection,
    setViewDurationMs,
    setViewStartMs,
    viewStartMs,
    visibleViewDurationMs,
    whenPlayheadReaches,
  });

  return {
    t,
    noteAudition,
    controlId,
    project,
    setProject,
    projectRef,
    commit,
    recordProvenance,
    undo,
    redo,
    canUndo,
    canRedo,
    pushHistory,
    clearHistory,
    restoreOriginalProject,
    restoreToast,
    dismissRestoreToast,
    translationLanguage,
    setTranslationLanguage,
    translationLanguages,
    addTranslation,
    removeTranslation,
    translationMismatch,
    tokens,
    selection,
    setSelection,
    selectedNoteIds,
    setSelectedNoteIds,
    copiedNotes,
    setCopiedNotes,
    flushEditorView,
    viewStartMs,
    setViewStartMs,
    setViewDurationMs,
    followViewport,
    setFollowViewport,
    timingScope,
    setTimingScope,
    previewOpen,
    setPreviewOpen,
    previewTextSize,
    setPreviewTextSize,
    previewHeight,
    setPreviewHeight,
    lyricsOpen,
    setLyricsOpen,
    lyricsDraft,
    setLyricsDraft,
    lyricsFileName,
    setLyricsFileName,
    lyricsWorkflowActive,
    setLyricsWorkflowActive,
    draftLyricsWordCount,
    lyricsDraftChanged,
    lyricsDraftTarget,
    openLyricsDraft,
    lyricFollowRequestKey,
    setLyricFollowRequestKey,
    wordShiftMs,
    destructiveAction,
    setDestructiveAction,
    lineEntryMode,
    setLineEntryMode,
    syllableSplitDraft,
    setSyllableSplitDraft,
    lineEntrySession,
    setLineEntrySession,
    lineEntryCountdown,
    handPanMode,
    setHandPanMode,
    noteEditMode,
    setNoteEditMode,
    hoveredEditHandle,
    setHoveredEditHandle,
    isPitchPanReady,
    setIsPitchPanReady,
    isCanvasPanning,
    setIsCanvasPanning,
    isCanvasScrubbing,
    setIsCanvasScrubbing,
    visualPlayheadMs,
    lineEntryIndex,
    setLineEntryIndex,
    lineEntryIndexRef,
    lineEntryCapture,
    setLineEntryCapture,
    analysisProgress,
    setAnalysisProgress,
    analysisMessage,
    setAnalysisMessage,
    whisperStage,
    setWhisperStage,
    whisperRunProfile,
    setWhisperRunProfile,
    downloadProgress,
    setDownloadProgress,
    analysisError,
    setAnalysisError,
    analysisRetry,
    setAnalysisRetry,
    analysisNotes,
    setAnalysisNotes,
    analysisFile,
    setAnalysisFile,
    exportOpen,
    setExportOpen,
    toolPanel,
    setToolPanel,
    noticeEntry,
    setNoticeEntry,
    setNotice,
    whisperConsentOpen,
    setWhisperConsentOpen,
    whisperSession,
    canvasRef,
    canvasHostRef,
    vocalStemInputRef,
    projectInputRef,
    lyricsInputRef,
    toolsRef,
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
    maximumViewDurationMs,
    maximumViewStartMs,
    minimumViewDurationMs,
    selectedLyricLineId,
    userTouchedWordCount,
    visibleViewDurationMs,
    issues,
    localizeMakerError,
    selectedToken,
    selectedNote,
    selectedNoteToken,
    selectedTokenTimingControls,
    canShiftFromWord,
    previewSong,
    shiftTimeline,
    setStemWaveforms,
    followPlayhead,
    moveViewport,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onCanvasWheel,
    resetLyricZoom,
    resizeViewport,
  };
};

export type TKaraokeMakerEditor = ReturnType<typeof useKaraokeMakerEditor>;

export default useKaraokeMakerEditor;
