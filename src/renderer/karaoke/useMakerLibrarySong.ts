/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { exportKaraokeMaker } from '../../common/karaoke/makerExport';
import type { IKaraokeMakerProject } from '../../common/karaoke/makerProject';
import { lyricsFromText } from '../../common/library/lyrics';
import type { TLyricsPlace } from '../../common/library/lyricsImport';
import { announceTrackLyricsChanged } from '../library/useTrackLyrics';
import type { IKaraokeLibraryOrigin } from './karaokeLibraryOrigin';
import type { TKaraokeMakerEditor } from './useKaraokeMakerEditor';

/** The Maker opened from the Library's Lyrics tab, on this song, just now. */
export interface IKaraokeMakerLibraryEntry {
  /** One per press, so a second "Open in Karaoke" opens a fresh editor. */
  nonce: number;
  /** Plain words, for the lyric editor; absent when the words came timed. */
  plainText?: string;
}

/**
 * What the Maker does once it knows whether a draft of this song was kept:
 * plain words go into the lyric editor to be timed, the way words pasted
 * there are; timed words are already the project. A draft the listener had
 * made is never put aside for the Library's words — it opens as it was, and
 * the notice says so, and how to start from the Library's words instead.
 */
export const useMakerLibraryEntry = (
  editor: TKaraokeMakerEditor,
  entry: IKaraokeMakerLibraryEntry | undefined,
) => {
  const {
    adoptedDraft,
    draftReady,
    openLyricsDraft,
    projectRef,
    setLyricsDraft,
    setNotice,
    t,
  } = editor;
  const handledRef = useRef(false);
  useEffect(() => {
    if (entry === undefined || !draftReady || handledRef.current) {
      return;
    }
    handledRef.current = true;
    const { plainText } = entry;
    if (plainText !== undefined) {
      openLyricsDraft(projectRef.current);
      setLyricsDraft(plainText);
    }
    if (adoptedDraft) {
      setNotice(
        t(
          plainText === undefined
            ? 'karaoke.maker.song.keptTimed'
            : 'karaoke.maker.song.keptPlain',
        ),
      );
    } else if (plainText === undefined) {
      setNotice(t('karaoke.maker.song.openedTimed'));
    }
  }, [
    adoptedDraft,
    draftReady,
    entry,
    openLyricsDraft,
    projectRef,
    setLyricsDraft,
    setNotice,
    t,
  ]);
};

export type TMakerSongSave =
  | { state: 'idle' }
  | { state: 'busy' }
  /** A lyrics file is already where the timing would go; nothing written. */
  | { state: 'confirm'; fileName: string; place: TLyricsPlace };

interface IMakerSongSaveParams {
  project: IKaraokeMakerProject;
  origin: IKaraokeLibraryOrigin | undefined;
  setNotice: (message?: string) => void;
  t: TKaraokeMakerEditor['t'];
}

/**
 * "Save to song": the Maker's timing written back as the Library song's
 * lyrics, through the very door the Lyrics tab imports by
 * (`library-lyrics-import`, by the song's id), so it lands where that tab
 * reads — the song's own `.lrc` beside it, or FluidEQ's lyrics folder where
 * the song's folder refuses the write — and never over a lyrics file already
 * there without the listener saying so here.
 *
 * Written as the Maker's own Enhanced LRC: line stamps, and word stamps where
 * words are timed, which the Lyrics tab lights word by word. A word's own
 * end stamp is written and read back only as the end of the line it closes;
 * melody notes and other languages stay in the Maker's draft.
 */
export const useMakerSongSave = ({
  project,
  origin,
  setNotice,
  t,
}: IMakerSongSaveParams) => {
  const [save, setSave] = useState<TMakerSongSave>({ state: 'idle' });
  // The words waiting on "Replace", and how many lines they left out.
  const pendingRef = useRef<{ text: string; droppedLines: number } | undefined>(
    undefined,
  );
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const send = useCallback(
    (text: string, droppedLines: number, replace: boolean) => {
      if (origin === undefined) {
        return;
      }
      const { trackId, timedInTags } = origin;
      setSave({ state: 'busy' });
      window.electron.ipcRenderer
        .importLibraryTrackLyrics(trackId, text, replace)
        .then((result) => {
          if (!isMountedRef.current) {
            return undefined;
          }
          if (result === undefined) {
            setSave({ state: 'idle' });
            setNotice(t('karaoke.maker.song.gone'));
            return undefined;
          }
          if (result.state === 'exists') {
            pendingRef.current = { text, droppedLines };
            setSave({
              state: 'confirm',
              fileName: result.fileName,
              place: result.place,
            });
            return undefined;
          }
          pendingRef.current = undefined;
          setSave({ state: 'idle' });
          if (result.state !== 'saved') {
            setNotice(t('karaoke.maker.song.failed'));
            return undefined;
          }
          announceTrackLyricsChanged(trackId);
          setNotice(
            [
              result.place === 'beside'
                ? t('karaoke.maker.song.savedBeside', { name: result.fileName })
                : t('karaoke.maker.song.savedKept'),
              droppedLines > 0
                ? t('karaoke.maker.song.untimedLeftOut', {
                    lines: droppedLines,
                  })
                : '',
              timedInTags ? t('karaoke.maker.song.tagsFirst') : '',
            ]
              .filter((sentence) => sentence !== '')
              .join(' '),
          );
          return undefined;
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console -- context-rich error before it is dropped; the Maker says the lyrics were not saved
          console.error('Could not save the Maker timing to a song', error);
          if (isMountedRef.current) {
            setSave({ state: 'idle' });
            setNotice(t('karaoke.maker.song.failed'));
          }
        });
    },
    [origin, setNotice, t],
  );

  const saveToSong = useCallback(() => {
    // The original words: the song's lyrics are the song's own language.
    const output = exportKaraokeMaker(project, 'elrc');
    // Read back by the Library's own reader, as main will: a file with no
    // timed line would otherwise go in as plain text made of its ID tags.
    if (lyricsFromText(output.contents, 'lrc')?.kind !== 'synced') {
      setNotice(t('karaoke.maker.song.nothingTimed'));
      return;
    }
    send(output.contents, output.droppedLines, false);
  }, [project, send, setNotice, t]);

  const replace = useCallback(() => {
    const pending = pendingRef.current;
    if (pending !== undefined) {
      send(pending.text, pending.droppedLines, true);
    }
  }, [send]);

  const keep = useCallback(() => {
    pendingRef.current = undefined;
    setSave({ state: 'idle' });
  }, []);

  return { save, saveToSong, replace, keep };
};
