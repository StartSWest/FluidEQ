/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_LYRICS_FILE_BYTES } from '../../common/library/lyrics';
import {
  checkLyricsImport,
  decodeLyricsBytes,
  isLyricsFileName,
  type TLyricsImportRefusal,
  type TLyricsPlace,
} from '../../common/library/lyricsImport';

export type TLyricsImportState =
  | { state: 'idle' }
  | { state: 'busy' }
  /** A lyrics file of that name is already there; nothing written yet. */
  | { state: 'confirm'; fileName: string; place: TLyricsPlace }
  | { state: 'saved'; fileName: string; place: TLyricsPlace }
  | { state: 'refused'; reason: TLyricsImportRefusal | 'notLyricsFile' }
  | { state: 'failed' };

export interface ILyricsImport {
  status: TLyricsImportState;
  /** The system's file dialog, in Downloads. */
  pickFile: () => void;
  /** A file dropped on the tab. */
  importFile: (file: File) => void;
  /** Words pasted into the tab. */
  importText: (text: string) => void;
  /** Goes over the lyrics file that was already there. */
  replace: () => void;
  /** Leaves things as they were, and says nothing more. */
  dismiss: () => void;
}

/**
 * Lyrics the listener brings to a song — picked, dropped or pasted — kept
 * with it by main (`library-lyrics-import`), asking before a lyrics file
 * already there is replaced. `onSaved` runs once they are kept, for the tab
 * to read them back the way it reads every song's words.
 *
 * Checked here as main will check them, so a file that is not lyrics is
 * refused at once rather than after a trip to main; main checks again.
 */
export const useLyricsImport = (
  trackId: string,
  onSaved: () => void,
): ILyricsImport => {
  const [status, setStatus] = useState<TLyricsImportState>({ state: 'idle' });
  // The words waiting on "Replace", which is the only time they are held.
  const pendingRef = useRef<string | undefined>(undefined);
  // A song changed under a running import must not have its tab told about
  // the last song's result.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const send = useCallback(
    (text: string, replace: boolean) => {
      const check = checkLyricsImport(text);
      if (!check.ok) {
        setStatus({ state: 'refused', reason: check.reason });
        return;
      }
      setStatus({ state: 'busy' });
      window.electron.ipcRenderer
        .importLibraryTrackLyrics(trackId, text, replace)
        .then((result) => {
          if (!isMountedRef.current) {
            return undefined;
          }
          if (result === undefined) {
            // The library no longer knows the song: nothing to keep it with.
            setStatus({ state: 'failed' });
            return undefined;
          }
          if (result.state === 'exists') {
            pendingRef.current = text;
            setStatus({
              state: 'confirm',
              fileName: result.fileName,
              place: result.place,
            });
            return undefined;
          }
          pendingRef.current = undefined;
          setStatus(result);
          if (result.state === 'saved') {
            onSaved();
          }
          return undefined;
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the lyrics were not saved
          console.error('Could not import lyrics for a song', trackId, error);
          if (isMountedRef.current) {
            setStatus({ state: 'failed' });
          }
        });
    },
    [trackId, onSaved],
  );

  const pickFile = useCallback(() => {
    setStatus({ state: 'busy' });
    window.electron.ipcRenderer
      .pickLibraryLyricsFile()
      .then((picked) => {
        if (!isMountedRef.current) {
          return undefined;
        }
        if (picked.state === 'canceled') {
          setStatus({ state: 'idle' });
        } else if (picked.state === 'refused') {
          setStatus({ state: 'refused', reason: picked.reason });
        } else {
          send(picked.text, false);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the file was not read
        console.error('Could not open a lyrics file', error);
        if (isMountedRef.current) {
          setStatus({ state: 'failed' });
        }
      });
  }, [send]);

  const importFile = useCallback(
    (file: File) => {
      if (!isLyricsFileName(file.name)) {
        setStatus({ state: 'refused', reason: 'notLyricsFile' });
        return;
      }
      // Never read whole what cannot be lyrics.
      if (file.size > MAX_LYRICS_FILE_BYTES) {
        setStatus({ state: 'refused', reason: 'tooBig' });
        return;
      }
      setStatus({ state: 'busy' });
      file
        .arrayBuffer()
        .then((buffer) => {
          if (isMountedRef.current) {
            send(decodeLyricsBytes(new Uint8Array(buffer)), false);
          }
          return undefined;
        })
        .catch((error: unknown) => {
          // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the file was not read
          console.error('Could not read a dropped lyrics file', error);
          if (isMountedRef.current) {
            setStatus({ state: 'refused', reason: 'notText' });
          }
        });
    },
    [send],
  );

  const importText = useCallback((text: string) => send(text, false), [send]);

  const replace = useCallback(() => {
    const text = pendingRef.current;
    if (text !== undefined) {
      send(text, true);
    }
  }, [send]);

  const dismiss = useCallback(() => {
    pendingRef.current = undefined;
    setStatus({ state: 'idle' });
  }, []);

  return { status, pickFile, importFile, importText, replace, dismiss };
};
