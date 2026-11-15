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
import { decodeLyricsBytes } from '../../common/library/lyricsImport';
import {
  checkSubtitleImport,
  isSubtitleFileName,
  type TSubtitleImportRefusal,
  type TSubtitleImportResult,
} from '../../common/library/subtitleImport';
import { MAX_SUBTITLE_FILE_BYTES } from '../../common/library/subtitles';

export type TSubtitlesImportState =
  | { state: 'idle' }
  | { state: 'busy' }
  | { state: 'saved'; fileName: string }
  | { state: 'refused'; reason: TSubtitleImportRefusal }
  | { state: 'failed' };

export interface ISubtitlesImport {
  status: TSubtitlesImportState;
  /** The system's file dialog, in Downloads. */
  pickFile: () => void;
  /** A file dropped on the tab. */
  importFile: (file: File) => void;
  /** Says nothing more about the last import. */
  dismiss: () => void;
}

/**
 * Subtitles the viewer brings to a video — picked or dropped — kept beside
 * it by main under the video's name (`library-subtitles-pick`,
 * `library-subtitles-import`). Never over a file already there, so there is
 * nothing to ask. `onSaved` gets the kept file's name, for the tab to show
 * it.
 *
 * A dropped file is checked here as main will check it, so one that is not
 * subtitles is refused at once; main checks again.
 */
export const useSubtitlesImport = (
  trackId: string,
  onSaved: (fileName: string) => void,
): ISubtitlesImport => {
  const [status, setStatus] = useState<TSubtitlesImportState>({
    state: 'idle',
  });
  // A video changed under a running import must not have its tab told
  // about the last video's result.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const settle = useCallback(
    (result: TSubtitleImportResult) => {
      if (!isMountedRef.current) {
        return;
      }
      if (result.state === 'canceled') {
        setStatus({ state: 'idle' });
        return;
      }
      setStatus(result);
      if (result.state === 'saved') {
        onSaved(result.fileName);
      }
    },
    [onSaved],
  );

  const fail = useCallback(
    (what: string) => (error: unknown) => {
      // eslint-disable-next-line no-console -- context-rich error before it is dropped; the tab says the subtitles were not kept
      console.error(what, trackId, error);
      if (isMountedRef.current) {
        setStatus({ state: 'failed' });
      }
    },
    [trackId],
  );

  const pickFile = useCallback(() => {
    setStatus({ state: 'busy' });
    window.electron.ipcRenderer
      .pickLibrarySubtitlesFile(trackId)
      .then(settle)
      .catch(fail('Could not keep a picked subtitle file for a video'));
  }, [trackId, settle, fail]);

  const importFile = useCallback(
    (file: File) => {
      if (!isSubtitleFileName(file.name)) {
        setStatus({ state: 'refused', reason: 'notSubtitles' });
        return;
      }
      // Never read whole what cannot be subtitles.
      if (file.size > MAX_SUBTITLE_FILE_BYTES) {
        setStatus({ state: 'refused', reason: 'tooBig' });
        return;
      }
      setStatus({ state: 'busy' });
      file
        .arrayBuffer()
        .then((buffer): Promise<TSubtitleImportResult> => {
          const text = decodeLyricsBytes(new Uint8Array(buffer));
          const check = checkSubtitleImport(text, file.name);
          return check.ok
            ? window.electron.ipcRenderer.importLibrarySubtitles(
                trackId,
                file.name,
                text,
              )
            : Promise.resolve({ state: 'refused', reason: check.reason });
        })
        .then(settle)
        .catch(fail('Could not keep a dropped subtitle file for a video'));
    },
    [trackId, settle, fail],
  );

  const dismiss = useCallback(() => setStatus({ state: 'idle' }), []);

  return { status, pickFile, importFile, dismiss };
};
