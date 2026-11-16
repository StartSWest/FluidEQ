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

import fs from 'fs';
import path from 'path';
import {
  decodeCueText,
  MAX_CUE_BYTES,
  parseCueSheet,
} from '../../common/library/cueSheet';
import {
  type ITagFolderFacts,
  MAX_COVER_BYTES,
  type TTagCoverPick,
} from '../../common/library/tagFields';
import {
  type IFolderPicture,
  isFolderPicture,
  pickCueFile,
  pickFolderCover,
} from '../../common/library/tagFolder';

/**
 * An album folder's own files, for Fix tags: its CUE sheet, read and
 * parsed, and the name of its picture. Only plain files directly in the
 * folder count — a link is not followed, a subfolder not entered — and a
 * file past its size limit is passed over, never read.
 */

/** The folder's plain files, or none where it cannot be listed. */
const filesIn = async (folder: string): Promise<string[]> => {
  try {
    const entries = await fs.promises.readdir(folder, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; Fix tags then proposes from names alone
    console.error(`Could not list the album folder ${folder}`, error);
    return [];
  }
};

/** A file's size where it is one this module may read, else `undefined`. */
const sizeWithin = async (
  file: string,
  limit: number,
): Promise<number | undefined> => {
  try {
    const { size } = await fs.promises.stat(file);
    return size > 0 && size <= limit ? size : undefined;
  } catch {
    return undefined;
  }
};

/** The folder's pictures with their sizes, for the album picture's pick. */
const picturesIn = async (
  folder: string,
  names: readonly string[],
): Promise<IFolderPicture[]> => {
  const pictures = await Promise.all(
    names.filter(isFolderPicture).map(async (name) => ({
      name,
      size: (await sizeWithin(path.join(folder, name), MAX_COVER_BYTES)) ?? 0,
    })),
  );
  return pictures.filter((picture) => picture.size > 0);
};

/** The album picture's file name, picked as the window will be told. */
const coverNameIn = async (
  folder: string,
  names: readonly string[],
): Promise<string | undefined> =>
  pickFolderCover(await picturesIn(folder, names), path.basename(folder));

export const readFolderFacts = async (
  folder: string,
): Promise<ITagFolderFacts> => {
  const names = await filesIn(folder);
  const facts: ITagFolderFacts = { folder };
  const cueName = pickCueFile(names);
  if (cueName !== undefined) {
    const file = path.join(folder, cueName);
    if ((await sizeWithin(file, MAX_CUE_BYTES)) !== undefined) {
      try {
        facts.cue = parseCueSheet(
          decodeCueText(new Uint8Array(await fs.promises.readFile(file))),
        );
      } catch (error) {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the album is proposed without its sheet
        console.error(`Could not read the CUE sheet ${file}`, error);
      }
    }
  }
  const coverName = await coverNameIn(folder, names);
  if (coverName !== undefined) {
    const bytes = await sizeWithin(
      path.join(folder, coverName),
      MAX_COVER_BYTES,
    );
    if (bytes !== undefined) {
      facts.cover = { fileName: coverName, bytes };
    }
  }
  return facts;
};

/** The folder picture's bytes, found again here rather than named by the
 * window: the window only ever names a song. */
export const readFolderCover = async (
  folder: string,
): Promise<TTagCoverPick> => {
  const coverName = await coverNameIn(folder, await filesIn(folder));
  if (coverName === undefined) {
    return { state: 'refused' };
  }
  const file = path.join(folder, coverName);
  if ((await sizeWithin(file, MAX_COVER_BYTES)) === undefined) {
    return { state: 'refused' };
  }
  try {
    return {
      state: 'ok',
      bytes: new Uint8Array(await fs.promises.readFile(file)),
    };
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; the cover line says it could not be read
    console.error(`Could not read the album picture ${file}`, error);
    return { state: 'refused' };
  }
};
