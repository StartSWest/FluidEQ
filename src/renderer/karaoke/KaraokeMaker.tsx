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
import {
  IKaraokeMakerProject,
  karaokeMakerProjectToSong,
  karaokeMakerRecordedLineRange,
  karaokeMakerTimedLineRange,
  karaokeMakerLineIsSection,
  karaokeMakerTokenBoundaryLimits,
  makerLinesFromPlainText,
  recordKaraokeMakerLineRange,
  shiftKaraokeMakerLineTailFromToken,
  shiftKaraokeMakerTimeline,
  touchKaraokeMakerProject,
  validateKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import { IKaraokeSong } from '../../common/karaoke/types';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import { formatClock } from './makerFormat';
import { useMakerCanvasGesture } from './useMakerCanvasGesture';
import { IDragState } from './makerCanvasTypes';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { karaokeMakerAnalysisProgress } from './makerAnalysisProgress';
import {
  normalizedLyricsText,
  plainLyrics,
  useKaraokeMakerLyricsDraft,
} from './useKaraokeMakerLyricsDraft';
import { useKaraokeMakerSelection } from './useKaraokeMakerSelection';
import KaraokeMakerDownloadDetails from './KaraokeMakerDownloadDetails';
import KaraokeMakerWordInspector from './KaraokeMakerWordInspector';
import KaraokeMakerEditTools from './KaraokeMakerEditTools';
import KaraokeMakerSpeechMemoryPanel from './KaraokeMakerSpeechMemoryPanel';
import KaraokeMakerAnalysisTools from './KaraokeMakerAnalysisTools';
import KaraokeMakerConfirmDialog, {
  TDestructiveMakerAction,
} from './KaraokeMakerConfirmDialog';
import { useKaraokeMakerEditorView } from './useKaraokeMakerEditorView';
import {
  IKaraokeMakerAnalysisResult,
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from './makerAnalysis';
import {
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  IKaraokeMakerDownloadSummary,
  TKaraokeMakerWhisperStage,
  getKaraokeWhisperSessionSnapshot,
  refreshKaraokeWhisperDownloaded,
  subscribeKaraokeWhisperSession,
  writeKaraokeWhisperMemorySettings,
} from './makerAi';
import useKaraokeNoteAudition from './useKaraokeNoteAudition';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import KaraokeMakerNavigator from './KaraokeMakerNavigator';
import KaraokeMakerCaptureCoach from './KaraokeMakerCaptureCoach';
import KaraokeMakerFloatingPanel from './KaraokeMakerFloatingPanel';
import KaraokeMakerPreview from './KaraokeMakerPreview';
import KaraokeMakerSelectionInfo from './KaraokeMakerSelectionInfo';
import KaraokeMakerLyricsDialog from './KaraokeMakerLyricsDialog';
import KaraokeMakerHeader from './KaraokeMakerHeader';
import KaraokeMakerToolbar from './KaraokeMakerToolbar';
import KaraokeMakerAnalysisPanels from './KaraokeMakerAnalysisPanels';
import KaraokeMakerWhisperConsent from './KaraokeMakerWhisperConsent';
import KaraokeMakerInspector from './KaraokeMakerInspector';
import { useMakerProjectFiles } from './useMakerProjectFiles';
import { useMakerLyricsActions } from './useMakerLyricsActions';
import { useMakerToolModes } from './useMakerToolModes';
import KaraokeMakerTimingSliders from './KaraokeMakerTimingSliders';
import { useMakerCanvasRender } from './useMakerCanvasRender';
import { useMakerCanvasModel } from './useMakerCanvasModel';
import { useMakerLyricsEditing } from './useMakerLyricsEditing';
import { flattenTokens } from './makerProjectEdits';
import {
  ISyllableSplitDraft,
  useMakerNoteEditing,
} from './useMakerNoteEditing';
import { useMakerCanvasPointer } from './useMakerCanvasPointer';
import {
  IGuidedLineCapture,
  TLineEntrySession,
  useMakerLineCapture,
} from './useMakerLineCapture';
import { IWhisperRunProfile, useMakerAnalysisRun } from './useMakerAnalysisRun';
import { readKaraokeMakerEditorView } from './karaokeEditorPersistence';

interface IKaraokeMakerProps {
  song: IKaraokeSong;
  audioFile: File;
  playheadMs: number;
  durationMs: number;
  isPlaying: boolean;
  restoreSavedDraft: boolean;
  readPlayheadMs?: () => number;
  onSeek: (timeMs: number) => void;
  onPlay: () => Promise<void> | void;
  onPause: () => void;
  onApply: (project: IKaraokeMakerProject) => void;
  onClose: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
}

interface ISentenceAuditionState {
  startMs: number;
  endMs: number;
  timerId: number;
}

const KaraokeMaker = ({
  song,
  audioFile,
  playheadMs,
  durationMs,
  isPlaying,
  restoreSavedDraft,
  readPlayheadMs,
  onSeek,
  onPlay,
  onPause,
  onApply,
  onClose,
  isFullScreen,
  onToggleFullScreen,
}: IKaraokeMakerProps) => {
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
    undo,
    redo,
    canUndo,
    canRedo,
    pushHistory,
    clearHistory,
    restoreOriginal: restoreOriginalProject,
    draftReady,
    restoreToast,
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
  const melodyTone = useKaraokeMelodyTone({
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
  } = useKaraokeMakerEditorView(project.id, selection, initialEditorView);
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
    openEditor: openLyricsDraft,
  } = useKaraokeMakerLyricsDraft(project);
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
    'whisper' | 'whisper-runtime'
  >();
  const [analysisResult, setAnalysisResult] =
    useState<IKaraokeMakerAnalysisResult>();
  const [analysisFile, setAnalysisFile] = useState<File>(audioFile);
  const [exportOpen, setExportOpen] = useState(false);
  const [toolPanel, setToolPanel] = useState<'timing' | 'edit' | 'analysis'>();
  const noticeSequenceRef = useRef(0);
  const [noticeEntry, setNoticeEntry] = useState<{
    id: number;
    message: string;
  }>();
  const notice = noticeEntry?.message;
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
  const lineEntryCountdownTimersRef = useRef<number[]>([]);
  const wordAuditionTimerRef = useRef<number | undefined>(undefined);

  const cancelAudibleInteractions = useCallback(
    (pause = true) => {
      const scrub = gesture.scrub.current;
      const sentenceAudition = sentenceAuditionRef.current;
      if (scrub?.grainTimerId !== undefined) {
        window.clearTimeout(scrub.grainTimerId);
      }
      if (sentenceAudition) {
        window.clearInterval(sentenceAudition.timerId);
      }
      if (wordAuditionTimerRef.current !== undefined) {
        window.clearTimeout(wordAuditionTimerRef.current);
      }
      const drag = gesture.drag.current;
      if (drag?.auditionTimerId !== undefined) {
        window.clearTimeout(drag.auditionTimerId);
      }
      const hadAudibleInteraction =
        scrub?.auditionWordGrain === true ||
        sentenceAudition !== undefined ||
        drag?.auditionStarted === true ||
        wordAuditionTimerRef.current !== undefined;
      wordAuditionTimerRef.current = undefined;
      gesture.scrub.current = undefined;
      sentenceAuditionRef.current = undefined;
      setScrubAuditionAnchorMs(undefined);
      if (drag) {
        drag.auditionTimerId = undefined;
        drag.auditionStarted = false;
      }
      setIsCanvasScrubbing(false);
      if (pause && hadAudibleInteraction) {
        onPause();
        if (sentenceAudition) {
          onSeek(sentenceAudition.startMs);
        } else if (drag?.audioAnchorMs !== undefined) {
          onSeek(drag.audioAnchorMs);
        } else if (scrub) {
          onSeek(scrub.anchorMs);
        }
      }
    },
    [gesture.drag, gesture.scrub, onPause, onSeek],
  );

  const clearLineEntryCountdown = useCallback(() => {
    lineEntryCountdownTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer),
    );
    lineEntryCountdownTimersRef.current = [];
    setLineEntryCountdown(undefined);
  }, []);

  const startLineEntryCountdown = useCallback(() => {
    clearLineEntryCountdown();
    cancelAudibleInteractions(false);
    if (isPlaying) {
      onPause();
    }
    const contentLines = projectRef.current.lyrics.lines.filter(
      (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
    );
    const hasRecordedMarks = contentLines.some(
      (line) => karaokeMakerRecordedLineRange(line) !== undefined,
    );
    if (!hasRecordedMarks) {
      const firstLine = contentLines[0];
      onSeek(0);
      setViewStartMs(0);
      lineEntryIndexRef.current = 0;
      setLineEntryIndex(0);
      if (firstLine) {
        setSelection({ kind: 'word', id: firstLine.tokens[0].id });
      }
      setLyricFollowRequestKey((key) => key + 1);
    }
    setLineEntryCapture(undefined);
    setLineEntrySession('countdown');
    setLineEntryCountdown('1');
    const schedule = (delayMs: number, action: () => void) => {
      lineEntryCountdownTimersRef.current.push(
        window.setTimeout(action, delayMs),
      );
    };
    schedule(650, () => setLineEntryCountdown('2'));
    schedule(1_300, () => setLineEntryCountdown('3'));
    schedule(1_950, () => {
      setLineEntryCountdown('GO');
      setLineEntrySession('active');
      Promise.resolve(onPlay()).catch(() => undefined);
    });
    schedule(2_500, () => {
      setLineEntryCountdown(undefined);
      lineEntryCountdownTimersRef.current = [];
    });
  }, [
    clearLineEntryCountdown,
    cancelAudibleInteractions,
    isPlaying,
    projectRef,
    onPause,
    onSeek,
    setViewStartMs,
    setSelection,
    onPlay,
  ]);

  useEffect(
    () => () => {
      lineEntryCountdownTimersRef.current.forEach((timer) =>
        window.clearTimeout(timer),
      );
    },
    [],
  );

  useEffect(() => {
    if (lineEntryMode) {
      return;
    }
    clearLineEntryCountdown();
    setLineEntrySession('setup');
  }, [clearLineEntryCountdown, lineEntryMode]);

  useEffect(() => {
    refreshKaraokeWhisperDownloaded().catch(() => undefined);
  }, []);

  const {
    activeLyricFocus,
    activeLyricWordId,
    canvasLyricWords,
    canvasSectionGroups,
    effectiveDurationMs,
    headerHeight,
    lyricLines,
    lyricSectionTop,
    maximumViewDurationMs,
    maximumViewStartMs,
    minimumViewDurationMs,
    selectedLyricLineId,
    userTouchedWordCount,
    visibleViewDurationMs,
  } = useMakerCanvasModel({
    durationMs,
    project,
    selection,
    tokens,
    viewDurationMs,
    visualPlayheadMs,
    wordFocusAnimationRef,
  });

  const issues = useMemo(() => validateKaraokeMakerProject(project), [project]);
  const localizeMakerError = (
    error: unknown,
    context: 'analysis' | 'export' | 'import' | 'whisper',
  ): string => {
    const message = error instanceof Error ? error.message : String(error);
    if (/1 GB|30 minutes/i.test(message)) {
      return t('karaoke.maker.errorAudioLimits');
    }
    if (/unavailable|AudioContext|WASM|Basic Pitch model/i.test(message)) {
      return t('karaoke.maker.errorComponentUnavailable');
    }
    if (/unsupported FluidEQ Karaoke Maker project version/i.test(message)) {
      return t('karaoke.maker.errorProjectVersion');
    }
    if (/Unsupported lyric extension|could not be parsed/i.test(message)) {
      return t('karaoke.maker.errorParse');
    }
    if (
      context === 'whisper' &&
      /Hugging Face|download|fetch|network/i.test(message)
    ) {
      return t('karaoke.maker.whisperDownloadError');
    }
    if (context === 'export') {
      return /at least one melody note/i.test(message)
        ? t('karaoke.maker.errorExportNeedsNotes')
        : t('karaoke.maker.errorExport');
    }
    if (context === 'import') {
      return t('karaoke.maker.errorImport');
    }
    return t('karaoke.maker.errorAnalysis');
  };
  const selectedToken =
    selection?.kind === 'word'
      ? tokens.find((token) => token.id === selection.id)
      : undefined;
  const selectedNote =
    selection?.kind === 'note'
      ? project.melody.notes.find((note) => note.id === selection.id)
      : undefined;
  const selectedNoteToken = selectedNote?.tokenId
    ? tokens.find((token) => token.id === selectedNote.tokenId)
    : undefined;
  const selectedTokenTimingControls = useMemo(() => {
    if (
      !selectedToken ||
      selectedToken.startMs === undefined ||
      selectedToken.endMs === undefined
    ) {
      return undefined;
    }
    const startLimits = karaokeMakerTokenBoundaryLimits(
      project,
      selectedToken.id,
      'start',
    );
    const endLimits = karaokeMakerTokenBoundaryLimits(
      project,
      selectedToken.id,
      'end',
    );
    const canResizeStart =
      startLimits !== undefined &&
      startLimits.minimumMs <= startLimits.maximumMs;
    const canResizeEnd =
      endLimits !== undefined && endLimits.minimumMs <= endLimits.maximumMs;
    return {
      startMs: selectedToken.startMs,
      endMs: selectedToken.endMs,
      durationMs: selectedToken.endMs - selectedToken.startMs,
      canResizeStart,
      canResizeEnd,
      minimumStartMs: canResizeStart
        ? startLimits.minimumMs
        : selectedToken.startMs,
      maximumStartMs: canResizeStart
        ? startLimits.maximumMs
        : selectedToken.startMs,
      minimumDurationMs: 20,
      maximumDurationMs: canResizeEnd
        ? endLimits.maximumMs - selectedToken.startMs
        : selectedToken.endMs - selectedToken.startMs,
    };
  }, [project, selectedToken]);

  const canShiftFromWord = selectedToken?.startMs !== undefined;
  const previewProject = useMemo(() => {
    if (!lineEntryCapture) {
      return project;
    }
    const capturedLineIndex = lyricLines.findIndex(
      (line) => line.id === lineEntryCapture.lineId,
    );
    return recordKaraokeMakerLineRange(
      project,
      lineEntryCapture.lineId,
      lineEntryCapture.startMs,
      lineEntryCapture.estimatedEndMs,
      lyricLines[capturedLineIndex - 1]?.id,
      lineEntryCapture.wordBoundariesMs,
    );
  }, [lineEntryCapture, lyricLines, project]);
  const previewSong = useMemo(() => {
    const audioAsset = song.assets.find((asset) => asset.role === 'audio');
    return audioAsset
      ? karaokeMakerProjectToSong(previewProject, audioAsset, song.assets)
      : song;
  }, [previewProject, song]);
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

  const shiftTimeline = useCallback(
    (deltaMs: number) => {
      if (timingScope === 'from-word' && selectedToken) {
        const shiftSelected = (current: IKaraokeMakerProject) =>
          shiftKaraokeMakerLineTailFromToken(
            current,
            selectedToken.id,
            deltaMs,
          );
        const previewShift = shiftSelected(project);
        const shiftedStart = flattenTokens(previewShift).find(
          (token) => token.id === selectedToken.id,
        )?.startMs;
        const effectiveDelta =
          selectedToken.startMs !== undefined && shiftedStart !== undefined
            ? shiftedStart - selectedToken.startMs
            : 0;
        commit(shiftSelected);
        setWordShiftMs((offset) => offset + effectiveDelta);
        return;
      }
      commit((current) => {
        const shifted = shiftKaraokeMakerTimeline(current, deltaMs);
        return {
          ...shifted,
          lyrics: {
            ...shifted.lyrics,
            source: 'manual',
            lines: shifted.lyrics.lines.map((line) => ({
              ...line,
              tokens: line.tokens.map((token) =>
                token.startMs !== undefined && token.endMs !== undefined
                  ? { ...token, source: 'manual', timingLocked: true }
                  : token,
              ),
            })),
          },
          melody: {
            ...shifted.melody,
            source: 'manual',
            notes: shifted.melody.notes.map((note) => ({
              ...note,
              source: 'manual',
            })),
          },
        };
      });
    },
    [commit, project, selectedToken, timingScope],
  );

  useEffect(() => {
    setWordShiftMs(0);
  }, [selectedToken?.id]);

  useEffect(() => {
    if (timingScope === 'from-word' && !canShiftFromWord) {
      setTimingScope('all');
    }
  }, [canShiftFromWord, setTimingScope, timingScope]);

  useEffect(() => {
    const togglePlaybackWithSpace = (event: KeyboardEvent) => {
      const isSpace =
        event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
      if (
        !isSpace ||
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        lineEntryMode ||
        document.querySelector(
          '.karaoke-maker__modal-backdrop, .dropdown--open',
        )
      ) {
        return;
      }
      let target: HTMLElement | undefined;
      if (event.target instanceof HTMLElement) {
        target = event.target;
      } else if (document.activeElement instanceof HTMLElement) {
        target = document.activeElement;
      }
      const isEnteringText = Boolean(
        target?.isContentEditable ||
        target?.closest(
          'textarea, [contenteditable="true"], input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="password"]',
        ),
      );
      if (isEnteringText) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isPlaying) {
        onPause();
      } else {
        Promise.resolve(onPlay()).catch(() => undefined);
      }
    };
    window.addEventListener('keydown', togglePlaybackWithSpace, true);
    return () =>
      window.removeEventListener('keydown', togglePlaybackWithSpace, true);
  }, [isPlaying, lineEntryMode, onPause, onPlay]);

  useEffect(() => {
    const stopSentenceAudition = () => {
      const audition = sentenceAuditionRef.current;
      if (!audition) {
        return;
      }
      window.clearInterval(audition.timerId);
      sentenceAuditionRef.current = undefined;
      onPause();
      onSeek(audition.startMs);
    };
    const startSentenceAudition = (event: KeyboardEvent) => {
      const isControl =
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight' ||
        event.key === 'Control';
      if (
        !isControl ||
        event.repeat ||
        event.defaultPrevented ||
        lineEntryMode ||
        sentenceAuditionRef.current ||
        selection?.kind === 'note' ||
        document.querySelector(
          '.karaoke-maker__modal-backdrop, .dropdown--open',
        )
      ) {
        return;
      }
      const { target } = event;
      if (
        target instanceof HTMLElement &&
        target.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const contentLines = projectRef.current.lyrics.lines.filter(
        (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
      );
      const selectedLine =
        selection?.kind === 'word'
          ? contentLines.find((line) =>
              line.tokens.some((token) => token.id === selection.id),
            )
          : undefined;
      const now = Math.max(0, readPlayheadMs?.() ?? playheadMsRef.current);
      const playheadLine = contentLines.find((line) => {
        const range = karaokeMakerTimedLineRange(line);
        return range && now >= range.startMs && now <= range.endMs;
      });
      const auditionLine = selectedLine ?? playheadLine;
      if (!auditionLine) {
        return;
      }
      const range = karaokeMakerTimedLineRange(auditionLine);
      if (!range) {
        return;
      }
      event.preventDefault();
      cancelAudibleInteractions();
      onSeek(range.startMs);
      Promise.resolve(onPlay()).catch(() => undefined);
      const timerId = window.setInterval(() => {
        const audition = sentenceAuditionRef.current;
        if (!audition) {
          return;
        }
        const currentMs = readPlayheadMs?.() ?? playheadMsRef.current;
        if (currentMs >= audition.endMs || currentMs < audition.startMs) {
          onSeek(audition.startMs);
          Promise.resolve(onPlay()).catch(() => undefined);
        }
      }, 25);
      sentenceAuditionRef.current = {
        startMs: range.startMs,
        endMs: range.endMs,
        timerId,
      };
    };
    const stopSentenceAuditionOnControlUp = (event: KeyboardEvent) => {
      if (
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight' ||
        event.key === 'Control'
      ) {
        stopSentenceAudition();
      }
    };
    window.addEventListener('keydown', startSentenceAudition, true);
    window.addEventListener('keyup', stopSentenceAuditionOnControlUp, true);
    window.addEventListener('blur', stopSentenceAudition);
    return () => {
      window.removeEventListener('keydown', startSentenceAudition, true);
      window.removeEventListener(
        'keyup',
        stopSentenceAuditionOnControlUp,
        true,
      );
      window.removeEventListener('blur', stopSentenceAudition);
      stopSentenceAudition();
    };
  }, [
    cancelAudibleInteractions,
    lineEntryMode,
    onPause,
    onPlay,
    onSeek,
    projectRef,
    readPlayheadMs,
    selection,
  ]);

  useEffect(() => {
    if (!noticeEntry || analysisProgress !== undefined || analysisError) {
      return undefined;
    }
    const noticeId = noticeEntry.id;
    const timeout = window.setTimeout(() => {
      setNoticeEntry((current) =>
        current?.id === noticeId ? undefined : current,
      );
    }, 5_000);
    return () => window.clearTimeout(timeout);
  }, [analysisError, analysisProgress, noticeEntry]);

  useEffect(
    () => () => {
      analysisAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const closeFloatingTools = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !toolsRef.current?.contains(event.target)
      ) {
        setToolPanel(undefined);
        setExportOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setToolPanel(undefined);
        setExportOpen(false);
        setLineEntryMode(false);
        setLineEntryCapture(undefined);
        setHandPanMode(false);
        setIsCanvasPanning(false);
        setIsCanvasScrubbing(false);
        setSelection(undefined);
        cancelAudibleInteractions();
        gesture.drag.current = undefined;
        gesture.pan.current = undefined;
        gesture.lastDragAuditionMidi.current = undefined;
      }
    };
    window.addEventListener('pointerdown', closeFloatingTools);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeFloatingTools);
      window.removeEventListener('keydown', closeOnEscape);
      cancelAudibleInteractions();
    };
  }, [
    cancelAudibleInteractions,
    gesture.drag,
    gesture.lastDragAuditionMidi,
    gesture.pan,
    setSelection,
  ]);

  useEffect(() => {
    if (viewDurationMs !== visibleViewDurationMs) {
      setViewDurationMs(visibleViewDurationMs);
    }
    setViewStartMs((current) => Math.min(maximumViewStartMs, current));
  }, [
    maximumViewStartMs,
    setViewDurationMs,
    setViewStartMs,
    viewDurationMs,
    visibleViewDurationMs,
  ]);

  useEffect(() => {
    if (!isPlaying || !followViewport) {
      return;
    }
    const viewportEnd = viewStartMs + visibleViewDurationMs;
    if (playheadMs > viewportEnd - visibleViewDurationMs * 0.08) {
      setViewStartMs(
        Math.min(
          Math.max(0, effectiveDurationMs - visibleViewDurationMs),
          Math.max(0, playheadMs - visibleViewDurationMs * 0.2),
        ),
      );
    }
  }, [
    setViewStartMs,
    effectiveDurationMs,
    followViewport,
    isPlaying,
    playheadMs,
    visibleViewDurationMs,
    viewStartMs,
  ]);

  useMakerCanvasRender({
    activeLyricFocus,
    activeLyricWordId,
    canvasHostRef,
    canvasLyricWords,
    canvasRef,
    canvasSectionGroups,
    controlLinkMode,
    effectiveDurationMs,
    gesture,
    headerHeight,
    hoveredEditHandle,
    lyricSectionTop,
    project,
    renderCanvasRef,
    selectedNoteIds,
    selection,
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
  });

  const startLineRecordingForProject = (nextProject: IKaraokeMakerProject) => {
    const nextLyricLines = nextProject.lyrics.lines.filter(
      (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
    );
    const targetLine = nextLyricLines[0];
    if (!targetLine) {
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setLyricsOpen(false);
    setLineEntryMode(true);
    setNoteEditMode(undefined);
    clearLineEntryCountdown();
    setLineEntrySession('setup');
    setLineEntryCapture(undefined);
    lineEntryIndexRef.current = 0;
    setLineEntryIndex(0);
    setSelection({ kind: 'word', id: targetLine.tokens[0].id });
    setHandPanMode(false);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    gesture.pan.current = undefined;
    gesture.noteLinkDrag.current = undefined;
    cancelAudibleInteractions();
    setPreviewOpen(true);
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    onSeek(0);
    setViewStartMs(0);
    setToolPanel(undefined);
  };

  const replaceLyrics = (
    detectTimingAndMelody = false,
    recordLinesAfter = false,
  ) => {
    const nextLines = makerLinesFromPlainText(lyricsDraft);
    if (!nextLines.some((line) => !karaokeMakerLineIsSection(line))) {
      setNotice(t('karaoke.maker.lyricsRequired'));
      return;
    }
    const textChanged =
      normalizedLyricsText(lyricsDraft) !==
      normalizedLyricsText(plainLyrics(projectRef.current));
    if (
      textChanged &&
      flattenTokens(projectRef.current).length > 0 &&
      destructiveAction !== 'replace-lyrics'
    ) {
      setDestructiveAction('replace-lyrics');
      return;
    }
    setDestructiveAction(undefined);
    if (!textChanged) {
      setLyricsOpen(detectTimingAndMelody);
      if (detectTimingAndMelody) {
        lyricsWorkflowActiveRef.current = true;
        setLyricsWorkflowActive(true);
        prepareAfterWhisperRef.current = true;
        requestWhisper(true).catch(() => undefined);
      } else if (recordLinesAfter) {
        startLineRecordingForProject(projectRef.current);
      } else {
        setLyricsOpen(false);
      }
      return;
    }
    // A complete preparation run must not expose cached/local melody from the
    // previous lyric set. Whisper establishes the new word timing first; only
    // then may the melody pass publish notes linked to those words.
    let reusableAnalysisNotes = analysisResult?.notes.slice(0, 0) ?? [];
    if (!detectTimingAndMelody) {
      reusableAnalysisNotes = analysisResult?.notes.length
        ? analysisResult.notes
        : karaokeMakerAnalysisNotesFromMelody(project);
    }
    const { current } = projectRef;
    const rebuildingEmptyTimeline =
      detectTimingAndMelody &&
      flattenTokens(current).length === 0 &&
      current.melody.notes.length === 0;
    const withNewLyrics: IKaraokeMakerProject = {
      ...current,
      meta: rebuildingEmptyTimeline
        ? { ...current.meta, gapMs: 0 }
        : current.meta,
      lyrics: { ...current.lyrics, source: 'manual', lines: nextLines },
      analysis: {
        ...current.analysis,
        whisperPasses: 0,
        whisperAlignmentVersion: undefined,
      },
      melody: {
        ...current.melody,
        notes: detectTimingAndMelody
          ? []
          : current.melody.notes.map((note) => ({
              ...note,
              tokenId: undefined,
            })),
      },
    };
    const next = touchKaraokeMakerProject(
      reusableAnalysisNotes.length
        ? autoAlignNewKaraokeMakerLyrics(withNewLyrics, reusableAnalysisNotes)
        : withNewLyrics,
    );
    projectRef.current = next;
    pushHistory(current);
    setProject(next);
    if (detectTimingAndMelody) {
      setAnalysisResult(undefined);
    }
    setSelection(undefined);
    if (detectTimingAndMelody) {
      lyricsWorkflowActiveRef.current = true;
      setLyricsWorkflowActive(true);
      prepareAfterWhisperRef.current = true;
      requestWhisper(true).catch(() => undefined);
      return;
    }
    if (recordLinesAfter) {
      startLineRecordingForProject(next);
    } else {
      setLyricsOpen(false);
    }
    if (reusableAnalysisNotes.length) {
      setNotice(t('karaoke.maker.lyricsAutoAligned'));
    } else {
      setNotice(t('karaoke.maker.lyricsNeedPreparation'));
    }
  };

  // Seeding and opening the editor is the hook's; landing the caret on the word
  // the user was last looking at is this component's, because the selection and
  // the lyric focus are not the draft's business.
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

  const { exportProject, openProject, selectVocalStem } = useMakerProjectFiles({
    clearHistory,
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
  });

  const {
    auditionLyricsToken,
    moveLyricsEditorSelection,
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
    wordAuditionTimerRef,
  });

  const renderSelectedWordTimingSliders = (idPrefix: string) => (
    <KaraokeMakerTimingSliders
      idPrefix={idPrefix}
      selectedTokenTimingControls={selectedTokenTimingControls}
      updateSelectedTokenTiming={updateSelectedTokenTiming}
    />
  );

  const renderLyricsModalWordInspector = () => (
    <KaraokeMakerWordInspector
      selectedToken={selectedToken}
      tokens={tokens}
      playheadMs={playheadMs}
      isProcessing={lyricsProcessing}
      controlId={controlId}
      onMoveSelection={moveLyricsEditorSelection}
      onAudition={auditionLyricsToken}
      onStartLineEntry={startLineEntrySync}
      onTimingChange={updateSelectedTokenTiming}
      renderTimingSliders={renderSelectedWordTimingSliders}
    />
  );

  const selectionInfo = (
    <KaraokeMakerSelectionInfo
      applySyllableSplit={applySyllableSplit}
      auditionLyricsToken={auditionLyricsToken}
      commit={commit}
      controlId={controlId}
      deleteSelection={deleteSelection}
      detachSelectedNotes={detachSelectedNotes}
      noteAudition={noteAudition}
      noteKindLabel={noteKindLabel}
      playheadMs={playheadMs}
      project={project}
      renderTimingSliders={renderSelectedWordTimingSliders}
      selectedNote={selectedNote}
      selectedNoteIds={selectedNoteIds}
      selectedNoteToken={selectedNoteToken}
      selectedToken={selectedToken}
      setSyllableSplitDraft={setSyllableSplitDraft}
      splitSelectedLyricsWord={splitSelectedLyricsWord}
      syllableSplitDraft={syllableSplitDraft}
      toggleSyllableCutPoint={toggleSyllableCutPoint}
      updateSelectedTokenTiming={updateSelectedTokenTiming}
    />
  );

  const {
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
    prepareKaraoke,
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

  const editTools = (
    <KaraokeMakerEditTools
      isRecordingLines={lineEntryMode}
      onToggleRecordLines={toggleLineEntryMode}
      noteEditMode={noteEditMode}
      onToggleNoteEditMode={toggleNoteEditMode}
      canCopyNotes={selection?.kind === 'note'}
      onCopyNotes={copySelectedNotes}
      canPasteNotes={copiedNotes.length > 0}
      onPasteNotes={pasteCopiedNotes}
      canSplitNote={Boolean(selectedNote)}
      onSplitNote={splitNote}
      canDelete={Boolean(selection)}
      onDelete={deleteSelection}
    />
  );

  const speechMemoryStatusKey = (() => {
    if (whisperSession.inMemory) {
      return 'karaoke.maker.speechMemoryReady';
    }
    return whisperSession.downloaded
      ? 'karaoke.maker.speechMemoryCached'
      : 'karaoke.maker.speechMemoryMissing';
  })();

  const advancedAnalysisTools = (
    <>
      <KaraokeMakerAnalysisTools
        isAnalysing={analysisProgress !== undefined}
        onDetectLyrics={() => requestWhisper(false).catch(() => undefined)}
        onDetectMelody={() => runBasicPitch().catch(() => undefined)}
        onRebuild={() => requestWhisper(true).catch(() => undefined)}
        isUsingSongAudio={analysisFile === audioFile}
        onChooseVocalStem={() => vocalStemInputRef.current?.click()}
      />
      <KaraokeMakerSpeechMemoryPanel
        session={whisperSession}
        statusKey={speechMemoryStatusKey}
        onRelease={() => releaseWhisperNow().catch(() => undefined)}
        onSettingsChange={writeKaraokeWhisperMemorySettings}
      />
    </>
  );

  const renderEditStatus = () => {
    if (handPanMode) {
      return (
        <div className="karaoke-maker__tap-status is-live">
          <span>{t('karaoke.maker.panHint')}</span>
          <button type="button" onClick={toggleHandPanMode}>
            × {t('karaoke.maker.cancel')}
          </button>
        </div>
      );
    }
    if (lineEntryMode) {
      return <span>{captureGuideInstruction}</span>;
    }
    return <span>{t('karaoke.maker.editHint')}</span>;
  };

  let lineCaptureState: 'armed' | 'ready' | undefined;
  if (lineEntryCapture) {
    lineCaptureState =
      playheadMs >= lineEntryCapture.estimatedEndMs - 650 ? 'ready' : 'armed';
  }
  const captureGuideLine = lineEntryMode
    ? lyricLines[lineEntryIndex]
    : undefined;
  const captureGuideNextLine = lineEntryMode
    ? lyricLines[lineEntryIndex + 1]
    : undefined;
  const captureGuideIsArmed =
    captureGuideLine !== undefined &&
    lineEntryCapture?.lineId === captureGuideLine.id;
  const captureGuideHasRecordedEnd =
    captureGuideLine !== undefined &&
    !captureGuideIsArmed &&
    karaokeMakerRecordedLineRange(captureGuideLine) !== undefined;
  const captureGuidePhase: 'start' | 'end' = captureGuideIsArmed
    ? 'end'
    : 'start';
  let captureGuideVisualState: 'pending' | 'started' | 'complete' = 'pending';
  if (captureGuideHasRecordedEnd) {
    captureGuideVisualState = 'complete';
  } else if (captureGuideIsArmed) {
    captureGuideVisualState = 'started';
  }
  let captureGuideInstruction = t('karaoke.maker.capturePressStart');
  if (captureGuideIsArmed && lineEntryCapture) {
    captureGuideInstruction = t(
      lineEntryCapture.automaticStart
        ? 'karaoke.maker.captureAutomaticStart'
        : 'karaoke.maker.captureStartSaved',
      { time: formatClock(lineEntryCapture.startMs) },
    );
  } else if (captureGuideHasRecordedEnd) {
    captureGuideInstruction = t('karaoke.maker.captureReplaceStart');
  }

  // Pure derivation, so it lives outside the run that produces it.
  const analysisView = karaokeMakerAnalysisProgress({
    analysisProgress,
    whisperStage,
    downloadProgress,
    runProfile: whisperRunProfile,
  });
  const displayedAnalysisProgress = analysisView.fraction;
  const analysisProgressIsIndeterminate = analysisView.isIndeterminate;
  const lyricsDownloadRate = analysisView.downloadRate;
  const visibleWhisperStages = analysisView.stages;
  const lyricsProcessing =
    KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED &&
    (lyricsWorkflowActive || analysisProgress !== undefined);
  const renderWhisperDownloadDetails = () =>
    whisperStage === 'download' && downloadProgress ? (
      <KaraokeMakerDownloadDetails
        progress={downloadProgress}
        rate={lyricsDownloadRate}
      />
    ) : null;

  let canvasInteractionHint = `${t('karaoke.maker.panHint')} ${t(
    'karaoke.maker.scrubHint',
  )}`;
  if (handPanMode) {
    canvasInteractionHint = t('karaoke.maker.panHint');
  } else if (noteEditMode === 'select') {
    canvasInteractionHint = t('karaoke.maker.selectNotesHint');
  } else if (noteEditMode === 'paint') {
    canvasInteractionHint = t('karaoke.maker.paintNotesHint');
  }

  return (
    <div
      className={`karaoke-maker${isFullScreen ? ' is-fullscreen' : ''}`}
      role="dialog"
      aria-label={t('karaoke.maker.dialog')}
    >
      <input
        ref={vocalStemInputRef}
        hidden
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a"
        onChange={selectVocalStem}
      />
      <input
        ref={projectInputRef}
        hidden
        type="file"
        accept=".json,.fluideq-karaoke.json,.lrc,.elrc,.txt,application/json,text/plain"
        onChange={openProject}
      />
      <input
        ref={lyricsInputRef}
        hidden
        type="file"
        accept=".lrc,.elrc,.txt,text/plain"
        onChange={selectLyricsFile}
      />
      <KaraokeMakerHeader
        canRedo={canRedo}
        canUndo={canUndo}
        commit={commit}
        effectiveDurationMs={effectiveDurationMs}
        isFullScreen={isFullScreen}
        isPlaying={isPlaying}
        issues={issues}
        makerMelodyTarget={makerMelodyTarget}
        maximumViewStartMs={maximumViewStartMs}
        melodyTone={melodyTone}
        onApply={onApply}
        onClose={onClose}
        onPause={onPause}
        onPlay={onPlay}
        onSeek={onSeek}
        onToggleFullScreen={onToggleFullScreen}
        playheadMs={playheadMs}
        project={project}
        redo={redo}
        setDestructiveAction={setDestructiveAction}
        setFollowViewport={setFollowViewport}
        setNotice={setNotice}
        setViewStartMs={setViewStartMs}
        undo={undo}
        visualPlayheadMs={visualPlayheadMs}
      />

      <KaraokeMakerToolbar
        advancedAnalysisTools={advancedAnalysisTools}
        analysisProgress={analysisProgress}
        canShiftFromWord={canShiftFromWord}
        editTools={editTools}
        exportOpen={exportOpen}
        exportProject={exportProject}
        handPanMode={handPanMode}
        openLyricsEditor={openLyricsEditor}
        prepareKaraoke={prepareKaraoke}
        project={project}
        projectInputRef={projectInputRef}
        selectedToken={selectedToken}
        setDestructiveAction={setDestructiveAction}
        setExportOpen={setExportOpen}
        setTimingScope={setTimingScope}
        setToolPanel={setToolPanel}
        shiftTimeline={shiftTimeline}
        timingScope={timingScope}
        toggleHandPanMode={toggleHandPanMode}
        toggleToolPanel={toggleToolPanel}
        tokens={tokens}
        toolPanel={toolPanel}
        toolsRef={toolsRef}
        wordShiftMs={wordShiftMs}
      />

      <div
        className={`karaoke-maker__status-row${
          lineEntryMode ? ' is-guided' : ''
        }`}
      >
        {renderEditStatus()}
        <div className="karaoke-maker__status-end">
          <div
            className="karaoke-maker__word-state-legend"
            aria-label={t('karaoke.maker.wordStateLegend')}
          >
            <span className="is-touched" data-count={userTouchedWordCount}>
              <i aria-hidden="true" />
              {t('karaoke.maker.userAdjustedWords', {
                count: userTouchedWordCount,
              })}
            </span>
            <span
              className="is-pending"
              data-count={Math.max(0, tokens.length - userTouchedWordCount)}
            >
              <i aria-hidden="true" />
              {t('karaoke.maker.pendingWords', {
                count: Math.max(0, tokens.length - userTouchedWordCount),
              })}
            </span>
          </div>
          <span>
            {t('karaoke.maker.stats', {
              notes: project.melody.notes.length,
              words: tokens.length,
              checks: issues.length,
            })}
          </span>
        </div>
      </div>

      <div ref={canvasHostRef} className="karaoke-maker__canvas-host">
        <canvas
          ref={canvasRef}
          className={`karaoke-maker__canvas${
            handPanMode ? ' is-hand-pan' : ''
          }${
            isPitchPanReady ? ' is-pitch-pan-ready' : ''
          }${isCanvasPanning ? ' is-panning' : ''}${
            isCanvasScrubbing ? ' is-scrubbing' : ''
          }${noteEditMode === 'select' ? ' is-note-selecting' : ''}${
            noteEditMode === 'paint' ? ' is-note-painting' : ''
          }${
            hoveredEditHandle?.behavior === 'move' ? ' is-note-move-ready' : ''
          }${
            hoveredEditHandle?.behavior === 'resize-start' ||
            hoveredEditHandle?.behavior === 'resize-end'
              ? ' is-note-resize-ready'
              : ''
          }`}
          title={canvasInteractionHint}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onPointerLeave={() => {
            if (!gesture.drag.current) {
              setHoveredEditHandle(undefined);
              setIsPitchPanReady(false);
            }
          }}
          onWheel={onCanvasWheel}
        />
        <KaraokeMakerNavigator
          durationMs={effectiveDurationMs}
          viewportStartMs={viewStartMs}
          viewportDurationMs={visibleViewDurationMs}
          playheadMs={visualPlayheadMs}
          waveform={project.analysis.waveform}
          notes={project.melody.notes}
          minimumViewportMs={minimumViewDurationMs}
          maximumViewportMs={maximumViewDurationMs}
          follow={followViewport}
          positionLabel={t('karaoke.maker.songPosition')}
          previousLabel={t('karaoke.maker.previousView')}
          nextLabel={t('karaoke.maker.nextView')}
          followLabel={t('karaoke.lyrics.follow')}
          resetZoomLabel={t('karaoke.maker.resetZoom')}
          onMove={moveViewport}
          onResize={resizeViewport}
          onFollow={followPlayhead}
          onResetZoom={resetLyricZoom}
        />
      </div>

      <KaraokeMakerCaptureCoach
        anchorRef={canvasHostRef}
        moveLabel={t('karaoke.maker.captureMoveGuide')}
        setup={
          lineEntryMode && lineEntrySession === 'setup' && captureGuideLine
            ? {
                eyebrow: t('karaoke.maker.captureGuideTitle'),
                title: t('karaoke.maker.captureSetupTitle'),
                description: t('karaoke.maker.captureSetupBody'),
                currentLine: captureGuideLine.tokens
                  .map((token) => token.text)
                  .join(' '),
                startLabel: t('karaoke.maker.captureStartRecording'),
              }
            : undefined
        }
        countdown={
          lineEntryMode && lineEntryCountdown
            ? {
                cue: lineEntryCountdown,
                label: t('karaoke.maker.captureCountdownReady'),
              }
            : undefined
        }
        help={
          lineEntryMode
            ? {
                audioLabel: t('karaoke.maker.captureGuideAudio'),
                lyricLabel: t('karaoke.maker.captureGuideLyrics'),
                playbackLabel: t('karaoke.maker.captureGuidePlayback'),
                wordLabel: t('karaoke.maker.captureGuideWords'),
                undoLabel: t('karaoke.maker.captureGuideUndo'),
              }
            : undefined
        }
        guide={
          lineEntryMode && lineEntrySession === 'active' && captureGuideLine
            ? {
                title: t('karaoke.maker.captureGuideTitle'),
                instruction: captureGuideInstruction,
                currentLine: captureGuideLine.tokens
                  .map((token) => token.text)
                  .join(' '),
                nextLine: captureGuideNextLine?.tokens
                  .map((token) => token.text)
                  .join(' '),
                nextLabel: t('karaoke.maker.captureGuideNext'),
                phase: captureGuidePhase,
                startLabel: t('karaoke.maker.captureStartPoint'),
                endLabel: t('karaoke.maker.captureEndPoint'),
              }
            : undefined
        }
        actions={
          lineEntryMode
            ? {
                isPlaying,
                playLabel: t('karaoke.transport.play'),
                pauseLabel: t('karaoke.transport.pause'),
                markLabel: t(
                  captureGuidePhase === 'start'
                    ? 'karaoke.maker.markLine'
                    : 'karaoke.maker.markLineEnd',
                ),
                markWordLabel: t('karaoke.maker.markNextWord'),
                undoLabel: t('karaoke.maker.undo'),
                ignoreLabel: t('karaoke.maker.ignoreLine'),
                stopLabel: t('karaoke.maker.stopRecording'),
                cancelLabel: t('karaoke.maker.cancel'),
                canUndo,
                canMarkWord:
                  captureGuidePhase === 'end' &&
                  (lineEntryCapture?.wordBoundariesMs?.length ?? 0) <
                    Math.max(0, (captureGuideLine?.tokens.length ?? 0) - 1),
                onTogglePlayback: () => {
                  if (isPlaying) {
                    onPause();
                  } else {
                    Promise.resolve(onPlay()).catch(() => undefined);
                  }
                },
                onMark: recordLineEntry,
                onMarkWord: markNextGuidedWord,
                onUndo: () => {
                  undo();
                  setLineEntryCapture(undefined);
                  selectGuidedLine(lineEntryIndex - 1);
                },
                onIgnore: ignoreGuidedLine,
                onStop: stopLineEntryRecording,
                onCancel: stopLineEntryRecording,
              }
            : undefined
        }
        onStart={startLineEntryCountdown}
      />

      {!lineEntryMode && (selectedNoteIds.size > 0 || selectedToken) && (
        <KaraokeMakerFloatingPanel
          anchorRef={canvasHostRef}
          className={`karaoke-maker__selection-coach${
            selectedToken && !syllableSplitDraft ? ' is-word-selection' : ''
          }`}
          ariaLabel={t('karaoke.maker.selectionPanel')}
          moveLabel={t('karaoke.maker.selectionMoveGuide')}
          closeLabel={t('karaoke.maker.dismissSelection')}
          onClose={() => {
            noteAudition.stop();
            setSyllableSplitDraft(undefined);
            setSelection(undefined);
            setSelectedNoteIds(new Set());
          }}
        >
          <div className="karaoke-maker__selection-coach-content">
            {selectionInfo}
          </div>
        </KaraokeMakerFloatingPanel>
      )}

      <KaraokeMakerPreview
        song={previewSong}
        playheadMs={visualPlayheadMs}
        textSize={previewTextSize}
        height={previewHeight}
        open={previewOpen}
        followRequestKey={lyricFollowRequestKey}
        title={t('karaoke.maker.livePreview')}
        showLabel={t('karaoke.maker.showPreview')}
        hideLabel={t('karaoke.maker.hidePreview')}
        resizeLabel={t('karaoke.maker.previewResize')}
        textSizeLabel={t('karaoke.lyrics.textSize')}
        centerLineId={
          lineEntryMode ? lyricLines[lineEntryIndex]?.id : selectedLyricLineId
        }
        activeLineId={
          lineEntryMode ? lyricLines[lineEntryIndex]?.id : selectedLyricLineId
        }
        captureState={
          lineEntrySession === 'active' ? lineCaptureState : undefined
        }
        captureLineState={
          lineEntryMode && lineEntrySession === 'active' && captureGuideLine
            ? captureGuideVisualState
            : undefined
        }
        onSeek={onSeek}
        onTextSize={setPreviewTextSize}
        onHeight={setPreviewHeight}
        onToggle={() => setPreviewOpen((current) => !current)}
      />

      <KaraokeMakerInspector
        commit={commit}
        controlId={controlId}
        project={project}
      />

      <KaraokeMakerAnalysisPanels
        analysisError={analysisError}
        analysisMessage={analysisMessage}
        analysisProgress={analysisProgress}
        analysisProgressIsIndeterminate={analysisProgressIsIndeterminate}
        analysisRetry={analysisRetry}
        cancelAnalysis={cancelAnalysis}
        displayedAnalysisProgress={displayedAnalysisProgress}
        lyricsOpen={lyricsOpen}
        renderWhisperDownloadDetails={renderWhisperDownloadDetails}
        runWhisper={runWhisper}
        setAnalysisError={setAnalysisError}
        setAnalysisRetry={setAnalysisRetry}
        visibleWhisperStages={visibleWhisperStages}
        whisperStage={whisperStage}
      />
      {analysisProgress === undefined && !analysisError && notice && (
        <div className="karaoke-maker__notice" role="status" aria-live="polite">
          <span>{notice}</span>
        </div>
      )}
      {restoreToast && (
        <div className="karaoke-maker__toast" role="status" aria-live="polite">
          <KaraokeMakerToolIcon name="apply" />
          <span>{restoreToast}</span>
        </div>
      )}

      <KaraokeMakerConfirmDialog
        action={destructiveAction}
        onCancel={() => setDestructiveAction(undefined)}
        onConfirm={() => {
          if (destructiveAction === 'notes') {
            clearNotes();
          } else if (destructiveAction === 'lyrics') {
            clearLyrics();
          } else {
            restoreOriginal();
          }
        }}
      />

      {lyricsOpen && (
        <KaraokeMakerLyricsDialog
          activeLyricFocus={activeLyricFocus}
          analysisMessage={analysisMessage}
          analysisProgress={analysisProgress}
          analysisProgressIsIndeterminate={analysisProgressIsIndeterminate}
          cancelAnalysis={cancelAnalysis}
          destructiveAction={destructiveAction}
          displayedAnalysisProgress={displayedAnalysisProgress}
          draftLyricsWordCount={draftLyricsWordCount}
          lyricsDraft={lyricsDraft}
          lyricsDraftChanged={lyricsDraftChanged}
          lyricsFileName={lyricsFileName}
          lyricsInputRef={lyricsInputRef}
          lyricsProcessing={lyricsProcessing}
          project={project}
          renderLyricsModalWordInspector={renderLyricsModalWordInspector}
          renderWhisperDownloadDetails={renderWhisperDownloadDetails}
          replaceLyrics={replaceLyrics}
          selectLyricsEditorToken={selectLyricsEditorToken}
          selection={selection}
          setLyricsDraft={setLyricsDraft}
          setLyricsOpen={setLyricsOpen}
          tokens={tokens}
        />
      )}
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && whisperConsentOpen && (
        <KaraokeMakerWhisperConsent
          lyricsWorkflowActiveRef={lyricsWorkflowActiveRef}
          prepareAfterWhisperRef={prepareAfterWhisperRef}
          runWhisper={runWhisper}
          setLyricsWorkflowActive={setLyricsWorkflowActive}
          setWhisperConsentOpen={setWhisperConsentOpen}
        />
      )}
    </div>
  );
};

export default KaraokeMaker;
