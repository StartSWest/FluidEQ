/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { RefObject, useCallback, useEffect, useRef } from 'react';
import {
  IKaraokePlaylistItem,
  karaokeFileRelativePath,
  karaokeRestoredFileToken,
} from '../../common/karaoke/files';
import {
  IKaraokeSessionFileReference,
  IKaraokeSessionSnapshot,
} from '../../common/karaoke/sessionPersistence';
import observeShown from '../utils/observeShown';
import {
  clearKaraokeProgress,
  writeKaraokeProgress,
} from './karaokeEditorPersistence';
import { TKaraokePlaybackStatus } from './useKaraokeSession';

interface IKaraokeSessionSavingOptions {
  /** False until last session has been read back; nothing is saved before. */
  readyRef: RefObject<boolean>;
  libraryFilesRef: RefObject<File[]>;
  playlistRef: RefObject<IKaraokePlaylistItem[]>;
  selectedPlaylistIdRef: RefObject<string | undefined>;
  /** The place worth coming back to, which a load resets before it lands. */
  playheadRef: RefObject<number>;
  /** The stage, watched for going out of sight while the window stays up. */
  surfaceRef: RefObject<HTMLElement | null>;
  audioRef: RefObject<HTMLAudioElement>;
  status: TKaraokePlaybackStatus;
  playlist: readonly IKaraokePlaylistItem[];
  selectedPlaylistId?: string;
  songId?: string;
  isRestoring: boolean;
  isHidden: boolean;
}

const persistedFileReference = (
  file: File,
): IKaraokeSessionFileReference | undefined => {
  const token = karaokeRestoredFileToken(file);
  if (token) {
    return { token, relativePath: karaokeFileRelativePath(file) };
  }
  try {
    const localPath = window.electron?.ipcRenderer.getPathForFile?.(file) ?? '';
    return localPath
      ? { localPath, relativePath: karaokeFileRelativePath(file) }
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * What the Karaoke tab keeps so a restart, or a crash, comes back to the same
 * list, the same song and the same place in it — saved when one of those
 * changes, never on a clock.
 *
 * It was saved every second and a half for as long as the tab was mounted,
 * behind another tab included, and main answers every save by checking each
 * file in the list on disk and writing the session out: with a large library
 * main stalled on that beat and every reply the window was waiting for came
 * late. A save now follows what is worth coming back to — a pause, a song
 * ending, another song or list, the stage or the window going out of sight,
 * the page going away — and a snapshot identical to the last one sent is not
 * sent again.
 *
 * Seeks go to the renderer's own record only (`writeKaraokeProgress`), which
 * the restore prefers for the song it names. A drag along a seek line is
 * dozens of seeks a second, and main is not asked to stat a library for each.
 */
const useKaraokeSessionSaving = ({
  readyRef,
  libraryFilesRef,
  playlistRef,
  selectedPlaylistIdRef,
  playheadRef,
  surfaceRef,
  audioRef,
  status,
  playlist,
  selectedPlaylistId,
  songId,
  isRestoring,
  isHidden,
}: IKaraokeSessionSavingOptions) => {
  const lastProgressRef = useRef<string | undefined>(undefined);
  const lastSessionRef = useRef<string | undefined>(undefined);
  // Asking the bridge for a path is per file, and a saved session holds up to
  // 5,000. The workspace replaces its file list whenever it changes, so the
  // list itself says when these have to be worked out again.
  const referencesRef = useRef<
    | { library: readonly File[]; files: IKaraokeSessionFileReference[] }
    | undefined
  >(undefined);

  const saveProgress = useCallback(() => {
    if (!readyRef.current) {
      return;
    }
    const selected = selectedPlaylistIdRef.current;
    const playheadMs = playheadRef.current;
    const key = `${selected ?? ''}\u0000${playheadMs}`;
    if (key === lastProgressRef.current) {
      return;
    }
    lastProgressRef.current = key;
    writeKaraokeProgress(selected, playheadMs);
  }, [playheadRef, readyRef, selectedPlaylistIdRef]);

  const saveSession = useCallback(() => {
    const bridge = window.electron?.ipcRenderer;
    if (!readyRef.current || !bridge?.saveKaraokeSession) {
      return;
    }
    const library = libraryFilesRef.current;
    if (referencesRef.current?.library !== library) {
      referencesRef.current = {
        library,
        files: library
          .map(persistedFileReference)
          .filter(
            (file): file is IKaraokeSessionFileReference => file !== undefined,
          ),
      };
    }
    const { files } = referencesRef.current;
    if (!files.length) {
      return;
    }
    const snapshot: IKaraokeSessionSnapshot = {
      version: 1,
      files,
      playlistOrder: playlistRef.current.map((item) => item.id),
      selectedPlaylistId: selectedPlaylistIdRef.current,
      playheadMs: playheadRef.current,
    };
    const key = JSON.stringify(snapshot);
    if (key === lastSessionRef.current) {
      return;
    }
    lastSessionRef.current = key;
    bridge.saveKaraokeSession(snapshot).catch(() => {
      // Not saved, so not the last one sent: the next reason to save sends
      // it again instead of taking it for done.
      if (lastSessionRef.current === key) {
        lastSessionRef.current = undefined;
      }
    });
  }, [
    libraryFilesRef,
    playheadRef,
    playlistRef,
    readyRef,
    selectedPlaylistIdRef,
  ]);

  const save = useCallback(() => {
    saveProgress();
    saveSession();
  }, [saveProgress, saveSession]);

  /** The saved session is gone; the next save is new, whatever it holds. */
  const clearSavedSession = useCallback(() => {
    lastSessionRef.current = undefined;
    window.electron?.ipcRenderer.clearKaraokeSession?.().catch(() => undefined);
  }, []);

  const clearSavedProgress = useCallback(() => {
    lastProgressRef.current = undefined;
    clearKaraokeProgress();
  }, []);

  useEffect(() => {
    if (status === 'paused' || status === 'ended') {
      save();
    }
  }, [save, status]);

  // Another list or song, and the moment last session has been read back: a
  // song sent from the Library while it was being read is otherwise saved by
  // nothing until the next pause.
  useEffect(() => {
    save();
  }, [save, playlist, selectedPlaylistId, songId, isRestoring]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }
    audio.addEventListener('seeked', saveProgress);
    return () => audio.removeEventListener('seeked', saveProgress);
  }, [audioRef, saveProgress]);

  // The stage going out of sight: another tab, or the amp over the window.
  useEffect(() => {
    if (isHidden) {
      save();
      return undefined;
    }
    const surface = surfaceRef.current;
    return surface
      ? observeShown(surface, (shown) => {
          if (!shown) {
            save();
          }
        })
      : undefined;
  }, [isHidden, save, surfaceRef]);

  // The window going out of sight is the last event a page can count on:
  // after it the app can be closed, or ended, with nothing else said.
  useEffect(() => {
    const saveWhenHidden = () => {
      if (document.hidden) {
        save();
      }
    };
    document.addEventListener('visibilitychange', saveWhenHidden);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', saveWhenHidden);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [save]);

  return { clearSavedSession, clearSavedProgress };
};

export default useKaraokeSessionSaving;
