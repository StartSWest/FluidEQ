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
 * A tag write as the window asked for it, checked field by field before a
 * single file is touched.
 *
 * The window names songs by id and nothing else: each id must be a song the
 * Library knows, an audio file in a format this editor writes. Every field
 * must be one of the editor's names with a value it may hold, every raw
 * code one the song's format can keep as text, and every picture a JPEG or
 * PNG that is what it says it is. Anything else drops the whole request:
 * a half-honoured write is worse than none.
 */

import path from 'path';
import { cleanFileName } from '../../common/library/fileNamePattern';
import {
  cleanTagValue,
  isTagFieldKey,
  type ITagExtraField,
  MAX_COVER_BYTES,
  type TTagCoverMime,
  type TTagFields,
  type TTagFormat,
} from '../../common/library/tagFields';
import { readImageFacts } from '../../common/library/tagImage';
import type { ILibraryTrack } from '../../common/library/types';
import type { IResolvedCover, IValidatedEdit } from './tagApply';
import {
  FAMILY_BY_FORMAT,
  isWritableExtraCode,
  tagFormatOfPath,
} from './tagFormats';

/** The most songs one write may name: a large folder, not a library. */
export const MAX_WRITE_ITEMS = 5000;

const MAX_COVERS = 64;

export interface IGuardedItem {
  track: ILibraryTrack;
  format: TTagFormat;
  edit: IValidatedEdit;
  /** The file's new name without its extension; absent keeps it. */
  fileName?: string;
}

export interface IGuardedRequest {
  items: IGuardedItem[];
  heldTrackIds: Set<string>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const guardCovers = (raw: unknown): Map<string, IResolvedCover> | undefined => {
  const covers = new Map<string, IResolvedCover>();
  if (raw === undefined) {
    return covers;
  }
  if (!isRecord(raw) || Object.keys(raw).length > MAX_COVERS) {
    return undefined;
  }
  const entries = Object.entries(raw);
  for (let index = 0; index < entries.length; index += 1) {
    const [id, value] = entries[index];
    if (!isRecord(value) || !(value.bytes instanceof Uint8Array)) {
      return undefined;
    }
    const { bytes } = value;
    const facts = readImageFacts(bytes);
    if (
      id.length === 0 ||
      id.length > 64 ||
      bytes.length > MAX_COVER_BYTES ||
      facts === undefined ||
      facts.mime !== value.mime
    ) {
      return undefined;
    }
    covers.set(id, { bytes, mime: facts.mime as TTagCoverMime });
  }
  return covers;
};

const guardFields = (raw: unknown): TTagFields | undefined => {
  if (raw === undefined) {
    return {};
  }
  if (!isRecord(raw)) {
    return undefined;
  }
  const fields: TTagFields = {};
  const keys = Object.keys(raw);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const value = raw[key];
    if (!isTagFieldKey(key) || typeof value !== 'string') {
      return undefined;
    }
    const cleaned = cleanTagValue(key, value);
    if (cleaned === undefined) {
      return undefined;
    }
    fields[key] = cleaned;
  }
  return fields;
};

const guardExtras = (
  raw: unknown,
  format: TTagFormat,
): ITagExtraField[] | undefined => {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw) || raw.length > 200) {
    return undefined;
  }
  const family = FAMILY_BY_FORMAT[format];
  const extras: ITagExtraField[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const extra: unknown = raw[index];
    if (
      !isRecord(extra) ||
      typeof extra.code !== 'string' ||
      typeof extra.value !== 'string' ||
      !isWritableExtraCode(family, extra.code)
    ) {
      return undefined;
    }
    // A raw field is text like a comment: line breaks kept, nothing else.
    const value = cleanTagValue('comment', extra.value);
    if (value === undefined) {
      return undefined;
    }
    extras.push({ code: extra.code, value });
  }
  return extras;
};

/**
 * The request, every song resolved through `trackOf`, or `undefined` when
 * any part of it is not something this editor writes.
 */
export const guardTagWriteRequest = (
  raw: unknown,
  trackOf: (trackId: string) => ILibraryTrack | undefined,
): IGuardedRequest | undefined => {
  if (!isRecord(raw) || !Array.isArray(raw.edits)) {
    return undefined;
  }
  const { edits } = raw;
  if (edits.length === 0 || edits.length > MAX_WRITE_ITEMS) {
    return undefined;
  }
  const covers = guardCovers(raw.covers);
  if (covers === undefined) {
    return undefined;
  }
  const items: IGuardedItem[] = [];
  const seen = new Set<string>();
  /** New names by folder, without case: two songs given one name would
   * have the second refused only once the first was renamed. */
  const named = new Set<string>();
  for (let index = 0; index < edits.length; index += 1) {
    const edit: unknown = edits[index];
    if (!isRecord(edit) || typeof edit.trackId !== 'string') {
      return undefined;
    }
    const track =
      edit.trackId.length <= 512 ? trackOf(edit.trackId) : undefined;
    const format = track ? tagFormatOfPath(track.path) : undefined;
    if (
      track === undefined ||
      track.kind !== 'audio' ||
      format === undefined ||
      seen.has(track.id)
    ) {
      return undefined;
    }
    seen.add(track.id);
    const fields = guardFields(edit.fields);
    const extras = guardExtras(edit.extras, format);
    if (fields === undefined || extras === undefined) {
      return undefined;
    }
    let cover: IResolvedCover | null | undefined;
    if (edit.coverId !== undefined) {
      if (typeof edit.coverId !== 'string') {
        return undefined;
      }
      cover = edit.coverId === '' ? null : covers.get(edit.coverId);
      if (cover === undefined) {
        return undefined;
      }
    }
    const { id3v2Version, keepId3v1 } = edit;
    if (
      (id3v2Version !== undefined &&
        id3v2Version !== 3 &&
        id3v2Version !== 4) ||
      (keepId3v1 !== undefined && typeof keepId3v1 !== 'boolean')
    ) {
      return undefined;
    }
    const { fileName } = edit;
    if (fileName !== undefined) {
      const target =
        typeof fileName === 'string'
          ? path
              .join(
                path.dirname(track.path),
                `${fileName}${path.extname(track.path)}`,
              )
              .toLowerCase()
          : undefined;
      // The name exactly as the window previewed it, or nothing at all.
      if (
        typeof fileName !== 'string' ||
        cleanFileName(fileName) !== fileName ||
        target === undefined ||
        named.has(target)
      ) {
        return undefined;
      }
      named.add(target);
    }
    items.push({
      track,
      format,
      ...(fileName === undefined ? {} : { fileName }),
      edit: {
        fields,
        extras,
        cover,
        id3v2Version:
          FAMILY_BY_FORMAT[format] === 'id3' ? id3v2Version : undefined,
        keepId3v1,
      },
    });
  }
  const heldTrackIds = new Set<string>(
    Array.isArray(raw.heldTrackIds)
      ? raw.heldTrackIds.filter(
          (id): id is string => typeof id === 'string' && seen.has(id),
        )
      : [],
  );
  return { items, heldTrackIds };
};
