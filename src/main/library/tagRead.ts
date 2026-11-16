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

/**
 * One song's tags as the editor shows them, read from its file.
 *
 * Read through node-taglib-sharp, the library that writes them, rather than
 * the scan's music-metadata: the panel must show exactly what a save would
 * start from, including the ID3 version and the fields only a writer keeps.
 */

import fs from 'fs';
import path from 'path';
import {
  File,
  Id3v2Tag,
  type IPicture,
  PictureType,
  TagTypes,
} from 'node-taglib-sharp';
import type {
  ITagCoverFacts,
  TTagReadResult,
} from '../../common/library/tagFields';
import { readImageFacts } from '../../common/library/tagImage';
import { readTagFields } from './tagFieldAccess';
import {
  FAMILY_BY_FORMAT,
  FIELD_CODES,
  canChooseId3v2Version,
  openTagFile,
  readExtras,
  tagFormatOfPath,
  tagNamesOnDisk,
} from './tagFormats';

/** The picture the Library shows as the cover: the front one, else the
 * first, as `common.picture[0]` is for the scan. */
export const coverPictureOf = (
  pictures: readonly IPicture[],
): IPicture | undefined =>
  pictures.find((picture) => picture.type === PictureType.FrontCover) ??
  pictures[0];

const coverFacts = (file: File): ITagCoverFacts | undefined => {
  const picture = coverPictureOf(file.tag.pictures ?? []);
  if (picture === undefined) {
    return undefined;
  }
  const bytes = picture.data.toByteArray();
  const facts = readImageFacts(bytes);
  return {
    mime: facts?.mime ?? picture.mimeType,
    width: facts?.width,
    height: facts?.height,
    bytes: bytes.length,
  };
};

/**
 * Whether the read-only attribute is set: Node reports a read-only file on
 * Windows as a mode without the owner's write bit.
 */
export const isReadOnlyFile = (filePath: string): boolean => {
  try {
    // eslint-disable-next-line no-bitwise -- the owner-write bit of the mode
    return (fs.statSync(filePath).mode & 0o200) === 0;
  } catch {
    return false;
  }
};

export const readTrackTagSheet = (
  trackId: string,
  filePath: string,
): TTagReadResult => {
  const format = tagFormatOfPath(filePath);
  if (format === undefined) {
    return { state: 'unsupported' };
  }
  if (!fs.existsSync(filePath)) {
    return { state: 'missing' };
  }
  let file: File | undefined;
  try {
    file = openTagFile(filePath, format);
    const family = FAMILY_BY_FORMAT[format];
    const id3 = file.getTag(TagTypes.Id3v2, false);
    const tagsInFile = tagNamesOnDisk(file);
    const versionOnDisk =
      id3 instanceof Id3v2Tag && tagsInFile.some((n) => n.startsWith('ID3v2'))
        ? id3.version
        : undefined;
    const canChoose = canChooseId3v2Version(format);
    // A file with no ID3v2 yet gets v2.3: what Windows Explorer, car
    // stereos and older players read best.
    const chosenVersion: 3 | 4 = versionOnDisk === 4 ? 4 : 3;
    const id3v2Version = canChoose ? chosenVersion : undefined;
    // v2.3 keeps the year in TYER; TDRC is v2.4's.
    const codes =
      id3v2Version === 3
        ? { ...FIELD_CODES[family], year: 'TYER' }
        : FIELD_CODES[family];
    return {
      state: 'ok',
      sheet: {
        trackId,
        fileName: path.basename(filePath),
        folder: path.dirname(filePath),
        format,
        tagsInFile,
        id3v2Version,
        canChooseId3v2Version: canChoose,
        hasId3v1: tagsInFile.includes('ID3v1'),
        fields: readTagFields(file.tag),
        codes,
        extras: readExtras(file, family),
        canAddExtras: true,
        cover: coverFacts(file),
        isReadOnly: isReadOnlyFile(filePath),
      },
    };
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before the panel says the tags could not be read
    console.error(`Could not read the tags of ${filePath}`, error);
    return { state: 'failed' };
  } finally {
    file?.dispose();
  }
};
