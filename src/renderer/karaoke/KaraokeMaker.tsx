/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ChangeEvent,
  Fragment,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
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
import { TranslationKey } from '../../common/i18n';
import { useTranslation } from '../utils/I18nContext';
import { reportError, reportInfo } from '../utils/logger';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import { useKaraokeMakerProject } from './useKaraokeMakerProject';
import {
  IKaraokeMakerAnalysisResult,
  analyzeKaraokeMakerAudio,
  autoAlignNewKaraokeMakerLyrics,
  karaokeMakerAnalysisNotesFromMelody,
} from './makerAnalysis';
import {
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  WHISPER_MODEL,
  IKaraokeMakerDownloadSummary,
  IKaraokeMakerWhisperLogEntry,
  IKaraokeMakerWhisperTranscribeProgress,
  TKaraokeMakerWhisperStage,
  analyzeKaraokeWithBasicPitch,
  applyBasicPitchMelody,
  applyDetectedPitchMelody,
  applyWhisperTranscript,
  formatKaraokeMakerWhisperLog,
  getKaraokeWhisperSessionSnapshot,
  karaokeMakerVocalAnalysisWindows,
  refreshKaraokeWhisperDownloaded,
  releaseKaraokeWhisperModel,
  subscribeKaraokeWhisperSession,
  transcribeKaraokeWithWhisper,
  writeKaraokeWhisperMemorySettings,
} from './makerAi';
import useKaraokeNoteAudition from './useKaraokeNoteAudition';
import KaraokeMakerToolIcon, {
  TKaraokeMakerToolIcon,
} from './KaraokeMakerToolIcon';
import KaraokeMakerNavigator from './KaraokeMakerNavigator';
import KaraokeMakerCaptureCoach from './KaraokeMakerCaptureCoach';
import KaraokeMakerFloatingPanel from './KaraokeMakerFloatingPanel';
import KaraokeMakerPreview from './KaraokeMakerPreview';
import {
  KARAOKE_MAKER_LYRIC_LANE_COUNT,
  groupKaraokeMakerWordSyllables,
  karaokeMakerLyricFocus,
  karaokeMakerFittedLyricViewport,
  karaokeMakerNoteProgress,
  karaokeMakerNoteIsActive,
  karaokeMakerPannedViewportStart,
  karaokeMakerSectionGroups,
  karaokeMakerWordProgress,
  layoutKaraokeMakerAnchoredLyricLabels,
} from './makerCanvasLayout';
import { KaraokeTransportIcon } from './KaraokeTransport';
import {
  IKaraokeMakerEditorView,
  readKaraokeMakerEditorView,
  writeKaraokeMakerEditorView,
} from './karaokeEditorPersistence';

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

type TSelection =
  { kind: 'word'; id: string } | { kind: 'note'; id: string } | undefined;

type TTimingScope = 'all' | 'from-word';
type TLineEntrySession = 'setup' | 'countdown' | 'active';

interface IGuidedLineCapture {
  lineId: string;
  startMs: number;
  estimatedEndMs: number;
  wordBoundariesMs?: number[];
  automaticStart?: boolean;
}
type TDestructiveMakerAction =
  'notes' | 'lyrics' | 'restore' | 'replace-lyrics';

/**
 * What the confirmation modal says, per action.
 *
 * `replace-lyrics` is absent on purpose: it is asked inside the lyrics editor,
 * next to the text it is about to replace, rather than in this modal.
 */
const DESTRUCTIVE_CONFIRMATIONS: Record<
  Exclude<TDestructiveMakerAction, 'replace-lyrics'>,
  {
    icon: TKaraokeMakerToolIcon;
    title: TranslationKey;
    body: TranslationKey;
    confirm: TranslationKey;
  }
> = {
  notes: {
    icon: 'clearNotes',
    title: 'karaoke.maker.clearNotesTitle',
    body: 'karaoke.maker.clearNotesBody',
    confirm: 'karaoke.maker.clearNotes',
  },
  lyrics: {
    icon: 'clearLyrics',
    title: 'karaoke.maker.clearLyricsTitle',
    body: 'karaoke.maker.clearLyricsBody',
    confirm: 'karaoke.maker.clearLyrics',
  },
  restore: {
    icon: 'restore',
    title: 'karaoke.maker.restoreTitle',
    body: 'karaoke.maker.restoreBody',
    confirm: 'karaoke.maker.restore',
  },
};

interface ISyllableSplitDraft {
  tokenId: string;
  word: string;
  cutPoints: number[];
}

interface IHitRegion {
  kind: 'word' | 'note';
  id: string;
  behavior?: IDragState['behavior'];
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ICanvasLyricToken {
  token: IKaraokeMakerToken;
  tokenIndex: number;
  lineIndex: number;
  lineStartMs: number;
  lineEndMs: number;
  isSection: boolean;
}

interface ICanvasLyricWord {
  id: string;
  text: string;
  syllables: ICanvasLyricToken[];
  lineIndex: number;
  wordIndex: number;
  lineStartMs: number;
  lineEndMs: number;
  startMs: number;
  endMs: number;
  isSection: boolean;
}

interface IDragState {
  selection: Exclude<TSelection, undefined>;
  behavior: 'move' | 'resize-start' | 'resize-end';
  pointerX: number;
  pointerY: number;
  base: IKaraokeMakerProject;
  noteIds?: string[];
  audioAnchorMs?: number;
  auditionStartMs?: number;
  auditionEndMs?: number;
  auditionStarted?: boolean;
  auditionTimerId?: number;
  finalAuditionMidi?: number;
  finalAuditionDurationMs?: number;
}

interface ICanvasSelectionBox {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
  initialNoteIds: Set<string>;
}

interface INotePaintDraft {
  pointerId: number;
  startX: number;
  currentX: number;
  y: number;
}

interface INoteLinkDragState {
  pointerId: number;
  noteId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  initialNoteIds: Set<string>;
}

interface ICanvasPanState {
  pointerX: number;
  viewStartMs: number;
}

interface ICanvasScrubState {
  pointerId?: number;
  anchorMs: number;
  auditionWordGrain: boolean;
  grainTimerId?: number;
}

interface ISentenceAuditionState {
  startMs: number;
  endMs: number;
  timerId: number;
}

const MIN_VIEW_MS = 650;
// Twelve seconds keeps authored lyrics readable on first open; the overview
// handles still expose the entire song and let the user zoom further out.
const DEFAULT_VIEW_MS = 12_000;
const DEFAULT_PREVIEW_HEIGHT = 150;
const WAVEFORM_TOP = 9;
const WAVEFORM_HEIGHT = 27;
const SECTION_GROUP_TOP = 43;
const SECTION_GROUP_HEIGHT = 30;
const BASE_LYRIC_SECTION_TOP = 43;
const LYRIC_LANE_HEIGHT = 34;
const LYRIC_SECTION_HEIGHT = KARAOKE_MAKER_LYRIC_LANE_COUNT * LYRIC_LANE_HEIGHT;
const MIN_NOTE_MIDI = 24;
const MAX_NOTE_MIDI = 96;
const MAKER_PREVIEW_OPEN_KEY = 'fluideq.karaoke.maker-preview-open';

const initialPreviewOpen = (): boolean => {
  try {
    return window.localStorage.getItem(MAKER_PREVIEW_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

const flattenTokens = (project: IKaraokeMakerProject) =>
  project.lyrics.lines
    .filter((line) => !karaokeMakerLineIsSection(line))
    .flatMap((line) => line.tokens);

const plainLyrics = (project: IKaraokeMakerProject): string =>
  project.lyrics.lines
    .map((line) =>
      line.tokens.reduce(
        (text, token) =>
          `${text}${text && token.startsWord !== false ? ' ' : ''}${token.text.trim()}`,
        '',
      ),
    )
    .join('\n');

const normalizedLyricsText = (value: string): string =>
  value
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join('\n');

const formatClock = (valueMs: number): string => {
  const safe = Math.max(0, valueMs);
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const tenths = Math.floor((safe % 1_000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
};

const formatMegabytes = (bytes: number): string => {
  const megabytes = Math.max(0, bytes) / (1024 * 1024);
  return megabytes >= 100 ? megabytes.toFixed(0) : megabytes.toFixed(1);
};

const WHISPER_STAGE_ORDER: Exclude<TKaraokeMakerWhisperStage, 'complete'>[] = [
  'decode',
  'download',
  'load',
  'transcribe',
];

interface IWhisperRunProfile {
  needsDownload: boolean;
  needsLoad: boolean;
}

const whisperDownloadFileName = (file?: string): string | undefined => {
  const parts = file?.split(/[\\/]/).filter(Boolean);
  return parts?.[parts.length - 1];
};

const midiName = (midi: number): string => {
  const names = [
    'C',
    'C♯',
    'D',
    'D♯',
    'E',
    'F',
    'F♯',
    'G',
    'G♯',
    'A',
    'A♯',
    'B',
  ];
  const rounded = Math.round(midi);
  return `${names[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
};

const replaceNote = (
  project: IKaraokeMakerProject,
  id: string,
  edit: (note: IKaraokeMakerNote) => IKaraokeMakerNote,
): IKaraokeMakerProject => ({
  ...project,
  melody: {
    ...project.melody,
    source: 'manual',
    notes: project.melody.notes.map((note) =>
      note.id === id ? { ...edit(note), source: 'manual' } : note,
    ),
  },
});

const replaceToken = (
  project: IKaraokeMakerProject,
  id: string,
  edit: (token: IKaraokeMakerToken) => IKaraokeMakerToken,
): IKaraokeMakerProject => ({
  ...project,
  lyrics: {
    ...project.lyrics,
    source: 'manual',
    lines: project.lyrics.lines.map((line) => ({
      ...line,
      tokens: line.tokens.map((token) =>
        token.id === id
          ? { ...edit(token), source: 'manual', timingLocked: true }
          : token,
      ),
    })),
  },
});

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
};

interface IKaraokeMakerToolbarButtonProps {
  icon: TKaraokeMakerToolIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
}

const KaraokeMakerToolbarButton = ({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  danger = false,
}: IKaraokeMakerToolbarButtonProps) => (
  <button
    type="button"
    className={`karaoke-maker__tool-button${active ? ' is-active' : ''}${
      danger ? ' is-danger' : ''
    }`}
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    aria-pressed={active || undefined}
    data-tooltip={label}
  >
    <KaraokeMakerToolIcon name={icon} />
    <span className="karaoke-maker__tool-label">{label}</span>
  </button>
);

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
  const [initialEditorView] = useState(() =>
    readKaraokeMakerEditorView(project.id),
  );
  const [selection, setSelection] = useState<TSelection>(
    initialEditorView?.selection,
  );
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(() =>
    initialEditorView?.selection?.kind === 'note'
      ? new Set([initialEditorView.selection.id])
      : new Set(),
  );
  const [copiedNotes, setCopiedNotes] = useState<IKaraokeMakerNote[]>([]);
  const [controlLinkMode, setControlLinkMode] = useState(false);
  const [viewStartMs, setViewStartMs] = useState(
    initialEditorView?.viewStartMs ?? 0,
  );
  const [viewDurationMs, setViewDurationMs] = useState(
    initialEditorView?.viewDurationMs ?? DEFAULT_VIEW_MS,
  );
  const [followViewport, setFollowViewport] = useState(
    initialEditorView?.followViewport ?? true,
  );
  const [lyricFollowRequestKey, setLyricFollowRequestKey] = useState(0);
  const [timingScope, setTimingScope] = useState<TTimingScope>(
    initialEditorView?.timingScope ?? 'all',
  );
  const [wordShiftMs, setWordShiftMs] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(
    initialEditorView?.previewOpen ?? initialPreviewOpen,
  );
  const [previewTextSize, setPreviewTextSize] = useState(
    initialEditorView?.previewTextSize ?? 100,
  );
  const [previewHeight, setPreviewHeight] = useState(
    initialEditorView?.previewHeight ?? DEFAULT_PREVIEW_HEIGHT,
  );
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsDraft, setLyricsDraft] = useState(() => plainLyrics(project));
  const [lyricsFileName, setLyricsFileName] = useState<string>();
  const [lyricsWorkflowActive, setLyricsWorkflowActive] = useState(false);
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
  const downloadSampleRef = useRef<
    | {
        loadedBytes: number;
        sampledAt: number;
        bytesPerSecond?: number;
      }
    | undefined
  >(undefined);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const vocalStemInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const hitRegionsRef = useRef<IHitRegion[]>([]);
  const dragRef = useRef<IDragState | undefined>(undefined);
  const panRef = useRef<ICanvasPanState | undefined>(undefined);
  const scrubRef = useRef<ICanvasScrubState | undefined>(undefined);
  const sentenceAuditionRef = useRef<ISentenceAuditionState | undefined>(
    undefined,
  );
  const selectionBoxRef = useRef<ICanvasSelectionBox | undefined>(undefined);
  const notePaintDraftRef = useRef<INotePaintDraft | undefined>(undefined);
  const noteLinkDragRef = useRef<INoteLinkDragState | undefined>(undefined);
  const lastDragAuditionMidiRef = useRef<number | undefined>(undefined);
  const analysisAbortRef = useRef<AbortController | undefined>(undefined);
  const prepareAfterWhisperRef = useRef(false);
  const lyricsWorkflowActiveRef = useRef(false);
  const editorViewRef = useRef<IKaraokeMakerEditorView | undefined>(undefined);
  const editorProjectIdRef = useRef(project.id);
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
      const scrub = scrubRef.current;
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
      const drag = dragRef.current;
      if (drag?.auditionTimerId !== undefined) {
        window.clearTimeout(drag.auditionTimerId);
      }
      const hadAudibleInteraction =
        scrub?.auditionWordGrain === true ||
        sentenceAudition !== undefined ||
        drag?.auditionStarted === true ||
        wordAuditionTimerRef.current !== undefined;
      wordAuditionTimerRef.current = undefined;
      scrubRef.current = undefined;
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
    [onPause, onSeek],
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
    cancelAudibleInteractions,
    clearLineEntryCountdown,
    isPlaying,
    onPause,
    onPlay,
    onSeek,
    projectRef,
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
  const tokens = useMemo(() => flattenTokens(project), [project]);
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
  const draftLyricsWordCount = useMemo(
    () =>
      makerLinesFromPlainText(lyricsDraft)
        .filter((line) => !karaokeMakerLineIsSection(line))
        .reduce((count, line) => count + line.tokens.length, 0),
    [lyricsDraft],
  );
  const lyricsDraftChanged =
    normalizedLyricsText(lyricsDraft) !==
    normalizedLyricsText(plainLyrics(project));
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
  }, [canShiftFromWord, timingScope]);

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
    if (selection?.kind !== 'note') {
      setControlLinkMode(false);
      return undefined;
    }
    const setControlIndicator = (event: KeyboardEvent) => {
      if (
        event.code === 'ControlLeft' ||
        event.code === 'ControlRight' ||
        event.key === 'Control'
      ) {
        setControlLinkMode(event.type === 'keydown');
      }
    };
    const clearControlIndicator = () => setControlLinkMode(false);
    window.addEventListener('keydown', setControlIndicator, true);
    window.addEventListener('keyup', setControlIndicator, true);
    window.addEventListener('blur', clearControlIndicator);
    return () => {
      window.removeEventListener('keydown', setControlIndicator, true);
      window.removeEventListener('keyup', setControlIndicator, true);
      window.removeEventListener('blur', clearControlIndicator);
    };
  }, [selection?.kind]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MAKER_PREVIEW_OPEN_KEY, String(previewOpen));
    } catch {
      // A blocked storage partition should not disable the editor preview.
    }
  }, [previewOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (editorViewRef.current) {
        writeKaraokeMakerEditorView(project.id, editorViewRef.current);
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [
    followViewport,
    previewOpen,
    previewHeight,
    previewTextSize,
    project.id,
    selection,
    timingScope,
    viewDurationMs,
    viewStartMs,
  ]);

  useEffect(
    () => () => {
      if (editorViewRef.current) {
        writeKaraokeMakerEditorView(
          editorProjectIdRef.current,
          editorViewRef.current,
        );
      }
    },
    [],
  );

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

  useEffect(() => {
    if (!draftReady || !selection) {
      return;
    }
    const selectionExists =
      selection.kind === 'word'
        ? tokens.some((token) => token.id === selection.id)
        : project.melody.notes.some((note) => note.id === selection.id);
    if (!selectionExists) {
      setSelection(undefined);
    }
  }, [draftReady, project.melody.notes, selection, tokens]);

  useEffect(() => {
    if (selection?.kind !== 'note') {
      if (selectedNoteIds.size) {
        setSelectedNoteIds(new Set());
      }
      return;
    }
    const existingIds = new Set(project.melody.notes.map((note) => note.id));
    setSelectedNoteIds((current) => {
      const next = new Set(
        [...current].filter((noteId) => existingIds.has(noteId)),
      );
      if (existingIds.has(selection.id)) {
        next.add(selection.id);
      }
      return next.size === current.size &&
        [...next].every((noteId) => current.has(noteId))
        ? current
        : next;
    });
  }, [project.melody.notes, selectedNoteIds.size, selection]);

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
        dragRef.current = undefined;
        panRef.current = undefined;
        lastDragAuditionMidiRef.current = undefined;
      }
    };
    window.addEventListener('pointerdown', closeFloatingTools);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeFloatingTools);
      window.removeEventListener('keydown', closeOnEscape);
      cancelAudibleInteractions();
    };
  }, [cancelAudibleInteractions]);

  useEffect(() => {
    if (viewDurationMs !== visibleViewDurationMs) {
      setViewDurationMs(visibleViewDurationMs);
    }
    setViewStartMs((current) => Math.min(maximumViewStartMs, current));
  }, [maximumViewStartMs, viewDurationMs, visibleViewDurationMs]);

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
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const plotLeft = 54;
    const plotRight = width - 18;
    const plotWidth = Math.max(1, plotRight - plotLeft);
    const plotTop = headerHeight;
    const plotBottom = height - 28;
    const plotHeight = Math.max(1, plotBottom - plotTop);
    const timeX = (timeMs: number) =>
      plotLeft + ((timeMs - viewStartMs) / visibleViewDurationMs) * plotWidth;
    const noteY = (midi: number) =>
      plotTop +
      ((MAX_NOTE_MIDI - midi) / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * plotHeight;
    const regions: IHitRegion[] = [];
    const wordBoundaryRegions: IHitRegion[] = [];

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, 'rgba(8, 24, 43, .96)');
    background.addColorStop(1, 'rgba(5, 19, 34, .98)');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const lyricBackground = context.createLinearGradient(
      0,
      lyricSectionTop,
      0,
      headerHeight,
    );
    lyricBackground.addColorStop(0, 'rgba(10, 35, 52, .72)');
    lyricBackground.addColorStop(1, 'rgba(4, 22, 36, .9)');
    context.fillStyle = lyricBackground;
    context.fillRect(
      plotLeft,
      lyricSectionTop - 3,
      plotWidth,
      LYRIC_SECTION_HEIGHT + 6,
    );
    if (canvasSectionGroups.length) {
      context.fillStyle = 'rgba(7, 29, 45, .94)';
      context.fillRect(
        plotLeft,
        SECTION_GROUP_TOP - 3,
        plotWidth,
        SECTION_GROUP_HEIGHT,
      );
      context.save();
      context.beginPath();
      context.rect(
        plotLeft,
        SECTION_GROUP_TOP - 3,
        plotWidth,
        SECTION_GROUP_HEIGHT,
      );
      context.clip();
      canvasSectionGroups.forEach((group, index) => {
        const rawLeft = timeX(group.startMs);
        const rawRight = timeX(group.endMs);
        if (rawRight < plotLeft || rawLeft > plotRight) {
          return;
        }
        const left = Math.max(plotLeft, rawLeft);
        const right = Math.min(plotRight, Math.max(left + 1, rawRight));
        const centerY = SECTION_GROUP_TOP + SECTION_GROUP_HEIGHT / 2 - 2;
        const groupGradient = context.createLinearGradient(left, 0, right, 0);
        groupGradient.addColorStop(
          0,
          index % 2 ? 'rgba(34, 213, 199, .12)' : 'rgba(72, 196, 232, .1)',
        );
        groupGradient.addColorStop(1, 'rgba(17, 109, 126, .025)');
        context.fillStyle = groupGradient;
        context.fillRect(left, SECTION_GROUP_TOP - 2, right - left, 25);
        context.strokeStyle = 'rgba(63, 232, 216, .45)';
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(left + 1, SECTION_GROUP_TOP + 22);
        context.lineTo(Math.max(left + 1, right - 4), SECTION_GROUP_TOP + 22);
        context.stroke();
        context.font = '800 10px Inter, system-ui, sans-serif';
        const text = group.text.toUpperCase();
        const measuredWidth = context.measureText(text).width;
        const textX = Math.max(
          left + measuredWidth / 2 + 9,
          Math.min(
            right - measuredWidth / 2 - 9,
            rawLeft + 10 + measuredWidth / 2,
          ),
        );
        context.save();
        context.beginPath();
        context.rect(
          left + 4,
          SECTION_GROUP_TOP,
          Math.max(0, right - left - 8),
          22,
        );
        context.clip();
        context.fillStyle = 'rgba(111, 255, 243, .94)';
        context.shadowColor = 'rgba(36, 223, 207, .48)';
        context.shadowBlur = 7;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, textX, centerY);
        context.restore();
      });
      context.restore();
      context.strokeStyle = 'rgba(44, 226, 211, .2)';
      context.beginPath();
      context.moveTo(plotLeft, lyricSectionTop - 3);
      context.lineTo(plotRight, lyricSectionTop - 3);
      context.stroke();
    }
    for (let lane = 1; lane < KARAOKE_MAKER_LYRIC_LANE_COUNT; lane += 1) {
      const laneY = lyricSectionTop + lane * LYRIC_LANE_HEIGHT;
      context.strokeStyle = 'rgba(76, 151, 174, .085)';
      context.beginPath();
      context.moveTo(plotLeft, laneY);
      context.lineTo(plotRight, laneY);
      context.stroke();
    }
    context.strokeStyle = 'rgba(44, 226, 211, .18)';
    context.beginPath();
    context.moveTo(plotLeft, headerHeight - 1);
    context.lineTo(plotRight, headerHeight - 1);
    context.stroke();

    context.strokeStyle = 'rgba(71, 116, 151, .13)';
    context.lineWidth = 1;
    let majorStep = 15_000;
    if (visibleViewDurationMs <= 10_000) {
      majorStep = 1_000;
    } else if (visibleViewDurationMs <= 40_000) {
      majorStep = 5_000;
    }
    const firstTick = Math.floor(viewStartMs / majorStep) * majorStep;
    for (
      let tick = firstTick;
      tick <= viewStartMs + visibleViewDurationMs;
      tick += majorStep
    ) {
      const x = timeX(tick);
      context.beginPath();
      context.moveTo(x, headerHeight - 2);
      context.lineTo(x, plotBottom);
      context.stroke();
      context.fillStyle = 'rgba(174, 201, 222, .58)';
      context.font = '10px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText(formatClock(tick), x, height - 10);
    }
    for (let midi = MIN_NOTE_MIDI; midi <= MAX_NOTE_MIDI; midi += 3) {
      const y = noteY(midi);
      context.strokeStyle =
        midi % 12 === 0 ? 'rgba(65, 218, 203, .16)' : 'rgba(71, 116, 151, .08)';
      context.beginPath();
      context.moveTo(plotLeft, y);
      context.lineTo(plotRight, y);
      context.stroke();
      if (midi % 12 === 0) {
        context.fillStyle = 'rgba(160, 244, 112, .72)';
        context.textAlign = 'right';
        context.fillText(midiName(midi), plotLeft - 8, y + 3);
      }
    }

    const { waveform } = project.analysis;
    if (waveform?.length) {
      context.save();
      context.beginPath();
      context.rect(plotLeft, WAVEFORM_TOP, plotWidth, WAVEFORM_HEIGHT);
      context.clip();
      context.fillStyle = 'rgba(22, 211, 198, .18)';
      context.beginPath();
      const startIndex = Math.floor(
        (viewStartMs / effectiveDurationMs) * waveform.length,
      );
      const endIndex = Math.ceil(
        ((viewStartMs + visibleViewDurationMs) / effectiveDurationMs) *
          waveform.length,
      );
      for (let xIndex = 0; xIndex < Math.ceil(plotWidth); xIndex += 1) {
        const progress = xIndex / plotWidth;
        const index = Math.max(
          0,
          Math.min(
            waveform.length - 1,
            Math.round(startIndex + (endIndex - startIndex) * progress),
          ),
        );
        const amplitude = waveform[index] ?? 0;
        const x = plotLeft + xIndex;
        const centerY = WAVEFORM_TOP + WAVEFORM_HEIGHT / 2;
        const halfHeight = Math.max(0.6, amplitude * (WAVEFORM_HEIGHT / 2 - 2));
        context.rect(x, centerY - halfHeight, 1, halfHeight * 2);
      }
      context.fill();
      context.strokeStyle = 'rgba(72, 246, 230, .32)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(plotLeft, WAVEFORM_TOP + WAVEFORM_HEIGHT / 2);
      context.lineTo(plotRight, WAVEFORM_TOP + WAVEFORM_HEIGHT / 2);
      context.stroke();
      context.restore();
    }

    // Keep a full viewport of labels on both sides in the packing pass. Small
    // pans and follow motion then retain the same neighbours and lane choices
    // instead of changing the set at each screen edge.
    const layoutWords = canvasLyricWords.filter(
      (word) =>
        word.endMs >= viewStartMs - visibleViewDurationMs &&
        word.startMs <= viewStartMs + visibleViewDurationMs * 2,
    );
    const lyricLabels = layoutWords.map((word) => {
      let labelFont = '650 13px Inter, system-ui, sans-serif';
      const selected = word.syllables.some(
        ({ token }) => selection?.kind === 'word' && selection.id === token.id,
      );
      if (word.isSection) {
        labelFont = '800 11px Inter, system-ui, sans-serif';
      } else if (selected) {
        labelFont = '750 14px Inter, system-ui, sans-serif';
      }
      context.font = labelFont;
      const measuredWidth = context.measureText(word.text).width;
      const labelWidth = Math.max(34, measuredWidth + 18);
      const rawLeft = timeX(word.startMs);
      const rawRight = timeX(word.endMs);
      const naturalCenterX = (rawLeft + rawRight) / 2;
      return {
        id: word.id,
        naturalLeft: naturalCenterX - labelWidth / 2,
        width: labelWidth,
        preferredLane: word.wordIndex % 3,
        word,
        measuredWidth,
        rawLeft,
        rawRight,
      };
    });
    const placedLyricLabels = new Map(
      layoutKaraokeMakerAnchoredLyricLabels(
        lyricLabels,
        plotLeft - plotWidth,
        plotRight + plotWidth,
        3,
        12,
        true,
      ).map((label) => [label.id, label]),
    );
    const lyricLabelData = new Map(
      lyricLabels.map((label) => [label.id, label]),
    );
    layoutWords.forEach((word) => {
      const label = placedLyricLabels.get(word.id);
      if (!label) {
        return;
      }
      const lyricLabel = lyricLabelData.get(word.id);
      if (!lyricLabel) {
        return;
      }
      const { rawLeft, rawRight, measuredWidth } = lyricLabel;
      if (rawRight < plotLeft || rawLeft > plotRight) {
        return;
      }
      const timingLeft = Math.max(plotLeft, rawLeft);
      const timingRight = Math.max(
        timingLeft + 3,
        Math.min(plotRight, rawRight),
      );
      const selected = word.syllables.some(
        ({ token }) => selection?.kind === 'word' && selection.id === token.id,
      );
      const userTouched = word.syllables.every(({ token }) =>
        karaokeMakerTokenWasUserTouched(token),
      );
      const lineActive = activeLyricFocus?.lineIndex === word.lineIndex;
      const wordActive = activeLyricWordId === word.id;
      const wordComplete = lineActive && visualPlayheadMs > word.endMs;
      const wordProgress = lineActive
        ? karaokeMakerWordProgress(word.startMs, word.endMs, visualPlayheadMs)
        : 0;
      let currentFont = '650 13px Inter, system-ui, sans-serif';
      if (word.isSection) {
        currentFont = '800 11px Inter, system-ui, sans-serif';
      } else if (selected) {
        currentFont = '750 14px Inter, system-ui, sans-serif';
      }
      context.font = currentFont;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const { width: labelWidth, left: labelLeft, lane } = label;
      const centerX = word.isSection
        ? Math.max(
            plotLeft + measuredWidth / 2 + 8,
            Math.min(
              plotRight - measuredWidth / 2 - 8,
              (rawLeft + rawRight) / 2,
            ),
          )
        : labelLeft + labelWidth / 2;
      const wordCenterY =
        lyricSectionTop + lane * LYRIC_LANE_HEIGHT + LYRIC_LANE_HEIGHT / 2;
      // The playback focus owns the single rounded highlight. A selection at
      // another timestamp stays visible through its bright text/underline,
      // but does not compete with the word currently being performed.
      const showFocusBox =
        wordActive || (selected && activeLyricFocus?.tokenId === undefined);
      if (showFocusBox) {
        const elapsed =
          wordActive && wordFocusAnimationRef.current.tokenId === word.id
            ? performance.now() - wordFocusAnimationRef.current.startedAt
            : 180;
        const progress = Math.max(0, Math.min(1, elapsed / 180));
        const eased = 1 - (1 - progress) ** 3;
        context.save();
        context.globalAlpha = 0.35 + eased * 0.65;
        context.translate(centerX, wordCenterY);
        context.scale(0.94 + eased * 0.06, 0.88 + eased * 0.12);
        context.translate(-centerX, -wordCenterY);
        context.fillStyle = selected
          ? 'rgba(44, 229, 213, .14)'
          : 'rgba(45, 214, 203, .09)';
        context.strokeStyle = selected
          ? 'rgba(123, 255, 244, .72)'
          : 'rgba(79, 238, 224, .28)';
        context.lineWidth = selected ? 1.4 : 1;
        context.shadowColor = selected ? '#20e6d4' : 'rgba(32, 230, 212, .5)';
        context.shadowBlur = selected ? 12 : 7;
        drawRoundedRect(
          context,
          labelLeft - 3,
          wordCenterY - 13,
          labelWidth + 6,
          26,
          7,
        );
        context.fill();
        if (wordActive && wordProgress > 0) {
          context.save();
          drawRoundedRect(
            context,
            labelLeft - 3,
            wordCenterY - 13,
            labelWidth + 6,
            26,
            7,
          );
          context.clip();
          context.fillStyle = 'rgba(70, 244, 229, .2)';
          context.fillRect(
            labelLeft - 3,
            wordCenterY - 13,
            (labelWidth + 6) * wordProgress,
            26,
          );
          context.restore();
        }
        drawRoundedRect(
          context,
          labelLeft - 3,
          wordCenterY - 13,
          labelWidth + 6,
          26,
          7,
        );
        context.stroke();
        context.restore();
      }
      // A continuous base with small junction nodes shows exactly where the
      // provider divided a readable word into editable sung syllables.
      context.save();
      context.strokeStyle = userTouched
        ? 'rgba(74, 232, 172, .34)'
        : 'rgba(111, 151, 178, .25)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(timingLeft, wordCenterY + 12);
      context.lineTo(timingRight, wordCenterY + 12);
      context.stroke();
      word.syllables.forEach(({ token }, syllableIndex) => {
        const syllableRawLeft = timeX(token.startMs as number);
        const syllableRawRight = timeX(token.endMs as number);
        if (syllableRawRight < plotLeft || syllableRawLeft > plotRight) {
          return;
        }
        const syllableLeft = Math.max(plotLeft, syllableRawLeft);
        const syllableRight = Math.max(
          syllableLeft + 2,
          Math.min(plotRight, syllableRawRight),
        );
        const syllableSelected =
          selection?.kind === 'word' && selection.id === token.id;
        const syllableTouched = karaokeMakerTokenWasUserTouched(token);
        let timingStroke = syllableTouched
          ? 'rgba(74, 232, 172, .8)'
          : 'rgba(111, 151, 178, .54)';
        if (wordComplete) {
          timingStroke = syllableTouched
            ? 'rgba(111, 255, 202, .98)'
            : 'rgba(166, 199, 221, .72)';
        }
        if (syllableSelected) {
          timingStroke = '#88fff4';
        }
        context.strokeStyle = timingStroke;
        context.lineWidth = syllableSelected ? 2.2 : 1.35;
        context.beginPath();
        context.moveTo(syllableLeft, wordCenterY + 12);
        context.lineTo(syllableRight, wordCenterY + 12);
        context.stroke();
        if (syllableIndex > 0) {
          const junctionX = Math.max(
            plotLeft + 1.5,
            Math.min(plotRight - 1.5, syllableLeft),
          );
          context.fillStyle = syllableSelected
            ? '#a8fff7'
            : 'rgba(73, 235, 220, .72)';
          context.beginPath();
          context.arc(junctionX, wordCenterY + 12, 1.8, 0, Math.PI * 2);
          context.fill();
        }

        const wordDurationMs = Math.max(1, word.endMs - word.startMs);
        const labelHitLeft =
          labelLeft +
          (((token.startMs as number) - word.startMs) / wordDurationMs) *
            labelWidth;
        const labelHitRight =
          labelLeft +
          (((token.endMs as number) - word.startMs) / wordDurationMs) *
            labelWidth;
        regions.push({
          kind: 'word',
          id: token.id,
          left: labelHitLeft,
          right: Math.max(labelHitLeft + 2, labelHitRight),
          top: wordCenterY - 14,
          bottom: wordCenterY + 8,
        });
        regions.push({
          kind: 'word',
          id: token.id,
          left: syllableLeft,
          right: syllableRight,
          top: wordCenterY + 8,
          bottom: wordCenterY + 16,
        });
        const lineTokens = project.lyrics.lines[word.lineIndex]?.tokens ?? [];
        const tokenIndex = lineTokens.findIndex(
          (candidate) => candidate.id === token.id,
        );
        const previousToken = lineTokens[tokenIndex - 1];
        const nextToken = lineTokens[tokenIndex + 1];
        const addWordBoundary = (
          handleX: number,
          boundaryTokenId: string,
          boundaryBehavior: 'resize-start' | 'resize-end',
          boundarySelected: boolean,
        ) => {
          const boundaryHovered =
            hoveredEditHandle?.kind === 'word' &&
            hoveredEditHandle.id === boundaryTokenId &&
            hoveredEditHandle.behavior === boundaryBehavior;
          if (boundaryHovered || boundarySelected) {
            const visibleHandleX = Math.max(
              plotLeft + 2,
              Math.min(plotRight - 2, handleX),
            );
            context.save();
            context.strokeStyle = boundaryHovered ? '#cafffa' : '#64eadf';
            context.lineWidth = boundaryHovered ? 2.2 : 1.35;
            context.shadowColor = '#21e8d6';
            context.shadowBlur = boundaryHovered ? 10 : 5;
            context.beginPath();
            context.moveTo(visibleHandleX, wordCenterY + 5);
            context.lineTo(visibleHandleX, wordCenterY + 19);
            context.stroke();
            context.fillStyle = boundaryHovered ? '#eafffd' : '#7cfff4';
            [wordCenterY + 6, wordCenterY + 18].forEach((handleY) => {
              context.beginPath();
              context.arc(
                visibleHandleX,
                handleY,
                boundaryHovered ? 2.2 : 1.6,
                0,
                Math.PI * 2,
              );
              context.fill();
            });
            context.restore();
          }
          wordBoundaryRegions.push({
            kind: 'word',
            id: boundaryTokenId,
            behavior: boundaryBehavior,
            left: handleX - 7,
            right: handleX + 7,
            top: wordCenterY + 3,
            bottom: wordCenterY + 21,
          });
        };
        const canResizeLeftBoundary =
          tokenIndex >= 0 &&
          token.startMs !== undefined &&
          (previousToken === undefined ||
            (previousToken.startMs !== undefined &&
              previousToken.endMs !== undefined));
        if (canResizeLeftBoundary) {
          addWordBoundary(
            syllableLeft,
            token.id,
            'resize-start',
            selection?.kind === 'word' && selection.id === token.id,
          );
        }
        const canResizeRightBoundary =
          tokenIndex >= 0 &&
          token.endMs !== undefined &&
          (nextToken === undefined ||
            (nextToken.startMs !== undefined && nextToken.endMs !== undefined));
        if (canResizeRightBoundary) {
          addWordBoundary(
            syllableRight,
            token.id,
            'resize-end',
            selection?.kind === 'word' && selection.id === token.id,
          );
        }
      });
      context.restore();
      let wordFill = userTouched
        ? 'rgba(128, 241, 194, .9)'
        : 'rgba(181, 204, 222, .66)';
      if (wordComplete) {
        wordFill = userTouched
          ? 'rgba(172, 255, 220, .98)'
          : 'rgba(216, 234, 246, .9)';
      }
      if (selected) {
        wordFill = '#f5fffe';
      }
      context.fillStyle = wordFill;
      context.save();
      context.beginPath();
      context.rect(labelLeft, wordCenterY - 12, labelWidth, 24);
      context.clip();
      context.fillText(word.text, centerX, wordCenterY);
      if (wordProgress > 0 && !wordComplete) {
        const textLeft = centerX - measuredWidth / 2;
        context.beginPath();
        context.rect(
          textLeft,
          wordCenterY - 14,
          measuredWidth * wordProgress,
          28,
        );
        context.clip();
        context.fillStyle = '#73fff3';
        context.shadowColor = '#21e8d6';
        context.shadowBlur = wordActive ? 11 : 4;
        context.fillText(word.text, centerX, wordCenterY);
      }
      context.restore();
    });

    // Boundary handles win hit-testing over the wider word/underline regions.
    regions.push(...wordBoundaryRegions);

    const lyricWordIdByTokenId = new Map<string, string>();
    canvasLyricWords.forEach((word) => {
      word.syllables.forEach(({ token }) => {
        lyricWordIdByTokenId.set(token.id, word.id);
      });
    });
    const orderedNotes = [...project.melody.notes].sort(
      (left, right) => left.startMs - right.startMs,
    );
    orderedNotes.slice(1).forEach((note, index) => {
      const previousNote = orderedNotes[index];
      const previousArticulation = karaokeLeadNoteArticulation(previousNote);
      const previousWordId = previousNote.tokenId
        ? lyricWordIdByTokenId.get(previousNote.tokenId)
        : undefined;
      const currentWordId = note.tokenId
        ? lyricWordIdByTokenId.get(note.tokenId)
        : undefined;
      if (
        !previousWordId ||
        previousWordId !== currentWordId ||
        previousNote.tokenId === note.tokenId ||
        previousNote.endMs < viewStartMs ||
        note.startMs > viewStartMs + visibleViewDurationMs
      ) {
        return;
      }
      const startX = Math.max(plotLeft, timeX(previousArticulation.endMs));
      const endX = Math.min(plotRight, timeX(note.startMs));
      const startY = noteY(previousNote.targetMidi);
      const endY = noteY(note.targetMidi);
      const controlX = (startX + endX) / 2;
      context.save();
      context.strokeStyle = 'rgba(79, 231, 220, .7)';
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.shadowColor = 'rgba(37, 226, 211, .5)';
      context.shadowBlur = 6;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(controlX, startY, controlX, endY, endX, endY);
      context.stroke();
      context.restore();
    });

    project.melody.notes.forEach((note) => {
      if (
        note.endMs < viewStartMs ||
        note.startMs > viewStartMs + visibleViewDurationMs
      ) {
        return;
      }
      const articulation = karaokeLeadNoteArticulation(note);
      const left = Math.max(plotLeft, timeX(articulation.startMs));
      const right = Math.min(
        plotRight,
        Math.max(left + 5, timeX(articulation.endMs)),
      );
      const centerY = noteY(note.targetMidi);
      const noteHeight = Math.max(
        8,
        (plotHeight / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * 0.8,
      );
      const selected = selectedNoteIds.has(note.id);
      const active = karaokeMakerNoteIsActive(
        articulation.startMs,
        articulation.endMs,
        visualPlayheadMs,
      );
      const noteProgress = active
        ? karaokeMakerNoteProgress(
            articulation.startMs,
            articulation.endMs,
            visualPlayheadMs,
          )
        : 0;
      let noteShadowColor = 'rgba(43, 216, 255, .54)';
      let noteShadowBlur = 4;
      let noteGradientTop = '#58bfd7';
      let noteGradientBottom = '#316f9f';
      if (selected) {
        noteShadowColor = '#f5fb73';
        noteShadowBlur = 13;
        noteGradientTop = '#bffff7';
        noteGradientBottom = '#39e5d3';
      }
      context.save();
      context.shadowColor = noteShadowColor;
      context.shadowBlur = noteShadowBlur;
      const noteGradient = context.createLinearGradient(
        0,
        centerY - noteHeight / 2,
        0,
        centerY + noteHeight / 2,
      );
      if (note.kind === 'golden') {
        noteGradient.addColorStop(0, '#fff484');
        noteGradient.addColorStop(1, '#ffb52d');
      } else {
        noteGradient.addColorStop(0, noteGradientTop);
        noteGradient.addColorStop(1, noteGradientBottom);
      }
      context.fillStyle = noteGradient;
      drawRoundedRect(
        context,
        left,
        centerY - noteHeight / 2,
        right - left,
        noteHeight,
        noteHeight / 2,
      );
      context.fill();
      if (active) {
        const progressRight = left + (right - left) * noteProgress;
        const progressGradient = context.createLinearGradient(
          0,
          centerY - noteHeight / 2,
          0,
          centerY + noteHeight / 2,
        );
        progressGradient.addColorStop(
          0,
          note.kind === 'golden' ? '#fffde0' : '#e8fffd',
        );
        progressGradient.addColorStop(
          1,
          note.kind === 'golden' ? '#ffc743' : '#27ead8',
        );
        context.save();
        drawRoundedRect(
          context,
          left,
          centerY - noteHeight / 2,
          right - left,
          noteHeight,
          noteHeight / 2,
        );
        context.clip();
        context.fillStyle = progressGradient;
        context.shadowColor = note.kind === 'golden' ? '#ffe571' : '#45fff0';
        context.shadowBlur = 14;
        context.fillRect(
          left,
          centerY - noteHeight / 2,
          Math.max(1, progressRight - left),
          noteHeight,
        );
        context.restore();

        context.lineWidth = 1.4;
        context.strokeStyle =
          note.kind === 'golden'
            ? 'rgba(255, 253, 210, .96)'
            : 'rgba(221, 255, 252, .96)';
        context.stroke();

        const playbackX = Math.max(left, Math.min(right, progressRight));
        const shine = context.createLinearGradient(
          playbackX - 10,
          0,
          playbackX + 4,
          0,
        );
        shine.addColorStop(0, 'rgba(255, 255, 255, 0)');
        shine.addColorStop(0.72, 'rgba(255, 255, 255, .68)');
        shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
        context.fillStyle = shine;
        context.beginPath();
        context.roundRect(
          Math.max(left, playbackX - 10),
          centerY - noteHeight / 2,
          Math.min(14, right - Math.max(left, playbackX - 10)),
          noteHeight,
          noteHeight / 2,
        );
        context.fill();
        context.save();
        context.strokeStyle = note.kind === 'golden' ? '#fff7a3' : '#effffc';
        context.lineWidth = 1.2;
        context.shadowColor = note.kind === 'golden' ? '#ffe571' : '#4affef';
        context.shadowBlur = 8;
        context.beginPath();
        context.moveTo(playbackX, centerY - noteHeight / 2 + 1);
        context.lineTo(playbackX, centerY + noteHeight / 2 - 1);
        context.stroke();
        context.restore();
      }
      context.restore();
      context.fillStyle =
        selected || active
          ? 'rgba(245, 255, 254, .98)'
          : 'rgba(207, 231, 238, .7)';
      context.font = `${active ? 750 : 600} 9px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.fillText(
        midiName(note.targetMidi),
        left + (right - left) / 2,
        centerY - noteHeight / 2 - 4,
      );
      if (controlLinkMode && selected) {
        const indicatorX = Math.max(left + 6, Math.min(right - 6, right - 7));
        context.save();
        context.strokeStyle = '#cafffa';
        context.lineWidth = 1.3;
        context.setLineDash([4, 3]);
        context.shadowColor = '#20e6d4';
        context.shadowBlur = 10;
        drawRoundedRect(
          context,
          left - 2,
          centerY - noteHeight / 2 - 2,
          right - left + 4,
          noteHeight + 4,
          noteHeight / 2 + 2,
        );
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = '#062731';
        context.beginPath();
        context.arc(indicatorX, centerY, 5.5, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = '#bafff8';
        context.shadowBlur = 4;
        context.beginPath();
        context.arc(indicatorX - 1.7, centerY - 1, 2.1, -0.7, 2.2);
        context.arc(indicatorX + 1.7, centerY + 1, 2.1, 2.45, 5.35);
        context.stroke();
        context.restore();
      }
      if (
        hoveredEditHandle?.kind === 'note' &&
        hoveredEditHandle.id === note.id
      ) {
        const centerX = left + (right - left) / 2;
        context.save();
        context.shadowColor = '#22ead8';
        context.shadowBlur = 9;
        if (!note.tokenId) {
          [left, right].forEach((handleX) => {
            context.beginPath();
            context.fillStyle = '#082839';
            context.strokeStyle = '#9efff6';
            context.lineWidth = 1.4;
            context.arc(handleX, centerY, 3.8, 0, Math.PI * 2);
            context.fill();
            context.stroke();
          });
        }
        if (right - left >= 18) {
          context.fillStyle = 'rgba(5, 34, 46, .94)';
          context.strokeStyle = 'rgba(167, 255, 247, .82)';
          context.lineWidth = 1;
          drawRoundedRect(context, centerX - 7, centerY - 4, 14, 8, 4);
          context.fill();
          context.stroke();
          context.fillStyle = '#bafff8';
          [-3, 0, 3].forEach((offset) => {
            context.beginPath();
            context.arc(centerX + offset, centerY, 0.8, 0, Math.PI * 2);
            context.fill();
          });
        }
        context.restore();
      }
      regions.push({
        kind: 'note',
        id: note.id,
        left,
        right,
        top: centerY - noteHeight / 2 - 8,
        bottom: centerY + noteHeight / 2 + 5,
      });
    });

    const notePaintDraft = notePaintDraftRef.current;
    if (notePaintDraft) {
      const left = Math.max(
        plotLeft,
        Math.min(notePaintDraft.startX, notePaintDraft.currentX),
      );
      const right = Math.min(
        plotRight,
        Math.max(notePaintDraft.startX + 5, notePaintDraft.currentX),
      );
      const centerY = Math.max(plotTop, Math.min(plotBottom, notePaintDraft.y));
      const noteHeight = Math.max(
        8,
        (plotHeight / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * 0.8,
      );
      context.save();
      context.fillStyle = 'rgba(58, 242, 222, .34)';
      context.strokeStyle = '#a2fff7';
      context.lineWidth = 1.5;
      context.shadowColor = '#20e6d4';
      context.shadowBlur = 12;
      drawRoundedRect(
        context,
        left,
        centerY - noteHeight / 2,
        Math.max(5, right - left),
        noteHeight,
        noteHeight / 2,
      );
      context.fill();
      context.stroke();
      context.restore();
    }

    const selectionBox = selectionBoxRef.current;
    if (selectionBox) {
      const left = Math.max(
        plotLeft,
        Math.min(selectionBox.startX, selectionBox.currentX),
      );
      const right = Math.min(
        plotRight,
        Math.max(selectionBox.startX, selectionBox.currentX),
      );
      const top = Math.max(
        plotTop,
        Math.min(selectionBox.startY, selectionBox.currentY),
      );
      const bottom = Math.min(
        plotBottom,
        Math.max(selectionBox.startY, selectionBox.currentY),
      );
      context.save();
      context.fillStyle = 'rgba(31, 226, 208, .09)';
      context.strokeStyle = 'rgba(126, 255, 244, .88)';
      context.lineWidth = 1.25;
      context.setLineDash([6, 4]);
      context.shadowColor = 'rgba(31, 226, 208, .55)';
      context.shadowBlur = 8;
      context.fillRect(
        left,
        top,
        Math.max(0, right - left),
        Math.max(0, bottom - top),
      );
      context.strokeRect(
        left + 0.5,
        top + 0.5,
        Math.max(0, right - left - 1),
        Math.max(0, bottom - top - 1),
      );
      context.restore();
    }

    const noteLinkDrag = noteLinkDragRef.current;
    if (noteLinkDrag) {
      const targetWord = [...regions]
        .reverse()
        .find(
          (region) =>
            region.kind === 'word' &&
            region.behavior === undefined &&
            noteLinkDrag.currentX >= region.left &&
            noteLinkDrag.currentX <= region.right &&
            noteLinkDrag.currentY >= region.top &&
            noteLinkDrag.currentY <= region.bottom,
        );
      context.save();
      context.strokeStyle = targetWord ? '#b8fff8' : 'rgba(104, 241, 231, .8)';
      context.lineWidth = targetWord ? 2.2 : 1.5;
      context.setLineDash(targetWord ? [] : [7, 5]);
      context.shadowColor = '#20e6d4';
      context.shadowBlur = targetWord ? 14 : 8;
      context.beginPath();
      context.moveTo(noteLinkDrag.startX, noteLinkDrag.startY);
      context.lineTo(noteLinkDrag.currentX, noteLinkDrag.currentY);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = targetWord ? '#eafffd' : '#74eee4';
      context.beginPath();
      context.arc(
        noteLinkDrag.currentX,
        noteLinkDrag.currentY,
        targetWord ? 5 : 3.5,
        0,
        Math.PI * 2,
      );
      context.fill();
      if (targetWord) {
        context.strokeStyle = 'rgba(139, 255, 247, .9)';
        context.lineWidth = 1.4;
        drawRoundedRect(
          context,
          targetWord.left - 3,
          targetWord.top - 3,
          targetWord.right - targetWord.left + 6,
          targetWord.bottom - targetWord.top + 6,
          7,
        );
        context.stroke();
      }
      context.restore();
    }

    const playheadX = timeX(visualPlayheadMs);
    if (playheadX >= plotLeft && playheadX <= plotRight) {
      context.save();
      context.strokeStyle = '#19e8d6';
      context.lineWidth = 1.5;
      context.shadowColor = '#1ee7d6';
      context.shadowBlur = 8;
      context.beginPath();
      context.moveTo(playheadX, 4);
      context.lineTo(playheadX, plotBottom);
      context.stroke();
      context.fillStyle = '#76fff4';
      context.beginPath();
      context.arc(playheadX, plotTop - 4, 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    hitRegionsRef.current = regions;
  }, [
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

  const canvasPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const canvasTimeAtX = (x: number, width: number): number => {
    const plotWidth = Math.max(1, width - 72);
    return Math.max(
      0,
      Math.min(
        effectiveDurationMs,
        viewStartMs + ((x - 54) / plotWidth) * visibleViewDurationMs,
      ),
    );
  };

  const canvasMidiAtY = (y: number, height: number): number => {
    const plotHeight = Math.max(1, height - headerHeight - 28);
    return Math.max(
      MIN_NOTE_MIDI,
      Math.min(
        MAX_NOTE_MIDI,
        Math.round(
          MAX_NOTE_MIDI -
            ((y - headerHeight) / plotHeight) * (MAX_NOTE_MIDI - MIN_NOTE_MIDI),
        ),
      ),
    );
  };

  const seekCanvasPoint = (point: ReturnType<typeof canvasPoint>): number => {
    const nextTimeMs = canvasTimeAtX(point.x, point.width);
    setFollowViewport(false);
    onSeek(nextTimeMs);
    return nextTimeMs;
  };

  const auditionDraggedWord = (
    drag: IDragState,
    startMs: number,
    endMs: number,
  ) => {
    if (drag.audioAnchorMs === undefined) {
      return;
    }
    drag.auditionStartMs = Math.max(0, startMs);
    drag.auditionEndMs = Math.max(drag.auditionStartMs + 20, endMs);
    setScrubAuditionAnchorMs(drag.audioAnchorMs);
    if (drag.auditionTimerId !== undefined) {
      return;
    }
    const playCurrentRange = () => {
      if (
        dragRef.current !== drag ||
        drag.auditionStartMs === undefined ||
        drag.auditionEndMs === undefined
      ) {
        return;
      }
      drag.auditionStarted = true;
      onSeek(drag.auditionStartMs);
      Promise.resolve(onPlay()).catch(() => undefined);
      drag.auditionTimerId = window.setTimeout(
        playCurrentRange,
        Math.max(20, drag.auditionEndMs - drag.auditionStartMs),
      );
    };
    playCurrentRange();
  };

  const auditionWordScrubGrain = (scrub: ICanvasScrubState) => {
    if (!scrub.auditionWordGrain) {
      if (scrub.grainTimerId !== undefined) {
        window.clearTimeout(scrub.grainTimerId);
        scrub.grainTimerId = undefined;
        onPause();
        onSeek(scrub.anchorMs);
      }
      return;
    }
    if (scrub.grainTimerId !== undefined) {
      window.clearTimeout(scrub.grainTimerId);
    }
    onSeek(scrub.anchorMs);
    Promise.resolve(onPlay()).catch(() => undefined);
    scrub.grainTimerId = window.setTimeout(() => {
      if (scrubRef.current !== scrub) {
        return;
      }
      onPause();
      onSeek(scrub.anchorMs);
      scrub.grainTimerId = undefined;
    }, 90);
  };

  const moveViewport = (requestedStartMs: number) => {
    setFollowViewport(false);
    setViewStartMs(Math.max(0, Math.min(maximumViewStartMs, requestedStartMs)));
  };

  const resizeViewport = (
    requestedStartMs: number,
    requestedDurationMs: number,
  ) => {
    const nextDurationMs = Math.max(
      minimumViewDurationMs,
      Math.min(maximumViewDurationMs, requestedDurationMs),
    );
    setFollowViewport(false);
    setViewDurationMs(nextDurationMs);
    setViewStartMs(
      Math.max(
        0,
        Math.min(
          Math.max(0, effectiveDurationMs - nextDurationMs),
          requestedStartMs,
        ),
      ),
    );
  };

  const followPlayhead = () => {
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    setViewStartMs(
      Math.max(
        0,
        Math.min(maximumViewStartMs, playheadMs - visibleViewDurationMs * 0.2),
      ),
    );
  };

  const resetLyricZoom = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const plotWidth = Math.max(1, (canvas?.clientWidth ?? 392) - 72);
    const selected =
      selection?.kind === 'word'
        ? canvasLyricWords.find((word) =>
            word.syllables.some(({ token }) => token.id === selection.id),
          )
        : undefined;
    const focusMs =
      selected !== undefined
        ? (selected.startMs + selected.endMs) / 2
        : playheadMs;
    if (context) {
      context.font = '650 13px Inter, system-ui, sans-serif';
    }
    const priorityForWord = (word: ICanvasLyricWord) => {
      if (word.id === activeLyricWordId) {
        return 100;
      }
      if (word.id === selected?.id) {
        return 80;
      }
      return 0;
    };
    const fitted = karaokeMakerFittedLyricViewport(
      canvasLyricWords.map((word) => ({
        id: word.id,
        startMs: word.startMs,
        endMs: word.endMs,
        width: Math.max(
          34,
          (context?.measureText(word.text).width ?? word.text.length * 7.2) +
            18,
        ),
        preferredLane: word.wordIndex % 3,
        priority: priorityForWord(word),
      })),
      focusMs,
      plotWidth,
      effectiveDurationMs,
      minimumViewDurationMs,
      3,
      12,
      true,
    );
    setFollowViewport(false);
    setViewStartMs(fitted.startMs);
    setViewDurationMs(fitted.durationMs);
  }, [
    activeLyricWordId,
    canvasLyricWords,
    effectiveDurationMs,
    minimumViewDurationMs,
    playheadMs,
    selection,
  ]);

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    const plotWidth = Math.max(1, point.width - 72);
    const playheadX =
      54 + ((playheadMs - viewStartMs) / visibleViewDurationMs) * plotWidth;
    const grabbedPlayhead = Math.abs(point.x - playheadX) <= 9;
    const hit = [...hitRegionsRef.current]
      .reverse()
      .find(
        (region) =>
          point.x >= region.left - 5 &&
          point.x <= region.right + 5 &&
          point.y >= region.top &&
          point.y <= region.bottom,
      );
    if (handPanMode && hit?.kind !== 'note') {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerX: point.x,
        viewStartMs,
      };
      setFollowViewport(false);
      setIsPitchPanReady(false);
      setIsCanvasPanning(true);
      return;
    }
    if (
      noteEditMode === 'paint' &&
      !lineEntryMode &&
      !hit &&
      point.y >= headerHeight
    ) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const draft: INotePaintDraft = {
        pointerId: event.pointerId,
        startX: point.x,
        currentX: point.x,
        y: point.y,
      };
      notePaintDraftRef.current = draft;
      renderCanvasRef.current();
      return;
    }
    if (
      noteEditMode === 'select' &&
      !hit &&
      !grabbedPlayhead &&
      !lineEntryMode &&
      point.y >= headerHeight
    ) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const additive = event.ctrlKey || event.metaKey || event.shiftKey;
      const box: ICanvasSelectionBox = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        currentX: point.x,
        currentY: point.y,
        additive,
        initialNoteIds: additive ? new Set(selectedNoteIds) : new Set<string>(),
      };
      selectionBoxRef.current = box;
      renderCanvasRef.current();
      if (!additive) {
        setSelection(undefined);
        setSelectedNoteIds(new Set());
      }
      return;
    }
    if (!hit && !grabbedPlayhead && !lineEntryMode && point.y >= headerHeight) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerX: point.x,
        viewStartMs,
      };
      setFollowViewport(false);
      setIsPitchPanReady(false);
      setIsCanvasPanning(true);
      return;
    }
    if (!hit || (grabbedPlayhead && hit?.kind !== 'note') || lineEntryMode) {
      event.preventDefault();
      cancelAudibleInteractions(false);
      onPause();
      event.currentTarget.setPointerCapture(event.pointerId);
      const anchorMs = seekCanvasPoint(point);
      const scrub: ICanvasScrubState = {
        pointerId: event.pointerId,
        anchorMs,
        auditionWordGrain: hit?.kind === 'word',
      };
      scrubRef.current = scrub;
      setIsCanvasScrubbing(true);
      setScrubAuditionAnchorMs(anchorMs);
      auditionWordScrubGrain(scrub);
      setSelection(undefined);
      setSelectedNoteIds(new Set());
      return;
    }
    const edgeDistance = Math.min(
      Math.abs(point.x - hit.left),
      Math.abs(point.x - hit.right),
    );
    let behavior: IDragState['behavior'] = hit.behavior ?? 'move';
    const hitNote =
      hit.kind === 'note'
        ? project.melody.notes.find((note) => note.id === hit.id)
        : undefined;
    if (
      !hit.behavior &&
      hit.kind === 'note' &&
      !hitNote?.tokenId &&
      edgeDistance <= 8
    ) {
      behavior =
        Math.abs(point.x - hit.left) < Math.abs(point.x - hit.right)
          ? 'resize-start'
          : 'resize-end';
    }
    const nextSelection = { kind: hit.kind, id: hit.id } as Exclude<
      TSelection,
      undefined
    >;
    if (hit.kind === 'note' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      noteLinkDragRef.current = {
        pointerId: event.pointerId,
        noteId: hit.id,
        startX: (hit.left + hit.right) / 2,
        startY: (hit.top + hit.bottom) / 2,
        currentX: point.x,
        currentY: point.y,
        initialNoteIds: new Set(selectedNoteIds),
      };
      setSelection(nextSelection);
      setSelectedNoteIds(new Set([hit.id]));
      renderCanvasRef.current();
      return;
    }
    if (hit.kind === 'note' && event.shiftKey && selectedNote) {
      event.preventDefault();
      const orderedNotes = [...project.melody.notes].sort(
        (left, right) => left.startMs - right.startMs,
      );
      const anchorIndex = orderedNotes.findIndex(
        (note) => note.id === selectedNote.id,
      );
      const hitIndex = orderedNotes.findIndex((note) => note.id === hit.id);
      if (anchorIndex >= 0 && hitIndex >= 0) {
        const rangeStart = Math.min(anchorIndex, hitIndex);
        const rangeEnd = Math.max(anchorIndex, hitIndex);
        setSelectedNoteIds(
          new Set(
            orderedNotes.slice(rangeStart, rangeEnd + 1).map((note) => note.id),
          ),
        );
        setSelection(nextSelection);
        return;
      }
    }
    let activeNoteIds = new Set<string>();
    if (hit.kind === 'note') {
      activeNoteIds = selectedNoteIds.has(hit.id)
        ? new Set(selectedNoteIds)
        : new Set([hit.id]);
    }
    setSelection(nextSelection);
    setSelectedNoteIds(activeNoteIds);
    // A lyric-linked note takes its complete timing and pitch identity from the
    // attached word/syllable. Select it normally, but require an explicit
    // detach before any direct note movement (including vertical pitch edits).
    if (hit.kind === 'note' && hitNote?.tokenId) {
      noteAudition.stop();
      return;
    }
    const dragBehavior =
      hit.kind === 'note' && activeNoteIds.size > 1 ? 'move' : behavior;
    if (hit.kind === 'note' && dragBehavior === 'move') {
      const note = project.melody.notes.find((item) => item.id === hit.id);
      if (note) {
        lastDragAuditionMidiRef.current = Math.round(note.targetMidi);
        noteAudition.play(
          note.targetMidi,
          karaokeLeadNoteArticulation(note).durationMs,
        );
      }
    } else if (hit.kind === 'note') {
      noteAudition.stop();
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      selection: nextSelection,
      behavior: dragBehavior,
      pointerX: point.x,
      pointerY: point.y,
      base: project,
      noteIds: hit.kind === 'note' ? [...activeNoteIds] : undefined,
      audioAnchorMs:
        hit.kind === 'word'
          ? Math.max(0, readPlayheadMs?.() ?? playheadMs)
          : undefined,
    };
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const noteLinkDrag = noteLinkDragRef.current;
    if (noteLinkDrag?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      noteLinkDrag.currentX = point.x;
      noteLinkDrag.currentY = point.y;
      renderCanvasRef.current();
      return;
    }
    const paintDraft = notePaintDraftRef.current;
    if (paintDraft?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      const next = { ...paintDraft, currentX: point.x };
      notePaintDraftRef.current = next;
      renderCanvasRef.current();
      return;
    }
    const activeSelectionBox = selectionBoxRef.current;
    if (activeSelectionBox?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      const next = {
        ...activeSelectionBox,
        currentX: point.x,
        currentY: point.y,
      };
      selectionBoxRef.current = next;
      renderCanvasRef.current();
      const left = Math.min(next.startX, next.currentX);
      const right = Math.max(next.startX, next.currentX);
      const top = Math.min(next.startY, next.currentY);
      const bottom = Math.max(next.startY, next.currentY);
      const nextIds = new Set(next.initialNoteIds);
      hitRegionsRef.current.forEach((region) => {
        if (
          region.kind === 'note' &&
          region.right >= left &&
          region.left <= right &&
          region.bottom >= top &&
          region.top <= bottom
        ) {
          nextIds.add(region.id);
        }
      });
      setSelectedNoteIds(nextIds);
      setSelection((current) => {
        if (current?.kind === 'note' && nextIds.has(current.id)) {
          return current;
        }
        const firstId = nextIds.values().next().value as string | undefined;
        return firstId ? { kind: 'note', id: firstId } : undefined;
      });
      return;
    }
    const pan = panRef.current;
    if (pan) {
      const point = canvasPoint(event);
      const plotWidth = Math.max(1, point.width - 72);
      setViewStartMs(
        karaokeMakerPannedViewportStart(
          pan.viewStartMs,
          point.x - pan.pointerX,
          plotWidth,
          visibleViewDurationMs,
          maximumViewStartMs,
        ),
      );
      return;
    }
    if (scrubRef.current?.pointerId === event.pointerId) {
      const scrub = scrubRef.current;
      const scrubPoint = canvasPoint(event);
      scrub.anchorMs = seekCanvasPoint(scrubPoint);
      scrub.auditionWordGrain = hitRegionsRef.current.some(
        (region) =>
          region.kind === 'word' &&
          region.behavior === undefined &&
          scrubPoint.x >= region.left &&
          scrubPoint.x <= region.right &&
          scrubPoint.y >= region.top &&
          scrubPoint.y <= region.bottom,
      );
      setScrubAuditionAnchorMs(scrub.anchorMs);
      auditionWordScrubGrain(scrub);
      return;
    }
    const drag = dragRef.current;
    const point = canvasPoint(event);
    if (!drag) {
      const hovered = [...hitRegionsRef.current]
        .reverse()
        .find(
          (region) =>
            (region.kind === 'note' || region.behavior !== undefined) &&
            point.x >= region.left - 5 &&
            point.x <= region.right + 5 &&
            point.y >= region.top &&
            point.y <= region.bottom,
        );
      setIsPitchPanReady(
        !hovered &&
          !handPanMode &&
          noteEditMode === undefined &&
          !lineEntryMode &&
          point.y >= headerHeight,
      );
      if (!hovered) {
        setHoveredEditHandle(undefined);
        return;
      }
      const leftDistance = Math.abs(point.x - hovered.left);
      const rightDistance = Math.abs(point.x - hovered.right);
      let behavior: IDragState['behavior'] = hovered.behavior ?? 'move';
      const attachedNote =
        hovered.kind === 'note'
          ? project.melody.notes.find((note) => note.id === hovered.id)
          : undefined;
      if (attachedNote?.tokenId) {
        setHoveredEditHandle(undefined);
        return;
      }
      if (!hovered.behavior && Math.min(leftDistance, rightDistance) <= 8) {
        behavior = leftDistance < rightDistance ? 'resize-start' : 'resize-end';
      }
      setHoveredEditHandle((current) =>
        current?.kind === hovered.kind &&
        current.id === hovered.id &&
        current.behavior === behavior
          ? current
          : { kind: hovered.kind, id: hovered.id, behavior },
      );
      return;
    }
    setIsPitchPanReady(false);
    setHoveredEditHandle(undefined);
    const timeDelta =
      ((point.x - drag.pointerX) / Math.max(1, point.width - 72)) *
      visibleViewDurationMs;
    const semitoneDelta = Math.round(
      (-(point.y - drag.pointerY) /
        Math.max(1, event.currentTarget.clientHeight - headerHeight - 28)) *
        (MAX_NOTE_MIDI - MIN_NOTE_MIDI),
    );
    if (drag.selection.kind === 'note') {
      const movingNoteIds = new Set(
        drag.noteIds?.length ? drag.noteIds : [drag.selection.id],
      );
      const movingNotes = drag.base.melody.notes.filter((note) =>
        movingNoteIds.has(note.id),
      );
      if (drag.behavior === 'move') {
        const baseNote = drag.base.melody.notes.find(
          (note) => note.id === drag.selection.id,
        );
        if (movingNotes.length) {
          const movableNotes = movingNotes.filter((note) => !note.tokenId);
          const minimumStartMs = movableNotes.length
            ? Math.min(...movableNotes.map((note) => note.startMs))
            : 0;
          const maximumEndMs = movableNotes.length
            ? Math.max(...movableNotes.map((note) => note.endMs))
            : effectiveDurationMs;
          const minimumMidi = movableNotes.length
            ? Math.min(...movableNotes.map((note) => note.targetMidi))
            : MIN_NOTE_MIDI;
          const maximumMidi = movableNotes.length
            ? Math.max(...movableNotes.map((note) => note.targetMidi))
            : MAX_NOTE_MIDI;
          const clampedTimeDelta = movableNotes.length
            ? Math.max(
                -minimumStartMs,
                Math.min(effectiveDurationMs - maximumEndMs, timeDelta),
              )
            : 0;
          const clampedSemitoneDelta = movableNotes.length
            ? Math.max(
                MIN_NOTE_MIDI - minimumMidi,
                Math.min(MAX_NOTE_MIDI - maximumMidi, semitoneDelta),
              )
            : 0;
          if (
            baseNote &&
            !baseNote.tokenId &&
            (Math.abs(clampedTimeDelta) > 0.5 || clampedSemitoneDelta !== 0)
          ) {
            const auditionMidi = baseNote.targetMidi + clampedSemitoneDelta;
            drag.finalAuditionMidi = auditionMidi;
            drag.finalAuditionDurationMs =
              karaokeLeadNoteArticulation(baseNote).durationMs;
            if (lastDragAuditionMidiRef.current !== auditionMidi) {
              lastDragAuditionMidiRef.current = auditionMidi;
              noteAudition.play(auditionMidi, 190);
            }
          }
          setProject({
            ...drag.base,
            melody: {
              ...drag.base.melody,
              source: 'manual',
              notes: drag.base.melody.notes.map((note) =>
                movingNoteIds.has(note.id) && !note.tokenId
                  ? {
                      ...note,
                      startMs: note.startMs + clampedTimeDelta,
                      endMs: note.endMs + clampedTimeDelta,
                      targetMidi: note.targetMidi + clampedSemitoneDelta,
                      source: 'manual' as const,
                    }
                  : note,
              ),
            },
          });
        }
        return;
      }
      setProject(
        replaceNote(drag.base, drag.selection.id, (note) => {
          if (note.tokenId) {
            return note;
          }
          if (drag.behavior === 'resize-start') {
            return {
              ...note,
              startMs: Math.max(
                0,
                Math.min(note.endMs - 40, note.startMs + timeDelta),
              ),
              source: 'manual',
            };
          }
          return {
            ...note,
            endMs: Math.min(
              effectiveDurationMs,
              Math.max(note.startMs + 40, note.endMs + timeDelta),
            ),
            source: 'manual',
          };
        }),
      );
      return;
    }
    const baseToken = flattenTokens(drag.base).find(
      (token) => token.id === drag.selection.id,
    );
    if (
      !baseToken ||
      baseToken.startMs === undefined ||
      baseToken.endMs === undefined
    ) {
      return;
    }
    const shifted =
      drag.behavior === 'move'
        ? shiftKaraokeMakerLineTailFromToken(drag.base, baseToken.id, timeDelta)
        : resizeKaraokeMakerTokenBoundary(
            drag.base,
            baseToken.id,
            drag.behavior === 'resize-start' ? 'start' : 'end',
            (drag.behavior === 'resize-start'
              ? baseToken.startMs
              : baseToken.endMs) + timeDelta,
          );
    const movedToken = flattenTokens(shifted).find(
      (token) => token.id === baseToken.id,
    );
    if (movedToken?.startMs !== undefined && movedToken.endMs !== undefined) {
      auditionDraggedWord(drag, movedToken.startMs, movedToken.endMs);
    }
    setProject(shifted);
  };

  const onCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const wasCancelled = event.type === 'pointercancel';
    const noteLinkDrag = noteLinkDragRef.current;
    if (noteLinkDrag?.pointerId === event.pointerId) {
      const point = canvasPoint(event);
      const targetWord = wasCancelled
        ? undefined
        : [...hitRegionsRef.current]
            .reverse()
            .find(
              (region) =>
                region.kind === 'word' &&
                region.behavior === undefined &&
                point.x >= region.left &&
                point.x <= region.right &&
                point.y >= region.top &&
                point.y <= region.bottom,
            );
      const targetToken = targetWord
        ? flattenTokens(projectRef.current).find(
            (token) => token.id === targetWord.id,
          )
        : undefined;
      if (
        targetToken?.startMs !== undefined &&
        targetToken.endMs !== undefined
      ) {
        commit((current) => ({
          ...current,
          melody: {
            ...current.melody,
            source: 'manual',
            notes: current.melody.notes.map((note) =>
              note.id === noteLinkDrag.noteId
                ? {
                    ...note,
                    tokenId: targetToken.id,
                    startMs: targetToken.startMs as number,
                    endMs: targetToken.endMs as number,
                    source: 'manual' as const,
                  }
                : note,
            ),
          },
        }));
        setSelection({ kind: 'note', id: noteLinkDrag.noteId });
        setSelectedNoteIds(new Set([noteLinkDrag.noteId]));
      } else {
        const movedDistance = Math.hypot(
          point.x - noteLinkDrag.startX,
          point.y - noteLinkDrag.startY,
        );
        const nextNoteIds = new Set(noteLinkDrag.initialNoteIds);
        if (!wasCancelled && movedDistance < 5) {
          if (nextNoteIds.has(noteLinkDrag.noteId)) {
            nextNoteIds.delete(noteLinkDrag.noteId);
          } else {
            nextNoteIds.add(noteLinkDrag.noteId);
          }
        }
        setSelectedNoteIds(nextNoteIds);
        const firstSelectedId = nextNoteIds.values().next().value as
          string | undefined;
        setSelection(
          firstSelectedId ? { kind: 'note', id: firstSelectedId } : undefined,
        );
      }
      noteLinkDragRef.current = undefined;
      renderCanvasRef.current();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const paintDraft = notePaintDraftRef.current;
    if (paintDraft?.pointerId === event.pointerId) {
      if (wasCancelled) {
        notePaintDraftRef.current = undefined;
        renderCanvasRef.current();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        return;
      }
      const point = canvasPoint(event);
      const requestedStartTime = canvasTimeAtX(
        Math.min(paintDraft.startX, paintDraft.currentX),
        point.width,
      );
      const startTime = Math.min(
        Math.max(0, effectiveDurationMs - 40),
        requestedStartTime,
      );
      const draggedEndTime = canvasTimeAtX(
        Math.max(paintDraft.startX, paintDraft.currentX),
        point.width,
      );
      const endTime =
        Math.abs(paintDraft.currentX - paintDraft.startX) < 4
          ? Math.min(effectiveDurationMs, startTime + 500)
          : Math.max(startTime + 40, draggedEndTime);
      const targetMidi = canvasMidiAtY(paintDraft.y, point.height);
      const note: IKaraokeMakerNote = {
        id: karaokeMakerId('note'),
        startMs: startTime,
        endMs: endTime,
        targetMidi,
        kind: 'normal',
        source: 'manual',
      };
      notePaintDraftRef.current = undefined;
      renderCanvasRef.current();
      commit((current) => ({
        ...current,
        melody: {
          ...current.melody,
          source: 'manual',
          notes: [...current.melody.notes, note].sort(
            (left, right) => left.startMs - right.startMs,
          ),
        },
      }));
      setSelection({ kind: 'note', id: note.id });
      setSelectedNoteIds(new Set([note.id]));
      noteAudition.play(note.targetMidi, 240);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (selectionBoxRef.current?.pointerId === event.pointerId) {
      selectionBoxRef.current = undefined;
      renderCanvasRef.current();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (panRef.current) {
      panRef.current = undefined;
      setIsCanvasPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (scrubRef.current?.pointerId === event.pointerId) {
      const scrub = scrubRef.current;
      if (scrub.grainTimerId !== undefined) {
        window.clearTimeout(scrub.grainTimerId);
      }
      if (scrub.auditionWordGrain) {
        onPause();
        onSeek(scrub.anchorMs);
      }
      scrubRef.current = undefined;
      setIsCanvasScrubbing(false);
      setScrubAuditionAnchorMs(undefined);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    if (drag.auditionTimerId !== undefined) {
      window.clearTimeout(drag.auditionTimerId);
    }
    if (drag.auditionStarted && drag.audioAnchorMs !== undefined) {
      onPause();
      onSeek(drag.audioAnchorMs);
      setScrubAuditionAnchorMs(undefined);
    }
    dragRef.current = undefined;
    lastDragAuditionMidiRef.current = undefined;
    noteAudition.stop();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pushHistory(drag.base);
    setProject((current) => touchKaraokeMakerProject(current));
    if (
      !wasCancelled &&
      drag.behavior === 'move' &&
      drag.finalAuditionMidi !== undefined &&
      drag.finalAuditionDurationMs !== undefined
    ) {
      noteAudition.play(drag.finalAuditionMidi, drag.finalAuditionDurationMs);
    }
  };

  const onCanvasWheel = (event: ReactWheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    setFollowViewport(false);
    if (event.ctrlKey || event.metaKey) {
      const rect = event.currentTarget.getBoundingClientRect();
      const cursorProgress = Math.max(
        0,
        Math.min(
          1,
          (event.clientX - rect.left - 54) / Math.max(1, rect.width - 72),
        ),
      );
      const cursorTime = viewStartMs + cursorProgress * visibleViewDurationMs;
      const nextDuration = Math.max(
        minimumViewDurationMs,
        Math.min(
          maximumViewDurationMs,
          visibleViewDurationMs * Math.exp(event.deltaY * 0.002),
        ),
      );
      setViewDurationMs(nextDuration);
      setViewStartMs(
        Math.max(
          0,
          Math.min(
            effectiveDurationMs - nextDuration,
            cursorTime - cursorProgress * nextDuration,
          ),
        ),
      );
      return;
    }
    setViewStartMs((start) =>
      Math.max(
        0,
        Math.min(
          maximumViewStartMs,
          start +
            (event.deltaX + event.deltaY) * (visibleViewDurationMs / 2_000),
        ),
      ),
    );
  };

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
    panRef.current = undefined;
    noteLinkDragRef.current = undefined;
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

  const openLyricsEditor = () => {
    setLyricsDraft(plainLyrics(projectRef.current));
    setLyricsFileName(undefined);
    setDestructiveAction(undefined);
    const preferredToken =
      tokens.find((token) => token.id === activeLyricFocus?.tokenId) ??
      tokens[0];
    if (preferredToken) {
      setSelection({ kind: 'word', id: preferredToken.id });
    }
    setLyricsOpen(true);
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

  const seekGuidedTimeline = useCallback(
    (requestedMs: number) => {
      const nextMs = Math.max(0, Math.min(effectiveDurationMs, requestedMs));
      onSeek(nextMs);
      setFollowViewport(true);
      setViewStartMs(
        Math.max(
          0,
          Math.min(maximumViewStartMs, nextMs - visibleViewDurationMs * 0.3),
        ),
      );
    },
    [effectiveDurationMs, maximumViewStartMs, onSeek, visibleViewDurationMs],
  );

  const selectGuidedLine = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(lyricLines.length - 1, index));
      const line = lyricLines[nextIndex];
      if (!line) {
        return;
      }
      setLineEntryCapture(undefined);
      lineEntryIndexRef.current = nextIndex;
      setLineEntryIndex(nextIndex);
      setSelection({ kind: 'word', id: line.tokens[0].id });
      setLyricFollowRequestKey((key) => key + 1);
    },
    [lyricLines],
  );

  const recordLineEntry = useCallback(() => {
    if (lineEntrySession !== 'active') {
      return;
    }
    const line = lyricLines[lineEntryIndex];
    if (!line) {
      setLineEntryMode(false);
      setNotice(t('karaoke.maker.lineTimingComplete'));
      return;
    }
    const now = Math.max(0, readPlayheadMs?.() ?? playheadMs);
    const timedTokens = line.tokens.filter(
      (token) => token.startMs !== undefined && token.endMs !== undefined,
    );
    const detectedStartMs = timedTokens.length
      ? Math.min(...timedTokens.map((token) => token.startMs as number))
      : undefined;
    const detectedEndMs = timedTokens.length
      ? Math.max(...timedTokens.map((token) => token.endMs as number))
      : undefined;
    const captureStartMs = lineEntryCapture?.startMs;
    if (!lineEntryCapture || lineEntryCapture.lineId !== line.id) {
      const estimatedSpanMs =
        detectedStartMs !== undefined && detectedEndMs !== undefined
          ? Math.max(600, detectedEndMs - detectedStartMs)
          : Math.min(8_000, Math.max(1_200, line.tokens.length * 420));
      setLineEntryCapture({
        lineId: line.id,
        startMs: now,
        estimatedEndMs: Math.min(effectiveDurationMs, now + estimatedSpanMs),
        wordBoundariesMs: [],
      });
      setFollowViewport(true);
      return;
    }
    if (captureStartMs === undefined) {
      return;
    }
    const minimumCaptureMs = Math.max(
      160,
      Math.min(700, line.tokens.length * 55),
    );
    if (now - captureStartMs < minimumCaptureMs) {
      return;
    }
    const previousLine = lyricLines[lineEntryIndex - 1];
    commit((current) =>
      recordKaraokeMakerLineRange(
        current,
        line.id,
        captureStartMs,
        now,
        previousLine?.id,
        lineEntryCapture.wordBoundariesMs,
      ),
    );
    const nextIndex = lineEntryIndex + 1;
    const nextLine = lyricLines[nextIndex];
    if (!nextLine) {
      setLineEntryCapture(undefined);
      setSelection({ kind: 'word', id: line.tokens[0].id });
      setLineEntryMode(false);
      setNotice(t('karaoke.maker.lineTimingComplete'));
      return;
    }
    // Merely revealing the next sentence must never invent its START. A pause
    // between phrases is meaningful karaoke timing, so the next Enter records
    // the exact playhead position and only a later Enter records its END.
    setLineEntryCapture(undefined);
    setLineEntryIndex(nextIndex);
    // Completing a line always previews the following sentence. Playback can
    // keep painting recorded timing progress, but must not steal this focus.
    setSelection({ kind: 'word', id: nextLine.tokens[0].id });
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
    setViewStartMs(
      Math.max(
        0,
        Math.min(maximumViewStartMs, now - visibleViewDurationMs * 0.3),
      ),
    );
  }, [
    commit,
    effectiveDurationMs,
    lineEntryIndex,
    lineEntryCapture,
    lyricLines,
    maximumViewStartMs,
    playheadMs,
    readPlayheadMs,
    setNotice,
    t,
    lineEntrySession,
    visibleViewDurationMs,
  ]);

  const markNextGuidedWord = useCallback(() => {
    const line = lyricLines[lineEntryIndex];
    if (
      lineEntrySession !== 'active' ||
      !line ||
      !lineEntryCapture ||
      lineEntryCapture.lineId !== line.id
    ) {
      return;
    }
    const boundaries = lineEntryCapture.wordBoundariesMs ?? [];
    if (boundaries.length >= line.tokens.length - 1) {
      return;
    }
    const now = Math.max(0, readPlayheadMs?.() ?? playheadMs);
    const previousBoundaryMs = boundaries[boundaries.length - 1];
    if (
      now <= lineEntryCapture.startMs + 20 ||
      (previousBoundaryMs !== undefined && now <= previousBoundaryMs + 20)
    ) {
      return;
    }
    const nextBoundaries = [...boundaries, now];
    setLineEntryCapture({
      ...lineEntryCapture,
      wordBoundariesMs: nextBoundaries,
    });
    const nextToken = line.tokens[nextBoundaries.length];
    if (nextToken) {
      setSelection({ kind: 'word', id: nextToken.id });
      setLyricFollowRequestKey((key) => key + 1);
    }
  }, [
    lineEntryCapture,
    lineEntryIndex,
    lineEntrySession,
    lyricLines,
    playheadMs,
    readPlayheadMs,
  ]);

  const ignoreGuidedLine = useCallback(() => {
    const nextIndex = lineEntryIndex + 1;
    const nextLine = lyricLines[nextIndex];
    setLineEntryCapture(undefined);
    if (!nextLine) {
      setLineEntryMode(false);
      setNotice(t('karaoke.maker.lineTimingComplete'));
      return;
    }
    lineEntryIndexRef.current = nextIndex;
    setLineEntryIndex(nextIndex);
    setSelection({ kind: 'word', id: nextLine.tokens[0].id });
    setFollowViewport(true);
    setLyricFollowRequestKey((key) => key + 1);
  }, [lineEntryIndex, lyricLines, setNotice, t]);

  useEffect(() => {
    if (!lineEntryMode) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const repeatsLineNavigation =
        event.code === 'ArrowUp' || event.code === 'ArrowDown';
      if (event.repeat && !repeatsLineNavigation) {
        return;
      }
      const target =
        event.target instanceof HTMLElement ? event.target : undefined;
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      if (target?.closest('button') && event.code === 'Enter') {
        return;
      }
      if (lineEntrySession !== 'active') {
        if (lineEntrySession === 'setup' && event.code === 'Enter') {
          event.preventDefault();
          event.stopImmediatePropagation();
          startLineEntryCountdown();
          return;
        }
        if (event.code === 'Escape') {
          setLineEntryMode(false);
          clearLineEntryCountdown();
          setLineEntryCapture(undefined);
          return;
        }
        if (
          event.code === 'Enter' ||
          event.code === 'Space' ||
          event.code === 'Backspace' ||
          event.code.startsWith('Arrow')
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (event.code === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        recordLineEntry();
      } else if (event.code === 'Tab') {
        event.preventDefault();
        event.stopImmediatePropagation();
        markNextGuidedWord();
      } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const direction = event.code === 'ArrowUp' ? -1 : 1;
        const currentIndex = lineEntryIndexRef.current;
        const nextIndex = Math.max(
          0,
          Math.min(lyricLines.length - 1, currentIndex + direction),
        );
        if (nextIndex === currentIndex) {
          return;
        }
        const nextLine = lyricLines[nextIndex];
        selectGuidedLine(nextIndex);
        if (event.code === 'ArrowUp' && nextLine) {
          const recordedRange = karaokeMakerRecordedLineRange(nextLine);
          if (recordedRange) {
            seekGuidedTimeline(recordedRange.startMs);
          }
        }
      } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        event.stopImmediatePropagation();
        const now = readPlayheadMs?.() ?? playheadMs;
        const seekStepMs = event.shiftKey ? 1_000 : 2_000;
        const nextMs = Math.max(
          0,
          Math.min(
            effectiveDurationMs,
            now + (event.code === 'ArrowLeft' ? -seekStepMs : seekStepMs),
          ),
        );
        seekGuidedTimeline(nextMs);
      } else if (event.code === 'Space') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (isPlaying) {
          onPause();
        } else {
          Promise.resolve(onPlay()).catch(() => undefined);
        }
      } else if (event.code === 'Backspace') {
        event.preventDefault();
        event.stopImmediatePropagation();
        undo();
        selectGuidedLine(lineEntryIndexRef.current - 1);
      } else if (event.code === 'Escape') {
        setLineEntryMode(false);
        setLineEntryCapture(undefined);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    effectiveDurationMs,
    clearLineEntryCountdown,
    isPlaying,
    lineEntryMode,
    lineEntrySession,
    lyricLines,
    markNextGuidedWord,
    onPause,
    onPlay,
    playheadMs,
    readPlayheadMs,
    recordLineEntry,
    seekGuidedTimeline,
    selectGuidedLine,
    startLineEntryCountdown,
    undo,
  ]);

  useEffect(() => {
    if (lineEntryMode) {
      return undefined;
    }
    const navigatePreviewLyrics = (event: KeyboardEvent) => {
      if (
        (event.code !== 'ArrowUp' && event.code !== 'ArrowDown') ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        document.querySelector(
          '.karaoke-maker__modal-backdrop, .dropdown--open',
        )
      ) {
        return;
      }
      const target =
        event.target instanceof HTMLElement ? event.target : undefined;
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]') ||
        target?.closest('button')
      ) {
        return;
      }
      let currentIndex = selectedLyricLineId
        ? lyricLines.findIndex((line) => line.id === selectedLyricLineId)
        : -1;
      if (currentIndex < 0) {
        const now = Math.max(0, readPlayheadMs?.() ?? playheadMs);
        currentIndex = lyricLines.findIndex((line) => {
          const range = karaokeMakerTimedLineRange(line);
          return range && now >= range.startMs && now <= range.endMs;
        });
        if (currentIndex < 0) {
          const nextTimedIndex = lyricLines.findIndex((line) => {
            const range = karaokeMakerTimedLineRange(line);
            return range !== undefined && range.startMs >= now;
          });
          if (event.code === 'ArrowDown') {
            currentIndex = Math.max(-1, nextTimedIndex - 1);
          } else {
            currentIndex =
              nextTimedIndex >= 0 ? nextTimedIndex : lyricLines.length;
          }
        }
      }
      const direction = event.code === 'ArrowUp' ? -1 : 1;
      const nextIndex = Math.max(
        0,
        Math.min(lyricLines.length - 1, currentIndex + direction),
      );
      const nextLine = lyricLines[nextIndex];
      if (!nextLine || nextIndex === currentIndex) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      setSelection({ kind: 'word', id: nextLine.tokens[0].id });
      setSelectedNoteIds(new Set());
      setPreviewOpen(true);
      setLyricFollowRequestKey((key) => key + 1);
    };
    window.addEventListener('keydown', navigatePreviewLyrics, true);
    return () =>
      window.removeEventListener('keydown', navigatePreviewLyrics, true);
  }, [
    lineEntryMode,
    lyricLines,
    playheadMs,
    readPlayheadMs,
    selectedLyricLineId,
  ]);

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
  }, [commit, selectedNoteIds, selection]);

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
  }, [project.melody.notes, selectedNoteIds, selection]);

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
        `[karaoke][melody] basic-pitch.start file=${analysisFile.name} bytes=${analysisFile.size}`,
      );
      try {
        const notes = await analyzeKaraokeWithBasicPitch(
          analysisFile,
          setAnalysisProgress,
          controller.signal,
          karaokeMakerVocalAnalysisWindows(baseProject ?? projectRef.current),
        );
        const publishBase = baseProject ?? projectRef.current;
        const next = touchKaraokeMakerProject(
          applyBasicPitchMelody(publishBase, notes),
        );
        projectRef.current = next;
        pushHistory(publishBase);
        setProject(next);
        const generatedNoteCount = next.melody.notes.filter(
          (note) => note.source !== 'manual',
        ).length;
        reportInfo(
          `[karaoke][melody] basic-pitch.complete candidates=${notes.length} guideNotes=${generatedNoteCount}`,
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
          '[karaoke][melody] basic-pitch.failed; using local detector',
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
    const referenceTokens = flattenTokens(projectRef.current);
    if (!referenceTokens.length) {
      lyricsWorkflowActiveRef.current = false;
      setLyricsWorkflowActive(false);
      setLyricsDraft(plainLyrics(projectRef.current));
      setLyricsOpen(true);
      setNotice(t('karaoke.maker.lyricsRequired'));
      return;
    }
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
      let completedProject = applyWhisperTranscript(
        beforeTranscript,
        transcript,
      );
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
          const notes = await analyzeKaraokeWithBasicPitch(
            analysisFile,
            (progress) => setAnalysisProgress(0.72 + progress * 0.28),
            controller.signal,
            windows,
          );
          completedProject = touchKaraokeMakerProject(
            applyBasicPitchMelody(completedProject, notes),
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

  const renderLyricsModalWordInspector = () => {
    if (!selectedToken) {
      return (
        <div className="karaoke-maker__lyrics-word-empty">
          <KaraokeMakerToolIcon name="lyrics" />
          <span>{t('karaoke.maker.lyricsSelectWord')}</span>
        </div>
      );
    }
    const selectedIndex = tokens.findIndex(
      (token) => token.id === selectedToken.id,
    );
    return (
      <div className="karaoke-maker__lyrics-word-editor">
        <div className="karaoke-maker__lyrics-word-editor-head">
          <div>
            <span>{t('karaoke.maker.lyricsSelectedWord')}</span>
            <strong>{selectedToken.text}</strong>
          </div>
          <nav aria-label={t('karaoke.maker.lyricsWordNavigation')}>
            <button
              type="button"
              disabled={selectedIndex <= 0}
              onClick={() => moveLyricsEditorSelection(-1)}
              aria-label={t('karaoke.maker.previousWord')}
            >
              <KaraokeMakerToolIcon name="previous" />
            </button>
            <output>
              {selectedIndex + 1} / {tokens.length}
            </output>
            <button
              type="button"
              disabled={selectedIndex < 0 || selectedIndex >= tokens.length - 1}
              onClick={() => moveLyricsEditorSelection(1)}
              aria-label={t('karaoke.maker.nextWord')}
            >
              <KaraokeMakerToolIcon name="next" />
            </button>
          </nav>
        </div>
        <div className="karaoke-maker__lyrics-word-fields">
          <label htmlFor={`${controlId}-lyrics-word-text`}>
            <span>{t('karaoke.maker.wordText')}</span>
            <input
              id={`${controlId}-lyrics-word-text`}
              key={`${selectedToken.id}-modal-text`}
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
          `${controlId}-lyrics-word-${selectedToken.id}`,
        )}
        <div className="karaoke-maker__lyrics-word-actions">
          <button
            type="button"
            disabled={selectedToken.startMs === undefined}
            onClick={() => auditionLyricsToken(selectedToken)}
          >
            <KaraokeMakerToolIcon name="preview" />
            {t('karaoke.maker.playWord')}
          </button>
          <button
            type="button"
            onClick={() => updateSelectedTokenTiming({ startMs: playheadMs })}
          >
            <KaraokeMakerToolIcon name="timing" />
            {t('karaoke.maker.usePlayhead')}
          </button>
          <button
            type="button"
            className="is-primary"
            disabled={lyricsProcessing}
            onClick={() => startLineEntrySync(selectedToken.id)}
          >
            <KaraokeMakerToolIcon name="align" />
            {t('karaoke.maker.syncLinesFromHere')}
          </button>
          <span
            className={
              selectedToken.startMs === undefined ? 'is-untimed' : undefined
            }
          >
            {selectedToken.startMs === undefined
              ? t('karaoke.maker.untimed')
              : `${formatClock(selectedToken.startMs)} → ${formatClock(
                  selectedToken.endMs ?? selectedToken.startMs,
                )}`}
          </span>
        </div>
      </div>
    );
  };

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
    panRef.current = undefined;
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
    selectionBoxRef.current = undefined;
    notePaintDraftRef.current = undefined;
    noteLinkDragRef.current = undefined;
    setLineEntryMode(false);
    clearLineEntryCountdown();
    setLineEntryCapture(undefined);
    setIsCanvasPanning(false);
    setIsCanvasScrubbing(false);
    panRef.current = undefined;
    cancelAudibleInteractions();
    dragRef.current = undefined;
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
    panRef.current = undefined;
    scrubRef.current = undefined;
    dragRef.current = undefined;
    selectionBoxRef.current = undefined;
    notePaintDraftRef.current = undefined;
    noteLinkDragRef.current = undefined;
    cancelAudibleInteractions();
    setToolPanel(undefined);
  };

  const renderEditTools = () => (
    <>
      <KaraokeMakerToolbarButton
        icon="align"
        label={t('karaoke.maker.recordLines')}
        active={lineEntryMode}
        onClick={toggleLineEntryMode}
      />
      <KaraokeMakerToolbarButton
        icon="select"
        label={t('karaoke.maker.selectNotes')}
        active={noteEditMode === 'select'}
        onClick={() => toggleNoteEditMode('select')}
      />
      <KaraokeMakerToolbarButton
        icon="noteAdd"
        label={t('karaoke.maker.paintNotes')}
        active={noteEditMode === 'paint'}
        onClick={() => toggleNoteEditMode('paint')}
      />
      <KaraokeMakerToolbarButton
        icon="copy"
        label={t('karaoke.maker.copyNotes')}
        disabled={selection?.kind !== 'note'}
        onClick={copySelectedNotes}
      />
      <KaraokeMakerToolbarButton
        icon="paste"
        label={t('karaoke.maker.pasteNotes')}
        disabled={!copiedNotes.length}
        onClick={pasteCopiedNotes}
      />
      <KaraokeMakerToolbarButton
        icon="split"
        label={t('karaoke.maker.split')}
        disabled={!selectedNote}
        onClick={splitNote}
      />
      <KaraokeMakerToolbarButton
        icon="remove"
        label={t('karaoke.maker.delete')}
        disabled={!selection}
        onClick={deleteSelection}
      />
    </>
  );

  const speechMemoryStatusKey = (() => {
    if (whisperSession.inMemory) {
      return 'karaoke.maker.speechMemoryReady';
    }
    return whisperSession.downloaded
      ? 'karaoke.maker.speechMemoryCached'
      : 'karaoke.maker.speechMemoryMissing';
  })();

  const renderAdvancedAnalysisTools = () => (
    <>
      <KaraokeMakerToolbarButton
        icon="transcribe"
        label={t('karaoke.maker.repairLyrics')}
        onClick={() => requestWhisper(false).catch(() => undefined)}
        disabled={analysisProgress !== undefined}
      />
      <KaraokeMakerToolbarButton
        icon="melody"
        label={t('karaoke.maker.repairMelody')}
        onClick={() => runBasicPitch().catch(() => undefined)}
        disabled={analysisProgress !== undefined}
      />
      <KaraokeMakerToolbarButton
        icon="analyze"
        label={t('karaoke.maker.rebuildKaraoke')}
        onClick={() => requestWhisper(true).catch(() => undefined)}
        disabled={analysisProgress !== undefined}
      />
      <KaraokeMakerToolbarButton
        icon="stem"
        label={t(
          analysisFile === audioFile
            ? 'karaoke.maker.vocalStem'
            : 'karaoke.maker.vocalStemLoaded',
        )}
        onClick={() => vocalStemInputRef.current?.click()}
      />
      <section className="karaoke-maker__memory-panel">
        <div className="karaoke-maker__memory-heading">
          <span
            className={whisperSession.inMemory ? 'is-ready' : undefined}
            aria-hidden="true"
          />
          <strong>{t('karaoke.maker.speechMemory')}</strong>
          <em>{t(speechMemoryStatusKey)}</em>
          {whisperSession.inMemory && (
            <button
              type="button"
              disabled={whisperSession.busy}
              onClick={() => releaseWhisperNow().catch(() => undefined)}
            >
              {t('karaoke.maker.freeMemory')}
            </button>
          )}
        </div>
        <span className="karaoke-maker__memory-label">
          {t('karaoke.maker.memoryAfterUse')}
        </span>
        <div className="karaoke-maker__memory-options" role="group">
          {(['ask', 'auto', 'keep'] as const).map((policy) => (
            <button
              key={policy}
              type="button"
              className={
                whisperSession.settings.policy === policy ? 'is-active' : ''
              }
              onClick={() =>
                writeKaraokeWhisperMemorySettings({
                  ...whisperSession.settings,
                  policy,
                })
              }
            >
              {t(`karaoke.maker.memoryPolicy.${policy}`)}
            </button>
          ))}
        </div>
        {whisperSession.settings.policy !== 'keep' && (
          <div className="karaoke-maker__memory-delay" role="group">
            <span>{t('karaoke.maker.memoryAfter')}</span>
            {([5, 10, 30] as const).map((idleMinutes) => (
              <button
                key={idleMinutes}
                type="button"
                className={
                  whisperSession.settings.idleMinutes === idleMinutes
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  writeKaraokeWhisperMemorySettings({
                    ...whisperSession.settings,
                    idleMinutes,
                  })
                }
              >
                {t('karaoke.maker.memoryMinutes', { count: idleMinutes })}
              </button>
            ))}
          </div>
        )}
      </section>
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

  const whisperDownloadFraction =
    whisperStage === 'download' && downloadProgress?.progress !== undefined
      ? downloadProgress.progress
      : undefined;
  const displayedAnalysisProgress =
    whisperDownloadFraction ?? analysisProgress ?? 0;
  const analysisProgressIsIndeterminate =
    whisperStage === 'load' ||
    (whisperStage === 'download' && whisperDownloadFraction === undefined);
  let lyricsDownloadRate = '— MB/s';
  if (
    downloadProgress &&
    downloadProgress.fileCount > 0 &&
    downloadProgress.completeFiles === downloadProgress.fileCount
  ) {
    lyricsDownloadRate = '✓';
  } else if (downloadProgress?.bytesPerSecond !== undefined) {
    lyricsDownloadRate = `${formatMegabytes(
      downloadProgress.bytesPerSecond,
    )} MB/s`;
  }
  const visibleWhisperStages = WHISPER_STAGE_ORDER.filter(
    (stage) =>
      (stage !== 'download' || whisperRunProfile.needsDownload) &&
      (stage !== 'load' || whisperRunProfile.needsLoad),
  );
  const lyricsProcessing =
    KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED &&
    (lyricsWorkflowActive || analysisProgress !== undefined);
  const renderWhisperDownloadDetails = () => {
    if (whisperStage !== 'download' || !downloadProgress) {
      return null;
    }
    return (
      <div className="karaoke-maker__download-details">
        <div className="karaoke-maker__download-overall">
          <strong>{t('karaoke.maker.downloadOverall')}</strong>
          <span>
            {t('karaoke.maker.downloadFiles', {
              complete: downloadProgress.completeFiles,
              total: downloadProgress.fileCount,
            })}
          </span>
          <span>
            {formatMegabytes(downloadProgress.loadedBytes)} MB
            {downloadProgress.totalBytes !== undefined &&
              ` / ${formatMegabytes(downloadProgress.totalBytes)} MB`}
          </span>
          <span>{lyricsDownloadRate}</span>
        </div>
        <div className="karaoke-maker__download-files">
          {downloadProgress.files.map((entry) => {
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
              <div
                className="karaoke-maker__download-file-row"
                key={entry.file}
              >
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
        <div className="karaoke-maker__header-actions">
          <button
            className="karaoke-maker__header-icon"
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label={t('karaoke.maker.undo')}
            data-tooltip={t('karaoke.maker.undo')}
          >
            <KaraokeMakerToolIcon name="undo" />
          </button>
          <button
            className="karaoke-maker__header-icon"
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label={t('karaoke.maker.redo')}
            data-tooltip={t('karaoke.maker.redo')}
          >
            <KaraokeMakerToolIcon name="redo" />
          </button>
          <button
            className="karaoke-maker__header-icon"
            type="button"
            onClick={() => setDestructiveAction('restore')}
            aria-label={t('karaoke.maker.restore')}
            data-tooltip={t('karaoke.maker.restore')}
          >
            <KaraokeMakerToolIcon name="restore" />
          </button>
          <button
            className="is-primary karaoke-maker__header-action"
            type="button"
            aria-label={t('karaoke.maker.applyHint')}
            data-tooltip={t('karaoke.maker.applyHint')}
            onClick={() => {
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
          >
            <KaraokeMakerToolIcon name="apply" />
            <span>{t('karaoke.maker.apply')}</span>
          </button>
          <button
            className={`karaoke-maker__header-icon${
              isFullScreen ? ' karaoke-maker__fullscreen-exit' : ''
            }`}
            type="button"
            aria-label={t(
              isFullScreen
                ? 'karaoke.fullscreen.exit'
                : 'karaoke.fullscreen.enter',
            )}
            aria-pressed={isFullScreen}
            data-tooltip={`${t(
              isFullScreen
                ? 'karaoke.fullscreen.exit'
                : 'karaoke.fullscreen.enter',
            )} (Ctrl+F)`}
            onClick={onToggleFullScreen}
          >
            <KaraokeMakerToolIcon
              name={isFullScreen ? 'fullscreenExit' : 'fullscreen'}
            />
          </button>
        </div>
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
              <div
                className="karaoke-maker__tool-popover karaoke-maker__timing-popover"
                role="dialog"
                aria-label={t('karaoke.maker.lyricsTiming')}
              >
                <div className="karaoke-maker__popover-heading">
                  <KaraokeMakerToolIcon name="timing" />
                  <span>{t('karaoke.maker.lyricsTiming')}</span>
                  <output>
                    {Math.round(
                      timingScope === 'all' ? project.meta.gapMs : wordShiftMs,
                    )}{' '}
                    ms
                  </output>
                  <button
                    type="button"
                    className="karaoke-maker__popover-close"
                    onClick={() => setToolPanel(undefined)}
                    aria-label={t('karaoke.maker.close')}
                  >
                    ×
                  </button>
                </div>
                <div className="karaoke-maker__timing-scope" role="group">
                  <button
                    type="button"
                    className={timingScope === 'all' ? 'is-active' : ''}
                    onClick={() => setTimingScope('all')}
                  >
                    {t('karaoke.maker.timingAll')}
                  </button>
                  <button
                    type="button"
                    className={timingScope === 'from-word' ? 'is-active' : ''}
                    disabled={!canShiftFromWord}
                    onClick={() => setTimingScope('from-word')}
                  >
                    {t('karaoke.maker.timingFromWord')}
                  </button>
                </div>
                <p className="karaoke-maker__timing-hint">
                  {timingScope === 'from-word' && selectedToken
                    ? t('karaoke.maker.timingFromWordHint', {
                        word: selectedToken.text,
                      })
                    : t('karaoke.maker.timingAllHint')}
                </p>
                <div className="karaoke-maker__timing-shift">
                  <button
                    type="button"
                    onClick={() => shiftTimeline(-100)}
                    aria-label={t('karaoke.maker.earlier')}
                  >
                    −100
                  </button>
                  <input
                    type="range"
                    min={Math.min(
                      -30_000,
                      timingScope === 'all' ? project.meta.gapMs : wordShiftMs,
                    )}
                    max={Math.max(
                      60_000,
                      timingScope === 'all' ? project.meta.gapMs : wordShiftMs,
                    )}
                    step={25}
                    value={
                      timingScope === 'all' ? project.meta.gapMs : wordShiftMs
                    }
                    onChange={(event) =>
                      shiftTimeline(
                        Number(event.target.value) -
                          (timingScope === 'all'
                            ? project.meta.gapMs
                            : wordShiftMs),
                      )
                    }
                    aria-label={t('karaoke.maker.lyricsTiming')}
                  />
                  <button
                    type="button"
                    onClick={() => shiftTimeline(100)}
                    aria-label={t('karaoke.maker.later')}
                  >
                    +100
                  </button>
                </div>
              </div>
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
          {renderEditTools()}
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
              {renderEditTools()}
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
                  {renderAdvancedAnalysisTools()}
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
                {renderAdvancedAnalysisTools()}
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
            if (!dragRef.current) {
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

      {destructiveAction && destructiveAction !== 'replace-lyrics' && (
        <div className="karaoke-maker__modal-backdrop" role="presentation">
          <div
            className="karaoke-maker__confirm-modal"
            role="alertdialog"
            aria-label={t(DESTRUCTIVE_CONFIRMATIONS[destructiveAction].confirm)}
          >
            <KaraokeMakerToolIcon
              name={DESTRUCTIVE_CONFIRMATIONS[destructiveAction].icon}
            />
            <div>
              <h2>{t(DESTRUCTIVE_CONFIRMATIONS[destructiveAction].title)}</h2>
              <p>{t(DESTRUCTIVE_CONFIRMATIONS[destructiveAction].body)}</p>
            </div>
            <div className="karaoke-maker__modal-actions">
              <button
                type="button"
                onClick={() => setDestructiveAction(undefined)}
              >
                {t('karaoke.maker.cancel')}
              </button>
              <button
                className="is-danger"
                type="button"
                onClick={() => {
                  if (destructiveAction === 'notes') {
                    clearNotes();
                  } else if (destructiveAction === 'lyrics') {
                    clearLyrics();
                  } else {
                    restoreOriginal();
                  }
                }}
              >
                {t(DESTRUCTIVE_CONFIRMATIONS[destructiveAction].confirm)}
              </button>
            </div>
          </div>
        </div>
      )}

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
