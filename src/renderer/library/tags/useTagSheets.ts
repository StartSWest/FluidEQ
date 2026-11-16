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

import { useEffect, useRef, useState } from 'react';
import type { TTagReadResult } from '../../../common/library/tagFields';
import { useTagEditor } from './TagEditorContext';

/** Songs read per call: main reads them one after another, and a page this
 * size keeps each call short enough that the window never waits on it. */
const PAGE = 25;

export interface ITagSheets {
  /** By song id; a song not read yet is absent. */
  results: ReadonlyMap<string, TTagReadResult>;
  /** How many of `ids` have been read, for the progress line. */
  readCount: number;
  isComplete: boolean;
}

/**
 * The tags of `ids`, read from their files in pages as they arrive, and a
 * song read again the moment a write of it lands.
 */
export const useTagSheets = (ids: readonly string[]): ITagSheets => {
  const { writtenRevisions } = useTagEditor();
  const [results, setResults] = useState<ReadonlyMap<string, TTagReadResult>>(
    () => new Map(),
  );
  /** The revision each song was read at, so a write is read once. */
  const readAt = useRef(new Map<string, number>());
  const key = ids.join('|');

  useEffect(() => {
    let isCurrent = true;
    const wanted = key === '' ? [] : key.split('|');
    const stale = wanted.filter(
      (id) =>
        !readAt.current.has(id) ||
        (writtenRevisions.get(id) ?? 0) > (readAt.current.get(id) ?? 0),
    );
    const readPage = async (from: number): Promise<void> => {
      if (!isCurrent || from >= stale.length) {
        return;
      }
      const page = stale.slice(from, from + PAGE);
      const answers = await window.electron.ipcRenderer.readLibraryTags(page);
      if (!isCurrent) {
        return;
      }
      setResults((current) => {
        const next = new Map(current);
        page.forEach((id, index) => {
          const answer = answers[index];
          if (answer !== undefined) {
            next.set(id, answer);
            readAt.current.set(id, writtenRevisions.get(id) ?? 0);
          }
        });
        return next;
      });
      await readPage(from + PAGE);
    };
    readPage(0).catch((error: unknown) => {
      // eslint-disable-next-line no-console -- context-rich error; the editor shows the songs it could read
      console.error('Could not read the tags of some songs', error);
    });
    return () => {
      isCurrent = false;
    };
  }, [key, writtenRevisions]);

  const wanted = key === '' ? [] : key.split('|');
  const readCount = wanted.filter((id) => results.has(id)).length;
  return { results, readCount, isComplete: readCount === wanted.length };
};
