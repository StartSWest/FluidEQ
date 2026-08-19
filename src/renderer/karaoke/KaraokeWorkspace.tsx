/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import karaokeMicrophoneImage from '../../../assets/karaoke-microphone.png';
import { TranslationKey } from '../../common/i18n';
import {
  KARAOKE_FILE_PICKER_ACCEPT,
  IKaraokePlaylistItem,
  karaokeFileRelativePath,
  karaokeRestoredFileToken,
  selectKaraokePlaylist,
  setKaraokeRelativePath,
  setKaraokeRestoredFileToken,
} from '../../common/karaoke/files';
import {
  IKaraokeRestoredFile,
  IKaraokeRestoredSession,
  IKaraokeSessionFileReference,
} from '../../common/karaoke/sessionPersistence';
import { karaokeProviderDisplayName } from '../../common/karaoke/provider';
import { karaokeMakerProjectToSong } from '../../common/karaoke/makerProject';
import { useTranslation } from '../utils/I18nContext';
import { revealChromeNow, setChromeHeld } from '../utils/idleChrome';
import MenuIcon from '../icons/MenuIcon';
import AnchoredMenu, { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { KaraokeMicrophoneSettings } from './KaraokeMicrophone';
import KaraokeChordGuide from './KaraokeChordGuide';
import KaraokeLyrics from './KaraokeLyrics';
import {
  MAX_LYRIC_TEXT_SIZE,
  MIN_LYRIC_TEXT_SIZE,
  readLyricTextSize,
  writeLyricTextSize,
} from './karaokeLyricText';
import KaraokeTransport from './KaraokeTransport';
import KaraokeStageMedia, { hasKaraokeStageArt } from './KaraokeStageMedia';
import KaraokePitchLane from './KaraokePitchLane';
import { IKaraokePitchIssue } from './karaokePitchGeometry';
import KaraokePlaylist, { KARAOKE_PLAYLIST_DRAG_MIME } from './KaraokePlaylist';
import KaraokePaneSplitter from './KaraokePaneSplitter';
import KaraokeMaker from './KaraokeMaker';
import {
  IKaraokeSetAsideFiles,
  karaokeLyricWarningSentence,
  karaokeSetAsideFiles,
  karaokeSetAsideSentences,
} from './karaokeImportNotices';
import {
  clearKaraokeProgress,
  readKaraokeMakerOpen,
  readKaraokeProgress,
  writeKaraokeMakerOpen,
  writeKaraokeProgress,
} from './karaokeEditorPersistence';
import collectKaraokeDropFiles from './droppedFiles';
import {
  clampKaraokePitchShare,
  clampKaraokePlaylistShare,
  IKaraokeLayoutSettings,
  readKaraokeLayout,
  TKaraokeLayoutMode,
  writeKaraokeLayout,
} from './karaokeLayout';
import { useKaraokeMicrophone } from './useKaraokeMicrophone';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import { useKaraokeChordAnalysis } from './useKaraokeChordAnalysis';
import { useKaraokeVocalMix } from './useKaraokeVocalMix';
import { TKaraokeSessionError, useKaraokeSession } from './useKaraokeSession';
import {
  getKaraokeWhisperSessionSnapshot,
  releaseKaraokeWhisperModel,
  subscribeKaraokeWhisperSession,
} from './makerAi';
import '../styles/Karaoke.scss';

interface IKaraokeWorkspaceProps {
  /** Hidden instead of unmounted so future playback and capture survive tabs. */
  isHidden: boolean;
  isFullScreen?: boolean;
  isChromeIdle?: boolean;
  hasFullScreenTopBar?: boolean;
  onToggleFullScreenTopBar?: () => void;
  onToggleFullScreen?: () => void;
}

const ERROR_KEYS: Record<TKaraokeSessionError, TranslationKey> = {
  'missing-audio': 'karaoke.error.missingAudio',
  ambiguous: 'karaoke.error.ambiguous',
  unsupported: 'karaoke.error.unsupported',
  read: 'karaoke.error.read',
  playback: 'karaoke.error.playback',
};

const SOURCE_KEYS: Record<string, TranslationKey> = {
  'audio-only': 'karaoke.source.audioOnly',
  lrc: 'karaoke.source.lrc',
  elrc: 'karaoke.source.elrc',
  ultrastar: 'karaoke.source.ultrastar',
};

const STAGE_PITCH_MEDIA_QUERY = '(min-width: 1120px)';
const PLAYLIST_FOLDER_GROUPING_KEY = 'fluideq-karaoke-playlist-group-by-folder';
const PITCH_GUIDE_VISIBILITY_KEY = 'fluideq-karaoke-pitch-guide-visible';
const STAGE_ART_VISIBILITY_KEY = 'fluideq-karaoke-stage-art-visible';

export const readKaraokePlaylistFolderGrouping = (): boolean => {
  try {
    return window.localStorage.getItem(PLAYLIST_FOLDER_GROUPING_KEY) === 'true';
  } catch {
    return false;
  }
};

export const writeKaraokePlaylistFolderGrouping = (enabled: boolean): void => {
  try {
    window.localStorage.setItem(PLAYLIST_FOLDER_GROUPING_KEY, String(enabled));
  } catch {
    // Keep the live preference when storage is unavailable.
  }
};

const readPitchGuideVisibility = (): boolean => {
  try {
    return window.localStorage.getItem(PITCH_GUIDE_VISIBILITY_KEY) !== 'false';
  } catch {
    return true;
  }
};

const writePitchGuideVisibility = (visible: boolean): void => {
  try {
    window.localStorage.setItem(PITCH_GUIDE_VISIBILITY_KEY, String(visible));
  } catch {
    // Keep the live preference when storage is unavailable.
  }
};

const readStageArtVisibility = (): boolean => {
  try {
    return window.localStorage.getItem(STAGE_ART_VISIBILITY_KEY) !== 'false';
  } catch {
    return true;
  }
};

const writeStageArtVisibility = (visible: boolean): void => {
  try {
    window.localStorage.setItem(STAGE_ART_VISIBILITY_KEY, String(visible));
  } catch {
    // Keep the live preference when storage is unavailable.
  }
};

type TKaraokeLayoutStyle = CSSProperties & {
  '--karaoke-pitch-size'?: string;
  '--karaoke-playlist-size'?: string;
};

type TKaraokeLyricSizeStyle = CSSProperties & {
  '--karaoke-lyric-size-progress': string;
};

const initiallyUseStagePitch = (): boolean =>
  typeof window.matchMedia !== 'function' ||
  window.matchMedia(STAGE_PITCH_MEDIA_QUERY).matches;

const importedFileIdentity = (file: File): string =>
  karaokeFileRelativePath(file).toLowerCase();

const restoredKaraokeFile = (saved: IKaraokeRestoredFile): File => {
  const file = new File(
    saved.role === 'lyrics' ? [saved.text ?? ''] : [],
    saved.name,
    {
      type: saved.type,
      lastModified: saved.lastModified,
    },
  );
  setKaraokeRelativePath(file, saved.relativePath);
  setKaraokeRestoredFileToken(file, saved.token);
  return file;
};

const orderedRestoredPlaylist = (
  items: readonly IKaraokePlaylistItem[],
  order: readonly string[],
): IKaraokePlaylistItem[] => {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = order
    .map((id) => byId.get(id))
    .filter((item): item is IKaraokePlaylistItem => Boolean(item));
  const included = new Set(ordered.map((item) => item.id));
  items.forEach((item) => {
    if (!included.has(item.id)) {
      ordered.push(item);
    }
  });
  return ordered;
};

/** Local player composition. File bytes stay in renderer-owned File handles. */
const KaraokeWorkspace = ({
  isHidden,
  isFullScreen = false,
  isChromeIdle = false,
  hasFullScreenTopBar = true,
  onToggleFullScreenTopBar = () => undefined,
  onToggleFullScreen = () => undefined,
}: IKaraokeWorkspaceProps) => {
  const { t } = useTranslation();
  const lyricTextSizeId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const microphoneMenuButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const libraryFilesRef = useRef<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMicrophoneMenuOpen, setIsMicrophoneMenuOpen] = useState(false);
  const [isMakerOpen, setIsMakerOpen] = useState(readKaraokeMakerOpen);
  const [restoreMakerDraft, setRestoreMakerDraft] =
    useState(readKaraokeMakerOpen);
  const whisperSession = useSyncExternalStore(
    subscribeKaraokeWhisperSession,
    getKaraokeWhisperSessionSnapshot,
    getKaraokeWhisperSessionSnapshot,
  );
  const [countInCue, setCountInCue] = useState<string>();
  const [countInLabel, setCountInLabel] = useState<string>();
  const [lyricsFollowRequestKey, setLyricsFollowRequestKey] = useState(0);
  const [lyricTextSize, setLyricTextSize] = useState(readLyricTextSize);
  const [playlist, setPlaylist] = useState<IKaraokePlaylistItem[]>([]);
  const [groupPlaylistByFolder, setGroupPlaylistByFolder] = useState(
    readKaraokePlaylistFolderGrouping,
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>();
  const [setAsideFiles, setSetAsideFiles] = useState<IKaraokeSetAsideFiles>();
  const [useStagePitch, setUseStagePitch] = useState(initiallyUseStagePitch);
  const [isPitchGuideVisible, setIsPitchGuideVisible] = useState(
    readPitchGuideVisibility,
  );
  const [isStageArtVisible, setIsStageArtVisible] = useState(
    readStageArtVisibility,
  );
  const layoutMode: TKaraokeLayoutMode = isFullScreen ? 'fullscreen' : 'normal';
  const [layouts, setLayouts] = useState<
    Record<TKaraokeLayoutMode, IKaraokeLayoutSettings>
  >(() => ({
    normal: readKaraokeLayout('normal'),
    fullscreen: readKaraokeLayout('fullscreen'),
  }));
  const layoutsRef = useRef(layouts);
  const playlistResizeStartRef = useRef(0);
  const pitchResizeStartRef = useRef(0);
  const countInTimerRef = useRef<number | undefined>(undefined);
  const resumeWithCountInAfterScrubRef = useRef(false);
  const autoplayAfterLoadRef = useRef(false);
  const microphone = useKaraokeMicrophone(!isHidden);
  const session = useKaraokeSession(!isHidden);
  const { song, status, error, warning, seek } = session;
  const songId = song?.id;
  const melodyTone = useKaraokeMelodyTone({
    isActive: !isHidden && !isMakerOpen,
    isPlaying: status === 'playing',
    target: song?.pitch,
    playheadMs: session.playheadMs,
    readPlayheadMs: session.readPlayheadMs,
  });
  const chordAnalysis = useKaraokeChordAnalysis(song, !isHidden);
  // Present only for a song that has been separated. Everything downstream is
  // guarded on it, so an ordinary song shows no fader at all rather than a
  // control that does nothing.
  const { vocalLevel, setVocalLevel, canMixVocals } = useKaraokeVocalMix({
    audioRef: session.audioRef,
    vocals: song?.assets.find((asset) => asset.role === 'vocals')?.file,
  });
  // Which stem the stems-panel is listening to. 'backing' is normal play —
  // the fader blends the voice over the backing track. 'voice' inverts it:
  // the voice at full level, the slider now the amount of backing underneath,
  // starting at none. The models never see any of this; they read files.
  const [stemFocus, setStemFocus] = useState<'backing' | 'voice'>('backing');
  const [backingBlend, setBackingBlend] = useState(0);
  // The backing track's own fader, master times this. Solo drives it too:
  // voice solo pulls it to the blend, returning to backing restores it.
  const [backingLevel, setBackingLevel] = useState(1);
  const vocalBeforeSoloRef = useRef(0);
  const focusStem = useCallback(
    (row: 'backing' | 'voice') => {
      setStemFocus((current) => {
        if (row === current) {
          return current;
        }
        if (row === 'voice') {
          vocalBeforeSoloRef.current = vocalLevel;
          setVocalLevel(1);
          session.setBackingScale(backingBlend);
        } else {
          setVocalLevel(vocalBeforeSoloRef.current);
          session.setBackingScale(backingLevel);
        }
        return row;
      });
    },
    [vocalLevel, setVocalLevel, session, backingBlend, backingLevel],
  );
  const changeBackingBlend = useCallback(
    (blend: number) => {
      setBackingBlend(blend);
      session.setBackingScale(blend);
    },
    [session],
  );
  const changeBackingLevel = useCallback(
    (level: number) => {
      setBackingLevel(level);
      session.setBackingScale(level);
    },
    [session],
  );

  /** File both stems on the song; the element swaps to the backing track. */
  const applyStemsToSong = useCallback(
    (target: typeof song, vocals: File, instrumental: File) => {
      if (!target) {
        return;
      }
      session.applySong({
        ...target,
        assets: [
          ...target.assets.filter(
            (asset) => asset.role !== 'instrumental' && asset.role !== 'vocals',
          ),
          {
            id: `${target.id}-instrumental`,
            role: 'instrumental',
            file: instrumental,
            extension: 'wav',
          },
          {
            id: `${target.id}-vocals`,
            role: 'vocals',
            file: vocals,
            extension: 'wav',
          },
        ],
      });
    },
    [session],
  );

  // A song whose stems were made on an earlier run gets them back from disk,
  // so a refresh does not cost the split again. Fires once per song: as soon
  // as the assets carry stems the condition goes false.
  useEffect(() => {
    if (!song || song.assets.some((asset) => asset.role === 'vocals')) {
      return;
    }
    window.electron.ipcRenderer
      .loadKaraokeStems(song.id)
      .then((stems) => {
        if (stems) {
          applyStemsToSong(
            song,
            new File([stems.vocals as BlobPart], `${song.title} (vocals).wav`, {
              type: 'audio/wav',
            }),
            new File(
              [stems.instrumental as BlobPart],
              `${song.title} (instrumental).wav`,
              { type: 'audio/wav' },
            ),
          );
        }
        return null;
      })
      .catch(() => undefined);
  }, [song, applyStemsToSong]);

  // Leaving the tab discharges both AI models after the memory panel's idle
  // delay — the whisper worker and the separation session in main together
  // hold well over a gigabyte. Staying on the tab never discharges anything;
  // coming back cancels the countdown. 'keep' in the panel means keep.
  useEffect(() => {
    if (!isHidden || whisperSession.settings.policy === 'keep') {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      window.electron.ipcRenderer.releaseKaraokeSeparationModel();
      releaseKaraokeWhisperModel().catch(() => undefined);
    }, whisperSession.settings.idleMinutes * 60_000);
    return () => window.clearTimeout(timer);
  }, [isHidden, whisperSession.settings]);
  const isLoading = status === 'loading';
  const playheadRef = useRef(session.playheadMs);
  const sessionRef = useRef(session);
  const playlistRef = useRef(playlist);
  const selectedPlaylistIdRef = useRef(selectedPlaylistId);
  const persistenceReadyRef = useRef(false);
  sessionRef.current = session;
  playlistRef.current = playlist;
  selectedPlaylistIdRef.current = selectedPlaylistId;
  layoutsRef.current = layouts;

  // The microphone settings are anchored to the floating full-screen dock.
  // Keep that dock present while its panel is open; otherwise a person who
  // stops moving to read a device name would lose the control beneath it.
  useEffect(() => {
    if (!isFullScreen || !isMicrophoneMenuOpen) {
      return undefined;
    }
    setChromeHeld(true);
    return () => setChromeHeld(false);
  }, [isFullScreen, isMicrophoneMenuOpen]);

  const changeLyricTextSize = useCallback((nextSize: number) => {
    const normalized = Math.min(
      MAX_LYRIC_TEXT_SIZE,
      Math.max(MIN_LYRIC_TEXT_SIZE, nextSize),
    );
    setLyricTextSize(normalized);
    writeLyricTextSize(normalized);
  }, []);

  const cancelCountIn = useCallback(() => {
    if (countInTimerRef.current !== undefined) {
      window.clearTimeout(countInTimerRef.current);
      countInTimerRef.current = undefined;
    }
    setCountInCue(undefined);
    setCountInLabel(undefined);
  }, []);

  const startCountIn = useCallback(
    (label: string, onGo: () => void) => {
      cancelCountIn();
      sessionRef.current.pause();
      setCountInLabel(label);
      const cues = ['1', '2', '3', t('karaoke.practice.go')];
      const showCue = (index: number) => {
        setCountInCue(cues[index]);
        if (index === cues.length - 1) {
          onGo();
          countInTimerRef.current = window.setTimeout(() => {
            countInTimerRef.current = undefined;
            setCountInCue(undefined);
            setCountInLabel(undefined);
          }, 600);
          return;
        }
        countInTimerRef.current = window.setTimeout(
          () => showCue(index + 1),
          550,
        );
      };
      showCue(0);
    },
    [cancelCountIn, t],
  );

  const startSongPlayback = useCallback(
    (fromBeginning = false) => {
      resumeWithCountInAfterScrubRef.current = false;
      if (fromBeginning) {
        sessionRef.current.seek(0);
        setLyricsFollowRequestKey((request) => request + 1);
      }
      startCountIn(t('karaoke.countIn.ready'), () => {
        sessionRef.current.play().catch(() => undefined);
      });
    },
    [startCountIn, t],
  );
  const startSongPlaybackRef = useRef(startSongPlayback);
  startSongPlaybackRef.current = startSongPlayback;

  const practicePitchIssue = useCallback(
    (issue: IKaraokePitchIssue) => {
      resumeWithCountInAfterScrubRef.current = false;
      sessionRef.current.pause();
      sessionRef.current.seek(Math.max(0, issue.startMs - 1_500));
      setLyricsFollowRequestKey((request) => request + 1);
      startCountIn(t('karaoke.practice.ready'), () => {
        sessionRef.current.play().catch(() => undefined);
      });
    },
    [startCountIn, t],
  );

  const handleTogglePlayback = useCallback(() => {
    if (countInCue) {
      cancelCountIn();
      return;
    }
    if (status === 'playing') {
      sessionRef.current.pause();
      return;
    }
    if (resumeWithCountInAfterScrubRef.current) {
      startSongPlayback();
      return;
    }
    if (status === 'ended' || playheadRef.current <= 250) {
      startSongPlayback(status === 'ended');
      return;
    }
    sessionRef.current.play().catch(() => undefined);
  }, [cancelCountIn, countInCue, startSongPlayback, status]);

  // Maker playback is editing transport, so it starts immediately rather
  // than going through the singer-facing 1, 2, 3 count-in. The header button
  // and Space shortcut share these callbacks so they cannot drift apart.
  const handleEditorPlay = useCallback(() => {
    cancelCountIn();
    if (status === 'ended') {
      sessionRef.current.seek(0);
    }
    sessionRef.current.play().catch(() => undefined);
  }, [cancelCountIn, status]);

  const handleEditorPause = useCallback(() => {
    cancelCountIn();
    sessionRef.current.pause();
  }, [cancelCountIn]);

  const handleEditorTogglePlayback = useCallback(() => {
    if (status === 'playing') {
      handleEditorPause();
    } else {
      handleEditorPlay();
    }
  }, [handleEditorPause, handleEditorPlay, status]);

  const handleRestart = useCallback(() => {
    startSongPlayback(true);
  }, [startSongPlayback]);

  const handleSeek = useCallback(
    (timeMs: number) => {
      cancelCountIn();
      resumeWithCountInAfterScrubRef.current = false;
      seek(timeMs);
    },
    [cancelCountIn, seek],
  );

  const handleSelectLyric = useCallback(
    (timeMs: number) => {
      resumeWithCountInAfterScrubRef.current = false;
      sessionRef.current.pause();
      sessionRef.current.seek(timeMs);
      setLyricsFollowRequestKey((request) => request + 1);
      startCountIn(t('karaoke.practice.ready'), () => {
        sessionRef.current.play().catch(() => undefined);
      });
    },
    [startCountIn, t],
  );

  const handlePitchScrubStart = useCallback(() => {
    cancelCountIn();
    sessionRef.current.pause();
  }, [cancelCountIn]);

  const handlePitchScrub = useCallback((timeMs: number) => {
    sessionRef.current.seek(timeMs);
  }, []);

  const handlePitchScrubEnd = useCallback((timeMs: number) => {
    sessionRef.current.pause();
    sessionRef.current.seek(timeMs);
    resumeWithCountInAfterScrubRef.current = true;
    setLyricsFollowRequestKey((request) => request + 1);
  }, []);

  const layout = layouts[layoutMode];

  const updateLayout = useCallback(
    (patch: Partial<IKaraokeLayoutSettings>, persist = false) => {
      const nextLayout = {
        ...layoutsRef.current[layoutMode],
        ...patch,
      };
      const nextLayouts = {
        ...layoutsRef.current,
        [layoutMode]: nextLayout,
      };
      layoutsRef.current = nextLayouts;
      setLayouts(nextLayouts);
      if (persist) {
        writeKaraokeLayout(layoutMode, nextLayout);
      }
    },
    [layoutMode],
  );

  const commitLayout = useCallback(() => {
    writeKaraokeLayout(layoutMode, layoutsRef.current[layoutMode]);
  }, [layoutMode]);

  const startPlaylistResize = useCallback(() => {
    playlistResizeStartRef.current =
      layoutsRef.current[layoutMode].playlistShare;
  }, [layoutMode]);

  const resizePlaylist = useCallback(
    (deltaX: number) => {
      const width =
        playerRef.current?.getBoundingClientRect().width ||
        playerRef.current?.clientWidth ||
        window.innerWidth ||
        1_000;
      updateLayout({
        playlistShare: clampKaraokePlaylistShare(
          playlistResizeStartRef.current + deltaX / width,
        ),
        playlistCollapsed: false,
      });
    },
    [updateLayout],
  );

  const startPitchResize = useCallback(() => {
    pitchResizeStartRef.current = layoutsRef.current[layoutMode].pitchShare;
  }, [layoutMode]);

  const resizePitch = useCallback(
    (deltaY: number) => {
      const container =
        song && useStagePitch ? stageRef.current : workspaceRef.current;
      const height =
        container?.getBoundingClientRect().height ||
        container?.clientHeight ||
        window.innerHeight ||
        720;
      updateLayout({
        // The splitter sits above the lane, so moving it upward gives the lane
        // more room and moving it downward gives the lyrics more room.
        pitchShare: clampKaraokePitchShare(
          pitchResizeStartRef.current - deltaY / height,
        ),
      });
    },
    [song, updateLayout, useStagePitch],
  );

  const playerStyle: TKaraokeLayoutStyle = {
    '--karaoke-playlist-size': `${layout.playlistShare * 100}%`,
  };
  const pitchStyle: TKaraokeLayoutStyle = {
    '--karaoke-pitch-size': `${layout.pitchShare * 100}%`,
  };

  useEffect(() => {
    playheadRef.current = session.playheadMs;
  }, [session.playheadMs]);

  useEffect(() => {
    writeKaraokeMakerOpen(isMakerOpen);
  }, [isMakerOpen]);

  const persistCurrentProgress = useCallback(() => {
    if (!persistenceReadyRef.current) {
      return;
    }
    writeKaraokeProgress(selectedPlaylistIdRef.current, playheadRef.current);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(persistCurrentProgress, 250);
    return () => window.clearTimeout(timeout);
  }, [persistCurrentProgress, selectedPlaylistId, session.playheadMs]);

  useEffect(() => {
    const persistNow = () => persistCurrentProgress();
    window.addEventListener('pagehide', persistNow);
    return () => {
      window.removeEventListener('pagehide', persistNow);
      persistNow();
    };
  }, [persistCurrentProgress]);

  const persistedFileReference = useCallback(
    (file: File): IKaraokeSessionFileReference | undefined => {
      const token = karaokeRestoredFileToken(file);
      if (token) {
        return { token, relativePath: karaokeFileRelativePath(file) };
      }
      try {
        const localPath =
          window.electron?.ipcRenderer.getPathForFile?.(file) ?? '';
        return localPath
          ? { localPath, relativePath: karaokeFileRelativePath(file) }
          : undefined;
      } catch {
        return undefined;
      }
    },
    [],
  );

  const persistKaraokeSession = useCallback(() => {
    const bridge = window.electron?.ipcRenderer;
    if (!persistenceReadyRef.current || !bridge?.saveKaraokeSession) {
      return;
    }
    const files = libraryFilesRef.current
      .map(persistedFileReference)
      .filter(
        (file): file is IKaraokeSessionFileReference => file !== undefined,
      );
    if (!files.length) {
      return;
    }
    bridge
      .saveKaraokeSession({
        version: 1,
        files,
        playlistOrder: playlistRef.current.map((item) => item.id),
        selectedPlaylistId: selectedPlaylistIdRef.current,
        playheadMs: playheadRef.current,
      })
      .catch(() => undefined);
  }, [persistedFileReference]);

  useEffect(() => {
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.restoreKaraokeSession) {
      persistenceReadyRef.current = true;
      return undefined;
    }
    let cancelled = false;
    bridge
      .restoreKaraokeSession()
      .then(async (restored: IKaraokeRestoredSession | undefined) => {
        if (cancelled || !restored?.files.length) {
          return false;
        }
        const files = restored.files.map(restoredKaraokeFile);
        const selection = selectKaraokePlaylist(files);
        const ordered = orderedRestoredPlaylist(
          selection.items,
          restored.playlistOrder,
        );
        if (!ordered.length) {
          return false;
        }
        libraryFilesRef.current = files;
        playlistRef.current = ordered;
        setPlaylist(ordered);
        const preciseProgress = readKaraokeProgress();
        const selected =
          ordered.find(
            (item) => item.id === preciseProgress?.selectedPlaylistId,
          ) ??
          ordered.find((item) => item.id === restored.selectedPlaylistId) ??
          ordered[0];
        selectedPlaylistIdRef.current = selected.id;
        setSelectedPlaylistId(selected.id);
        // The media travels here too. Restoring passed only the pair, so the
        // song the app opened on lost the cover, background and video that
        // the very same song got back the moment it was clicked in the
        // playlist — see the note on the select path below.
        const loaded = await sessionRef.current.loadFiles([
          selected.audio,
          ...(selected.lyrics ? [selected.lyrics] : []),
          ...selected.media,
        ]);
        const restoredPlayheadMs =
          preciseProgress?.selectedPlaylistId === selected.id
            ? preciseProgress.playheadMs
            : restored.playheadMs;
        if (!cancelled && loaded && restoredPlayheadMs > 0) {
          sessionRef.current.seek(restoredPlayheadMs);
        }
        return loaded;
      })
      .catch(() => undefined)
      .finally(() => {
        persistenceReadyRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    persistKaraokeSession();
  }, [persistKaraokeSession, playlist, selectedPlaylistId]);

  useEffect(() => {
    const interval = window.setInterval(persistKaraokeSession, 1_500);
    return () => {
      window.clearInterval(interval);
      persistKaraokeSession();
    };
  }, [persistKaraokeSession]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const mediaQuery = window.matchMedia(STAGE_PITCH_MEDIA_QUERY);
    const onChange = () => setUseStagePitch(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMicrophoneMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (
        microphoneMenuButtonRef.current?.contains(target) ||
        isInsideAnchoredMenu(target) ||
        target?.closest('.dropdown-menu-layer')
      ) {
        return;
      }
      setIsMicrophoneMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [isMicrophoneMenuOpen]);

  useEffect(() => {
    if (isHidden) {
      setIsMicrophoneMenuOpen(false);
      cancelCountIn();
    }
  }, [cancelCountIn, isHidden]);

  useEffect(() => cancelCountIn, [cancelCountIn]);

  useEffect(() => {
    cancelCountIn();
    if (songId && autoplayAfterLoadRef.current) {
      autoplayAfterLoadRef.current = false;
      startSongPlaybackRef.current(true);
    }
  }, [cancelCountIn, songId]);

  const loadPlaylistItem = useCallback(
    async (item: IKaraokePlaylistItem, autoplay = false) => {
      autoplayAfterLoadRef.current = autoplay;
      playheadRef.current = 0;
      setSelectedPlaylistId(item.id);
      // The artwork and video travel with the pair. `loadFiles` picks the
      // audio and the lyrics out by extension and hands the rest to the stage,
      // so passing the whole folder's media here costs nothing and is the only
      // way a playlist entry keeps its cover — see IKaraokePlaylistItem.media.
      const loaded = await session.loadFiles([
        item.audio,
        ...(item.lyrics ? [item.lyrics] : []),
        ...item.media,
      ]);
      if (!loaded) {
        autoplayAfterLoadRef.current = false;
      }
    },
    [session],
  );

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (!files.length) {
        return;
      }
      const merged = new Map(
        libraryFilesRef.current.map((file) => [
          importedFileIdentity(file),
          file,
        ]),
      );
      files.forEach((file) => merged.set(importedFileIdentity(file), file));
      libraryFilesRef.current = Array.from(merged.values());
      const selection = selectKaraokePlaylist(libraryFilesRef.current);
      // Judged against the whole library, not this drop alone: a lyric file
      // dropped on its own pairs with audio that arrived earlier, and asking
      // its own drop would report it unpaired at the moment it succeeded.
      // The restore path deliberately does not do this — re-announcing the
      // same set-aside files at every launch is noise, not news.
      setSetAsideFiles(karaokeSetAsideFiles(selection));
      if (!selection.items.length) {
        session.loadFiles(files);
        return;
      }

      const nextById = new Map(selection.items.map((item) => [item.id, item]));
      const ordered = playlist
        .map((item) => nextById.get(item.id))
        .filter((item): item is IKaraokePlaylistItem => Boolean(item));
      const alreadyOrdered = new Set(ordered.map((item) => item.id));
      selection.items.forEach((item) => {
        if (!alreadyOrdered.has(item.id)) {
          ordered.push(item);
        }
      });
      setPlaylist(ordered);

      const previousSelected = playlist.find(
        (item) => item.id === selectedPlaylistId,
      );
      const nextSelected = selectedPlaylistId
        ? nextById.get(selectedPlaylistId)
        : undefined;
      if (!nextSelected) {
        await loadPlaylistItem(ordered[0]);
      } else if (
        previousSelected?.audio !== nextSelected.audio ||
        previousSelected?.lyrics !== nextSelected.lyrics
      ) {
        await loadPlaylistItem(nextSelected, session.status === 'playing');
      }
    },
    [loadPlaylistItem, playlist, selectedPlaylistId, session],
  );

  const loadSelectedFiles = (files: FileList | null) => {
    if (files?.length) {
      addFiles(Array.from(files));
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    loadSelectedFiles(event.target.files);
    // Selecting the same pair again is a valid replace/retry action.
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer.types.includes(KARAOKE_PLAYLIST_DRAG_MIME)) {
      return;
    }
    const fallbackFiles = Array.from(event.dataTransfer.files);
    collectKaraokeDropFiles(event.dataTransfer)
      .then(addFiles)
      .catch(() => session.loadFiles(fallbackFiles));
  };

  const clearPlaylist = () => {
    libraryFilesRef.current = [];
    setPlaylist([]);
    setSelectedPlaylistId(undefined);
    setSetAsideFiles(undefined);
    setIsMakerOpen(false);
    setRestoreMakerDraft(false);
    clearKaraokeProgress();
    session.clear();
    window.electron?.ipcRenderer.clearKaraokeSession?.().catch(() => undefined);
  };

  const selectPlaylistItem = (id: string) => {
    const item = playlist.find((candidate) => candidate.id === id);
    if (item) {
      loadPlaylistItem(item, status === 'playing');
    }
  };

  const movePlaylistItem = (id: string, targetId: string) => {
    setPlaylist((current) => {
      const sourceIndex = current.findIndex((item) => item.id === id);
      const targetIndex = current.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }
      const next = [...current];
      [next[sourceIndex], next[targetIndex]] = [
        next[targetIndex],
        next[sourceIndex],
      ];
      return next;
    });
  };

  const removePlaylistItem = (id: string) => {
    const removedIndex = playlist.findIndex((item) => item.id === id);
    if (removedIndex < 0) {
      return;
    }
    const removed = playlist[removedIndex];
    const removedFiles = new Set([removed.audio, removed.lyrics]);
    libraryFilesRef.current = libraryFilesRef.current.filter(
      (file) => !removedFiles.has(file),
    );
    // The library just changed, so a notice naming files that are no longer in
    // it is a lie the user cannot dismiss: remove the song whose `.srt` was
    // reported unpaired and the sentence stayed on screen naming a file that
    // had left with it.
    //
    // Recomputed only while a notice is already showing. Raising one here
    // would be announcing set-aside files at a moment the user imported
    // nothing — the same noise the restore path deliberately avoids.
    setSetAsideFiles((current) =>
      current
        ? karaokeSetAsideFiles(selectKaraokePlaylist(libraryFilesRef.current))
        : current,
    );
    const remaining = playlist.filter((item) => item.id !== id);
    setPlaylist(remaining);
    if (!remaining.length) {
      window.electron?.ipcRenderer
        .clearKaraokeSession?.()
        .catch(() => undefined);
    }
    if (selectedPlaylistId === id) {
      const next = remaining[Math.min(removedIndex, remaining.length - 1)];
      if (next) {
        loadPlaylistItem(next, status === 'playing');
      } else {
        setSelectedPlaylistId(undefined);
        session.clear();
      }
    }
  };

  const autoAdvancedSongRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (status !== 'ended' || !selectedPlaylistId) {
      autoAdvancedSongRef.current = undefined;
      return;
    }
    if (autoAdvancedSongRef.current === selectedPlaylistId) {
      return;
    }
    autoAdvancedSongRef.current = selectedPlaylistId;
    const currentIndex = playlist.findIndex(
      (item) => item.id === selectedPlaylistId,
    );
    const next = playlist[currentIndex + 1];
    if (next) {
      loadPlaylistItem(next, true);
    }
  }, [loadPlaylistItem, playlist, selectedPlaylistId, status]);

  useEffect(() => {
    if (isHidden) {
      return undefined;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      let target: HTMLElement | undefined;
      if (event.target instanceof HTMLElement) {
        target = event.target;
      } else if (document.activeElement instanceof HTMLElement) {
        target = document.activeElement;
      }
      const isMakerTypingTarget = Boolean(
        target?.isContentEditable ||
        target?.closest('input, textarea, select, [contenteditable]'),
      );
      /*
       * SPACE BELONGS TO THE TRANSPORT, NOT TO WHICHEVER BUTTON WAS CLICKED
       * LAST.
       *
       * A focused button used to block this handler on the player, which left
       * the keypress to the browser — and the browser's answer to Space on a
       * focused button is to press it again. The transport's buttons sit in a
       * row, so after clicking "Jump to song start" (immediately beside play)
       * every Space restarted the song instead of stopping it. Nothing looked
       * broken; the key was simply reaching a different control than the one
       * the singer meant.
       *
       * Space is now the transport's, the way it is in every media player,
       * and buttons keep Enter — which is the other key that activates them
       * and the one no player has ever claimed.
       *
       * Menus are still excluded: a Space inside an open menu is choosing the
       * highlighted item, and that menu is the thing the user is looking at.
       */
      const isBlockedControl = Boolean(
        target?.closest('[role="menu"], [role="menuitem"], [role="separator"]'),
      );
      if (
        isMakerTypingTarget ||
        isBlockedControl ||
        document.querySelector(
          '.karaoke-maker__modal-backdrop, .dropdown--open',
        )
      ) {
        return;
      }
      if (
        event.code === 'Space' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        song
      ) {
        event.preventDefault();
        // The response graph also has a Space shortcut. Karaoke owns the key
        // while this tab is visible, so do not let a single press perform two
        // unrelated actions on the same window.
        event.stopImmediatePropagation();
        if (isMakerOpen) {
          handleEditorTogglePlayback();
        } else {
          handleTogglePlayback();
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleSeek(playheadRef.current - 5_000);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSeek(playheadRef.current + 5_000);
      } else if (event.key === 'Home') {
        event.preventDefault();
        handleRestart();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleEditorTogglePlayback,
    handleRestart,
    handleSeek,
    handleTogglePlayback,
    isHidden,
    isMakerOpen,
    song,
  ]);

  const lyricWarningSentence = warning
    ? karaokeLyricWarningSentence(warning, t)
    : '';

  const hasStageArt = song ? hasKaraokeStageArt(song) : false;
  const stageArtActionKey = (() => {
    if (!hasStageArt) {
      return 'karaoke.stage.noArt';
    }
    return isStageArtVisible
      ? 'karaoke.stage.hideArt'
      : 'karaoke.stage.showArt';
  })();

  // Full screen gives the vertical space to the lyrics instead of keeping the
  // workspace introduction above them. The same controls move into a compact
  // glass dock inside the lyric surface, so importing or changing the mic does
  // not require leaving the stage.
  const workspaceActions = (
    <div
      className={`karaoke-workspace__actions${
        isFullScreen ? ' is-stage-toolbar' : ''
      }${isFullScreen && isChromeIdle ? ' is-idle' : ''}`}
      role="toolbar"
      aria-label={t('karaoke.actions')}
    >
      {playlist.length > 0 && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__action"
          onClick={clearPlaylist}
        >
          <MenuIcon name="clear" className="karaoke-button__icon" />
          <span>{t('karaoke.import.clear')}</span>
        </button>
      )}
      <button
        type="button"
        className="button small subtle karaoke-workspace__action"
        onClick={() => folderInputRef.current?.click()}
        disabled={isLoading}
        aria-disabled={isLoading}
      >
        <MenuIcon name="folder" className="karaoke-button__icon" />
        <span>{t('karaoke.import.folder')}</span>
      </button>
      {song && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__action karaoke-workspace__maker-action"
          onClick={() => {
            cancelCountIn();
            session.pause();
            // Which takes precedence, the saved draft or the player's own
            // timing, depends on what the song is. An existing karaoke — the
            // song itself carries word timing — opens on the player's
            // normalized truth, with the draft one Undo away, so a stale
            // shifted draft cannot make a finished song look out of sync.
            // A song with no timing of its own has all its work in the
            // draft: detected lyrics vanished on reopen until it restored.
            setRestoreMakerDraft(
              !song.lines.some((line) =>
                line.tokens.some((token) => token.startMs !== undefined),
              ),
            );
            setIsMakerOpen(true);
          }}
          title={t('karaoke.maker.openTitle')}
        >
          <svg
            className="karaoke-button__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m4 17-.8 3.8L7 20l10.8-10.8-3-3L4 17Zm9.5-9.5 3 3M13 20h8" />
          </svg>
          <span>{t('karaoke.maker.open')}</span>
        </button>
      )}
      <button
        type="button"
        className="button small karaoke-workspace__action karaoke-workspace__open"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        aria-disabled={isLoading}
      >
        <MenuIcon name="filePlus" className="karaoke-button__icon" />
        <span>
          {t(song ? 'karaoke.import.addFiles' : 'karaoke.import.open')}
        </span>
      </button>
      <button
        type="button"
        className="button small subtle karaoke-workspace__icon-action karaoke-workspace__pitch-toggle"
        aria-label={t(
          isPitchGuideVisible ? 'karaoke.pitch.hide' : 'karaoke.pitch.show',
        )}
        title={t(
          isPitchGuideVisible ? 'karaoke.pitch.hide' : 'karaoke.pitch.show',
        )}
        aria-pressed={isPitchGuideVisible}
        onClick={() => {
          setIsPitchGuideVisible((visible) => {
            const next = !visible;
            writePitchGuideVisibility(next);
            return next;
          });
        }}
      >
        <MenuIcon name="graph" className="karaoke-button__icon" />
      </button>
      {/* Present for every song, disabled for the ones with nothing behind
          the words. Hiding it instead was worse: a library of bare UltraStar
          text files never showed the control at all, so the setting looked
          like it did not exist. Disabled and labelled says which of the two
          it is. */}
      {song && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__icon-action karaoke-workspace__stage-art-toggle"
          aria-label={t(stageArtActionKey)}
          title={t(stageArtActionKey)}
          aria-pressed={isStageArtVisible}
          disabled={!hasStageArt}
          aria-disabled={!hasStageArt}
          onClick={() => {
            setIsStageArtVisible((visible) => {
              const next = !visible;
              writeStageArtVisibility(next);
              return next;
            });
          }}
        >
          <svg
            className="karaoke-button__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 5.5h16v13H4zM4 15.5l4.5-4.5 3 3 3.5-3.5 5 5M14.6 9.6a1.15 1.15 0 1 0 2.3 0 1.15 1.15 0 1 0-2.3 0" />
          </svg>
        </button>
      )}
      <button
        ref={microphoneMenuButtonRef}
        type="button"
        className={`button small subtle karaoke-workspace__icon-action karaoke-workspace__settings${
          microphone.status === 'live' ? ' is-live' : ''
        }`}
        aria-label={t('karaoke.mic.settings')}
        title={t('karaoke.mic.settings')}
        aria-haspopup="dialog"
        aria-expanded={isMicrophoneMenuOpen}
        onClick={() => setIsMicrophoneMenuOpen((open) => !open)}
      >
        <MenuIcon name="microphoneSettings" className="karaoke-button__icon" />
      </button>
      {isFullScreen && (
        <button
          type="button"
          className="button small subtle karaoke-workspace__icon-action karaoke-workspace__top-bar"
          aria-label={t(
            hasFullScreenTopBar
              ? 'karaoke.fullscreen.hideHeader'
              : 'karaoke.fullscreen.showHeader',
          )}
          title={t(
            hasFullScreenTopBar
              ? 'karaoke.fullscreen.hideHeader'
              : 'karaoke.fullscreen.showHeader',
          )}
          aria-pressed={hasFullScreenTopBar}
          onClick={onToggleFullScreenTopBar}
        >
          <svg
            className="karaoke-button__icon"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M4 4.5h16v15H4zM4 9h16" />
          </svg>
        </button>
      )}
      <button
        type="button"
        className="button small subtle karaoke-workspace__icon-action karaoke-workspace__fullscreen"
        aria-label={t(
          isFullScreen ? 'karaoke.fullscreen.exit' : 'karaoke.fullscreen.enter',
        )}
        title={`${t(
          isFullScreen ? 'karaoke.fullscreen.exit' : 'karaoke.fullscreen.enter',
        )} (Ctrl+F)`}
        aria-pressed={isFullScreen}
        onClick={onToggleFullScreen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {isFullScreen ? (
            <path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5" />
          ) : (
            <path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5" />
          )}
        </svg>
      </button>
      <AnchoredMenu
        anchor={microphoneMenuButtonRef.current}
        isOpen={isMicrophoneMenuOpen}
        className="karaoke-microphone-popover"
        role="dialog"
        ariaLabel={t('karaoke.mic.settings')}
      >
        <KaraokeMicrophoneSettings microphone={microphone} />
      </AnchoredMenu>
    </div>
  );

  return (
    <section
      ref={workspaceRef}
      className={`karaoke-workspace workspace-tab-panel workspace-tab-panel--karaoke${
        isHidden ? ' is-hidden' : ''
      }${isFullScreen ? ' is-fullscreen' : ''}${
        song ? ' has-song' : ' is-empty'
      }`}
      aria-labelledby={isFullScreen ? undefined : 'karaoke-workspace-title'}
      aria-label={isFullScreen ? t('karaoke.title') : undefined}
      aria-hidden={isHidden}
      onPointerDownCapture={() => {
        if (isFullScreen) {
          revealChromeNow();
        }
      }}
      onDoubleClick={(event) => {
        const target = event.target as Element;
        // The stage itself is the fullscreen target. Controls keep their own
        // double-click behaviour, and the Maker is a separate editing surface
        // where an accidental window-mode change would be especially costly.
        if (
          target.closest(
            'button, input, select, textarea, a, [role="dialog"], [role="menu"], .karaoke-maker',
          )
        ) {
          return;
        }
        onToggleFullScreen();
      }}
      // A labelled region is also the deliberate whole-surface drop target.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      onDragEnter={(event) => {
        event.preventDefault();
        if (!event.dataTransfer.types.includes(KARAOKE_PLAYLIST_DRAG_MIME)) {
          setIsDragging(true);
        }
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setIsDragging(false);
        }
      }}
      onDrop={onDrop}
    >
      {/* Imported timed lyrics are rendered beside this audio-only element;
          there is no video track to caption. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={session.audioRef} preload="metadata" />
      <input
        ref={fileInputRef}
        className="karaoke-workspace__file-input"
        type="file"
        multiple
        accept={KARAOKE_FILE_PICKER_ACCEPT}
        onChange={onFileInput}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={folderInputRef}
        className="karaoke-workspace__file-input"
        type="file"
        multiple
        // Chromium's folder picker attribute is not yet in React's DOM types.
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...({ webkitdirectory: '' } as { webkitdirectory: string })}
        onChange={onFileInput}
        tabIndex={-1}
        aria-hidden="true"
      />
      {!isFullScreen && (
        <header className="karaoke-workspace__header">
          <div>
            <p className="eyebrow">{t('karaoke.eyebrow')}</p>
            <h2 id="karaoke-workspace-title">{t('karaoke.title')}</h2>
            <p className="karaoke-workspace__intro">{t('karaoke.intro')}</p>
          </div>
          {workspaceActions}
        </header>
      )}

      {error && (
        <div className="karaoke-workspace__notice is-error" role="alert">
          {t(ERROR_KEYS[error])}
        </div>
      )}
      {/* The idle-release question is not drawn here. It outlives this tab
          being looked at, so `SpeechMemoryNotice` asks it from the app root. */}
      {warning && (
        <div className="karaoke-workspace__notice is-warning" role="status">
          <strong>{warning.fileName}</strong> {lyricWarningSentence}{' '}
          <span>{t('karaoke.warning.lyricsAudioIntact')}</span>
        </div>
      )}
      {setAsideFiles && (
        <div className="karaoke-workspace__notice is-warning" role="status">
          {karaokeSetAsideSentences(setAsideFiles, t).join(' ')}
        </div>
      )}

      <div
        ref={playerRef}
        className={`karaoke-workspace__player${
          playlist.length > 0 ? ' has-playlist' : ''
        }${
          playlist.length > 0 && layout.playlistCollapsed
            ? ' is-playlist-collapsed'
            : ''
        }`}
        style={playerStyle}
      >
        {playlist.length > 0 && !layout.playlistCollapsed && (
          <KaraokePlaylist
            items={playlist}
            selectedId={selectedPlaylistId}
            groupByFolder={groupPlaylistByFolder}
            onToggleFolderGrouping={() => {
              setGroupPlaylistByFolder((current) => {
                const next = !current;
                writeKaraokePlaylistFolderGrouping(next);
                return next;
              });
            }}
            onSelect={selectPlaylistItem}
            onMove={movePlaylistItem}
            onRemove={removePlaylistItem}
            onCollapse={() => updateLayout({ playlistCollapsed: true }, true)}
          />
        )}
        {playlist.length > 0 && !layout.playlistCollapsed && (
          <KaraokePaneSplitter
            orientation="vertical"
            ariaLabel={t('karaoke.playlist.resize')}
            valuePercent={layout.playlistShare * 100}
            onStart={startPlaylistResize}
            onDrag={resizePlaylist}
            onEnd={commitLayout}
          />
        )}
        <div
          ref={stageRef}
          className={`karaoke-workspace__stage${song ? ' has-song' : ''}${
            isPitchGuideVisible && song && useStagePitch
              ? ' has-stage-pitch'
              : ''
          }${
            playlist.length > 0 && layout.playlistCollapsed
              ? ' has-collapsed-playlist'
              : ''
          }${isDragging ? ' is-dragging' : ''}`}
          style={pitchStyle}
        >
          {isFullScreen && workspaceActions}
          {playlist.length > 0 && layout.playlistCollapsed && (
            <button
              type="button"
              className="karaoke-playlist__expand"
              aria-label={t('karaoke.playlist.expand')}
              title={t('karaoke.playlist.expand')}
              onClick={() => updateLayout({ playlistCollapsed: false }, true)}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 5.5h6M4 10h6M4 14.5h6M12.5 4.5 18 10l-5.5 5.5" />
              </svg>
              <span>{t('karaoke.playlist.title')}</span>
            </button>
          )}
          {song ? (
            <>
              {/* First, so it is behind everything the stage draws. It is
                  absolutely positioned and takes no row of its own — the
                  heading, lyrics and pitch guide keep the grid they had.
                  Unmounted rather than hidden when the art is switched off, so
                  a video stops decoding instead of playing to nobody. */}
              {isStageArtVisible && (
                <KaraokeStageMedia
                  song={song}
                  playheadMs={session.playheadMs}
                  isPlaying={status === 'playing'}
                />
              )}
              <div className="karaoke-song__heading">
                <div>
                  <p>{song.artist || t('karaoke.song.unknownArtist')}</p>
                  <h3>{song.title}</h3>
                </div>
                <div className="karaoke-song__tools">
                  <KaraokeChordGuide
                    status={chordAnalysis.status}
                    chords={chordAnalysis.chords}
                    progress={chordAnalysis.progress}
                    playheadMs={session.playheadMs}
                  />
                  <div className="karaoke-song__utility">
                    <span className="karaoke-song__source">
                      {SOURCE_KEYS[song.meta.sourceFormat]
                        ? t(SOURCE_KEYS[song.meta.sourceFormat])
                        : karaokeProviderDisplayName(song.meta.sourceFormat) ||
                          t(SOURCE_KEYS['audio-only'])}
                    </span>
                    <label
                      className="karaoke-song__text-size"
                      htmlFor={lyricTextSizeId}
                    >
                      <span className="is-small" aria-hidden="true">
                        A
                      </span>
                      <input
                        id={lyricTextSizeId}
                        type="range"
                        min={MIN_LYRIC_TEXT_SIZE}
                        max={MAX_LYRIC_TEXT_SIZE}
                        step="5"
                        value={lyricTextSize}
                        aria-label={t('karaoke.lyrics.textSize')}
                        aria-valuetext={`${lyricTextSize}%`}
                        title={`${t(
                          'karaoke.lyrics.textSize',
                        )} · ${lyricTextSize}%`}
                        style={
                          {
                            '--karaoke-lyric-size-progress': `${
                              ((lyricTextSize - MIN_LYRIC_TEXT_SIZE) /
                                (MAX_LYRIC_TEXT_SIZE - MIN_LYRIC_TEXT_SIZE)) *
                              100
                            }%`,
                          } as TKaraokeLyricSizeStyle
                        }
                        onChange={(event) =>
                          changeLyricTextSize(Number(event.target.value))
                        }
                      />
                      <span className="is-large" aria-hidden="true">
                        A
                      </span>
                      <span className="karaoke-song__text-value">
                        {lyricTextSize}%
                      </span>
                    </label>
                  </div>
                </div>
              </div>
              <KaraokeLyrics
                song={song}
                playheadMs={session.playheadMs}
                onSeek={handleSelectLyric}
                followRequestKey={lyricsFollowRequestKey}
                textSize={lyricTextSize}
              />
              {isPitchGuideVisible && useStagePitch && (
                <>
                  <KaraokePaneSplitter
                    orientation="horizontal"
                    ariaLabel={t('karaoke.pitch.resize')}
                    valuePercent={layout.pitchShare * 100}
                    onStart={startPitchResize}
                    onDrag={resizePitch}
                    onEnd={commitLayout}
                  />
                  <KaraokePitchLane
                    isActive={!isHidden}
                    isPlaying={status === 'playing'}
                    pitch={microphone.pitch}
                    analysisStatus={microphone.pitchAnalysisStatus}
                    microphoneStatus={microphone.status}
                    onToggleMicrophone={microphone.toggle}
                    target={song.pitch}
                    playheadMs={session.playheadMs}
                    durationMs={session.durationMs}
                    readPlayheadMs={session.readPlayheadMs}
                    onPracticeIssue={practicePitchIssue}
                    onScrubStart={handlePitchScrubStart}
                    onScrub={handlePitchScrub}
                    onScrubEnd={handlePitchScrubEnd}
                  />
                </>
              )}
              {countInCue && (
                <div
                  className="karaoke-count-in"
                  role="status"
                  aria-live="assertive"
                >
                  <strong key={countInCue}>{countInCue}</strong>
                  <span>{countInLabel}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <img
                className="karaoke-workspace__microphone-art"
                src={karaokeMicrophoneImage}
                alt=""
                aria-hidden="true"
                draggable="false"
              />
              <div className="karaoke-workspace__empty-copy">
                <h3>
                  {t(
                    isLoading
                      ? 'karaoke.import.loading'
                      : 'karaoke.empty.title',
                  )}
                </h3>
                <p>{t('karaoke.empty.body')}</p>
                <button
                  type="button"
                  className="button small karaoke-workspace__empty-open"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  aria-disabled={isLoading}
                >
                  <MenuIcon name="filePlus" className="karaoke-button__icon" />
                  <span>{t('karaoke.import.open')}</span>
                </button>
                <small>{t('karaoke.import.formats')}</small>
              </div>
              <div className="karaoke-workspace__levels" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </>
          )}
          {isDragging && (
            <div className="karaoke-workspace__drop-overlay" role="status">
              {t('karaoke.import.drop')}
            </div>
          )}
        </div>
      </div>

      {isPitchGuideVisible && (!song || !useStagePitch) && (
        <>
          <KaraokePaneSplitter
            orientation="horizontal"
            ariaLabel={t('karaoke.pitch.resize')}
            valuePercent={layout.pitchShare * 100}
            onStart={startPitchResize}
            onDrag={resizePitch}
            onEnd={commitLayout}
          />
          <div
            className="karaoke-workspace__readiness is-pitch-only is-resizable"
            style={pitchStyle}
          >
            <KaraokePitchLane
              isActive={!isHidden}
              isPlaying={status === 'playing'}
              pitch={microphone.pitch}
              analysisStatus={microphone.pitchAnalysisStatus}
              microphoneStatus={microphone.status}
              onToggleMicrophone={microphone.toggle}
              target={song?.pitch}
              playheadMs={session.playheadMs}
              durationMs={session.durationMs}
              readPlayheadMs={session.readPlayheadMs}
              onPracticeIssue={practicePitchIssue}
              onScrubStart={handlePitchScrubStart}
              onScrub={handlePitchScrub}
              onScrubEnd={handlePitchScrubEnd}
            />
          </div>
        </>
      )}
      {song && (
        <KaraokeTransport
          status={status}
          playheadMs={session.playheadMs}
          durationMs={session.durationMs}
          levels={[
            {
              id: 'melody',
              label: t('karaoke.pitch.toneVolume'),
              value: melodyTone.volume,
              channel: 'melody',
              disabled: !melodyTone.isAvailable || !melodyTone.enabled,
              toggleDisabled: !melodyTone.isAvailable,
              pressed: melodyTone.enabled,
              onToggle: () => melodyTone.toggle().catch(() => undefined),
              onChange: melodyTone.setVolume,
            },
            {
              id: 'backing',
              label: t('karaoke.maker.stemBacking'),
              value: backingLevel,
              channel: 'backing',
              onChange: changeBackingLevel,
            },
            ...(canMixVocals
              ? [
                  {
                    id: 'vocal',
                    label: t('karaoke.transport.vocalLevel'),
                    value: vocalLevel,
                    valueText:
                      vocalLevel === 0
                        ? t('karaoke.transport.vocalOff')
                        : `${Math.round(vocalLevel * 100)}%`,
                    channel: 'vocal' as const,
                    onChange: setVocalLevel,
                  },
                ]
              : []),
          ]}
          onTogglePlayback={handleTogglePlayback}
          onJumpToStart={() => handleSeek(0)}
          onJumpToEnd={() => handleSeek(session.durationMs)}
          onSeek={handleSeek}
        />
      )}
      {isMakerOpen &&
        song &&
        song.assets.find((asset) => asset.role === 'audio') && (
          <KaraokeMaker
            // Apply replaces only this song's in-memory normalized timing, so
            // it deliberately keeps the same editor. A different audio item
            // gets a fresh Maker instance and restores its own saved draft.
            key={importedFileIdentity(
              song.assets.find((asset) => asset.role === 'audio')!.file,
            )}
            song={song}
            audioFile={
              song.assets.find((asset) => asset.role === 'audio')!.file
            }
            playheadMs={session.playheadMs}
            durationMs={session.durationMs}
            isPlaying={status === 'playing'}
            restoreSavedDraft={restoreMakerDraft}
            readPlayheadMs={session.readPlayheadMs}
            vocalLevel={canMixVocals ? vocalLevel : undefined}
            onVocalLevel={canMixVocals ? setVocalLevel : undefined}
            backingLevel={backingLevel}
            onBackingLevel={changeBackingLevel}
            stemFocus={stemFocus}
            onFocusStem={focusStem}
            backingBlend={backingBlend}
            onBackingBlend={changeBackingBlend}
            onSeek={session.seek}
            onPlay={handleEditorPlay}
            onPause={handleEditorPause}
            onStems={({ vocals, instrumental }) => {
              // Both stems join the song as their own roles; the audio asset
              // stays exactly as imported — the Maker is keyed on it, and an
              // earlier version that swapped it remounted the open editor.
              applyStemsToSong(song, vocals, instrumental);
              // And onto disk, so a refresh recovers them with the workspace.
              Promise.all([vocals.arrayBuffer(), instrumental.arrayBuffer()])
                .then(([vocalBytes, instrumentalBytes]) =>
                  window.electron.ipcRenderer.saveKaraokeStems(
                    song.id,
                    vocalBytes,
                    instrumentalBytes,
                  ),
                )
                .catch(() => undefined);
            }}
            onApply={(project) => {
              const audioAsset = song.assets.find(
                (asset) => asset.role === 'audio',
              );
              if (audioAsset) {
                session.applySong(
                  karaokeMakerProjectToSong(project, audioAsset, song.assets),
                );
                setLyricsFollowRequestKey((request) => request + 1);
              }
            }}
            onClose={() => {
              // Solo listening must not outlive the editor: leaving with the
              // voice soloed kept the backing scaled to its blend — often
              // zero — and the player looked broken at any master volume.
              focusStem('backing');
              setIsMakerOpen(false);
            }}
            isFullScreen={isFullScreen}
            onToggleFullScreen={onToggleFullScreen}
          />
        )}
    </section>
  );
};

export default KaraokeWorkspace;
