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

export type TSubtitleRemoveState =
  | { state: 'idle' }
  /** The row is asking whether to remove this file. */
  | { state: 'asking'; fileName: string }
  | { state: 'busy'; fileName: string }
  | { state: 'failed'; fileName: string };

export interface ISubtitleRemove {
  status: TSubtitleRemoveState;
  ask: (fileName: string) => void;
  confirm: () => void;
  cancel: () => void;
}

/**
 * Removing a video's subtitle file from its row (Ivan, 2026-11-15: "add an
 * option to remove a sub"): asked in the row first, then moved to the
 * Recycle Bin by main (`library-subtitles-remove`), which takes only a file
 * it lists beside that video. `onGone` runs once the file is no longer
 * there — removed now, or found gone already — for the tab to read the list
 * again and put another file in use.
 */
export const useSubtitleRemove = (
  videoId: string,
  onGone: (fileName: string) => void,
): ISubtitleRemove => {
  const [status, setStatus] = useState<TSubtitleRemoveState>({
    state: 'idle',
  });
  // A video changed under a running removal must not hear its result.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const ask = useCallback(
    (fileName: string) => setStatus({ state: 'asking', fileName }),
    [],
  );

  const cancel = useCallback(() => setStatus({ state: 'idle' }), []);

  const confirm = useCallback(() => {
    if (status.state !== 'asking') {
      return;
    }
    const { fileName } = status;
    setStatus({ state: 'busy', fileName });
    window.electron.ipcRenderer
      .removeLibrarySubtitle(videoId, fileName)
      .then((result) => {
        if (!isMountedRef.current) {
          return undefined;
        }
        if (result.state === 'failed') {
          setStatus({ state: 'failed', fileName });
          return undefined;
        }
        // Refused means it is not among the video's files now: gone since
        // the list was read. Either way the list is read again.
        setStatus({ state: 'idle' });
        onGone(fileName);
        return undefined;
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the row says the file was not removed
        console.error('Could not remove a subtitle file', videoId, error);
        if (isMountedRef.current) {
          setStatus({ state: 'failed', fileName });
        }
      });
  }, [status, videoId, onGone]);

  return { status, ask, confirm, cancel };
};
