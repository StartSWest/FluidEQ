/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IKaraokeMakerNote,
  IKaraokeMakerProject,
  IKaraokeMakerToken,
  createKaraokeMakerProject,
  importLyricsIntoKaraokeMakerProject,
  karaokeMakerId,
  karaokeMakerProjectToSong,
  karaokeMakerLineIsSection,
  karaokeMakerTokenWasUserTouched,
  makerLinesFromPlainText,
  parseKaraokeMakerProject,
  shiftKaraokeMakerFromToken,
  shiftKaraokeMakerTimeline,
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
import { IKaraokeSong } from '../../common/karaoke/types';
import { useTranslation } from '../utils/I18nContext';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import {
  IKaraokeMakerAnalysisResult,
  analyzeKaraokeMakerAudio,
  autoAlignNewKaraokeMakerLyrics,
  autoAlignKaraokeMakerProject,
  extractKaraokeMakerWaveform,
  karaokeMakerAnalysisNotesFromMelody,
} from './makerAnalysis';
import {
  WHISPER_MODEL,
  analyzeKaraokeWithBasicPitch,
  applyBasicPitchMelody,
  applyWhisperTranscript,
  transcribeKaraokeWithWhisper,
} from './makerAi';
import useKaraokeNoteAudition from './useKaraokeNoteAudition';
import KaraokeMakerToolIcon, {
  TKaraokeMakerToolIcon,
} from './KaraokeMakerToolIcon';
import KaraokeMakerNavigator from './KaraokeMakerNavigator';
import KaraokeMakerPreview from './KaraokeMakerPreview';
import {
  KARAOKE_MAKER_LYRIC_LANE_COUNT,
  karaokeMakerLyricFocus,
  karaokeMakerFittedLyricViewport,
  karaokeMakerNoteProgress,
  karaokeMakerNoteIsActive,
  karaokeMakerPannedViewportStart,
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

interface IHitRegion {
  kind: 'word' | 'note';
  id: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ICanvasLyricToken {
  token: IKaraokeMakerToken;
  lineIndex: number;
  lineStartMs: number;
  lineEndMs: number;
  isSection: boolean;
}

interface IDragState {
  selection: Exclude<TSelection, undefined>;
  behavior: 'move' | 'resize-start' | 'resize-end';
  pointerX: number;
  pointerY: number;
  base: IKaraokeMakerProject;
}

interface ICanvasPanState {
  pointerX: number;
  viewStartMs: number;
}

const MIN_VIEW_MS = 650;
// Twelve seconds keeps authored lyrics readable on first open; the overview
// handles still expose the entire song and let the user zoom further out.
const DEFAULT_VIEW_MS = 12_000;
const DEFAULT_PREVIEW_HEIGHT = 150;
const WAVEFORM_TOP = 9;
const WAVEFORM_HEIGHT = 27;
const LYRIC_SECTION_TOP = 43;
const LYRIC_LANE_HEIGHT = 34;
const LYRIC_SECTION_HEIGHT = KARAOKE_MAKER_LYRIC_LANE_COUNT * LYRIC_LANE_HEIGHT;
const HEADER_HEIGHT = LYRIC_SECTION_TOP + LYRIC_SECTION_HEIGHT + 10;
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
    .map((line) => line.tokens.map((token) => token.text).join(' '))
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
}

const KaraokeMakerToolbarButton = ({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: IKaraokeMakerToolbarButtonProps) => (
  <button
    type="button"
    className={`karaoke-maker__tool-button${active ? ' is-active' : ''}`}
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

const KaraokeMaker = ({
  song,
  audioFile,
  playheadMs,
  durationMs,
  isPlaying,
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
  const [project, setProject] = useState(() => createKaraokeMakerProject(song));
  const makerMelodyTarget = useMemo(
    () =>
      project.melody.notes.length
        ? {
            kind: 'notes' as const,
            source: 'fluideq-maker-editor',
            coordinateSystem: 'midi-semitones' as const,
            octavePolicy: project.melody.octavePolicy,
            notes: project.melody.notes.map((note) => ({
              text: '',
              startMs: note.startMs,
              endMs: note.endMs,
              targetMidi: note.targetMidi,
              kind: note.kind,
            })),
          }
        : undefined,
    [project.melody.notes, project.melody.octavePolicy],
  );
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
  const [past, setPast] = useState<IKaraokeMakerProject[]>([]);
  const [future, setFuture] = useState<IKaraokeMakerProject[]>([]);
  const [selection, setSelection] = useState<TSelection>(
    initialEditorView?.selection,
  );
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(() =>
    initialEditorView?.selection?.kind === 'note'
      ? new Set([initialEditorView.selection.id])
      : new Set(),
  );
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
  const [tapMode, setTapMode] = useState(false);
  const [handPanMode, setHandPanMode] = useState(false);
  const [isCanvasPanning, setIsCanvasPanning] = useState(false);
  const [tapIndex, setTapIndex] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState<number>();
  const [analysisMessage, setAnalysisMessage] = useState<string>();
  const [downloadProgress, setDownloadProgress] = useState<{
    loadedBytes: number;
    totalBytes?: number;
    bytesPerSecond?: number;
  }>();
  const [analysisError, setAnalysisError] = useState<string>();
  const [analysisRetry, setAnalysisRetry] = useState<
    'whisper' | 'whisper-runtime'
  >();
  const [analysisResult, setAnalysisResult] =
    useState<IKaraokeMakerAnalysisResult>();
  const [analysisFile, setAnalysisFile] = useState<File>(audioFile);
  const [exportOpen, setExportOpen] = useState(false);
  const [toolPanel, setToolPanel] = useState<'timing' | 'edit' | 'analysis'>();
  const [notice, setNotice] = useState<string>();
  const [restoreToast, setRestoreToast] = useState<string>();
  const [draftReady, setDraftReady] = useState(false);
  const [whisperConsentOpen, setWhisperConsentOpen] = useState(false);
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
  const toolsRef = useRef<HTMLDivElement>(null);
  const hitRegionsRef = useRef<IHitRegion[]>([]);
  const dragRef = useRef<IDragState | undefined>(undefined);
  const panRef = useRef<ICanvasPanState | undefined>(undefined);
  const lastDragAuditionMidiRef = useRef<number | undefined>(undefined);
  const analysisAbortRef = useRef<AbortController | undefined>(undefined);
  const automaticPreparationRef = useRef(false);
  const prepareAfterWhisperRef = useRef(false);
  const editorViewRef = useRef<IKaraokeMakerEditorView | undefined>(undefined);
  const editorProjectIdRef = useRef(project.id);
  const projectRef = useRef(project);
  const wordFocusAnimationRef = useRef<{
    tokenId?: string;
    startedAt: number;
  }>({ startedAt: 0 });
  const renderCanvasRef = useRef<() => void>(() => undefined);

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
  const tokens = useMemo(() => flattenTokens(project), [project]);
  const userTouchedWordCount = useMemo(
    () => tokens.filter(karaokeMakerTokenWasUserTouched).length,
    [tokens],
  );
  const canvasLyricTokens = useMemo(
    () =>
      project.lyrics.lines
        .flatMap((line, lineIndex): ICanvasLyricToken[] => {
          const isSection = karaokeMakerLineIsSection(line);
          const timedTokens = isSection
            ? []
            : line.tokens.filter(
                (token) =>
                  token.startMs !== undefined && token.endMs !== undefined,
              );
          const lineStartMs = timedTokens.length
            ? Math.min(...timedTokens.map((token) => token.startMs as number))
            : (line.startMs ?? Number.POSITIVE_INFINITY);
          const lineEndMs = timedTokens.length
            ? Math.max(...timedTokens.map((token) => token.endMs as number))
            : (line.endMs ?? line.startMs ?? Number.NEGATIVE_INFINITY);
          return line.tokens.map((originalToken) => ({
            token:
              isSection && line.startMs !== undefined
                ? {
                    ...originalToken,
                    startMs: line.startMs,
                    endMs: line.endMs ?? line.startMs + 1_200,
                  }
                : originalToken,
            lineIndex,
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
        playheadMs,
      ),
    [canvasLyricTokens, playheadMs],
  );
  if (wordFocusAnimationRef.current.tokenId !== activeLyricFocus?.tokenId) {
    wordFocusAnimationRef.current = {
      tokenId: activeLyricFocus?.tokenId,
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
  const canShiftFromWord = selectedToken?.startMs !== undefined;
  const previewSong = useMemo(() => {
    const audioAsset = song.assets.find((asset) => asset.role === 'audio');
    return audioAsset
      ? karaokeMakerProjectToSong(project, audioAsset, song.assets)
      : song;
  }, [project, song]);
  editorProjectIdRef.current = project.id;
  projectRef.current = project;
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

  const commit = useCallback(
    (edit: (current: IKaraokeMakerProject) => IKaraokeMakerProject) => {
      setProject((current) => {
        const next = touchKaraokeMakerProject(edit(current));
        setPast((history) => [...history.slice(-79), current]);
        setFuture([]);
        return next;
      });
    },
    [],
  );

  const shiftTimeline = useCallback(
    (deltaMs: number) => {
      if (timingScope === 'from-word' && selectedToken) {
        const previewShift = shiftKaraokeMakerFromToken(
          project,
          selectedToken.id,
          deltaMs,
        );
        const shiftedStart = flattenTokens(previewShift).find(
          (token) => token.id === selectedToken.id,
        )?.startMs;
        const effectiveDelta =
          selectedToken.startMs !== undefined && shiftedStart !== undefined
            ? shiftedStart - selectedToken.startMs
            : 0;
        commit((current) => {
          return shiftKaraokeMakerFromToken(current, selectedToken.id, deltaMs);
        });
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

  const undo = useCallback(() => {
    setPast((history) => {
      const previous = history[history.length - 1];
      if (!previous) {
        return history;
      }
      setProject((current) => {
        setFuture((redoHistory) => [current, ...redoHistory].slice(0, 80));
        return previous;
      });
      return history.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((history) => {
      const next = history[0];
      if (!next) {
        return history;
      }
      setProject((current) => {
        setPast((undoHistory) => [...undoHistory.slice(-79), current]);
        return next;
      });
      return history.slice(1);
    });
  }, []);

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
      // A playlist can advance during the autosave debounce. Flush the latest
      // draft before this song's keyed editor unmounts so reopening it restores
      // the exact work that was on screen.
      window.electron.ipcRenderer
        .saveKaraokeMakerDraft(projectRef.current)
        .catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    if (project.analysis.waveform?.length) {
      return undefined;
    }
    let active = true;
    extractKaraokeMakerWaveform(audioFile)
      .then(({ waveform, durationMs: decodedDurationMs }) => {
        if (!active) {
          return undefined;
        }
        setProject((current) => {
          if (current.analysis.waveform?.length) {
            return current;
          }
          return {
            ...current,
            audio: { ...current.audio, durationMs: decodedDurationMs },
            analysis: { ...current.analysis, waveform },
          };
        });
        return waveform;
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [audioFile, project.analysis.waveform?.length]);

  useEffect(() => {
    let active = true;
    window.electron.ipcRenderer
      .loadKaraokeMakerDraft(project.id)
      .then((saved) => {
        if (!active || !saved) {
          return undefined;
        }
        setProject(saved);
        setLyricsDraft(plainLyrics(saved));
        setRestoreToast(t('karaoke.maker.draftRestored'));
        return saved;
      })
      .catch(() => undefined)
      .finally(() => active && setDraftReady(true));
    return () => {
      active = false;
    };
    // The project identity belongs to the loaded song and is immutable here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restoreToast) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setRestoreToast(undefined), 2_600);
    return () => window.clearTimeout(timeout);
  }, [restoreToast]);

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

  useEffect(() => {
    if (!draftReady) {
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      window.electron.ipcRenderer
        .saveKaraokeMakerDraft(project)
        .catch(() => undefined);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [draftReady, project]);

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
        setTapMode(false);
        setHandPanMode(false);
        setIsCanvasPanning(false);
        setSelection(undefined);
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
    };
  }, []);

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
    const plotTop = HEADER_HEIGHT;
    const plotBottom = height - 28;
    const plotHeight = Math.max(1, plotBottom - plotTop);
    const timeX = (timeMs: number) =>
      plotLeft + ((timeMs - viewStartMs) / visibleViewDurationMs) * plotWidth;
    const noteY = (midi: number) =>
      plotTop +
      ((MAX_NOTE_MIDI - midi) / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * plotHeight;
    const regions: IHitRegion[] = [];

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, 'rgba(8, 24, 43, .96)');
    background.addColorStop(1, 'rgba(5, 19, 34, .98)');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const lyricBackground = context.createLinearGradient(
      0,
      LYRIC_SECTION_TOP,
      0,
      HEADER_HEIGHT,
    );
    lyricBackground.addColorStop(0, 'rgba(10, 35, 52, .72)');
    lyricBackground.addColorStop(1, 'rgba(4, 22, 36, .9)');
    context.fillStyle = lyricBackground;
    context.fillRect(
      plotLeft,
      LYRIC_SECTION_TOP - 3,
      plotWidth,
      LYRIC_SECTION_HEIGHT + 6,
    );
    for (let lane = 1; lane < KARAOKE_MAKER_LYRIC_LANE_COUNT; lane += 1) {
      const laneY = LYRIC_SECTION_TOP + lane * LYRIC_LANE_HEIGHT;
      context.strokeStyle = 'rgba(76, 151, 174, .085)';
      context.beginPath();
      context.moveTo(plotLeft, laneY);
      context.lineTo(plotRight, laneY);
      context.stroke();
    }
    context.strokeStyle = 'rgba(44, 226, 211, .18)';
    context.beginPath();
    context.moveTo(plotLeft, HEADER_HEIGHT - 1);
    context.lineTo(plotRight, HEADER_HEIGHT - 1);
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
      context.moveTo(x, HEADER_HEIGHT - 2);
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
    const layoutTokens = canvasLyricTokens.filter(
      ({ token }) =>
        token.startMs !== undefined &&
        token.endMs !== undefined &&
        token.endMs >= viewStartMs - visibleViewDurationMs &&
        token.startMs <= viewStartMs + visibleViewDurationMs * 2,
    );
    const lyricLabels = layoutTokens.map(
      ({ token, lineIndex, lineStartMs, lineEndMs, isSection }) => {
        let labelFont = '650 13px Inter, system-ui, sans-serif';
        if (isSection) {
          labelFont = '800 11px Inter, system-ui, sans-serif';
        } else if (selection?.kind === 'word' && selection.id === token.id) {
          labelFont = '750 14px Inter, system-ui, sans-serif';
        }
        context.font = labelFont;
        const measuredWidth = context.measureText(token.text).width;
        const labelWidth = Math.max(34, measuredWidth + 18);
        const rawLeft = timeX(token.startMs as number);
        const rawRight = timeX(token.endMs as number);
        const naturalCenterX = (rawLeft + rawRight) / 2;
        return {
          id: token.id,
          naturalLeft: naturalCenterX - labelWidth / 2,
          width: labelWidth,
          preferredLane: lineIndex,
          token,
          lineIndex,
          lineStartMs,
          lineEndMs,
          isSection,
          measuredWidth,
          rawLeft,
          rawRight,
        };
      },
    );
    const placedLyricLabels = new Map(
      layoutKaraokeMakerAnchoredLyricLabels(
        lyricLabels,
        plotLeft - plotWidth,
        plotRight + plotWidth,
      ).map((label) => [label.id, label]),
    );
    const lyricLabelData = new Map(
      lyricLabels.map((label) => [label.id, label]),
    );
    layoutTokens.forEach(({ token }) => {
      const label = placedLyricLabels.get(token.id);
      if (!label) {
        return;
      }
      const lyricLabel = lyricLabelData.get(token.id);
      if (!lyricLabel) {
        return;
      }
      const { rawLeft, rawRight, measuredWidth, isSection } = lyricLabel;
      if (rawRight < plotLeft || rawLeft > plotRight) {
        return;
      }
      const timingLeft = Math.max(plotLeft, rawLeft);
      const timingRight = Math.max(
        timingLeft + 3,
        Math.min(plotRight, rawRight),
      );
      const selected = selection?.kind === 'word' && selection.id === token.id;
      const userTouched = karaokeMakerTokenWasUserTouched(token);
      const lineActive = activeLyricFocus?.lineIndex === lyricLabel.lineIndex;
      const wordActive = activeLyricFocus?.tokenId === token.id;
      const wordComplete = lineActive && playheadMs > (token.endMs as number);
      const wordProgress = lineActive
        ? karaokeMakerWordProgress(
            token.startMs as number,
            token.endMs as number,
            playheadMs,
          )
        : 0;
      let currentFont = '650 13px Inter, system-ui, sans-serif';
      if (isSection) {
        currentFont = '800 11px Inter, system-ui, sans-serif';
      } else if (selected) {
        currentFont = '750 14px Inter, system-ui, sans-serif';
      }
      context.font = currentFont;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const { width: labelWidth, left: labelLeft, lane } = label;
      const centerX = labelLeft + labelWidth / 2;
      const wordCenterY =
        LYRIC_SECTION_TOP + lane * LYRIC_LANE_HEIGHT + LYRIC_LANE_HEIGHT / 2;
      if (isSection) {
        context.save();
        context.fillStyle = 'rgba(103, 241, 232, .82)';
        context.shadowColor = 'rgba(36, 223, 207, .36)';
        context.shadowBlur = 9;
        context.fillText(token.text.toUpperCase(), centerX, wordCenterY);
        context.strokeStyle = 'rgba(45, 215, 202, .32)';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(timingLeft, wordCenterY + 10);
        context.lineTo(timingRight, wordCenterY + 10);
        context.stroke();
        context.restore();
        return;
      }
      // The playback focus owns the single rounded highlight. A selection at
      // another timestamp stays visible through its bright text/underline,
      // but does not compete with the word currently being performed.
      const showFocusBox =
        wordActive || (selected && activeLyricFocus?.tokenId === undefined);
      if (showFocusBox) {
        const elapsed =
          wordActive && wordFocusAnimationRef.current.tokenId === token.id
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
      // Green means the user has explicitly confirmed/changed this timing.
      // Muted blue-grey remains pending, even when it came from Auto Align.
      let timingStroke = userTouched
        ? 'rgba(74, 232, 172, .8)'
        : 'rgba(111, 151, 178, .46)';
      if (wordComplete) {
        timingStroke = userTouched
          ? 'rgba(111, 255, 202, .98)'
          : 'rgba(166, 199, 221, .72)';
      }
      if (selected) {
        timingStroke = '#88fff4';
      }
      context.strokeStyle = timingStroke;
      context.lineWidth = selected ? 2 : 1.25;
      context.beginPath();
      context.moveTo(timingLeft, wordCenterY + 12);
      context.lineTo(timingRight, wordCenterY + 12);
      context.stroke();
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
      context.fillText(token.text, centerX, wordCenterY);
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
        context.fillText(token.text, centerX, wordCenterY);
      }
      context.restore();
      regions.push({
        kind: 'word',
        id: token.id,
        left: Math.min(labelLeft, timingLeft),
        right: Math.max(labelLeft + labelWidth, timingRight),
        top: wordCenterY - 14,
        bottom: wordCenterY + 15,
      });
    });

    project.melody.notes.forEach((note) => {
      if (
        note.endMs < viewStartMs ||
        note.startMs > viewStartMs + visibleViewDurationMs
      ) {
        return;
      }
      const left = Math.max(plotLeft, timeX(note.startMs));
      const right = Math.min(plotRight, Math.max(left + 5, timeX(note.endMs)));
      const centerY = noteY(note.targetMidi);
      const noteHeight = Math.max(
        8,
        (plotHeight / (MAX_NOTE_MIDI - MIN_NOTE_MIDI)) * 0.8,
      );
      const selected = selectedNoteIds.has(note.id);
      const active = karaokeMakerNoteIsActive(
        note.startMs,
        note.endMs,
        playheadMs,
      );
      const noteProgress = active
        ? karaokeMakerNoteProgress(note.startMs, note.endMs, playheadMs)
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
      regions.push({
        kind: 'note',
        id: note.id,
        left,
        right,
        top: centerY - noteHeight / 2 - 8,
        bottom: centerY + noteHeight / 2 + 5,
      });
    });

    const playheadX = timeX(playheadMs);
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
    canvasLyricTokens,
    effectiveDurationMs,
    playheadMs,
    project,
    selection,
    selectedNoteIds,
    visibleViewDurationMs,
    viewStartMs,
  ]);

  renderCanvasRef.current = renderCanvas;

  useEffect(() => {
    const tokenId = activeLyricFocus?.tokenId;
    if (!tokenId) {
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
  }, [activeLyricFocus?.tokenId]);

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
    };
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
        ? canvasLyricTokens.find(({ token }) => token.id === selection.id)
            ?.token
        : undefined;
    const focusMs =
      selected?.startMs !== undefined && selected.endMs !== undefined
        ? (selected.startMs + selected.endMs) / 2
        : playheadMs;
    if (context) {
      context.font = '650 13px Inter, system-ui, sans-serif';
    }
    const priorityForToken = (tokenId: string) => {
      if (activeLyricFocus?.tokenId === tokenId) {
        return 100;
      }
      if (selected?.id === tokenId) {
        return 80;
      }
      return 0;
    };
    const fitted = karaokeMakerFittedLyricViewport(
      canvasLyricTokens.flatMap(({ token, lineIndex }) =>
        token.startMs === undefined || token.endMs === undefined
          ? []
          : [
              {
                id: token.id,
                startMs: token.startMs,
                endMs: token.endMs,
                width: Math.max(
                  34,
                  (context?.measureText(token.text).width ??
                    token.text.length * 7.2) + 18,
                ),
                preferredLane: lineIndex,
                priority: priorityForToken(token.id),
              },
            ],
      ),
      focusMs,
      plotWidth,
      effectiveDurationMs,
      minimumViewDurationMs,
    );
    setFollowViewport(false);
    setViewStartMs(fitted.startMs);
    setViewDurationMs(fitted.durationMs);
  }, [
    activeLyricFocus?.tokenId,
    canvasLyricTokens,
    effectiveDurationMs,
    minimumViewDurationMs,
    playheadMs,
    selection,
  ]);

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = canvasPoint(event);
    if (handPanMode) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = {
        pointerX: point.x,
        viewStartMs,
      };
      setFollowViewport(false);
      setIsCanvasPanning(true);
      return;
    }
    const hit = [...hitRegionsRef.current]
      .reverse()
      .find(
        (region) =>
          point.x >= region.left - 5 &&
          point.x <= region.right + 5 &&
          point.y >= region.top &&
          point.y <= region.bottom,
      );
    if (!hit) {
      const plotWidth = Math.max(1, point.width - 72);
      const time =
        viewStartMs + ((point.x - 54) / plotWidth) * visibleViewDurationMs;
      onSeek(Math.max(0, Math.min(effectiveDurationMs, time)));
      setSelection(undefined);
      return;
    }
    const edgeDistance = Math.min(
      Math.abs(point.x - hit.left),
      Math.abs(point.x - hit.right),
    );
    let behavior: IDragState['behavior'] = 'move';
    if (hit.kind === 'note' && edgeDistance <= 8) {
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
      const nextNoteIds = new Set(selectedNoteIds);
      if (nextNoteIds.has(hit.id)) {
        nextNoteIds.delete(hit.id);
      } else {
        nextNoteIds.add(hit.id);
      }
      setSelectedNoteIds(nextNoteIds);
      setSelection(
        nextNoteIds.size
          ? {
              kind: 'note',
              id: nextNoteIds.has(hit.id) ? hit.id : [...nextNoteIds][0],
            }
          : undefined,
      );
      setTapMode(false);
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
        setTapMode(false);
        return;
      }
    }
    setSelection(nextSelection);
    setSelectedNoteIds(hit.kind === 'note' ? new Set([hit.id]) : new Set());
    if (hit.kind === 'note') {
      setTapMode(false);
    }
    if (hit.kind === 'note') {
      const note = project.melody.notes.find((item) => item.id === hit.id);
      if (note) {
        lastDragAuditionMidiRef.current = Math.round(note.targetMidi);
        noteAudition.play(note.targetMidi);
      }
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      selection: nextSelection,
      behavior,
      pointerX: point.x,
      pointerY: point.y,
      base: project,
    };
  };

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
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
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    const point = canvasPoint(event);
    const timeDelta =
      ((point.x - drag.pointerX) / Math.max(1, point.width - 72)) *
      visibleViewDurationMs;
    const semitoneDelta = Math.round(
      (-(point.y - drag.pointerY) /
        Math.max(1, event.currentTarget.clientHeight - HEADER_HEIGHT - 28)) *
        (MAX_NOTE_MIDI - MIN_NOTE_MIDI),
    );
    if (drag.selection.kind === 'note') {
      if (drag.behavior === 'move') {
        const baseNote = drag.base.melody.notes.find(
          (note) => note.id === drag.selection.id,
        );
        if (baseNote) {
          const auditionMidi = Math.max(
            MIN_NOTE_MIDI,
            Math.min(MAX_NOTE_MIDI, baseNote.targetMidi + semitoneDelta),
          );
          if (lastDragAuditionMidiRef.current !== auditionMidi) {
            lastDragAuditionMidiRef.current = auditionMidi;
            noteAudition.play(auditionMidi, 190);
          }
        }
      }
      setProject(
        replaceNote(drag.base, drag.selection.id, (note) => {
          if (drag.behavior === 'resize-start') {
            return {
              ...note,
              startMs: Math.max(
                0,
                Math.min(note.endMs - 40, note.startMs + timeDelta),
              ),
            };
          }
          if (drag.behavior === 'resize-end') {
            return {
              ...note,
              endMs: Math.min(
                effectiveDurationMs,
                Math.max(note.startMs + 40, note.endMs + timeDelta),
              ),
            };
          }
          const duration = note.endMs - note.startMs;
          const nextStart = Math.max(
            0,
            Math.min(effectiveDurationMs - duration, note.startMs + timeDelta),
          );
          return {
            ...note,
            startMs: nextStart,
            endMs: nextStart + duration,
            targetMidi: Math.max(
              MIN_NOTE_MIDI,
              Math.min(MAX_NOTE_MIDI, note.targetMidi + semitoneDelta),
            ),
          };
        }),
      );
      return;
    }
    setProject((current) => {
      const baseToken = flattenTokens(drag.base).find(
        (token) => token.id === drag.selection.id,
      );
      if (
        !baseToken ||
        baseToken.startMs === undefined ||
        baseToken.endMs === undefined
      ) {
        return current;
      }
      const duration = baseToken.endMs - baseToken.startMs;
      const nextStart = Math.max(
        0,
        Math.min(effectiveDurationMs - duration, baseToken.startMs + timeDelta),
      );
      const delta = nextStart - baseToken.startMs;
      const shifted = replaceToken(drag.base, baseToken.id, (token) => ({
        ...token,
        startMs: nextStart,
        endMs: nextStart + duration,
      }));
      return {
        ...shifted,
        melody: {
          ...shifted.melody,
          notes: shifted.melody.notes.map((note) =>
            note.tokenId === baseToken.id
              ? {
                  ...note,
                  startMs: note.startMs + delta,
                  endMs: note.endMs + delta,
                  source: 'manual',
                }
              : note,
          ),
        },
      };
    });
  };

  const onCanvasPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (panRef.current) {
      panRef.current = undefined;
      setIsCanvasPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    dragRef.current = undefined;
    lastDragAuditionMidiRef.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPast((history) => [...history.slice(-79), drag.base]);
    setFuture([]);
    setProject((current) => {
      if (drag.selection.kind !== 'note') {
        return touchKaraokeMakerProject(current);
      }
      const moved = current.melody.notes.find(
        (note) => note.id === drag.selection.id,
      );
      if (!moved) {
        return touchKaraokeMakerProject(current);
      }
      const midpoint = (moved.startMs + moved.endMs) / 2;
      const containing = flattenTokens(current).find(
        (token) =>
          token.startMs !== undefined &&
          token.endMs !== undefined &&
          midpoint >= token.startMs &&
          midpoint <= token.endMs,
      );
      return touchKaraokeMakerProject(
        containing
          ? replaceNote(current, moved.id, (note) => ({
              ...note,
              tokenId: containing.id,
            }))
          : current,
      );
    });
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

  const replaceLyrics = () => {
    const nextLines = makerLinesFromPlainText(lyricsDraft);
    const reusableAnalysisNotes = analysisResult?.notes.length
      ? analysisResult.notes
      : karaokeMakerAnalysisNotesFromMelody(project);
    commit((current) => {
      const withNewLyrics: IKaraokeMakerProject = {
        ...current,
        lyrics: { ...current.lyrics, source: 'manual', lines: nextLines },
        melody: {
          ...current.melody,
          notes: current.melody.notes.map((note) => ({
            ...note,
            tokenId: undefined,
          })),
        },
      };
      return reusableAnalysisNotes.length
        ? autoAlignNewKaraokeMakerLyrics(withNewLyrics, reusableAnalysisNotes)
        : withNewLyrics;
    });
    setTapIndex(0);
    setSelection(undefined);
    setLyricsOpen(false);
    if (reusableAnalysisNotes.length) {
      setNotice(t('karaoke.maker.lyricsAutoAligned'));
    } else {
      // The replacement is visible immediately. The local analysis completes
      // the timing as a second undoable step once pitch regions are available.
      window.setTimeout(() => runAnalysis(true).catch(() => undefined), 0);
    }
  };

  const tapWord = useCallback(() => {
    const currentTokens = flattenTokens(project);
    const token = currentTokens[tapIndex];
    if (!token) {
      setTapMode(false);
      return;
    }
    const now = Math.max(0, playheadMs);
    const previous = currentTokens[tapIndex - 1];
    commit((current) => {
      let next = replaceToken(current, token.id, (word) => ({
        ...word,
        startMs: now,
        endMs: Math.min(effectiveDurationMs, now + 500),
        source: 'manual',
      }));
      if (previous?.startMs !== undefined) {
        next = replaceToken(next, previous.id, (word) => ({
          ...word,
          endMs: Math.max((word.startMs ?? 0) + 40, now),
        }));
      }
      return next;
    });
    setSelection({ kind: 'word', id: token.id });
    setTapIndex((index) => index + 1);
  }, [commit, effectiveDurationMs, playheadMs, project, tapIndex]);

  useEffect(() => {
    if (!tapMode) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.matches(
          'button, input, textarea, select, [contenteditable="true"]',
        )
      ) {
        return;
      }
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        tapWord();
      } else if (event.code === 'Backspace') {
        event.preventDefault();
        undo();
        setTapIndex((index) => Math.max(0, index - 1));
      } else if (event.code === 'Escape') {
        setTapMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [tapMode, tapWord, undo]);

  const addNote = () => {
    const tokenId = selectedToken?.id ?? selectedNote?.tokenId;
    const defaultPitch = selectedNote?.targetMidi ?? 60;
    const startMs = Math.max(
      0,
      Math.min(effectiveDurationMs - 300, playheadMs),
    );
    const note: IKaraokeMakerNote = {
      id: karaokeMakerId('note'),
      tokenId,
      startMs,
      endMs: Math.min(effectiveDurationMs, startMs + 500),
      targetMidi: defaultPitch,
      kind: 'normal',
      source: 'manual',
    };
    commit((current) => ({
      ...current,
      melody: {
        ...current.melody,
        source: 'manual',
        notes: [...current.melody.notes, note],
      },
    }));
    setSelection({ kind: 'note', id: note.id });
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

  useEffect(() => {
    const deleteSelectedNotes = (event: KeyboardEvent) => {
      if (
        tapMode ||
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
  }, [deleteSelection, selection?.kind, tapMode]);

  const runAnalysis = async (autoAlign: boolean) => {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setAnalysisProgress(0);
    setAnalysisMessage(t('karaoke.maker.analysisRunning'));
    setAnalysisError(undefined);
    setAnalysisRetry(undefined);
    setNotice(undefined);
    setDownloadProgress(undefined);
    downloadSampleRef.current = undefined;
    try {
      const result = await analyzeKaraokeMakerAudio(
        analysisFile,
        project.analysis.vocalFocus,
        setAnalysisProgress,
        controller.signal,
      );
      setAnalysisResult(result);
      commit((current) => {
        const withWaveform = {
          ...current,
          audio: { ...current.audio, durationMs: result.durationMs },
          analysis: {
            ...current.analysis,
            waveform: result.waveform,
            lastRunAt: new Date().toISOString(),
          },
        };
        return autoAlign
          ? autoAlignKaraokeMakerProject(withWaveform, result.notes)
          : withWaveform;
      });
      setNotice(
        autoAlign
          ? t('karaoke.maker.analysisAligned', {
              count: result.notes.length,
            })
          : t('karaoke.maker.analysisFound', { count: result.notes.length }),
      );
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAnalysisError(localizeMakerError(error, 'analysis'));
      }
    } finally {
      setAnalysisProgress(undefined);
      setAnalysisMessage(undefined);
      analysisAbortRef.current = undefined;
    }
  };

  const runBasicPitch = async () => {
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setAnalysisProgress(0);
    setAnalysisMessage(t('karaoke.maker.basicPitchRunning'));
    setAnalysisError(undefined);
    setAnalysisRetry(undefined);
    setNotice(undefined);
    try {
      const notes = await analyzeKaraokeWithBasicPitch(
        analysisFile,
        project.analysis.vocalFocus,
        setAnalysisProgress,
        controller.signal,
      );
      commit((current) => applyBasicPitchMelody(current, notes));
      setNotice(t('karaoke.maker.basicPitchFound', { count: notes.length }));
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAnalysisError(localizeMakerError(error, 'analysis'));
      }
    } finally {
      setAnalysisProgress(undefined);
      setAnalysisMessage(undefined);
      analysisAbortRef.current = undefined;
    }
  };

  const prepareKaraoke = () => {
    const needsWordTiming =
      !tokens.length ||
      tokens.some(
        (token) => token.startMs === undefined || token.endMs === undefined,
      );
    if (needsWordTiming) {
      prepareAfterWhisperRef.current = true;
      setWhisperConsentOpen(true);
      setToolPanel(undefined);
      return;
    }
    if (project.melody.notes.length) {
      setNotice(t('karaoke.maker.prepared'));
      setToolPanel(undefined);
      return;
    }
    automaticPreparationRef.current = true;
    setToolPanel(undefined);
    runBasicPitch().catch(() => undefined);
  };

  const runWhisper = async () => {
    setWhisperConsentOpen(false);
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setAnalysisProgress(0);
    setAnalysisMessage(t('karaoke.maker.whisperPreparing'));
    setAnalysisError(undefined);
    setAnalysisRetry(undefined);
    setNotice(undefined);
    try {
      const transcript = await transcribeKaraokeWithWhisper(
        analysisFile,
        project.analysis.vocalFocus,
        (progress, message, download) => {
          setAnalysisProgress(progress);
          if (
            download?.loadedBytes !== undefined &&
            Number.isFinite(download.loadedBytes)
          ) {
            const sampledAt = performance.now();
            const previous = downloadSampleRef.current;
            const elapsedSeconds = previous
              ? (sampledAt - previous.sampledAt) / 1_000
              : 0;
            const instantaneousSpeed =
              previous && elapsedSeconds > 0.12
                ? Math.max(
                    0,
                    (download.loadedBytes - previous.loadedBytes) /
                      elapsedSeconds,
                  )
                : undefined;
            let bytesPerSecond = previous?.bytesPerSecond;
            if (instantaneousSpeed !== undefined) {
              bytesPerSecond =
                previous?.bytesPerSecond === undefined
                  ? instantaneousSpeed
                  : previous.bytesPerSecond * 0.72 + instantaneousSpeed * 0.28;
            }
            downloadSampleRef.current = {
              loadedBytes: download.loadedBytes,
              sampledAt,
              bytesPerSecond,
            };
            setDownloadProgress({
              loadedBytes: download.loadedBytes,
              totalBytes:
                download.totalBytes !== undefined &&
                Number.isFinite(download.totalBytes) &&
                download.totalBytes > 0
                  ? download.totalBytes
                  : undefined,
              bytesPerSecond,
            });
          } else if (message) {
            setDownloadProgress(undefined);
            downloadSampleRef.current = undefined;
          }
          if (message) {
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
      );
      setProject((current) => {
        const next = applyWhisperTranscript(current, transcript);
        setPast((history) => [...history.slice(-79), current]);
        setFuture([]);
        setLyricsDraft(plainLyrics(next));
        return next;
      });
      setNotice(
        t('karaoke.maker.whisperMatched', { count: transcript.length }),
      );
      if (prepareAfterWhisperRef.current) {
        prepareAfterWhisperRef.current = false;
        automaticPreparationRef.current = true;
        window.setTimeout(() => runBasicPitch().catch(() => undefined), 0);
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setAnalysisError(localizeMakerError(error, 'whisper'));
        const detail = error instanceof Error ? error.message : String(error);
        setAnalysisRetry(
          /Local Whisper WASM runtime failed/i.test(detail)
            ? 'whisper-runtime'
            : 'whisper',
        );
      }
    } finally {
      setAnalysisProgress(undefined);
      setAnalysisMessage(undefined);
      setDownloadProgress(undefined);
      downloadSampleRef.current = undefined;
      analysisAbortRef.current = undefined;
    }
  };

  useEffect(() => {
    if (!draftReady || automaticPreparationRef.current) {
      return;
    }
    if (project.melody.notes.length) {
      automaticPreparationRef.current = true;
      return;
    }
    const currentTokens = flattenTokens(project);
    if (
      !currentTokens.length ||
      currentTokens.some(
        (token) => token.startMs === undefined || token.endMs === undefined,
      )
    ) {
      return;
    }
    automaticPreparationRef.current = true;
    runBasicPitch().catch(() => undefined);
    // The analyser intentionally starts once for a fully timed project. Its
    // implementation changes with render state and must not retrigger this gate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady, project.lyrics.lines, project.melody.notes.length]);

  const applyLastAnalysis = () => {
    if (!analysisResult) {
      runAnalysis(true).catch(() => undefined);
      return;
    }
    commit((current) =>
      autoAlignKaraokeMakerProject(current, analysisResult.notes),
    );
    setNotice(t('karaoke.maker.autoAlignComplete'));
  };

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
      setPast([]);
      setFuture([]);
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

  const renderSelectionInfo = () => {
    if (selectedNoteIds.size > 1) {
      return (
        <>
          <strong>{selectedNoteIds.size}×</strong>
          <span>{t('karaoke.maker.addNote')}</span>
        </>
      );
    }
    if (selectedNote) {
      return (
        <>
          <strong>{midiName(selectedNote.targetMidi)}</strong>
          <span>
            {formatClock(selectedNote.startMs)} →{' '}
            {formatClock(selectedNote.endMs)}
          </span>
          <button
            type="button"
            className="karaoke-maker__audition"
            onClick={() => noteAudition.play(selectedNote.targetMidi, 650)}
            title={t('karaoke.maker.hearNote')}
          >
            ◖)) {t('karaoke.maker.hearNote')}
          </button>
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
        </>
      );
    }
    if (selectedToken) {
      const timing =
        selectedToken.startMs === undefined
          ? t('karaoke.maker.untimed')
          : `${formatClock(selectedToken.startMs)} → ${formatClock(selectedToken.endMs ?? selectedToken.startMs)}`;
      return (
        <>
          <strong>{selectedToken.text}</strong>
          <span>{timing}</span>
        </>
      );
    }
    return <span>{t('karaoke.maker.selectHint')}</span>;
  };

  const toggleToolPanel = (panel: 'timing' | 'edit' | 'analysis') => {
    setExportOpen(false);
    setToolPanel((current) => (current === panel ? undefined : panel));
  };

  const toggleTapMode = () => {
    if (tapMode) {
      setTapMode(false);
      return;
    }
    const firstUntimed = tokens.findIndex(
      (token) => token.startMs === undefined,
    );
    setSelection(undefined);
    setHandPanMode(false);
    setIsCanvasPanning(false);
    panRef.current = undefined;
    setTapIndex(firstUntimed < 0 ? 0 : firstUntimed);
    setTapMode(true);
    setToolPanel(undefined);
  };

  const toggleHandPanMode = () => {
    setHandPanMode((active) => !active);
    setTapMode(false);
    setIsCanvasPanning(false);
    panRef.current = undefined;
    dragRef.current = undefined;
    setToolPanel(undefined);
  };

  const renderEditTools = () => (
    <>
      <KaraokeMakerToolbarButton
        icon="tap"
        label={t('karaoke.maker.tapWords')}
        active={tapMode}
        onClick={toggleTapMode}
      />
      <KaraokeMakerToolbarButton
        icon="noteAdd"
        label={t('karaoke.maker.addNote')}
        onClick={addNote}
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

  const renderAdvancedAnalysisTools = () => (
    <>
      <KaraokeMakerToolbarButton
        icon="analyze"
        label={t('karaoke.maker.localAnalysis')}
        onClick={() => runAnalysis(false).catch(() => undefined)}
        disabled={analysisProgress !== undefined}
      />
      <KaraokeMakerToolbarButton
        icon="align"
        label={t('karaoke.maker.autoAlign')}
        onClick={applyLastAnalysis}
        disabled={analysisProgress !== undefined}
      />
      <KaraokeMakerToolbarButton
        icon="melody"
        label={t('karaoke.maker.aiMelody')}
        onClick={() => runBasicPitch().catch(() => undefined)}
        disabled={analysisProgress !== undefined}
      />
      <KaraokeMakerToolbarButton
        icon="transcribe"
        label={t('karaoke.maker.transcribe')}
        onClick={() => setWhisperConsentOpen(true)}
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
      <KaraokeMakerToolbarButton
        icon="vocal"
        label={t('karaoke.maker.vocalFocus')}
        active={project.analysis.vocalFocus}
        onClick={() =>
          commit((current) => ({
            ...current,
            analysis: {
              ...current.analysis,
              vocalFocus: !current.analysis.vocalFocus,
            },
          }))
        }
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
    if (tapMode) {
      return (
        <div className="karaoke-maker__tap-status is-live">
          <span>
            {t('karaoke.maker.tapHint', {
              word: tokens[tapIndex]?.text ?? '✓',
            })}
          </span>
          <button type="button" onClick={() => setTapMode(false)}>
            × {t('karaoke.maker.cancel')}
          </button>
        </div>
      );
    }
    return <span>{t('karaoke.maker.editHint')}</span>;
  };

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
              aria-pressed={isPlaying}
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
          </div>
          <div className="karaoke-maker__transport-time">
            <time>{formatClock(playheadMs)}</time>
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
            disabled={!past.length}
            aria-label={t('karaoke.maker.undo')}
            data-tooltip={t('karaoke.maker.undo')}
          >
            <KaraokeMakerToolIcon name="undo" />
          </button>
          <button
            className="karaoke-maker__header-icon"
            type="button"
            onClick={redo}
            disabled={!future.length}
            aria-label={t('karaoke.maker.redo')}
            data-tooltip={t('karaoke.maker.redo')}
          >
            <KaraokeMakerToolIcon name="redo" />
          </button>
          <button
            className="is-primary karaoke-maker__header-action"
            type="button"
            aria-label={t('karaoke.maker.applyHint')}
            data-tooltip={t('karaoke.maker.applyHint')}
            onClick={() => {
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
            onClick={() => setLyricsOpen(true)}
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

      <div className="karaoke-maker__status-row">
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
          }${isCanvasPanning ? ' is-panning' : ''}`}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={onCanvasPointerUp}
          onWheel={onCanvasWheel}
        />
        <KaraokeMakerNavigator
          durationMs={effectiveDurationMs}
          viewportStartMs={viewStartMs}
          viewportDurationMs={visibleViewDurationMs}
          playheadMs={playheadMs}
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

      <KaraokeMakerPreview
        song={previewSong}
        playheadMs={playheadMs}
        textSize={previewTextSize}
        height={previewHeight}
        open={previewOpen}
        followRequestKey={lyricFollowRequestKey}
        title={t('karaoke.maker.livePreview')}
        showLabel={t('karaoke.maker.showPreview')}
        hideLabel={t('karaoke.maker.hidePreview')}
        resizeLabel={t('karaoke.maker.previewResize')}
        textSizeLabel={t('karaoke.lyrics.textSize')}
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
        <div className="karaoke-maker__selection-info">
          {renderSelectionInfo()}
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

      {analysisProgress !== undefined && (
        <div className="karaoke-maker__analysis-progress" role="status">
          <div className="karaoke-maker__analysis-progress-copy">
            <KaraokeMakerToolIcon name="transcribe" />
            <div>
              <div className="karaoke-maker__analysis-progress-heading">
                <strong>
                  {analysisMessage ?? t('karaoke.maker.localAnalysis')}
                </strong>
                <span>{Math.round(analysisProgress * 100)}%</span>
              </div>
              {downloadProgress && (
                <small className="karaoke-maker__download-stats">
                  <span>
                    {formatMegabytes(downloadProgress.loadedBytes)} MB
                    {downloadProgress.totalBytes !== undefined &&
                      ` / ${formatMegabytes(downloadProgress.totalBytes)} MB`}
                  </span>
                  <span>
                    {downloadProgress.bytesPerSecond !== undefined
                      ? `${formatMegabytes(downloadProgress.bytesPerSecond)} MB/s`
                      : '— MB/s'}
                  </span>
                </small>
              )}
            </div>
          </div>
          <progress value={analysisProgress} max={1} />
          <button
            type="button"
            onClick={() => analysisAbortRef.current?.abort()}
          >
            {t('karaoke.maker.cancel')}
          </button>
        </div>
      )}
      {analysisProgress === undefined && analysisError && (
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
        <div className="karaoke-maker__notice" role="status">
          <span>{notice}</span>
        </div>
      )}
      {restoreToast && (
        <div className="karaoke-maker__toast" role="status" aria-live="polite">
          <KaraokeMakerToolIcon name="apply" />
          <span>{restoreToast}</span>
        </div>
      )}

      {lyricsOpen && (
        <div className="karaoke-maker__modal-backdrop" role="presentation">
          <div
            className="karaoke-maker__lyrics-modal"
            role="dialog"
            aria-label={t('karaoke.maker.lyricsTitle')}
          >
            <div>
              <span className="karaoke-maker__eyebrow">
                {t('karaoke.maker.lyricsEyebrow')}
              </span>
              <h2>{t('karaoke.maker.lyricsTitle')}</h2>
              <p>{t('karaoke.maker.lyricsWarning')}</p>
            </div>
            <textarea
              value={lyricsDraft}
              onChange={(event) => setLyricsDraft(event.target.value)}
            />
            <div className="karaoke-maker__modal-actions">
              <button type="button" onClick={() => setLyricsOpen(false)}>
                {t('karaoke.maker.cancel')}
              </button>
              <button
                className="is-primary"
                type="button"
                onClick={replaceLyrics}
              >
                {t('karaoke.maker.replaceLyrics')}
              </button>
            </div>
          </div>
        </div>
      )}
      {whisperConsentOpen && (
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
                {t('karaoke.maker.downloadTranscribe')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KaraokeMaker;
