/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import {
  readKaraokeMakerOpen,
  readKaraokeProgress,
  writeKaraokeMakerOpen,
} from './karaokeEditorPersistence';
import {
  MAX_LYRIC_TEXT_SIZE,
  MIN_LYRIC_TEXT_SIZE,
  readLyricTextSize,
  writeLyricTextSize,
} from './karaokeLyricText';
import {
  IKaraokePlaylistItem,
  selectKaraokePlaylist,
} from '../../common/karaoke/files';
import {
  initiallyUseStagePitch,
  readKaraokePlaylistFolderGrouping,
  readPitchGuideVisibility,
  readStageArtVisibility,
  STAGE_PITCH_MEDIA_QUERY,
} from './karaokeWorkspacePrefs';
import { IKaraokeSetAsideFiles } from './karaokeImportNotices';
import {
  clampKaraokePitchShare,
  clampKaraokePlaylistShare,
  IKaraokeLayoutSettings,
  readKaraokeLayout,
  TKaraokeLayoutMode,
  writeKaraokeLayout,
} from './karaokeLayout';
import { usePlaybackHandoff } from '../audio/playbackHandoff';
import { useKaraokeAudioClock } from './karaokeAudioClock';
import { useKaraokeMicrophoneInput } from './useKaraokeMicrophone';
import observeShown from '../utils/observeShown';
import { useKaraokeSession } from './useKaraokeSession';
import { useSystemFader } from '../audio/systemVolume';
import { useKaraokeMelodyTone } from './useKaraokeMelodyTone';
import { useKaraokeChordAnalysis } from './useKaraokeChordAnalysis';
import { useKaraokeVocalMix } from './useKaraokeVocalMix';
import { releaseKaraokeWhisperModel } from './makerAi';
import { setChromeHeld } from '../utils/idleChrome';
import { IKaraokePitchIssue } from './karaokePitchGeometry';
import { IKaraokeRestoredSession } from '../../common/karaoke/sessionPersistence';
import {
  importedFileIdentity,
  orderedRestoredPlaylist,
  restoredKaraokeFile,
} from './karaokeWorkspaceRestore';
import useKaraokeSessionSaving from './useKaraokeSessionSaving';
import { isInsideAnchoredMenu } from '../widgets/AnchoredMenu';
import { type IKaraokeWorkspaceProps } from './KaraokeWorkspace';

type TKaraokeLayoutStyle = CSSProperties & {
  '--karaoke-pitch-size'?: string;
  '--karaoke-playlist-size'?: string;
};

/**
 * The karaoke stage: the playing session, its microphone, pitch and mix,
 * the count-in and transport, the lyric and layout settings, and the saved
 * session — everything the playlist and the markup read, returned as one
 * object in the order it is declared.
 */
const useKaraokeWorkspaceStage = ({
  isFullScreen,
  isHidden,
}: Pick<IKaraokeWorkspaceProps, 'isHidden'> &
  Required<Pick<IKaraokeWorkspaceProps, 'isFullScreen'>>) => {
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
  /**
   * The Maker is running a local model, so nothing here may take it away.
   *
   * Reported by the editor rather than inferred: the jobs and their progress
   * live inside it. Deliberately not persisted — a run cannot survive a
   * reload, so a stored `true` would be a lock with nothing behind it.
   */
  const [isMakerWorking, setIsMakerWorking] = useState(false);
  const [restoreMakerDraft, setRestoreMakerDraft] =
    useState(readKaraokeMakerOpen);
  const [countInCue, setCountInCue] = useState<string>();
  const [countInLabel, setCountInLabel] = useState<string>();
  const [lyricsFollowRequestKey, setLyricsFollowRequestKey] = useState(0);
  const [lyricTextSize, setLyricTextSize] = useState(readLyricTextSize);
  const [playlist, setPlaylist] = useState<IKaraokePlaylistItem[]>([]);
  const [groupPlaylistByFolder, setGroupPlaylistByFolder] = useState(
    readKaraokePlaylistFolderGrouping,
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>();
  /**
   * What an import could not use, and why.
   *
   * A fact about the import rather than about a song, which is why it stayed
   * here when the lyric warning moved beside the words: "these three files
   * were set aside" answers a question about the folder that was just opened,
   * and there is no one song to attach it to. Without it `Song.mp3` beside
   * `Song.srt` played with no lyrics and no explanation.
   */
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
  const cancelCountInCuesRef = useRef<(() => void) | undefined>(undefined);
  const resumeWithCountInAfterScrubRef = useRef(false);
  const autoplayAfterLoadRef = useRef(false);
  const [retainWhenHidden, setRetainWhenHidden] = usePlaybackHandoff();
  // The count-in's tempo, and the Maker's countdown and auditions: the sound
  // card's clock, opened on the first of them and idle between them.
  const audioClock = useKaraokeAudioClock();
  const microphone = useKaraokeMicrophoneInput(!isHidden);
  // Whether the stage can be seen at all. The amp puts the whole window's
  // pages out of sight without leaving this tab, and the playhead went on
  // being sampled every frame under it, for readouts nobody could see.
  const [isStageShown, setIsStageShown] = useState(true);
  useEffect(() => {
    const surface = workspaceRef.current;
    return surface ? observeShown(surface, setIsStageShown) : undefined;
  }, []);
  // Visible playback gets the frame clock needed by lyrics and pitch. Hidden
  // playback — another tab, or the amp over the window — falls back to the
  // audio element's low-rate `timeupdate` events, which keep the transport
  // moving without animating an unseen stage.
  const session = useKaraokeSession(!isHidden && isStageShown);
  // The computer's volume, the one fader this app has (`useSystemFader`): the
  // backing track plays at full level and karaoke's master row moves Windows.
  const fader = useSystemFader();
  const { song, status, error, warning, seek, playhead } = session;
  const songId = song?.id;
  const melodyTone = useKaraokeMelodyTone({
    isActive: !isHidden && !isMakerOpen,
    isPlaying: status === 'playing',
    target: song?.pitch,
    // Only the fallback for a missing reader: the tone asks the element
    // itself every frame, so this render's reading is never the one it plays.
    playheadMs: playhead.read(),
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

  // AI is editing machinery, not playback. The hidden lifetime keeps one audio
  // element and nothing else; both models leave immediately with their UI.
  useEffect(() => {
    if (!isHidden) {
      return undefined;
    }
    window.electron.ipcRenderer.releaseKaraokeSeparationModel();
    releaseKaraokeWhisperModel().catch(() => undefined);
    return undefined;
  }, [isHidden]);
  const isLoading = status === 'loading';
  const playheadRef = useRef(playhead.read());
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
    cancelCountInCuesRef.current?.();
    cancelCountInCuesRef.current = undefined;
    setCountInCue(undefined);
    setCountInLabel(undefined);
  }, []);

  /**
   * "1, 2, 3, go" a beat apart, the song on "go", and the card gone a moment
   * after.
   *
   * On the audio clock. It was a chain of timers, each started when the one
   * before it fired, so every step's lateness — a busy thread, a render —
   * was carried into the next and "go" landed late by all of it. Every cue is
   * now a time past one origin on the sound card's clock. "1" is up at the
   * press; the clock's own start-up (none once it has run, a few milliseconds
   * the first time) lengthens that first beat and never the ones after it.
   */
  const startCountIn = useCallback(
    (label: string, onGo: () => void) => {
      cancelCountIn();
      sessionRef.current.pause();
      setCountInLabel(label);
      setCountInCue('1');
      const beatSeconds = 0.55;
      const goSeconds = beatSeconds * 3;
      const clear = () => {
        cancelCountInCuesRef.current = undefined;
        setCountInCue(undefined);
        setCountInLabel(undefined);
      };
      cancelCountInCuesRef.current = audioClock.schedule(() => [
        { atSeconds: beatSeconds, run: () => setCountInCue('2') },
        { atSeconds: beatSeconds * 2, run: () => setCountInCue('3') },
        {
          atSeconds: goSeconds,
          run: () => {
            setCountInCue(t('karaoke.practice.go'));
            onGo();
          },
        },
        // "Go" stays up while the song comes in, as it always has.
        { atSeconds: goSeconds + 0.6, run: clear },
      ]);
    },
    [audioClock, cancelCountIn, t],
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
      setRetainWhenHidden(false);
      cancelCountIn();
      return;
    }
    if (status === 'playing') {
      setRetainWhenHidden(false);
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
  }, [
    cancelCountIn,
    countInCue,
    setRetainWhenHidden,
    startSongPlayback,
    status,
  ]);

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
    setRetainWhenHidden(false);
    cancelCountIn();
    sessionRef.current.pause();
  }, [cancelCountIn, setRetainWhenHidden]);

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

  const handleStopPlayback = useCallback(() => {
    autoplayAfterLoadRef.current = false;
    resumeWithCountInAfterScrubRef.current = false;
    setRetainWhenHidden(false);
    cancelCountIn();
    sessionRef.current.pause();
    sessionRef.current.seek(0);
    playheadRef.current = 0;
  }, [cancelCountIn, setRetainWhenHidden]);

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

  // Kept by a subscription rather than copied in after each render, because
  // the playhead no longer renders this component.
  useEffect(
    () =>
      playhead.subscribe(() => {
        playheadRef.current = playhead.read();
      }),
    [playhead],
  );

  useEffect(() => {
    writeKaraokeMakerOpen(isMakerOpen);
  }, [isMakerOpen]);

  /**
   * Whether last session's playlist is still being read back.
   *
   * The tab opens with no song because the songs arrive a moment later, and
   * for that moment the workspace drew its empty state: a microphone and
   * "drop a folder here" over a library that was about to appear. Same bug as
   * the library tab's own empty panel, same fix -- say nothing about being
   * empty until the question has been answered.
   */
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    const bridge = window.electron?.ipcRenderer;
    if (!bridge?.restoreKaraokeSession) {
      persistenceReadyRef.current = true;
      setIsRestoring(false);
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
        /**
         * MERGED WITH WHATEVER ARRIVED WHILE THIS WAS READING, not written
         * over the top of it.
         *
         * This used to assign both the file list and the playlist outright,
         * on the reasonable-looking assumption that a restore runs into an
         * empty workspace. It does not always: "Send to Karaoke" MOUNTS this
         * component, so the song being sent is imported in the same commit
         * that starts this read, and the read then finished a moment later
         * and replaced the list with the saved session — the tab changed, the
         * Maker closed, and the song was nowhere. Every first send after a
         * launch failed that way; a second one, with the tab already mounted
         * and restored, worked, which is what made it look intermittent.
         *
         * The imported file wins any collision. A restored entry is a
         * placeholder carrying a name and a token rather than bytes (see
         * `restoredKaraokeFile`), so where the two describe the same song the
         * one that was actually read off disk is the one worth keeping.
         */
        const byIdentity = new Map(
          files.map((file) => [importedFileIdentity(file), file]),
        );
        libraryFilesRef.current.forEach((file) =>
          byIdentity.set(importedFileIdentity(file), file),
        );
        libraryFilesRef.current = Array.from(byIdentity.values());
        const restoredIds = new Set(ordered.map((item) => item.id));
        const merged = [
          ...ordered,
          ...playlistRef.current.filter((item) => !restoredIds.has(item.id)),
        ];
        playlistRef.current = merged;
        setPlaylist(merged);
        const preciseProgress = readKaraokeProgress();
        // A song imported while this was reading has already been chosen and
        // loaded by `addFiles`, and it is the one the reader asked for. The
        // saved session's own choice only applies when nothing has been.
        const imported = merged.find(
          (item) => item.id === selectedPlaylistIdRef.current,
        );
        const selected =
          imported ??
          ordered.find(
            (item) => item.id === preciseProgress?.selectedPlaylistId,
          ) ??
          ordered.find((item) => item.id === restored.selectedPlaylistId) ??
          ordered[0];
        selectedPlaylistIdRef.current = selected.id;
        setSelectedPlaylistId(selected.id);
        // Its audio is already loading, and the playhead below belongs to the
        // saved session rather than to it.
        if (imported) {
          return true;
        }
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
        setIsRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { clearSavedSession, clearSavedProgress } = useKaraokeSessionSaving({
    readyRef: persistenceReadyRef,
    libraryFilesRef,
    playlistRef,
    selectedPlaylistIdRef,
    playheadRef,
    surfaceRef: workspaceRef,
    audioRef: session.audioRef,
    status,
    playlist,
    selectedPlaylistId,
    songId,
    isRestoring,
    isHidden,
  });

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
      // Loading may have used part of the original grace period. The ready
      // song gets a fresh bound for its count-in and real `playing` event.
      setRetainWhenHidden(true);
      startSongPlaybackRef.current(true);
    }
  }, [cancelCountIn, setRetainWhenHidden, songId]);

  // The lease exists only while a queued song is being loaded and started.
  // An actual play event completes the handoff; pause, error and clear are all
  // terminal and must make a hidden workspace eligible for disposal again.
  useEffect(() => {
    if (
      status === 'playing' ||
      status === 'paused' ||
      status === 'empty' ||
      status === 'error'
    ) {
      setRetainWhenHidden(false);
    }
  }, [setRetainWhenHidden, status]);

  return {
    t,
    lyricTextSizeId,
    fileInputRef,
    folderInputRef,
    microphoneMenuButtonRef,
    workspaceRef,
    playerRef,
    stageRef,
    libraryFilesRef,
    isDragging,
    setIsDragging,
    isMicrophoneMenuOpen,
    setIsMicrophoneMenuOpen,
    isMakerOpen,
    setIsMakerOpen,
    isMakerWorking,
    setIsMakerWorking,
    restoreMakerDraft,
    setRestoreMakerDraft,
    countInCue,
    countInLabel,
    lyricsFollowRequestKey,
    setLyricsFollowRequestKey,
    lyricTextSize,
    playlist,
    setPlaylist,
    groupPlaylistByFolder,
    setGroupPlaylistByFolder,
    selectedPlaylistId,
    setSelectedPlaylistId,
    setAsideFiles,
    setSetAsideFiles,
    useStagePitch,
    isPitchGuideVisible,
    setIsPitchGuideVisible,
    isStageArtVisible,
    setIsStageArtVisible,
    autoplayAfterLoadRef,
    retainWhenHidden,
    setRetainWhenHidden,
    audioClock,
    microphone,
    session,
    fader,
    song,
    status,
    error,
    warning,
    playhead,
    melodyTone,
    chordAnalysis,
    vocalLevel,
    setVocalLevel,
    canMixVocals,
    stemFocus,
    backingBlend,
    backingLevel,
    focusStem,
    changeBackingBlend,
    changeBackingLevel,
    applyStemsToSong,
    isLoading,
    playheadRef,
    sessionRef,
    changeLyricTextSize,
    cancelCountIn,
    startSongPlayback,
    practicePitchIssue,
    handleTogglePlayback,
    handleEditorPlay,
    handleEditorPause,
    handleEditorTogglePlayback,
    handleRestart,
    handleSeek,
    handleStopPlayback,
    handleSelectLyric,
    handlePitchScrubStart,
    handlePitchScrub,
    handlePitchScrubEnd,
    layout,
    updateLayout,
    commitLayout,
    startPlaylistResize,
    resizePlaylist,
    startPitchResize,
    resizePitch,
    playerStyle,
    pitchStyle,
    isRestoring,
    clearSavedSession,
    clearSavedProgress,
  };
};

export type TKaraokeWorkspaceStage = ReturnType<
  typeof useKaraokeWorkspaceStage
>;

export default useKaraokeWorkspaceStage;
