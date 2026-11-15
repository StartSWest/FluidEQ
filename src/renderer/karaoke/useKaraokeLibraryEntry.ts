/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  takeKaraokeMakerRequest,
  usePendingKaraokeMakerRequest,
} from '../library/karaokeHandoff';
import { reportError } from '../utils/logger';
import {
  type IKaraokeLibraryOrigin,
  libraryOriginOf,
  rememberLibraryOrigin,
} from './karaokeLibraryOrigin';
import { karaokeSongIdForFile } from './useKaraokeSession';
import { type IKaraokeMakerLibraryEntry } from './useMakerLibrarySong';
import { type TKaraokeWorkspacePlaylist } from './useKaraokeWorkspacePlaylist';
import { type TKaraokeWorkspaceStage } from './useKaraokeWorkspaceStage';

interface IEntry extends IKaraokeMakerLibraryEntry {
  /** The song the Maker is to open on (`karaokeSongIdForFile`). */
  songId: string;
  origin: IKaraokeLibraryOrigin;
  /** The Maker has been opened for it. */
  isOpened: boolean;
  /**
   * That Maker was closed: the words were handed over once, and a Maker
   * opened again from the player's own button starts as it always does —
   * the plain words do not come back into its editor a second time.
   */
  isSpent: boolean;
}

/**
 * A song sent from the Library's Lyrics tab, opened in the Maker with the
 * words it came with (`karaokeHandoff.ts`'s Maker slot).
 *
 * The song goes into the playlist as any sent song does, its timed words as
 * the `.lrc` beside it, and the Maker opens on it only once the player holds
 * it — told by the song itself arriving, never by a guess at how long a load
 * takes — so a load that fails never opens the editor over the song before
 * it. The Maker always prefers a draft of the song over the Library's words
 * here (`restoreSavedDraft`): what the listener made is never put aside for
 * what they pressed a button to start from.
 *
 * Songs are named by their audio file, not by `song.id`: Use in player gives
 * the song the project's id, and the link to the Library has to outlive it.
 */
const useKaraokeLibraryEntry = (
  stage: TKaraokeWorkspaceStage,
  songs: TKaraokeWorkspacePlaylist,
) => {
  const {
    cancelCountIn,
    isMakerOpen,
    isMakerWorking,
    setIsMakerOpen,
    setRestoreMakerDraft,
  } = stage;
  const { addFiles, makerAudio } = songs;
  const request = usePendingKaraokeMakerRequest();
  const [entry, setEntry] = useState<IEntry>();
  const nonceRef = useRef(0);

  useEffect(() => {
    // Left waiting while a model runs in the Maker, as a sent file is
    // (`useKaraokeWorkspacePlaylist`): taking it would close the editor the
    // running job belongs to.
    if (request === undefined || isMakerWorking) {
      return;
    }
    const taken = takeKaraokeMakerRequest();
    if (taken === undefined) {
      return;
    }
    const songId = karaokeSongIdForFile(taken.audio);
    rememberLibraryOrigin(songId, taken.origin);
    cancelCountIn();
    // Put away first, whatever it was open on: on this same song it holds
    // the words from before this press, and its draft is written as it goes.
    setIsMakerOpen(false);
    setEntry(undefined);
    nonceRef.current += 1;
    const nonce = nonceRef.current;
    addFiles(
      taken.lyrics === undefined ? [taken.audio] : [taken.audio, taken.lyrics],
      taken.audio,
    )
      .then((loaded) => {
        if (loaded && nonceRef.current === nonce) {
          setEntry({
            songId,
            origin: taken.origin,
            nonce,
            plainText: taken.plainText,
            isOpened: false,
            isSpent: false,
          });
        }
        return undefined;
      })
      .catch((error: unknown) => {
        reportError('Could not open the Library song in the Maker', error);
      });
  }, [request, isMakerWorking, addFiles, cancelCountIn, setIsMakerOpen]);

  const audioSongId =
    makerAudio === undefined
      ? undefined
      : karaokeSongIdForFile(makerAudio.file);

  useEffect(() => {
    if (entry === undefined || entry.isOpened || audioSongId !== entry.songId) {
      return;
    }
    setRestoreMakerDraft(true);
    setIsMakerOpen(true);
    setEntry({ ...entry, isOpened: true });
  }, [audioSongId, entry, setIsMakerOpen, setRestoreMakerDraft]);

  useEffect(() => {
    if (entry?.isOpened === true && !entry.isSpent && !isMakerOpen) {
      setEntry({ ...entry, isSpent: true });
    }
  }, [entry, isMakerOpen]);

  const isEntrySong = entry !== undefined && entry.songId === audioSongId;
  const libraryOrigin = useMemo(() => {
    if (audioSongId === undefined) {
      return undefined;
    }
    // The one just handed over first: it is there even where storage is not.
    return isEntrySong && entry !== undefined
      ? entry.origin
      : libraryOriginOf(audioSongId);
  }, [audioSongId, entry, isEntrySong]);

  const entryNonce = entry?.nonce;
  const entryText = entry?.plainText;
  const isLive = isEntrySong && entry?.isOpened === true && !entry.isSpent;
  const libraryEntry = useMemo<IKaraokeMakerLibraryEntry | undefined>(
    () =>
      isLive && entryNonce !== undefined
        ? { nonce: entryNonce, plainText: entryText }
        : undefined,
    [entryNonce, entryText, isLive],
  );

  return {
    libraryOrigin,
    /** For the Maker opened on the entry's song, until it closes. */
    libraryEntry,
  };
};

export type TKaraokeLibraryEntry = ReturnType<typeof useKaraokeLibraryEntry>;

export default useKaraokeLibraryEntry;
