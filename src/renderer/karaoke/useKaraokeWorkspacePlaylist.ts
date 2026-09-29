/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { buildSongIdentity } from 'common/songIdentity';
import {
  IKaraokePlaylistItem,
  selectKaraokePlaylist,
} from '../../common/karaoke/files';
import { importedFileIdentity } from './karaokeWorkspaceRestore';
import { karaokeSetAsideFiles } from './karaokeImportNotices';
import {
  drainKaraokeFiles,
  usePendingKaraokeFiles,
} from '../library/karaokeHandoff';
import { reportError } from '../utils/logger';
import { KARAOKE_PLAYLIST_DRAG_MIME } from './KaraokePlaylist';
import collectKaraokeDropFiles from './droppedFiles';
import { writeKaraokePlaylistFolderGrouping } from './karaokeWorkspacePrefs';
import { useTransportSlot } from '../audio/transportSlot';
import {
  clearTransportSource,
  setTransportSource,
} from '../audio/transportSource';
import { quantizeTransportPosition } from '../../common/dsp/nativeTransport';
import { releasePlayback } from '../audio/playbackOwner';
import { type IKaraokeWorkspaceProps } from './KaraokeWorkspace';
import { type TKaraokeWorkspaceStage } from './useKaraokeWorkspaceStage';

/**
 * The karaoke playlist, built on the stage: importing files and folders,
 * loading, ordering and removing songs, advancing at a song's end, the
 * session restored from disk, and the song handed to the window's bar.
 * Runs after the stage's hooks, in the order the workspace always ran them.
 */
const useKaraokeWorkspacePlaylist = (
  stage: TKaraokeWorkspaceStage,
  { isHidden }: Pick<IKaraokeWorkspaceProps, 'isHidden'>,
) => {
  const {
    libraryFilesRef,
    setIsDragging,
    isMakerOpen,
    setIsMakerOpen,
    isMakerWorking,
    setRestoreMakerDraft,
    playlist,
    setPlaylist,
    setGroupPlaylistByFolder,
    selectedPlaylistId,
    setSelectedPlaylistId,
    setSetAsideFiles,
    autoplayAfterLoadRef,
    retainWhenHidden,
    setRetainWhenHidden,
    session,
    song,
    status,
    playhead,
    playheadRef,
    sessionRef,
    startSongPlayback,
    handleTogglePlayback,
    handleEditorTogglePlayback,
    handleRestart,
    handleSeek,
    updateLayout,
    clearSavedSession,
    clearSavedProgress,
  } = stage;
  const loadPlaylistItem = useCallback(
    async (item: IKaraokePlaylistItem, autoplay = false) => {
      autoplayAfterLoadRef.current = autoplay;
      setRetainWhenHidden(autoplay);
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
        setRetainWhenHidden(false);
      }
    },
    [
      autoplayAfterLoadRef,
      playheadRef,
      session,
      setRetainWhenHidden,
      setSelectedPlaylistId,
    ],
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
      /**
       * A SONG THAT WAS NOT HERE A MOMENT AGO IS THE ONE THAT WAS JUST ASKED
       * FOR.
       *
       * The selection used to be left exactly where it was whenever it
       * survived the merge, so "Send to Karaoke" on a tab that already had
       * songs added a row to the list and changed nothing else — the reader
       * pressed it, arrived, and found the previous song still loaded and
       * their own nowhere in sight.
       *
       * Only a genuinely NEW entry counts. A lyrics file dropped to pair with
       * audio already in the list produces no new id, and moving the
       * selection for that would be taking the reader off the song they are
       * singing to announce a file they only wanted attached to it.
       *
       * Gated on the list having existed: on the launch restore every item is
       * new by this test, and the selection put back from disk is the right
       * one to keep.
       */
      const arrived =
        playlist.length > 0
          ? ordered.find((item) => !playlist.some((was) => was.id === item.id))
          : undefined;
      if (arrived) {
        await loadPlaylistItem(arrived);
      } else if (!nextSelected) {
        await loadPlaylistItem(ordered[0]);
      } else if (
        previousSelected?.audio !== nextSelected.audio ||
        previousSelected?.lyrics !== nextSelected.lyrics
      ) {
        await loadPlaylistItem(nextSelected, session.status === 'playing');
      }
    },
    [
      libraryFilesRef,
      loadPlaylistItem,
      playlist,
      selectedPlaylistId,
      session,
      setPlaylist,
      setSetAsideFiles,
    ],
  );

  /**
   * Songs sent over from the Library tab's row menu.
   *
   * Drained rather than read, and drained here rather than in App: this is
   * the only place that knows how to turn a file into a playlist entry, and
   * anything that read the queue without emptying it would import the same
   * song again on the next render. App's half is switching to this tab and
   * making sure this component is mounted to do the draining at all.
   *
   * The queue itself is the dependency, so a file sent while this tab was
   * already open lands as promptly as one that mounted it.
   */
  const pendingKaraokeFiles = usePendingKaraokeFiles();
  useEffect(() => {
    if (pendingKaraokeFiles.length === 0) {
      return;
    }
    // Left in the queue, not dropped, while the Maker has a model running.
    // The drain below closes the Maker on purpose — see the note on it — and
    // that is the same exit the editor's own guard exists to prevent, reached
    // from the Library tab instead of from a button in the header.
    // `isMakerWorking` is a dependency, so the song lands the moment the run
    // ends or is cancelled.
    if (isMakerWorking) {
      return;
    }
    const taken = drainKaraokeFiles();
    if (taken.length > 0) {
      // AND THE PLAYER IS WHAT THIS TAB SHOWS WHEN IT ARRIVES.
      //
      // `isMakerOpen` is restored from disk, so whoever last left this tab in
      // the Maker comes back to it — which is right on a plain visit and
      // wrong here. "Send to Karaoke" asks to SING the song; it landed
      // underneath the editor instead, and read as the command having opened
      // the wrong thing. The Maker is reached by asking for it, and the draft
      // is not discarded — only put away.
      setIsMakerOpen(false);
      setRestoreMakerDraft(false);
      // SAID OUT LOUD, not swallowed. This was `.catch(() => undefined)`, and
      // an import that failed here failed in total silence: the tab changed,
      // the Maker closed, and the song simply was not in the list — which is
      // exactly the shape "Send to Karaoke does nothing" arrives in.
      addFiles([...taken]).catch((error: unknown) => {
        reportError('Could not add the song sent from the Library', error);
      });
    }
  }, [
    pendingKaraokeFiles,
    addFiles,
    isMakerWorking,
    setIsMakerOpen,
    setRestoreMakerDraft,
  ]);

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
    autoplayAfterLoadRef.current = false;
    setRetainWhenHidden(false);
    libraryFilesRef.current = [];
    setPlaylist([]);
    setSelectedPlaylistId(undefined);
    setSetAsideFiles(undefined);
    setIsMakerOpen(false);
    setRestoreMakerDraft(false);
    clearSavedProgress();
    session.clear();
    clearSavedSession();
  };

  // Every callback the playlist is handed stays the same object across the
  // renders that change nothing it shows; a new one would re-draw every row.

  /**
   * One press: load it, unless it is already the one that is loaded.
   *
   * The guard is the whole point. Every press used to reload the song from
   * its files, so a double-click on the song already on the stage tore it
   * down and rebuilt it twice — the transport bar blanking and coming back
   * for a song that had not changed.
   */
  const selectPlaylistItem = useCallback(
    (id: string) => {
      if (id === selectedPlaylistId) {
        return;
      }
      const item = playlist.find((candidate) => candidate.id === id);
      if (item) {
        loadPlaylistItem(item, status === 'playing');
      }
    },
    [loadPlaylistItem, playlist, selectedPlaylistId, status],
  );

  /**
   * Two presses: play it, from the top.
   *
   * What a double-click means everywhere else a list of songs exists. Loading
   * one already loaded is skipped for the reason above; it is sent back to
   * the start instead, because "play this" on a song half way through means
   * play it, not resume it.
   */
  const activatePlaylistItem = useCallback(
    (id: string) => {
      if (id === selectedPlaylistId) {
        sessionRef.current.seek(0);
        playheadRef.current = 0;
        startSongPlayback(true);
        return;
      }
      const item = playlist.find((candidate) => candidate.id === id);
      if (item) {
        loadPlaylistItem(item, true);
      }
    },
    [
      loadPlaylistItem,
      playheadRef,
      playlist,
      selectedPlaylistId,
      sessionRef,
      startSongPlayback,
    ],
  );

  const movePlaylistItem = useCallback(
    (id: string, targetId: string) => {
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
    },
    [setPlaylist],
  );

  const removePlaylistItem = useCallback(
    (id: string) => {
      const removedIndex = playlist.findIndex((item) => item.id === id);
      if (removedIndex < 0) {
        return;
      }
      const removed = playlist[removedIndex];
      const removedFiles = new Set([removed.audio, removed.lyrics]);
      libraryFilesRef.current = libraryFilesRef.current.filter(
        (file) => !removedFiles.has(file),
      );
      // The library just changed, so a notice naming files that are no longer
      // in it is a lie the user cannot dismiss: remove the song whose `.srt`
      // was reported unpaired and the sentence stayed on screen naming a file
      // that had left with it.
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
        clearSavedSession();
      }
      if (selectedPlaylistId === id) {
        const next = remaining[Math.min(removedIndex, remaining.length - 1)];
        if (next) {
          loadPlaylistItem(next, status === 'playing');
        } else {
          autoplayAfterLoadRef.current = false;
          setRetainWhenHidden(false);
          setSelectedPlaylistId(undefined);
          session.clear();
        }
      }
    },
    [
      autoplayAfterLoadRef,
      clearSavedSession,
      libraryFilesRef,
      loadPlaylistItem,
      playlist,
      selectedPlaylistId,
      session,
      setPlaylist,
      setRetainWhenHidden,
      setSelectedPlaylistId,
      setSetAsideFiles,
      status,
    ],
  );

  const toggleFolderGrouping = useCallback(() => {
    setGroupPlaylistByFolder((current) => {
      const next = !current;
      writeKaraokePlaylistFolderGrouping(next);
      return next;
    });
  }, [setGroupPlaylistByFolder]);

  const collapsePlaylist = useCallback(
    () => updateLayout({ playlistCollapsed: true }, true),
    [updateLayout],
  );

  const autoAdvancedSongRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (status !== 'ended' || !selectedPlaylistId) {
      autoAdvancedSongRef.current = undefined;
      return;
    }
    // The one exit from the editor that opens by itself. Preview playback runs
    // through the player, so a song left running while a model works reaches
    // its end and the playlist walks on to the next entry — which swaps the
    // audio the Maker is keyed to and remounts it on a different song, with
    // the split still running against the old one. This end is marked handled
    // rather than deferred: releasing it when the model finishes would jump to
    // the next song at the exact moment the stems appear, which is the one
    // moment the user is looking at the editor.
    if (isMakerWorking) {
      autoAdvancedSongRef.current = selectedPlaylistId;
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
  }, [isMakerWorking, loadPlaylistItem, playlist, selectedPlaylistId, status]);

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
    playheadRef,
    song,
  ]);

  const transportSlot = useTransportSlot();

  /**
   * The song's own cover, for the bar at the foot of the window.
   *
   * An UltraStar pack keeps its artwork beside the audio as a plain file, so
   * this is the same asset the stage draws behind the words. Revoked when the
   * song changes: an object URL holds the file alive until it is, and a
   * session that plays a hundred songs would hold a hundred.
   */
  const coverAsset = song?.assets.find((asset) => asset.role === 'cover');
  const makerAudio = song?.assets.find((asset) => asset.role === 'audio');
  /**
   * The Maker is over the stage. Covered is not hidden — the stage is laid
   * out and on screen beneath it, so `observeShown` says shown — and the
   * words' and the pitch lane's frame loops drew every frame for nobody for
   * as long as the Maker was open. Both stand down while it is, and come back
   * drawing the song where it is when it closes.
   */
  const isMakerShown = isMakerOpen && Boolean(song) && Boolean(makerAudio);
  const coverUrl = useMemo(
    () => (coverAsset ? URL.createObjectURL(coverAsset.file) : undefined),
    [coverAsset],
  );
  useEffect(
    () => () => {
      if (coverUrl) {
        URL.revokeObjectURL(coverUrl);
      }
    },
    [coverUrl],
  );

  /**
   * Tell the bar at the foot of the window what this tab is playing.
   *
   * The position travels at the Library's quarter second
   * (`quantizeTransportPosition`) and is republished only when that moves.
   * Every reader of the register re-renders on each publish, the app's root
   * among them, and none draws finer than a whole second: sent at the stage's
   * twenty a second, each tick re-rendered all of them. `hasOwnControls` is
   * the arrangement itself: the bar keeps the space, this tab fills it, and
   * the karaoke buttons stay karaoke's.
   */
  useEffect(() => {
    if (!song) {
      clearTransportSource('karaoke');
      return undefined;
    }
    const selectedIndex = playlist.findIndex(
      (item) => item.id === selectedPlaylistId,
    );
    const hasQueuedSuccessor =
      status === 'ended' &&
      !isMakerWorking &&
      selectedIndex >= 0 &&
      selectedIndex + 1 < playlist.length;
    let publishedMs: number | undefined;
    const publish = () => {
      const positionMs =
        quantizeTransportPosition(playhead.read() / 1_000) * 1_000;
      if (positionMs === publishedMs) {
        return;
      }
      publishedMs = positionMs;
      setTransportSource({
        owner: 'karaoke',
        title: song.title,
        subtitle: song.artist || undefined,
        artworkUrl: coverUrl,
        isPlaying: status === 'playing',
        retainWhenHidden: retainWhenHidden || hasQueuedSuccessor || undefined,
        positionMs,
        durationMs: session.durationMs,
        toggle: handleTogglePlayback,
        canToggle: !['empty', 'loading'].includes(status),
        navigation: 'boundaries',
        previous: !['empty', 'loading'].includes(status)
          ? () => handleSeek(0)
          : undefined,
        next: !['empty', 'loading'].includes(status)
          ? () => handleSeek(session.durationMs)
          : undefined,
        seek: handleSeek,
        // The exact KaraokeTransport instance remains in this slot while the
        // workspace is hidden. Replacing it with the generic source controls
        // is what changed the icon sizes and dropped karaoke-only actions.
        hasOwnControls: true,
        identity: buildSongIdentity(
          'karaoke',
          song.id,
          song.title,
          song.artist,
        ),
      });
    };
    publish();
    return playhead.subscribe(publish);
  }, [
    song,
    coverUrl,
    status,
    retainWhenHidden,
    playhead,
    session.durationMs,
    handleTogglePlayback,
    handleSeek,
    isMakerWorking,
    playlist,
    selectedPlaylistId,
  ]);

  // The transport description above must expose the handoff before ownership
  // is released, or another tab's paused controls can flash between songs.
  useEffect(() => {
    if (status === 'ended') {
      releasePlayback('karaoke');
    }
  }, [status]);

  // The tab can go away while another is playing; `clearTransportSource` is
  // guarded so it only takes the bar back if karaoke still owns it.
  useEffect(() => () => clearTransportSource('karaoke'), []);

  return {
    onFileInput,
    onDrop,
    clearPlaylist,
    selectPlaylistItem,
    activatePlaylistItem,
    movePlaylistItem,
    removePlaylistItem,
    toggleFolderGrouping,
    collapsePlaylist,
    transportSlot,
    makerAudio,
    isMakerShown,
  };
};

export type TKaraokeWorkspacePlaylist = ReturnType<
  typeof useKaraokeWorkspacePlaylist
>;

export default useKaraokeWorkspacePlaylist;
