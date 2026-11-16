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
 * One edit applied to an open file, before it is saved.
 *
 * The file keeps the tags it had, in the version it had them, unless the
 * edit asks otherwise: node-taglib-sharp will happily add an ID3v1 to every
 * MP3 and a DivX and MovieID tag to every WAV it saves (measured on 6.0.3),
 * and a tag editor that changes what a file carries when asked to change a
 * title is the kind that breaks somebody's car stereo.
 */

import {
  ByteVector,
  File,
  Id3v2Tag,
  Picture,
  PictureType,
  TagTypes,
} from 'node-taglib-sharp';
import type {
  ITagExtraField,
  TTagCoverMime,
  TTagFields,
  TTagFieldKey,
  TTagFormat,
} from '../../common/library/tagFields';
import { readTagFields, writeTagField } from './tagFieldAccess';
import { FAMILY_BY_FORMAT, keepsId3v1, writeExtra } from './tagFormats';
import { coverPictureOf } from './tagRead';

/** A picture to write, already checked to be the JPEG or PNG it says. */
export interface IResolvedCover {
  bytes: Uint8Array;
  mime: TTagCoverMime;
}

/** An edit main has validated against the song it names. */
export interface IValidatedEdit {
  fields: TTagFields;
  extras: ITagExtraField[];
  /** `null` removes the cover; absent leaves it. */
  cover?: IResolvedCover | null;
  id3v2Version?: 3 | 4;
  keepId3v1?: boolean;
}

/* eslint-disable no-bitwise -- tag types are a flag set */
const hasType = (types: TagTypes, type: TagTypes): boolean =>
  (types & type) !== 0;
/* eslint-enable no-bitwise */

/**
 * Writes every field the file already has into the tags just created, so a
 * new ID3v1 or RIFF INFO starts as a copy of the rest rather than empty.
 */
const fillNewTags = (file: File, before: TTagFields): void => {
  (Object.keys(before) as TTagFieldKey[]).forEach((key) => {
    const value = before[key];
    if (value !== undefined) {
      writeTagField(file.tag, key, value);
    }
  });
};

const replaceCover = (
  file: File,
  cover: IResolvedCover | null,
  description: string,
): void => {
  const pictures = file.tag.pictures ?? [];
  const current = coverPictureOf(pictures);
  const others = pictures.filter((picture) => picture !== current);
  if (cover === null) {
    file.tag.pictures = others;
    return;
  }
  const picture = Picture.fromFullData(
    ByteVector.fromByteArray(cover.bytes),
    PictureType.FrontCover,
    cover.mime,
    description,
  );
  file.tag.pictures = [picture, ...others];
};

export const applyTagEdit = (
  file: File,
  format: TTagFormat,
  edit: IValidatedEdit,
): void => {
  const onDisk = file.tagTypesOnDisk;
  const family = FAMILY_BY_FORMAT[format];
  const before = readTagFields(file.tag);
  let created = false;

  if (family === 'id3') {
    const hadId3v2 = hasType(onDisk, TagTypes.Id3v2);
    const id3 = file.getTag(TagTypes.Id3v2, true);
    if (id3 instanceof Id3v2Tag) {
      if (edit.id3v2Version !== undefined) {
        id3.version = edit.id3v2Version;
      } else if (!hadId3v2) {
        id3.version = 3;
      }
    }
    created = created || !hadId3v2;
    // A WAV keeps the ID3 chunk and RIFF INFO in step: Explorer reads INFO,
    // nearly everything else the ID3 chunk.
    if (format === 'wav') {
      created = created || !hasType(onDisk, TagTypes.RiffInfo);
      file.getTag(TagTypes.RiffInfo, true);
    }
  } else if (family === 'xiph') {
    file.getTag(TagTypes.Xiph, true);
  } else if (family === 'apple') {
    file.getTag(TagTypes.Apple, true);
  } else {
    file.getTag(TagTypes.Asf, true);
  }

  // The choice is offered on an MP3 or AAC; anywhere else an ID3v1 a file
  // already carries (a FLAC from an old ripper) is kept, and none is added.
  const hadId3v1 = hasType(onDisk, TagTypes.Id3v1);
  const wantsId3v1 = keepsId3v1(format)
    ? (edit.keepId3v1 ?? hadId3v1)
    : hadId3v1;
  if (wantsId3v1) {
    created = created || !hadId3v1;
    file.getTag(TagTypes.Id3v1, true);
  }
  if (created) {
    fillNewTags(file, before);
  }

  (Object.keys(edit.fields) as TTagFieldKey[]).forEach((key) => {
    const value = edit.fields[key];
    if (value !== undefined) {
      writeTagField(file.tag, key, value);
    }
  });
  edit.extras.forEach((extra) => writeExtra(file, extra.code, extra.value));
  if (edit.cover !== undefined) {
    // An ASF picture with an empty description is written and then not read
    // back by node-taglib-sharp (measured on 6.0.3).
    replaceCover(file, edit.cover, family === 'asf' ? 'Front cover' : '');
  }

  // What the save must not bring along: an ID3v1 nobody asked for, an APE
  // tag the file did not have, and the AVI tags node-taglib-sharp creates
  // on every RIFF file it saves.
  if (!wantsId3v1) {
    file.removeTags(TagTypes.Id3v1);
  }
  if (!hasType(onDisk, TagTypes.Ape)) {
    file.removeTags(TagTypes.Ape);
  }
  if (!hasType(onDisk, TagTypes.MovieId)) {
    file.removeTags(TagTypes.MovieId);
  }
  if (!hasType(onDisk, TagTypes.DivX)) {
    file.removeTags(TagTypes.DivX);
  }
};
