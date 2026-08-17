/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ChangeEvent,
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  importLyricsIntoKaraokeMakerProject,
  karaokeMakerId,
  karaokeMakerProjectToSong,
  karaokeMakerRecordedLineRange,
  karaokeMakerTimedLineRange,
  karaokeMakerLineIsSection,
  karaokeMakerTokenBoundaryLimits,
  karaokeMakerTokenWasUserTouched,
  makerLinesFromPlainText,
  parseKaraokeMakerProject,
  recordKaraokeMakerLineRange,
  resizeKaraokeMakerTokenBoundary,
  shiftKaraokeMakerLineTailFromToken,
  shiftKaraokeMakerTimeline,
  splitKaraokeMakerWordIntoSyllables,
  touchKaraokeMakerProject,
  validateKaraokeMakerProject,
} from '../../common/karaoke/makerProject';
import {
  TKaraokeMakerExportFormat,
  exportKaraokeMaker,
  karaokeMakerExportFileName,
} from '../../common/karaoke/makerExport';
import {
  karaokeFileExtension,
  parseKaraokeText,
  readKaraokeTextFile,
} from '../../common/karaoke/files';
import { splitKaraokeWordSyllables } from '../../common/karaoke/syllables';
import { karaokeLeadNoteArticulation } from '../../common/karaoke/melodyArticulation';
import { IKaraokeSong } from '../../common/karaoke/types';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import { formatClock } from './makerFormat';
import { paintMakerCanvas } from './makerCanvasPaint';
import { useMakerCanvasGesture } from './useMakerCanvasGesture';
import {
  ICanvasLyricToken,
  ICanvasLyricWord,
  IDragState,
} from './makerCanvasTypes';
import {
  BASE_LYRIC_SECTION_TOP,
  SECTION_GROUP_HEIGHT,
  lyricSectionHeight,
  midiName,
} from './makerCanvasGeometry';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import { karaokeMakerAnalysisProgress } from './makerAnalysisProgress';
import {
  normalizedLyricsText,
  plainLyrics,
  useKaraokeMakerLyricsDraft,
} from './useKaraokeMakerLyricsDraft';
import { useKaraokeMakerSelection } from './useKaraokeMakerSelection';
import KaraokeMakerHeaderActions from './KaraokeMakerHeaderActions';
import KaraokeMakerDownloadDetails from './KaraokeMakerDownloadDetails';
import KaraokeMakerWordInspector from './KaraokeMakerWordInspector';
import KaraokeMakerTimingPopover from './KaraokeMakerTimingPopover';
import KaraokeMakerToolbarButton from './KaraokeMakerToolbarButton';
import KaraokeMakerEditTools from './KaraokeMakerEditTools';
import KaraokeMakerSpeechMemoryPanel from './KaraokeMakerSpeechMemoryPanel';
import KaraokeMakerAnalysisTools from './KaraokeMakerAnalysisTools';
import KaraokeMakerConfirmDialog, {
  TDestructiveMakerAction,
} from './KaraokeMakerConfirmDialog';
import {
  DEFAULT_PREVIEW_HEIGHT,
  DEFAULT_VIEW_MS,
  initialPreviewOpen,
  useKaraokeMakerEditorView,
} from './useKaraokeMakerEditorView';
import {
  IKaraokeMakerAnalysisResult,
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from './makerAnalysis';
import {
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  WHISPER_MODEL,
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
import { flattenTokens, replaceNote, replaceToken } from './makerProjectEdits';
import { useMakerCanvasPointer } from './useMakerCanvasPointer';
import {
  IGuidedLineCapture,
  TLineEntrySession,
  useMakerLineCapture,
} from './useMakerLineCapture';
import { IWhisperRunProfile, useMakerAnalysisRun } from './useMakerAnalysisRun';
import {
  KARAOKE_MAKER_LYRIC_LANE_COUNT,
  groupKaraokeMakerWordSyllables,
  karaokeMakerLyricFocus,
  karaokeMakerSectionGroups,
} from './makerCanvasLayout';
import { KaraokeTransportIcon } from './KaraokeTransport';
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

interface ISyllableSplitDraft {
  tokenId: string;
  word: string;
  cutPoints: number[];
}

interface ISentenceAuditionState {
  startMs: number;
  endMs: number;
  timerId: number;
}

const MIN_VIEW_MS = 650;
// Twelve seconds keeps authored lyrics readable on first open; the overview
// handles still expose the entire song and let the user zoom further out.
const LYRIC_SECTION_HEIGHT = lyricSectionHeight(KARAOKE_MAKER_LYRIC_LANE_COUNT);

const karaokeMakerWordTokensFor = (
  project: IKaraokeMakerProject,
  tokenId: string,
): IKaraokeMakerToken[] => {
  const line = project.lyrics.lines.find((candidate) =>
    candidate.tokens.some((token) => token.id === tokenId),
  );
  if (!line) {
    return [];
  }
  const selectedIndex = line.tokens.findIndex((token) => token.id === tokenId);
  const precedingWordOffset = line.tokens
    .slice(0, selectedIndex + 1)
    .reverse()
    .findIndex((token) => token.startsWord !== false);
  const firstIndex =
    precedingWordOffset < 0
      ? 0
      : Math.max(0, selectedIndex - precedingWordOffset);
  const followingWordOffset = line.tokens
    .slice(firstIndex + 1)
    .findIndex((token) => token.startsWord !== false);
  const lastIndex =
    followingWordOffset < 0
      ? line.tokens.length
      : firstIndex + followingWordOffset + 1;
  return line.tokens.slice(firstIndex, lastIndex);
};

const syllablesAtCutPoints = (
  word: string,
  cutPoints: readonly number[],
): string[] => {
  const characters = Array.from(word);
  const boundaries = [
    0,
    ...[...new Set(cutPoints)]
      .filter((point) => point > 0 && point < characters.length)
      .sort((left, right) => left - right),
    characters.length,
  ];
  return boundaries
    .slice(0, -1)
    .map((start, index) =>
      characters.slice(start, boundaries[index + 1]).join(''),
    )
    .filter(Boolean);
};

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

  const effectiveDurationMs = Math.max(
    1_000,
    durationMs || project.audio.durationMs || DEFAULT_VIEW_MS,
  );
  const minimumViewDurationMs = Math.min(MIN_VIEW_MS, effectiveDurationMs);
  const maximumViewDurationMs = Math.max(
    minimumViewDurationMs,
    effectiveDurationMs,
  );
  const visibleViewDurationMs = Math.max(
    minimumViewDurationMs,
    Math.min(maximumViewDurationMs, viewDurationMs),
  );
  const maximumViewStartMs = Math.max(
    0,
    effectiveDurationMs - visibleViewDurationMs,
  );
  const canvasSectionGroups = useMemo(
    () =>
      karaokeMakerSectionGroups(
        project.lyrics.lines.flatMap((line) =>
          karaokeMakerLineIsSection(line) && line.startMs !== undefined
            ? [
                {
                  id: line.id,
                  text: line.tokens
                    .map((token) => token.text.trim())
                    .filter(Boolean)
                    .join(' '),
                  startMs: line.startMs,
                },
              ]
            : [],
        ),
        effectiveDurationMs,
      ),
    [effectiveDurationMs, project.lyrics.lines],
  );
  const lyricSectionTop =
    BASE_LYRIC_SECTION_TOP +
    (canvasSectionGroups.length ? SECTION_GROUP_HEIGHT : 0);
  const headerHeight = lyricSectionTop + LYRIC_SECTION_HEIGHT + 10;
  const lyricLines = useMemo(
    () =>
      project.lyrics.lines.filter(
        (line) => !karaokeMakerLineIsSection(line) && line.tokens.length > 0,
      ),
    [project.lyrics.lines],
  );
  const selectedLyricLineId = useMemo(() => {
    if (selection?.kind !== 'word') {
      return undefined;
    }
    return lyricLines.find((line) =>
      line.tokens.some((token) => token.id === selection.id),
    )?.id;
  }, [lyricLines, selection]);
  const userTouchedWordCount = useMemo(
    () => tokens.filter(karaokeMakerTokenWasUserTouched).length,
    [tokens],
  );
  const canvasLyricTokens = useMemo(
    () =>
      project.lyrics.lines
        .flatMap((line, lineIndex): ICanvasLyricToken[] => {
          const isSection = karaokeMakerLineIsSection(line);
          if (isSection) {
            return [];
          }
          const timedTokens = line.tokens.filter(
            (token) => token.startMs !== undefined && token.endMs !== undefined,
          );
          const lineStartMs = timedTokens.length
            ? Math.min(...timedTokens.map((token) => token.startMs as number))
            : (line.startMs ?? Number.POSITIVE_INFINITY);
          const lineEndMs = timedTokens.length
            ? Math.max(...timedTokens.map((token) => token.endMs as number))
            : (line.endMs ?? line.startMs ?? Number.NEGATIVE_INFINITY);
          return line.tokens.map((originalToken, tokenIndex) => ({
            token: originalToken,
            lineIndex,
            tokenIndex,
            lineStartMs,
            lineEndMs,
            isSection,
          }));
        })
        .sort(
          (left, right) =>
            (left.token.startMs ?? Number.POSITIVE_INFINITY) -
            (right.token.startMs ?? Number.POSITIVE_INFINITY),
        ),
    [project.lyrics.lines],
  );
  const canvasLyricWords = useMemo(() => {
    const tokensByLine = new Map<number, ICanvasLyricToken[]>();
    canvasLyricTokens.forEach((entry) => {
      const lineTokens = tokensByLine.get(entry.lineIndex) ?? [];
      lineTokens.push(entry);
      tokensByLine.set(entry.lineIndex, lineTokens);
    });
    return [...tokensByLine.values()]
      .flatMap((lineTokens): ICanvasLyricWord[] => {
        if (!lineTokens.length) {
          return [];
        }
        const orderedLineTokens = [...lineTokens].sort(
          (left, right) => left.tokenIndex - right.tokenIndex,
        );
        const [{ isSection }] = orderedLineTokens;
        const groups: ICanvasLyricToken[][] = groupKaraokeMakerWordSyllables(
          orderedLineTokens
            .filter(
              ({ token }) =>
                token.startMs !== undefined && token.endMs !== undefined,
            )
            .map((entry) => ({
              ...entry,
              startsWord: entry.token.startsWord,
            })),
        );
        return groups.flatMap((syllables, wordIndex): ICanvasLyricWord[] => {
          const timed = syllables.filter(
            ({ token }) =>
              token.startMs !== undefined && token.endMs !== undefined,
          );
          if (!timed.length) {
            return [];
          }
          return [
            {
              id: timed[0].token.id,
              text: timed.map(({ token }) => token.text.trim()).join(''),
              syllables: timed,
              lineIndex: timed[0].lineIndex,
              wordIndex,
              lineStartMs: timed[0].lineStartMs,
              lineEndMs: timed[0].lineEndMs,
              startMs: Math.min(
                ...timed.map(({ token }) => token.startMs as number),
              ),
              endMs: Math.max(
                ...timed.map(({ token }) => token.endMs as number),
              ),
              isSection,
            },
          ];
        });
      })
      .sort(
        (left, right) =>
          left.startMs - right.startMs || left.lineIndex - right.lineIndex,
      );
  }, [canvasLyricTokens]);
  const activeLyricFocus = useMemo(
    () =>
      karaokeMakerLyricFocus(
        canvasLyricTokens.flatMap(
          ({ token, lineIndex, lineStartMs, lineEndMs, isSection }) =>
            isSection ||
            token.startMs === undefined ||
            token.endMs === undefined
              ? []
              : [
                  {
                    id: token.id,
                    lineIndex,
                    lineStartMs,
                    lineEndMs,
                    startMs: token.startMs,
                    endMs: token.endMs,
                  },
                ],
        ),
        visualPlayheadMs,
      ),
    [canvasLyricTokens, visualPlayheadMs],
  );
  const activeLyricWordId = useMemo(
    () =>
      activeLyricFocus?.tokenId
        ? canvasLyricWords.find((word) =>
            word.syllables.some(
              ({ token }) => token.id === activeLyricFocus.tokenId,
            ),
          )?.id
        : undefined,
    [activeLyricFocus?.tokenId, canvasLyricWords],
  );
  if (wordFocusAnimationRef.current.tokenId !== activeLyricWordId) {
    wordFocusAnimationRef.current = {
      tokenId: activeLyricWordId,
      startedAt: performance.now(),
    };
  }
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

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const host = canvasHostRef.current;
    if (!canvas || !host) {
      return;
    }
    // CSS owns the visible canvas size. Writing the measured size back as an
    // inline width trapped the editor at its pre-fullscreen width, because the
    // next ResizeObserver pass could only measure that same locked width.
    // Measure the host instead and resize only the backing bitmap.
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    const width = Math.max(320, host.clientWidth);
    const height = Math.max(260, canvas.clientHeight);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    paintMakerCanvas({
      context,
      ratio,
      width,
      height,
      headerHeight,
      lyricSectionTop,
      project,
      selection,
      selectedNoteIds,
      canvasLyricWords,
      canvasSectionGroups,
      activeLyricFocus,
      activeLyricWordId,
      hoveredEditHandle,
      controlLinkMode,
      viewStartMs,
      visibleViewDurationMs,
      visualPlayheadMs,
      effectiveDurationMs,
      hitRegionsRef: gesture.hitRegions,
      selectionBoxRef: gesture.selectionBox,
      notePaintDraftRef: gesture.notePaintDraft,
      noteLinkDragRef: gesture.noteLinkDrag,
      wordFocusAnimationRef,
    });
  }, [
    gesture.hitRegions,
    gesture.noteLinkDrag,
    gesture.notePaintDraft,
    gesture.selectionBox,
    activeLyricFocus,
    activeLyricWordId,
    canvasSectionGroups,
    canvasLyricWords,
    controlLinkMode,
    effectiveDurationMs,
    headerHeight,
    lyricSectionTop,
    visualPlayheadMs,
    project,
    hoveredEditHandle,
    selection,
    selectedNoteIds,
    visibleViewDurationMs,
    viewStartMs,
  ]);

  renderCanvasRef.current = renderCanvas;

  useEffect(() => {
    if (!activeLyricWordId) {
      return undefined;
    }
    let animationFrame = 0;
    const animateFocus = (now: number) => {
      renderCanvasRef.current();
      if (now - wordFocusAnimationRef.current.startedAt < 180) {
        animationFrame = window.requestAnimationFrame(animateFocus);
      }
    };
    animationFrame = window.requestAnimationFrame(animateFocus);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeLyricWordId]);

  useEffect(() => {
    renderCanvas();
    const host = canvasHostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(renderCanvas);
    observer.observe(host);
    return () => observer.disconnect();
  }, [renderCanvas]);

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
  const openLyricsEditor = () => {
    openLyricsDraft(projectRef.current);
    setDestructiveAction(undefined);
    const preferredToken =
      tokens.find((token) => token.id === activeLyricFocus?.tokenId) ??
      tokens[0];
    if (preferredToken) {
      setSelection({ kind: 'word', id: preferredToken.id });
    }
  };

  const clearNotes = () => {
    commit((current) => ({
      ...current,
      melody: { ...current.melody, source: 'manual', notes: [] },
    }));
    setSelection(undefined);
    setSelectedNoteIds(new Set());
    setDestructiveAction(undefined);
    setNotice(t('karaoke.maker.notesCleared'));
  };

  const clearLyrics = () => {
    commit((current) => ({
      ...current,
      lyrics: { ...current.lyrics, source: 'manual', lines: [] },
      analysis: {
        ...current.analysis,
        whisperPasses: 0,
        whisperAlignmentVersion: undefined,
      },
      melody: {
        ...current.melody,
        notes: current.melody.notes.map((note) => ({
          ...note,
          tokenId: undefined,
        })),
      },
    }));
    setLyricsDraft('');
    setLyricsFileName(undefined);
    setSelection(undefined);
    setDestructiveAction(undefined);
    setNotice(t('karaoke.maker.lyricsCleared'));
  };

  /**
   * Throw the editing away and rebuild the project the import produced.
   *
   * Undoable like the other destructive actions: `commit` leaves the discarded
   * work one Undo away, which is what the confirmation promises.
   *
   * The saved draft is deleted rather than left for autosave to overwrite.
   * Autosave does write the pristine project a moment later, but a user who
   * closes the Maker inside that moment would otherwise reopen onto the very
   * work they just discarded.
   */
  // The project half of Restore is the hook's; what is left here is the view
  // state that has to follow it back.
  const restoreOriginal = () => {
    const original = restoreOriginalProject();
    setLyricsDraft(plainLyrics(original));
    setLyricsFileName(undefined);
    setSelection(undefined);
    setSelectedNoteIds(new Set());
    setDestructiveAction(undefined);
    setNotice(t('karaoke.maker.restored'));
  };

  const selectLyricsFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      const contents = await readKaraokeTextFile(file);
      let text = contents;
      try {
        const parsed = parseKaraokeText(file.name, contents);
        text = parsed.lines
          .map((line) =>
            line.tokens
              .reduce(
                (lineText, token) =>
                  `${lineText}${
                    lineText && token.startsWord !== false ? ' ' : ''
                  }${token.text}`,
                '',
              )
              .trim(),
          )
          .filter(Boolean)
          .join('\n');
      } catch {
        // Plain unsynchronised text is already a valid lyric reference.
      }
      setLyricsDraft(text);
      setLyricsFileName(file.name);
      setNotice(t('karaoke.maker.lyricsFileLoaded', { file: file.name }));
    } catch (error) {
      setNotice(localizeMakerError(error, 'import'));
    }
  };

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

  const splitSelectedLyricsWord = () => {
    const tokenId = selectedToken?.id ?? selectedNote?.tokenId;
    if (!tokenId) {
      return;
    }
    const wordTokens = karaokeMakerWordTokensFor(project, tokenId);
    const word = wordTokens.map((token) => token.text).join('');
    const characters = Array.from(word);
    if (characters.length < 2) {
      return;
    }
    const existingCutPoints = wordTokens
      .slice(0, -1)
      .reduce<number[]>((points, token) => {
        const previous = points[points.length - 1] ?? 0;
        points.push(previous + Array.from(token.text).length);
        return points;
      }, []);
    const suggestedSyllables = splitKaraokeWordSyllables(
      word,
      project.lyrics.language ?? 'en',
    );
    const suggestedCutPoints = suggestedSyllables
      .slice(0, -1)
      .reduce<number[]>((points, syllable) => {
        const previous = points[points.length - 1] ?? 0;
        points.push(previous + Array.from(syllable).length);
        return points;
      }, []);
    setSyllableSplitDraft({
      tokenId: wordTokens[0].id,
      word,
      cutPoints:
        existingCutPoints.length > 0 ? existingCutPoints : suggestedCutPoints,
    });
  };

  const toggleSyllableCutPoint = (cutPoint: number) => {
    setSyllableSplitDraft((current) => {
      if (!current) {
        return current;
      }
      const next = new Set(current.cutPoints);
      if (next.has(cutPoint)) {
        next.delete(cutPoint);
      } else {
        next.add(cutPoint);
      }
      return { ...current, cutPoints: [...next].sort((a, b) => a - b) };
    });
  };

  const applySyllableSplit = () => {
    if (!syllableSplitDraft) {
      return;
    }
    const syllables = syllablesAtCutPoints(
      syllableSplitDraft.word,
      syllableSplitDraft.cutPoints,
    );
    if (syllables.length < 2) {
      return;
    }
    commit((current) =>
      splitKaraokeMakerWordIntoSyllables(
        current,
        syllableSplitDraft.tokenId,
        current.lyrics.language ?? 'en',
        syllables,
      ),
    );
    setSelection({ kind: 'word', id: syllableSplitDraft.tokenId });
    setSyllableSplitDraft(undefined);
  };

  const splitNote = () => {
    if (!selectedNote) {
      return;
    }
    const splitAt =
      playheadMs > selectedNote.startMs + 40 &&
      playheadMs < selectedNote.endMs - 40
        ? playheadMs
        : (selectedNote.startMs + selectedNote.endMs) / 2;
    const second: IKaraokeMakerNote = {
      ...selectedNote,
      id: karaokeMakerId('note'),
      startMs: splitAt,
      source: 'manual',
    };
    commit((current) => {
      const first = replaceNote(current, selectedNote.id, (note) => ({
        ...note,
        endMs: splitAt,
        source: 'manual',
      }));
      return {
        ...first,
        melody: {
          ...first.melody,
          source: 'manual',
          notes: [...first.melody.notes, second],
        },
      };
    });
    setSelection({ kind: 'note', id: second.id });
  };

  const deleteSelection = useCallback(() => {
    if (!selection) {
      return;
    }
    if (selection.kind === 'note') {
      const noteIds = selectedNoteIds.size
        ? selectedNoteIds
        : new Set([selection.id]);
      commit((current) => ({
        ...current,
        melody: {
          ...current.melody,
          source: 'manual',
          notes: current.melody.notes.filter((note) => !noteIds.has(note.id)),
        },
      }));
    } else {
      commit((current) => ({
        ...current,
        lyrics: {
          ...current.lyrics,
          lines: current.lyrics.lines
            .map((line) => ({
              ...line,
              tokens: line.tokens.filter((token) => token.id !== selection.id),
            }))
            .filter((line) => line.tokens.length),
        },
        melody: {
          ...current.melody,
          notes: current.melody.notes.map((note) =>
            note.tokenId === selection.id
              ? { ...note, tokenId: undefined }
              : note,
          ),
        },
      }));
    }
    setSelection(undefined);
    setSelectedNoteIds(new Set());
  }, [commit, selectedNoteIds, selection, setSelectedNoteIds, setSelection]);

  const detachSelectedNotes = useCallback(() => {
    const noteIds = new Set(selectedNoteIds);
    if (!noteIds.size && selection?.kind === 'note') {
      noteIds.add(selection.id);
    }
    if (!noteIds.size) {
      return;
    }
    commit((current) => ({
      ...current,
      melody: {
        ...current.melody,
        source: 'manual',
        notes: current.melody.notes.map((note) =>
          noteIds.has(note.id)
            ? { ...note, tokenId: undefined, source: 'manual' as const }
            : note,
        ),
      },
    }));
  }, [commit, selectedNoteIds, selection]);

  const copySelectedNotes = useCallback(() => {
    const noteIds = new Set(selectedNoteIds);
    if (!noteIds.size && selection?.kind === 'note') {
      noteIds.add(selection.id);
    }
    if (!noteIds.size) {
      return;
    }
    setCopiedNotes(
      project.melody.notes
        .filter((note) => noteIds.has(note.id))
        .sort((left, right) => left.startMs - right.startMs)
        .map((note) => ({ ...note })),
    );
  }, [
    project.melody.notes,
    selectedNoteIds,
    selection?.id,
    selection?.kind,
    setCopiedNotes,
  ]);

  const pasteCopiedNotes = useCallback(() => {
    if (!copiedNotes.length) {
      return;
    }
    const anchorMs = Math.max(
      0,
      Math.min(effectiveDurationMs, readPlayheadMs?.() ?? playheadMs),
    );
    const sourceStartMs = Math.min(...copiedNotes.map((note) => note.startMs));
    const pastedNotes = copiedNotes.flatMap((note) => {
      const startMs = anchorMs + (note.startMs - sourceStartMs);
      if (startMs >= effectiveDurationMs) {
        return [];
      }
      const endMs = Math.min(
        effectiveDurationMs,
        Math.max(startMs + 1, startMs + (note.endMs - note.startMs)),
      );
      return [
        {
          ...note,
          id: karaokeMakerId('note'),
          tokenId: undefined,
          startMs,
          endMs,
          source: 'manual' as const,
        },
      ];
    });
    if (!pastedNotes.length) {
      return;
    }
    commit((current) => {
      return {
        ...current,
        melody: {
          ...current.melody,
          source: 'manual',
          notes: [...current.melody.notes, ...pastedNotes].sort(
            (left, right) => left.startMs - right.startMs,
          ),
        },
      };
    });
    setSelectedNoteIds(new Set(pastedNotes.map((note) => note.id)));
    setSelection({ kind: 'note', id: pastedNotes[0].id });
    setNotice(
      pastedNotes.length === 1
        ? t('karaoke.maker.notePasted')
        : t('karaoke.maker.notesPasted', { count: pastedNotes.length }),
    );
  }, [
    commit,
    copiedNotes,
    effectiveDurationMs,
    playheadMs,
    readPlayheadMs,
    setNotice,
    setSelectedNoteIds,
    setSelection,
    t,
  ]);

  useEffect(() => {
    const copyOrPasteNotes = (event: KeyboardEvent) => {
      if (
        lineEntryMode ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.matches(
            'input, textarea, select, [contenteditable="true"]',
          ))
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'c' && selection?.kind === 'note') {
        event.preventDefault();
        event.stopImmediatePropagation();
        copySelectedNotes();
      } else if (key === 'v' && copiedNotes.length) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pasteCopiedNotes();
      }
    };
    window.addEventListener('keydown', copyOrPasteNotes, true);
    return () => window.removeEventListener('keydown', copyOrPasteNotes, true);
  }, [
    copiedNotes.length,
    copySelectedNotes,
    lineEntryMode,
    pasteCopiedNotes,
    selection?.kind,
  ]);

  useEffect(() => {
    const deleteSelectedNotes = (event: KeyboardEvent) => {
      if (
        lineEntryMode ||
        selection?.kind !== 'note' ||
        (event.key !== 'Delete' && event.key !== 'Backspace') ||
        (event.target instanceof HTMLElement &&
          event.target.matches(
            'button, input, textarea, select, [contenteditable="true"]',
          ))
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      deleteSelection();
    };
    window.addEventListener('keydown', deleteSelectedNotes, true);
    return () =>
      window.removeEventListener('keydown', deleteSelectedNotes, true);
  }, [deleteSelection, lineEntryMode, selection?.kind]);

  const exportProject = async (format: TKaraokeMakerExportFormat) => {
    setExportOpen(false);
    if (format !== 'project' && !project.meta.rightsConfirmed) {
      setNotice(t('karaoke.maker.rightsRequired'));
      return;
    }
    try {
      const output = exportKaraokeMaker(project, format);
      let formatName = t('karaoke.maker.exportLrc');
      if (format === 'project') {
        formatName = t('karaoke.maker.exportProject');
      } else if (format === 'ultrastar') {
        formatName = t('karaoke.maker.exportUltraStar');
      } else if (format === 'elrc') {
        formatName = t('karaoke.maker.exportElrc');
      }
      const result = await window.electron.ipcRenderer.exportKaraokeMakerFile({
        fileName: karaokeMakerExportFileName(project, format),
        contents: output.contents,
        formatName,
        extensions: [output.extension],
      });
      if (!result.canceled) {
        setNotice(
          t('karaoke.maker.exported', {
            file: result.filePath ?? t('karaoke.maker.exportFallback'),
          }),
        );
      }
    } catch (error) {
      setNotice(localizeMakerError(error, 'export'));
    }
  };

  const selectVocalStem = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    setAnalysisFile(file);
    setNotice(t('karaoke.maker.analysisSource', { file: file.name }));
  };

  const openProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      if (file.size > 16 * 1024 * 1024) {
        setNotice(t('karaoke.maker.projectTooLarge'));
        return;
      }
      const contents = await readKaraokeTextFile(file);
      const extension = karaokeFileExtension(file.name);
      const isProjectFile =
        extension === 'json' || contents.trimStart().startsWith('{');
      let imported: IKaraokeMakerProject;
      if (isProjectFile) {
        const restored = parseKaraokeMakerProject(contents);
        imported = {
          ...restored,
          title:
            restored.title === 'Untitled karaoke'
              ? t('karaoke.maker.untitled')
              : restored.title,
          audio: { ...restored.audio, ...project.audio },
        };
      } else {
        imported = importLyricsIntoKaraokeMakerProject(
          project,
          parseKaraokeText(file.name, contents),
        );
      }
      setProject(imported);
      clearHistory();
      const importedView = readKaraokeMakerEditorView(imported.id);
      setSelection(importedView?.selection);
      setViewStartMs(importedView?.viewStartMs ?? 0);
      setViewDurationMs(importedView?.viewDurationMs ?? DEFAULT_VIEW_MS);
      setFollowViewport(importedView?.followViewport ?? true);
      setPreviewOpen(importedView?.previewOpen ?? initialPreviewOpen());
      setPreviewTextSize(importedView?.previewTextSize ?? 100);
      setPreviewHeight(importedView?.previewHeight ?? DEFAULT_PREVIEW_HEIGHT);
      setTimingScope(importedView?.timingScope ?? 'all');
      setLyricsDraft(plainLyrics(imported));
      setNotice(
        isProjectFile
          ? t('karaoke.maker.projectLoaded')
          : t('karaoke.maker.karaokeImported'),
      );
    } catch (error) {
      setNotice(localizeMakerError(error, 'import'));
    }
  };

  const noteKindLabel = (kind: IKaraokeMakerNote['kind']): string => {
    if (kind === 'normal') {
      return t('karaoke.maker.noteNormal');
    }
    if (kind === 'golden') {
      return t('karaoke.maker.noteGolden');
    }
    return t('karaoke.maker.noteFree');
  };

  const updateSelectedTokenTiming = (update: {
    text?: string;
    startMs?: number;
    durationMs?: number;
  }) => {
    if (!selectedToken) {
      return;
    }
    commit((current) => {
      let nextProject = current;
      if (update.text !== undefined && update.text.trim()) {
        nextProject = replaceToken(nextProject, selectedToken.id, (token) => ({
          ...token,
          text: update.text?.trim().slice(0, 2_000) ?? token.text,
          source: 'manual',
        }));
      }
      let currentToken = flattenTokens(nextProject).find(
        (token) => token.id === selectedToken.id,
      );
      if (
        currentToken?.startMs !== undefined &&
        currentToken.endMs !== undefined
      ) {
        if (Number.isFinite(update.startMs)) {
          nextProject = resizeKaraokeMakerTokenBoundary(
            nextProject,
            currentToken.id,
            'start',
            update.startMs as number,
          );
          currentToken = flattenTokens(nextProject).find(
            (token) => token.id === selectedToken.id,
          );
        }
        if (
          Number.isFinite(update.durationMs) &&
          currentToken?.startMs !== undefined
        ) {
          nextProject = resizeKaraokeMakerTokenBoundary(
            nextProject,
            currentToken.id,
            'end',
            currentToken.startMs + (update.durationMs as number),
          );
        }
        return nextProject;
      }

      const line = nextProject.lyrics.lines.find((candidate) =>
        candidate.tokens.some((token) => token.id === selectedToken.id),
      );
      const tokenIndex =
        line?.tokens.findIndex((token) => token.id === selectedToken.id) ?? -1;
      const previousToken =
        tokenIndex > 0 ? line?.tokens[tokenIndex - 1] : undefined;
      const nextToken =
        line && tokenIndex >= 0 && tokenIndex + 1 < line.tokens.length
          ? line.tokens[tokenIndex + 1]
          : undefined;
      const lineRange = line ? karaokeMakerTimedLineRange(line) : undefined;
      return replaceToken(nextProject, selectedToken.id, (token) => {
        const currentStart = token.startMs ?? Math.max(0, playheadMs);
        const currentEnd = token.endMs ?? currentStart + 400;
        const requestedStart = Number.isFinite(update.startMs)
          ? update.startMs
          : currentStart;
        const requestedDuration = Number.isFinite(update.durationMs)
          ? update.durationMs
          : currentEnd - currentStart;
        const minimumStart = Math.max(
          lineRange?.startMs ?? 0,
          previousToken?.endMs ?? previousToken?.startMs ?? 0,
        );
        const maximumEnd = Math.min(
          lineRange?.endMs ?? effectiveDurationMs,
          nextToken?.startMs ?? nextToken?.endMs ?? effectiveDurationMs,
        );
        const nextStart = Math.max(
          minimumStart,
          Math.min(maximumEnd - 20, requestedStart ?? currentStart),
        );
        const nextDuration = Math.min(
          Math.max(20, maximumEnd - nextStart),
          Math.max(20, requestedDuration ?? currentEnd - currentStart),
        );
        return {
          ...token,
          startMs: nextStart,
          endMs: Math.min(maximumEnd, nextStart + nextDuration),
          source: 'manual',
          timingLocked: true,
        };
      });
    });
  };

  const auditionLyricsToken = useCallback(
    (token: IKaraokeMakerToken) => {
      if (token.startMs === undefined) {
        return;
      }
      cancelAudibleInteractions();
      const startMs = Math.max(0, Math.min(effectiveDurationMs, token.startMs));
      const endMs = Math.max(
        startMs + 20,
        Math.min(effectiveDurationMs, token.endMs ?? startMs + 400),
      );
      onSeek(startMs);
      Promise.resolve(onPlay()).catch(() => undefined);
      wordAuditionTimerRef.current = window.setTimeout(() => {
        wordAuditionTimerRef.current = undefined;
        onPause();
      }, endMs - startMs);
    },
    [cancelAudibleInteractions, effectiveDurationMs, onPause, onPlay, onSeek],
  );

  const selectLyricsEditorToken = (token: IKaraokeMakerToken) => {
    setSelection({ kind: 'word', id: token.id });
    if (token.startMs !== undefined) {
      setViewStartMs(
        Math.max(
          0,
          Math.min(
            maximumViewStartMs,
            token.startMs - visibleViewDurationMs * 0.3,
          ),
        ),
      );
      auditionLyricsToken(token);
    }
  };

  const moveLyricsEditorSelection = (direction: -1 | 1) => {
    const currentIndex = selectedToken
      ? tokens.findIndex((token) => token.id === selectedToken.id)
      : -1;
    const nextIndex = Math.max(
      0,
      Math.min(tokens.length - 1, currentIndex + direction),
    );
    const nextToken = tokens[nextIndex];
    if (nextToken) {
      selectLyricsEditorToken(nextToken);
    }
  };

  const renderSelectedWordTimingSliders = (idPrefix: string) => {
    if (!selectedTokenTimingControls) {
      return (
        <div className="karaoke-maker__word-timing-sliders is-disabled">
          <span>{t('karaoke.maker.untimed')}</span>
          <small>{t('karaoke.maker.wordTimingSliderHint')}</small>
        </div>
      );
    }
    const positionMinimum = Math.round(
      selectedTokenTimingControls.minimumStartMs,
    );
    const positionMaximum = Math.max(
      positionMinimum,
      Math.round(selectedTokenTimingControls.maximumStartMs),
    );
    const durationMaximum = Math.max(
      selectedTokenTimingControls.minimumDurationMs,
      Math.round(selectedTokenTimingControls.maximumDurationMs),
    );
    return (
      <div className="karaoke-maker__word-timing-sliders">
        <label htmlFor={`${idPrefix}-position`}>
          <span>
            {t('karaoke.maker.wordPosition')}
            <output>{formatClock(selectedTokenTimingControls.startMs)}</output>
          </span>
          <input
            id={`${idPrefix}-position`}
            type="range"
            min={positionMinimum}
            max={positionMaximum}
            step={10}
            value={Math.round(selectedTokenTimingControls.startMs)}
            disabled={!selectedTokenTimingControls.canResizeStart}
            onChange={(event) =>
              updateSelectedTokenTiming({ startMs: Number(event.target.value) })
            }
          />
        </label>
        <label htmlFor={`${idPrefix}-length`}>
          <span>
            {t('karaoke.maker.wordDuration')}
            <output>
              {Math.round(selectedTokenTimingControls.durationMs)} ms
            </output>
          </span>
          <input
            id={`${idPrefix}-length`}
            type="range"
            min={selectedTokenTimingControls.minimumDurationMs}
            max={durationMaximum}
            step={10}
            value={Math.max(
              selectedTokenTimingControls.minimumDurationMs,
              Math.min(
                durationMaximum,
                Math.round(selectedTokenTimingControls.durationMs),
              ),
            )}
            disabled={!selectedTokenTimingControls.canResizeEnd}
            onChange={(event) =>
              updateSelectedTokenTiming({
                durationMs: Number(event.target.value),
              })
            }
          />
        </label>
        <small>{t('karaoke.maker.wordTimingSliderHint')}</small>
      </div>
    );
  };

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

  const renderSelectionInfo = () => {
    if (syllableSplitDraft) {
      const characters = Array.from(syllableSplitDraft.word);
      const syllables = syllablesAtCutPoints(
        syllableSplitDraft.word,
        syllableSplitDraft.cutPoints,
      );
      const characterEntries = characters.reduce<
        Array<{ character: string; cutPoint: number; key: string }>
      >((entries, character) => {
        const cutPoint = entries.length + 1;
        return [
          ...entries,
          {
            character,
            cutPoint,
            key: `${characters.slice(0, cutPoint).join('')}|${characters
              .slice(cutPoint)
              .join('')}`,
          },
        ];
      }, []);
      const syllableEntries = syllables.reduce<
        Array<{ key: string; syllable: string; showDivider: boolean }>
      >(
        (entries, syllable) => [
          ...entries,
          {
            key: `${entries.map((entry) => entry.syllable).join('')}|${syllable}`,
            syllable,
            showDivider: entries.length > 0,
          },
        ],
        [],
      );
      return (
        <div className="karaoke-maker__syllable-editor">
          <div className="karaoke-maker__syllable-editor-copy">
            <span>{t('karaoke.maker.syllableEditorEyebrow')}</span>
            <strong>
              {t('karaoke.maker.syllableEditorTitle', {
                word: syllableSplitDraft.word,
              })}
            </strong>
            <p>{t('karaoke.maker.syllableEditorHint')}</p>
          </div>
          <div
            className="karaoke-maker__syllable-cuts"
            aria-label={t('karaoke.maker.syllableEditorTitle', {
              word: syllableSplitDraft.word,
            })}
          >
            {characterEntries.map(({ character, cutPoint, key }) => (
              <Fragment key={key}>
                <span>{character}</span>
                {cutPoint < characters.length && (
                  <button
                    type="button"
                    className={
                      syllableSplitDraft.cutPoints.includes(cutPoint)
                        ? 'is-cut'
                        : undefined
                    }
                    aria-pressed={syllableSplitDraft.cutPoints.includes(
                      cutPoint,
                    )}
                    aria-label={t('karaoke.maker.syllableSplitPoint', {
                      text: characters.slice(0, cutPoint).join(''),
                    })}
                    onClick={() => toggleSyllableCutPoint(cutPoint)}
                  >
                    <span />
                  </button>
                )}
              </Fragment>
            ))}
          </div>
          <div className="karaoke-maker__syllable-preview">
            <span>{t('karaoke.maker.syllableEditorPreview')}</span>
            <output>
              {syllableEntries.map(({ key, syllable, showDivider }) => (
                <Fragment key={key}>
                  {showDivider && <i aria-hidden="true">·</i>}
                  <strong>{syllable}</strong>
                </Fragment>
              ))}
            </output>
          </div>
          <div className="karaoke-maker__syllable-actions">
            <button
              type="button"
              onClick={() => setSyllableSplitDraft(undefined)}
            >
              {t('karaoke.maker.cancel')}
            </button>
            <button
              type="button"
              className="is-primary"
              disabled={syllables.length < 2}
              onClick={applySyllableSplit}
            >
              <KaraokeMakerToolIcon name="split" />
              {t('karaoke.maker.applySyllableSplit')}
            </button>
          </div>
        </div>
      );
    }
    if (selectedNoteIds.size > 1) {
      const selectedNotes = project.melody.notes.filter((note) =>
        selectedNoteIds.has(note.id),
      );
      const hasAttachedNotes = selectedNotes.some((note) => note.tokenId);
      return (
        <div className="karaoke-maker__note-selection-inspector">
          <span>
            <strong>{selectedNoteIds.size}</strong>
            {t('karaoke.maker.notesSelected')}
          </span>
          {hasAttachedNotes && (
            <button type="button" onClick={detachSelectedNotes}>
              <KaraokeMakerToolIcon name="detach" />
              {t('karaoke.maker.detachNotes')}
            </button>
          )}
          <button type="button" onClick={deleteSelection}>
            <KaraokeMakerToolIcon name="remove" />
            {t('karaoke.maker.delete')}
          </button>
          <span className="karaoke-maker__note-link-help">
            {t('karaoke.maker.noteAttachHelp')}{' '}
            {t('karaoke.maker.noteCopyHelp')}
          </span>
        </div>
      );
    }
    if (selectedNote) {
      return (
        <div className="karaoke-maker__note-inspector">
          <div className="karaoke-maker__note-inspector-summary">
            <strong>{midiName(selectedNote.targetMidi)}</strong>
            <span>
              {formatClock(selectedNote.startMs)} →{' '}
              {formatClock(selectedNote.endMs)}
            </span>
            <button
              type="button"
              className="karaoke-maker__audition"
              onPointerDown={() =>
                noteAudition.play(
                  selectedNote.targetMidi,
                  karaokeLeadNoteArticulation(selectedNote).durationMs,
                )
              }
              onPointerUp={() => noteAudition.stop()}
              onPointerCancel={() => noteAudition.stop()}
              onPointerLeave={() => noteAudition.stop()}
              title={t('karaoke.maker.hearNote')}
            >
              ◖)) {t('karaoke.maker.hearNote')}
            </button>
          </div>
          <div
            className="karaoke-maker__kind-picker"
            aria-label={t('karaoke.maker.addNote')}
          >
            {(['normal', 'golden', 'free'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={selectedNote.kind === kind ? 'is-active' : undefined}
                aria-pressed={selectedNote.kind === kind}
                onClick={() =>
                  commit((current) =>
                    replaceNote(current, selectedNote.id, (note) => ({
                      ...note,
                      kind,
                    })),
                  )
                }
              >
                {noteKindLabel(kind)}
              </button>
            ))}
          </div>
          <div className="karaoke-maker__note-inspector-link">
            <span className="karaoke-maker__note-link">
              {selectedNoteToken
                ? t('karaoke.maker.attachedTo', {
                    word: selectedNoteToken.text,
                  })
                : t('karaoke.maker.noteUnattached')}
            </span>
            {selectedNoteToken && (
              <button type="button" onClick={detachSelectedNotes}>
                <KaraokeMakerToolIcon name="detach" />
                {t('karaoke.maker.detachNotes')}
              </button>
            )}
            {selectedNoteToken && (
              <button type="button" onClick={splitSelectedLyricsWord}>
                <KaraokeMakerToolIcon name="split" />
                {t('karaoke.maker.splitWordSyllables')}
              </button>
            )}
            <span className="karaoke-maker__note-link-help">
              {t('karaoke.maker.noteAttachHelp')}{' '}
              {t('karaoke.maker.noteCopyHelp')}
            </span>
          </div>
        </div>
      );
    }
    if (selectedToken) {
      const timing =
        selectedToken.startMs === undefined
          ? t('karaoke.maker.untimed')
          : `${formatClock(selectedToken.startMs)} → ${formatClock(selectedToken.endMs ?? selectedToken.startMs)}`;
      return (
        <div className="karaoke-maker__word-inspector">
          <div className="karaoke-maker__word-inspector-identity">
            <span>{t('karaoke.maker.lyricsSelectedWord')}</span>
            <div>
              <strong className="karaoke-maker__word-inspector-title">
                {selectedToken.text}
              </strong>
              <output>{timing}</output>
            </div>
            <label htmlFor={`${controlId}-selected-word`}>
              <span>{t('karaoke.maker.wordText')}</span>
              <input
                id={`${controlId}-selected-word`}
                key={selectedToken.id}
                defaultValue={selectedToken.text}
                onBlur={(event) => {
                  if (event.target.value.trim() !== selectedToken.text) {
                    updateSelectedTokenTiming({ text: event.target.value });
                  }
                }}
              />
            </label>
          </div>
          {renderSelectedWordTimingSliders(
            `${controlId}-selected-word-${selectedToken.id}`,
          )}
          <div className="karaoke-maker__word-inspector-actions">
            <button
              type="button"
              onClick={() => updateSelectedTokenTiming({ startMs: playheadMs })}
            >
              <KaraokeMakerToolIcon name="timing" />
              {t('karaoke.maker.usePlayhead')}
            </button>
            <button
              type="button"
              disabled={selectedToken.startMs === undefined}
              onClick={() => auditionLyricsToken(selectedToken)}
            >
              <KaraokeMakerToolIcon name="preview" />
              {t('karaoke.maker.playWord')}
            </button>
            <button type="button" onClick={splitSelectedLyricsWord}>
              <KaraokeMakerToolIcon name="split" />
              {t('karaoke.maker.splitWordSyllables')}
            </button>
          </div>
        </div>
      );
    }
    return <span>{t('karaoke.maker.selectHint')}</span>;
  };

  const toggleToolPanel = (panel: 'timing' | 'edit' | 'analysis') => {
    setExportOpen(false);
    setToolPanel((current) => (current === panel ? undefined : panel));
  };

  const startLineEntrySync = (preferredTokenId = selectedToken?.id) => {
    if (!tokens.length) {
      return;
    }
    const preferredWordIndex = preferredTokenId
      ? tokens.findIndex((token) => token.id === preferredTokenId)
      : -1;
    const firstUntimed = tokens.findIndex(
      (token) => token.startMs === undefined,
    );
    let wordIndex = 0;
    if (preferredWordIndex >= 0) {
      wordIndex = preferredWordIndex;
    } else if (firstUntimed >= 0) {
      wordIndex = firstUntimed;
    }
    const lineIndex = Math.max(
      0,
      lyricLines.findIndex((line) =>
        line.tokens.some((token) => token.id === tokens[wordIndex]?.id),
      ),
    );
    const target = lyricLines[lineIndex]?.tokens[0];
    if (!target) {
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setLyricsOpen(false);
    setLineEntryMode(true);
    clearLineEntryCountdown();
    setLineEntrySession('setup');
    setLineEntryCapture(undefined);
    setLineEntryIndex(lineIndex);
    setSelection({ kind: 'word', id: target.id });
    setHandPanMode(false);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    gesture.pan.current = undefined;
    cancelAudibleInteractions();
    setPreviewOpen(true);
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    if (target.startMs !== undefined) {
      const preRollMs = Math.max(0, target.startMs - 1_000);
      onSeek(preRollMs);
      setViewStartMs(
        Math.max(
          0,
          Math.min(
            maximumViewStartMs,
            target.startMs - visibleViewDurationMs * 0.3,
          ),
        ),
      );
    }
    setToolPanel(undefined);
  };

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

  const stopLineEntryRecording = () => {
    onPause();
    clearLineEntryCountdown();
    setLineEntryCapture(undefined);
    setLineEntrySession('setup');
    setLineEntryMode(false);
  };

  const toggleLineEntryMode = () => {
    if (lineEntryMode) {
      stopLineEntryRecording();
      return;
    }
    startLineEntrySync();
  };

  const toggleHandPanMode = () => {
    setHandPanMode((active) => !active);
    setNoteEditMode(undefined);
    gesture.selectionBox.current = undefined;
    gesture.notePaintDraft.current = undefined;
    gesture.noteLinkDrag.current = undefined;
    setLineEntryMode(false);
    clearLineEntryCountdown();
    setLineEntryCapture(undefined);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    gesture.pan.current = undefined;
    cancelAudibleInteractions();
    gesture.drag.current = undefined;
    setToolPanel(undefined);
  };

  const toggleNoteEditMode = (mode: 'select' | 'paint') => {
    setNoteEditMode((current) => (current === mode ? undefined : mode));
    setHandPanMode(false);
    setLineEntryMode(false);
    clearLineEntryCountdown();
    setLineEntryCapture(undefined);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    gesture.pan.current = undefined;
    gesture.scrub.current = undefined;
    gesture.drag.current = undefined;
    gesture.selectionBox.current = undefined;
    gesture.notePaintDraft.current = undefined;
    gesture.noteLinkDrag.current = undefined;
    cancelAudibleInteractions();
    setToolPanel(undefined);
  };

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
      <header className="karaoke-maker__header">
        <div className="karaoke-maker__identity">
          <button
            className="karaoke-maker__header-icon karaoke-maker__header-back"
            type="button"
            onClick={onClose}
            aria-label={t('karaoke.maker.close')}
            data-tooltip={t('karaoke.maker.close')}
          >
            <KaraokeMakerToolIcon name="back" />
          </button>
          <div>
            <span className="karaoke-maker__eyebrow">
              {t('karaoke.maker.eyebrow')}
            </span>
            <input
              className="karaoke-maker__title-input"
              value={project.title}
              aria-label={t('karaoke.maker.songTitle')}
              onChange={(event) =>
                commit((current) => ({
                  ...current,
                  title: event.target.value.slice(0, 2_000),
                }))
              }
            />
          </div>
        </div>
        <div
          className="karaoke-maker__transport"
          role="group"
          aria-label={t('karaoke.transport.title')}
        >
          <div className="karaoke-maker__transport-buttons">
            <button
              className="karaoke-maker__transport-control"
              type="button"
              onClick={() => {
                onSeek(0);
                setViewStartMs(0);
                setFollowViewport(true);
              }}
              aria-label={t('karaoke.maker.jumpToStart')}
              data-tooltip={t('karaoke.maker.jumpToStart')}
            >
              <KaraokeTransportIcon name="previous" />
            </button>
            <button
              className="karaoke-maker__transport-control"
              type="button"
              onClick={() => onSeek(Math.max(0, playheadMs - 5_000))}
              aria-label={t('karaoke.maker.seekBack', { seconds: 5 })}
              data-tooltip={t('karaoke.maker.seekBack', { seconds: 5 })}
            >
              <KaraokeTransportIcon name="previous" />
              <small>5</small>
            </button>
            <button
              className={`karaoke-maker__transport-control karaoke-maker__play${
                isPlaying ? ' is-playing' : ''
              }`}
              type="button"
              onClick={() => {
                if (isPlaying) {
                  onPause();
                } else {
                  Promise.resolve(onPlay()).catch(() => undefined);
                }
              }}
              aria-label={t(
                isPlaying
                  ? 'karaoke.transport.pause'
                  : 'karaoke.transport.play',
              )}
              aria-keyshortcuts="Space"
              aria-pressed={isPlaying}
              data-tooltip={t('karaoke.transport.spaceShortcut', {
                action: t(
                  isPlaying
                    ? 'karaoke.transport.pause'
                    : 'karaoke.transport.play',
                ),
              })}
            >
              <KaraokeTransportIcon name={isPlaying ? 'pause' : 'play'} />
            </button>
            <button
              className="karaoke-maker__transport-control"
              type="button"
              onClick={() =>
                onSeek(Math.min(effectiveDurationMs, playheadMs + 5_000))
              }
              aria-label={t('karaoke.maker.seekForward', { seconds: 5 })}
              data-tooltip={t('karaoke.maker.seekForward', { seconds: 5 })}
            >
              <KaraokeTransportIcon name="next" />
              <small>5</small>
            </button>
            <button
              className="karaoke-maker__transport-control"
              type="button"
              onClick={() => {
                onSeek(effectiveDurationMs);
                setViewStartMs(maximumViewStartMs);
                setFollowViewport(true);
              }}
              aria-label={t('karaoke.maker.jumpToEnd')}
              data-tooltip={t('karaoke.maker.jumpToEnd')}
            >
              <KaraokeTransportIcon name="next" />
            </button>
          </div>
          <div className="karaoke-maker__transport-time">
            <time>{formatClock(visualPlayheadMs)}</time>
            <span aria-hidden="true" />
            <time>{formatClock(effectiveDurationMs)}</time>
          </div>
          <div
            className={`karaoke-maker__tone-guide${
              melodyTone.enabled ? ' is-enabled' : ''
            }`}
          >
            <button
              type="button"
              className="karaoke-maker__transport-control"
              disabled={!makerMelodyTarget || !melodyTone.isAvailable}
              onClick={() => melodyTone.toggle().catch(() => undefined)}
              aria-pressed={melodyTone.enabled}
              aria-label={t(
                melodyTone.enabled
                  ? 'karaoke.pitch.toneDisable'
                  : 'karaoke.pitch.toneEnable',
              )}
              data-tooltip={t('karaoke.pitch.toneGuide')}
            >
              <KaraokeTransportIcon name="volume" />
            </button>
            {melodyTone.enabled && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={melodyTone.volume}
                aria-label={t('karaoke.pitch.toneVolume')}
                aria-valuetext={`${Math.round(melodyTone.volume * 100)}%`}
                onChange={(event) =>
                  melodyTone.setVolume(Number(event.target.value))
                }
              />
            )}
          </div>
        </div>
        <KaraokeMakerHeaderActions
          onUndo={undo}
          canUndo={canUndo}
          onRedo={redo}
          canRedo={canRedo}
          onRestore={() => setDestructiveAction('restore')}
          onApply={() => {
            const untimedCount = issues.filter(
              (issue) => issue.code === 'untimed-word',
            ).length;
            if (untimedCount > 0) {
              setNotice(
                t('karaoke.maker.applyUntimed', { count: untimedCount }),
              );
              return;
            }
            onApply(project);
            onClose();
          }}
          isFullScreen={isFullScreen}
          onToggleFullScreen={onToggleFullScreen}
        />
      </header>

      <div ref={toolsRef} className="karaoke-maker__tools">
        <div className="karaoke-maker__tool-group">
          <KaraokeMakerToolbarButton
            icon="project"
            label={t('karaoke.maker.openProject')}
            onClick={() => projectInputRef.current?.click()}
          />
          <KaraokeMakerToolbarButton
            icon="lyrics"
            label={t('karaoke.maker.lyrics')}
            onClick={openLyricsEditor}
          />
          <KaraokeMakerToolbarButton
            icon="clearLyrics"
            label={t('karaoke.maker.clearLyrics')}
            danger
            disabled={!tokens.length}
            onClick={() => setDestructiveAction('lyrics')}
          />
          <KaraokeMakerToolbarButton
            icon="clearNotes"
            label={t('karaoke.maker.clearNotes')}
            danger
            disabled={!project.melody.notes.length}
            onClick={() => setDestructiveAction('notes')}
          />
          <div className="karaoke-maker__tool-cluster">
            <KaraokeMakerToolbarButton
              icon="timing"
              label={t('karaoke.maker.lyricsTiming')}
              active={toolPanel === 'timing'}
              onClick={() => toggleToolPanel('timing')}
            />
            {toolPanel === 'timing' && (
              <KaraokeMakerTimingPopover
                scope={timingScope}
                onScopeChange={setTimingScope}
                canShiftFromWord={canShiftFromWord}
                shiftMs={
                  timingScope === 'all' ? project.meta.gapMs : wordShiftMs
                }
                selectedWord={selectedToken?.text}
                onShift={shiftTimeline}
                onClose={() => setToolPanel(undefined)}
              />
            )}
          </div>
          <KaraokeMakerToolbarButton
            icon="hand"
            label={t('karaoke.maker.panView')}
            active={handPanMode}
            onClick={toggleHandPanMode}
          />
        </div>

        <div className="karaoke-maker__tool-group karaoke-maker__wide-edit-tools">
          {editTools}
        </div>
        <div className="karaoke-maker__tool-cluster karaoke-maker__compact-edit-tools">
          <KaraokeMakerToolbarButton
            icon="edit"
            label={t('karaoke.maker.toolsEdit')}
            active={toolPanel === 'edit'}
            onClick={() => toggleToolPanel('edit')}
          />
          {toolPanel === 'edit' && (
            <div className="karaoke-maker__tool-popover karaoke-maker__action-popover">
              {editTools}
            </div>
          )}
        </div>

        {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && (
          <div className="karaoke-maker__tool-group karaoke-maker__wide-analysis-tools">
            <KaraokeMakerToolbarButton
              icon="analyze"
              label={t('karaoke.maker.prepare')}
              onClick={prepareKaraoke}
              disabled={analysisProgress !== undefined}
            />
            <div className="karaoke-maker__tool-cluster">
              <KaraokeMakerToolbarButton
                icon="melody"
                label={t('karaoke.maker.advanced')}
                active={toolPanel === 'analysis'}
                onClick={() => toggleToolPanel('analysis')}
              />
              {toolPanel === 'analysis' && (
                <div className="karaoke-maker__tool-popover karaoke-maker__action-popover karaoke-maker__analysis-popover">
                  {advancedAnalysisTools}
                </div>
              )}
            </div>
          </div>
        )}
        {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && (
          <div className="karaoke-maker__tool-cluster karaoke-maker__compact-analysis-tools">
            <KaraokeMakerToolbarButton
              icon="analyze"
              label={t('karaoke.maker.prepare')}
              onClick={prepareKaraoke}
              disabled={analysisProgress !== undefined}
            />
            <KaraokeMakerToolbarButton
              icon="melody"
              label={t('karaoke.maker.advanced')}
              active={toolPanel === 'analysis'}
              onClick={() => toggleToolPanel('analysis')}
            />
            {toolPanel === 'analysis' && (
              <div className="karaoke-maker__tool-popover karaoke-maker__action-popover karaoke-maker__analysis-popover">
                {advancedAnalysisTools}
              </div>
            )}
          </div>
        )}

        <div className="karaoke-maker__export-wrap">
          <KaraokeMakerToolbarButton
            icon="export"
            label={t('karaoke.maker.export')}
            active={exportOpen}
            onClick={() => {
              setToolPanel(undefined);
              setExportOpen((open) => !open);
            }}
          />
          {exportOpen && (
            <div className="karaoke-maker__export-menu">
              <button
                type="button"
                onClick={() => exportProject('project').catch(() => undefined)}
              >
                {t('karaoke.maker.exportProject')}
              </button>
              <button
                type="button"
                onClick={() =>
                  exportProject('ultrastar').catch(() => undefined)
                }
              >
                {t('karaoke.maker.exportUltraStar')}
              </button>
              <button
                type="button"
                onClick={() => exportProject('lrc').catch(() => undefined)}
              >
                {t('karaoke.maker.exportLrc')}
              </button>
              <button
                type="button"
                onClick={() => exportProject('elrc').catch(() => undefined)}
              >
                {t('karaoke.maker.exportElrc')}
              </button>
            </div>
          )}
        </div>
      </div>

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
            {renderSelectionInfo()}
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

      <footer className="karaoke-maker__inspector">
        <div className="karaoke-maker__fields">
          <label htmlFor={`${controlId}-artist`}>
            {t('karaoke.maker.artist')}
            <input
              id={`${controlId}-artist`}
              value={project.artist ?? ''}
              onChange={(event) =>
                commit((current) => ({
                  ...current,
                  artist: event.target.value.slice(0, 2_000) || undefined,
                }))
              }
            />
          </label>
          <label htmlFor={`${controlId}-bpm`}>
            {t('karaoke.maker.bpm')}
            <input
              id={`${controlId}-bpm`}
              type="number"
              min="20"
              max="400"
              value={project.meta.bpm ?? ''}
              onChange={(event) =>
                commit((current) => ({
                  ...current,
                  meta: {
                    ...current.meta,
                    bpm: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  },
                }))
              }
            />
          </label>
        </div>
        <label
          className="karaoke-maker__rights"
          htmlFor={`${controlId}-rights`}
        >
          <input
            id={`${controlId}-rights`}
            type="checkbox"
            checked={project.meta.rightsConfirmed}
            onChange={(event) =>
              commit((current) => ({
                ...current,
                meta: {
                  ...current.meta,
                  rightsConfirmed: event.target.checked,
                },
              }))
            }
          />
          {t('karaoke.maker.rights')}
        </label>
      </footer>

      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED &&
        analysisProgress !== undefined &&
        !lyricsOpen && (
          <div className="karaoke-maker__analysis-progress" role="status">
            <div className="karaoke-maker__analysis-progress-copy">
              <KaraokeMakerToolIcon name="transcribe" />
              <div>
                <div className="karaoke-maker__analysis-progress-heading">
                  <strong>
                    {analysisMessage ?? t('karaoke.maker.localAnalysis')}
                  </strong>
                  {analysisProgressIsIndeterminate ? (
                    <span
                      className="karaoke-maker__analysis-activity"
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <span>{Math.round(displayedAnalysisProgress * 100)}%</span>
                  )}
                </div>
              </div>
            </div>
            {renderWhisperDownloadDetails()}
            {whisperStage && (
              <ol
                className="karaoke-maker__whisper-stages"
                aria-label={t('karaoke.maker.whisperPreparing')}
              >
                {visibleWhisperStages.map((stageName, index) => {
                  const activeIndex =
                    whisperStage === 'complete'
                      ? visibleWhisperStages.length
                      : visibleWhisperStages.indexOf(whisperStage);
                  const complete = index < activeIndex;
                  const active = index === activeIndex;
                  let label = t('karaoke.maker.whisperTranscribing');
                  if (stageName === 'decode') {
                    label = t('karaoke.maker.whisperDecoding');
                  } else if (stageName === 'download') {
                    label = t('karaoke.maker.downloadingWhisper');
                  } else if (stageName === 'load') {
                    label = t('karaoke.maker.loadingWhisper');
                  }
                  return (
                    <li
                      key={stageName}
                      className={`${complete ? 'is-complete' : ''} ${
                        active ? 'is-active' : ''
                      }`}
                    >
                      <span aria-hidden="true">
                        {complete ? '✓' : index + 1}
                      </span>
                      <em>{label}</em>
                    </li>
                  );
                })}
              </ol>
            )}
            <div
              className={`karaoke-maker__analysis-progress-bar ${
                analysisProgressIsIndeterminate ? 'is-indeterminate' : ''
              }`}
              role="progressbar"
              aria-label={
                analysisMessage ?? t('karaoke.maker.whisperPreparing')
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                analysisProgressIsIndeterminate
                  ? undefined
                  : Math.round(displayedAnalysisProgress * 100)
              }
            >
              <span
                style={
                  analysisProgressIsIndeterminate
                    ? undefined
                    : { width: `${displayedAnalysisProgress * 100}%` }
                }
              />
            </div>
            <button type="button" onClick={cancelAnalysis}>
              {t('karaoke.maker.cancel')}
            </button>
          </div>
        )}
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED &&
        analysisProgress === undefined &&
        analysisError && (
          <div
            className="karaoke-maker__analysis-error"
            role="alert"
            aria-live="assertive"
          >
            <div
              className="karaoke-maker__analysis-error-icon"
              aria-hidden="true"
            >
              !
            </div>
            <div>
              <strong>
                {analysisRetry === 'whisper'
                  ? t('karaoke.maker.downloadFailed')
                  : t('karaoke.maker.localAnalysisFailed')}
              </strong>
              <span>{analysisError}</span>
            </div>
            <div className="karaoke-maker__analysis-error-actions">
              {analysisRetry !== undefined && (
                <button
                  type="button"
                  className="karaoke-maker__analysis-error-retry"
                  onClick={() => runWhisper().catch(() => undefined)}
                >
                  {t('karaoke.maker.tryAgain')}
                </button>
              )}
              <button
                type="button"
                className="karaoke-maker__analysis-error-close"
                onClick={() => {
                  setAnalysisError(undefined);
                  setAnalysisRetry(undefined);
                }}
                aria-label={t('karaoke.maker.dismiss')}
              >
                ×
              </button>
            </div>
          </div>
        )}
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
        <div
          className={`karaoke-maker__modal-backdrop${
            lyricsProcessing ? ' is-processing' : ''
          }`}
          role="presentation"
        >
          <div
            className={`karaoke-maker__lyrics-modal${
              lyricsProcessing ? ' is-processing' : ''
            }`}
            role="dialog"
            aria-label={t('karaoke.maker.lyricsTitle')}
          >
            <header className="karaoke-maker__lyrics-modal-head">
              <div>
                <span className="karaoke-maker__eyebrow">
                  {t('karaoke.maker.lyricsEyebrow')}
                </span>
                <h2>{t('karaoke.maker.lyricsTitle')}</h2>
                <p>{t('karaoke.maker.lyricsReferenceHint')}</p>
              </div>
            </header>
            <button
              className="karaoke-maker__lyrics-modal-close"
              type="button"
              aria-label={t('karaoke.maker.cancel')}
              data-tooltip={t('karaoke.maker.cancel')}
              onClick={() => setLyricsOpen(false)}
            >
              <KaraokeMakerToolIcon name="close" />
            </button>
            <div className="karaoke-maker__lyrics-editor-body">
              <section className="karaoke-maker__lyrics-source">
                <div className="karaoke-maker__lyrics-section-head">
                  <strong>{t('karaoke.maker.referenceLyrics')}</strong>
                  <div className="karaoke-maker__lyrics-source-actions">
                    <span title={lyricsFileName}>
                      {lyricsFileName ??
                        t('karaoke.maker.lyricsWordCount', {
                          count: draftLyricsWordCount,
                        })}
                    </span>
                    <button
                      type="button"
                      disabled={lyricsProcessing}
                      onClick={() => lyricsInputRef.current?.click()}
                    >
                      <KaraokeMakerToolIcon name="project" />
                      <span>{t('karaoke.maker.loadLyricsFile')}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={lyricsDraft}
                  disabled={lyricsProcessing}
                  onChange={(event) => setLyricsDraft(event.target.value)}
                  placeholder={t('karaoke.maker.lyricsPlaceholder')}
                  spellCheck
                />
              </section>
              <section className="karaoke-maker__lyrics-timing-editor">
                <div className="karaoke-maker__lyrics-section-head">
                  <strong>{t('karaoke.maker.wordTiming')}</strong>
                  <span>
                    {t('karaoke.maker.lyricsTimedCount', {
                      timed: tokens.filter(
                        (token) => token.startMs !== undefined,
                      ).length,
                      total: tokens.length,
                    })}
                  </span>
                </div>
                {lyricsDraftChanged || !tokens.length ? (
                  <div className="karaoke-maker__lyrics-timing-placeholder">
                    <KaraokeMakerToolIcon name="timing" />
                    <strong>
                      {t(
                        lyricsDraftChanged
                          ? 'karaoke.maker.lyricsApplyBeforeTiming'
                          : 'karaoke.maker.lyricsNoTimedWords',
                      )}
                    </strong>
                    <p>{t('karaoke.maker.lyricsTimingEditorHint')}</p>
                  </div>
                ) : (
                  <div className="karaoke-maker__lyrics-token-scroll">
                    {project.lyrics.lines.map((line) => {
                      const isSection = karaokeMakerLineIsSection(line);
                      return (
                        <div
                          key={line.id}
                          className={`karaoke-maker__lyrics-token-line${
                            isSection ? ' is-section' : ''
                          }`}
                        >
                          {line.tokens.map((token) =>
                            isSection ? (
                              <span key={token.id}>{token.text}</span>
                            ) : (
                              <button
                                key={token.id}
                                type="button"
                                className={`${
                                  selection?.kind === 'word' &&
                                  selection.id === token.id
                                    ? 'is-selected '
                                    : ''
                                }${
                                  token.id === activeLyricFocus?.tokenId
                                    ? 'is-current '
                                    : ''
                                }${
                                  token.startMs === undefined
                                    ? 'is-untimed '
                                    : ''
                                }${
                                  karaokeMakerTokenWasUserTouched(token)
                                    ? 'is-adjusted'
                                    : ''
                                }`}
                                onClick={() => selectLyricsEditorToken(token)}
                                title={
                                  token.startMs === undefined
                                    ? t('karaoke.maker.untimed')
                                    : `${formatClock(token.startMs)} → ${formatClock(
                                        token.endMs ?? token.startMs,
                                      )}`
                                }
                              >
                                {token.text}
                              </button>
                            ),
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!lyricsDraftChanged &&
                  tokens.length > 0 &&
                  renderLyricsModalWordInspector()}
              </section>
            </div>
            {analysisProgress !== undefined && (
              <div
                className="karaoke-maker__lyrics-progress"
                role="status"
                aria-live="polite"
              >
                <div className="karaoke-maker__analysis-progress-heading">
                  <strong>
                    {analysisMessage ?? t('karaoke.maker.whisperPreparing')}
                  </strong>
                  {!analysisProgressIsIndeterminate && (
                    <span>{Math.round(displayedAnalysisProgress * 100)}%</span>
                  )}
                </div>
                {renderWhisperDownloadDetails()}
                <div
                  className={`karaoke-maker__analysis-progress-bar${
                    analysisProgressIsIndeterminate ? ' is-indeterminate' : ''
                  }`}
                  role="progressbar"
                  aria-label={
                    analysisMessage ?? t('karaoke.maker.whisperPreparing')
                  }
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    analysisProgressIsIndeterminate
                      ? undefined
                      : Math.round(displayedAnalysisProgress * 100)
                  }
                >
                  <span
                    style={
                      analysisProgressIsIndeterminate
                        ? undefined
                        : { width: `${displayedAnalysisProgress * 100}%` }
                    }
                  />
                </div>
              </div>
            )}
            <div className="karaoke-maker__modal-actions karaoke-maker__lyrics-actions">
              {destructiveAction === 'replace-lyrics' && (
                <p className="karaoke-maker__replace-warning" role="alert">
                  {t('karaoke.maker.replaceLyricsWarning')}
                </p>
              )}
              {lyricsProcessing ? (
                <>
                  <button type="button" onClick={cancelAnalysis}>
                    {t('karaoke.maker.cancel')}
                  </button>
                  <button
                    className="is-primary"
                    type="button"
                    onClick={() => setLyricsOpen(false)}
                  >
                    {t('karaoke.maker.continueInBackground')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!lyricsDraft.trim()}
                    onClick={() => replaceLyrics(false)}
                  >
                    <KaraokeMakerToolIcon name="apply" />
                    {t(
                      destructiveAction === 'replace-lyrics'
                        ? 'karaoke.maker.replaceLyrics'
                        : 'karaoke.maker.acceptLyrics',
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!lyricsDraft.trim()}
                    onClick={() => replaceLyrics(false, true)}
                  >
                    <KaraokeMakerToolIcon name="timing" />
                    {t('karaoke.maker.acceptAndRecordLines')}
                  </button>
                  {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && (
                    <button
                      className="is-primary"
                      type="button"
                      disabled={!lyricsDraft.trim()}
                      onClick={() => replaceLyrics(true)}
                    >
                      <KaraokeMakerToolIcon name="analyze" />
                      {t(
                        destructiveAction === 'replace-lyrics'
                          ? 'karaoke.maker.replaceAndDetect'
                          : 'karaoke.maker.detectTimingMelody',
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED && whisperConsentOpen && (
        <div className="karaoke-maker__modal-backdrop" role="presentation">
          <div
            className="karaoke-maker__consent-modal"
            role="dialog"
            aria-label={t('karaoke.maker.transcriptionTitle')}
          >
            <span className="karaoke-maker__eyebrow">
              {t('karaoke.maker.transcriptionEyebrow')}
            </span>
            <h2>{t('karaoke.maker.transcriptionTitle')}</h2>
            <p>
              {t('karaoke.maker.transcriptionBody', {
                model: WHISPER_MODEL,
              })}
            </p>
            <p>{t('karaoke.maker.transcriptionReview')}</p>
            <div className="karaoke-maker__modal-actions">
              <button
                type="button"
                onClick={() => {
                  prepareAfterWhisperRef.current = false;
                  lyricsWorkflowActiveRef.current = false;
                  setLyricsWorkflowActive(false);
                  setWhisperConsentOpen(false);
                }}
              >
                {t('karaoke.maker.notNow')}
              </button>
              <button
                className="is-primary"
                type="button"
                onClick={() => runWhisper().catch(() => undefined)}
              >
                {t('karaoke.maker.downloadPrepare')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KaraokeMaker;
