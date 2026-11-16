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
 * The Library tag editor's fields, the same names in every format.
 *
 * The window edits these names and nothing else; main maps each to the
 * frame, comment or atom the file's own format keeps it in
 * (`main/library/tagFormats.ts`). Values cross the wire as text: a number
 * field is its digits, a switch is `'1'` or `''`, and `''` everywhere means
 * "this file has none" — removed on write.
 */

import type { ICueSheet } from './cueSheet';

/** What the panel shows first: the song, the album, the details. */
export const TAG_COMMON_FIELDS = [
  'title',
  'artist',
  'composer',
  'album',
  'albumArtist',
  'trackNo',
  'trackTotal',
  'discNo',
  'discTotal',
  'year',
  'genre',
  'bpm',
  'comment',
] as const;

/** "More fields": every format has a place for each of these. */
export const TAG_MORE_FIELDS = [
  'grouping',
  'publisher',
  'copyright',
  'isrc',
  'conductor',
  'subtitle',
  'remixer',
  'initialKey',
  'compilation',
  'titleSort',
  'artistSort',
  'albumSort',
  'albumArtistSort',
  'composerSort',
  'musicBrainzTrackId',
  'musicBrainzReleaseId',
  'musicBrainzArtistId',
  'musicBrainzReleaseArtistId',
  'musicBrainzReleaseGroupId',
] as const;

export const TAG_FIELDS = [...TAG_COMMON_FIELDS, ...TAG_MORE_FIELDS] as const;

export type TTagFieldKey = (typeof TAG_FIELDS)[number];

export type TTagFields = Partial<Record<TTagFieldKey, string>>;

/** Fields whose text is digits, and the largest value each may hold. */
export const TAG_NUMBER_LIMITS: Partial<Record<TTagFieldKey, number>> = {
  trackNo: 9999,
  trackTotal: 9999,
  discNo: 999,
  discTotal: 999,
  year: 9999,
  bpm: 999,
};

/** A switch: on is `'1'`, off is `''`. */
export const TAG_FLAG_FIELDS: readonly TTagFieldKey[] = ['compilation'];

/** Longest text a field may hold. A comment is a paragraph; a name is not. */
export const TAG_TEXT_LIMIT = 1024;

export const TAG_LONG_TEXT_LIMIT = 8192;

export const TAG_LONG_TEXT_FIELDS: readonly TTagFieldKey[] = ['comment'];

export const isTagFieldKey = (value: unknown): value is TTagFieldKey =>
  typeof value === 'string' &&
  (TAG_FIELDS as readonly string[]).includes(value);

/**
 * The value a field may carry, cleaned, or `undefined` when it may not.
 *
 * Shared by the window, which marks a field it would refuse, and main, which
 * refuses it: a number field takes digits only (spaces trimmed, leading zeros
 * kept out of the count), a switch `'1'` or `''`, and text anything printable
 * up to its limit, with control characters other than a comment's line breaks
 * taken out — a NUL in a title is how two albums once merged
 * (`libraryMetadata.ts`).
 */
export const cleanTagValue = (
  key: TTagFieldKey,
  raw: string,
): string | undefined => {
  const limit = TAG_NUMBER_LIMITS[key];
  if (limit !== undefined) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      return '';
    }
    if (!/^\d{1,5}$/.test(trimmed)) {
      return undefined;
    }
    const value = Number(trimmed);
    return value <= limit ? String(value) : undefined;
  }
  if (TAG_FLAG_FIELDS.includes(key)) {
    return raw === '1' || raw === '' ? raw : undefined;
  }
  const isLong = TAG_LONG_TEXT_FIELDS.includes(key);
  const isKept = (character: string): boolean => {
    const code = character.charCodeAt(0);
    if (code >= 0x20 && code !== 0x7f) {
      return true;
    }
    return isLong && (code === 0x0a || code === 0x0d);
  };
  const cleaned = Array.from(raw).filter(isKept).join('');
  if (cleaned.length > (isLong ? TAG_LONG_TEXT_LIMIT : TAG_TEXT_LIMIT)) {
    return undefined;
  }
  return cleaned;
};

/**
 * A field the file keeps that has no name of its own here: a TXXX or TLAN
 * frame, a LABEL comment, a WM/ attribute. Shown by its code under More
 * fields, and editable when it holds text.
 */
export interface ITagExtraField {
  /** The format's own name: `TLAN`, `TXXX:CATALOGNUMBER`, `LABEL`. */
  code: string;
  value: string;
}

export const MAX_EXTRA_CODE = 96;

/** How the file stores its tags, named as the panel shows them. */
export type TTagFormat =
  'mp3' | 'aac' | 'flac' | 'ogg' | 'opus' | 'm4a' | 'wav' | 'aiff' | 'wma';

/** The embedded cover the file carries, described; the picture itself is
 * the Library's own thumbnail. */
export interface ITagCoverFacts {
  mime: string;
  width?: number;
  height?: number;
  bytes: number;
}

/** One song's tags as the editor shows them, read from its file in main. */
export interface ITrackTagSheet {
  trackId: string;
  fileName: string;
  /** The folder the file sits in, for the panel's path line. */
  folder: string;
  format: TTagFormat;
  /** What the file carries now: "ID3v2.3", "ID3v1", "APEv2", "Vorbis
   * comments", "iTunes atoms", "RIFF INFO", "ASF". Empty for no tags. */
  tagsInFile: string[];
  /** The ID3v2 version written for this file when it keeps one: the
   * file's own, or 3 for a file that has none yet. */
  id3v2Version?: 3 | 4;
  /** True for the formats whose ID3v2 version can be chosen. */
  canChooseId3v2Version: boolean;
  /** True when the file has an ID3v1 tag at its end. */
  hasId3v1: boolean;
  fields: TTagFields;
  /** Each field's code in this file's format, for More fields. */
  codes: Partial<Record<TTagFieldKey, string>>;
  extras: ITagExtraField[];
  /** True when More fields may add any code the format allows. */
  canAddExtras: boolean;
  cover?: ITagCoverFacts;
  /** The file's read-only attribute is set. */
  isReadOnly: boolean;
}

export type TTagReadResult =
  | { state: 'ok'; sheet: ITrackTagSheet }
  /** Not a song the Library knows, or no longer on disk. */
  | { state: 'missing' }
  /** A video, or a container this editor does not write. */
  | { state: 'unsupported' }
  | { state: 'failed' };

/** The largest cover the editor writes into a file. */
export const MAX_COVER_BYTES = 20 * 1024 * 1024;

export type TTagCoverMime = 'image/jpeg' | 'image/png';

/** What an album's folder holds besides its songs, read by main for Fix
 * tags: its CUE sheet and its picture, where it has them. */
export interface ITagFolderFacts {
  /** The folder, spelled as `ITrackTagSheet.folder`. */
  folder: string;
  cue?: ICueSheet;
  /** The album picture's file name and size; its bytes come on their own. */
  cover?: { fileName: string; bytes: number };
}

/** A cover picked through the system's own file dialog, read by main. */
export type TTagCoverPick =
  | { state: 'ok'; bytes: Uint8Array }
  /** Empty, unreadable, or past `MAX_COVER_BYTES`. */
  | { state: 'refused' }
  | { state: 'canceled' };

/** A change to one song's tags. Only what changed is carried. */
export interface ITagEdit {
  trackId: string;
  fields?: TTagFields;
  /** Extras set by code; `''` removes one. */
  extras?: ITagExtraField[];
  /** A cover from the request's `covers`, by its id, or `''` to remove it. */
  coverId?: string;
  /** Absent keeps the file's own version. */
  id3v2Version?: 3 | 4;
  /** Absent keeps an ID3v1 tag where there is one and adds none. */
  keepId3v1?: boolean;
}

export interface ITagWriteRequest {
  edits: ITagEdit[];
  /** One copy of each picture, however many songs it goes to. */
  covers?: Record<string, { bytes: Uint8Array; mime: TTagCoverMime }>;
  /** Songs playing now: written the moment the window says they ended. */
  heldTrackIds?: string[];
}

export type TTagItemState =
  | 'queued'
  | 'writing'
  | 'written'
  /** Playing in FluidEQ; written when its song ends. */
  | 'held'
  /** Another program has it open. */
  | 'locked'
  | 'read-only'
  | 'missing'
  | 'failed'
  | 'skipped';

export interface ITagJobItem {
  trackId: string;
  fileName: string;
  state: TTagItemState;
}

export type TTagJobKind = 'write' | 'undo';

export interface ITagJobState {
  jobId: string;
  kind: TTagJobKind;
  items: ITagJobItem[];
  /** True once nothing is queued or writing; held, locked and read-only
   * items may still wait for an answer. */
  isSettled: boolean;
  isCancelled: boolean;
  /** True while Undo can put back what this job wrote. */
  canUndo: boolean;
}

export type TTagItemAnswer = 'retry' | 'skip' | 'make-writable';

/** Counts the window says at the foot: settled items by what became of them. */
export const countTagItems = (items: readonly ITagJobItem[]) => {
  const count = (state: TTagItemState) =>
    items.filter((item) => item.state === state).length;
  return {
    total: items.length,
    written: count('written'),
    waiting: count('queued') + count('writing'),
    held: count('held'),
    needYou: count('locked') + count('read-only'),
    failed: count('failed') + count('missing'),
    skipped: count('skipped'),
  };
};
