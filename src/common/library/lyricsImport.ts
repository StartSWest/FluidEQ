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
 * Lyrics a listener brings in themselves — a `.lrc` or `.txt` they
 * downloaded, dropped, or words they pasted — checked before anything is
 * written, the same way in the window and in main.
 *
 * Main checks again whatever the window sends (`libraryLyricsImport.ts`):
 * the window's check is only so a refusal is said at once.
 */

import { lyricsFromText, MAX_LYRICS_FILE_BYTES } from './lyrics';

/** The extensions a lyrics file is imported from, and written as. */
export const LYRICS_FILE_EXTENSIONS = ['.lrc', '.txt'] as const;
export type TLyricsFileExtension = (typeof LYRICS_FILE_EXTENSIONS)[number];

export type TLyricsImportRefusal = 'empty' | 'tooBig' | 'notText';

export type TLyricsImportCheck =
  | { ok: true; text: string; extension: TLyricsFileExtension }
  | { ok: false; reason: TLyricsImportRefusal };

/** Where imported lyrics were kept. */
export type TLyricsPlace = 'beside' | 'store';

export type TLyricsImportResult =
  | { state: 'saved'; place: TLyricsPlace; fileName: string }
  /** A lyrics file of that name is already there: nothing was written, and
   * the window asks before it is replaced. */
  | { state: 'exists'; place: TLyricsPlace; fileName: string }
  | { state: 'refused'; reason: TLyricsImportRefusal }
  /** Neither the song's folder nor FluidEQ's own could be written. */
  | { state: 'failed' };

export type TLyricsPickResult =
  | { state: 'picked'; text: string }
  | { state: 'canceled' }
  | { state: 'refused'; reason: TLyricsImportRefusal };

/** A name that is a lyrics file by its extension, any case. */
export const isLyricsFileName = (name: string): boolean => {
  const lower = name.toLowerCase();
  return LYRICS_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension));
};

/**
 * A lyrics file's bytes as text: UTF-16 where its byte-order mark says so
 * (Notepad's "Unicode"), UTF-8 where it is valid UTF-8, and otherwise the
 * Windows code page an older editor saved it in — the reader beside the song
 * makes the same last guess (`libraryLyrics.ts`).
 */
export const decodeLyricsBytes = (bytes: Uint8Array): string => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  try {
    // The decoder drops a UTF-8 byte-order mark itself.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
};

/**
 * Control characters that never belong in text, a NUL first among them.
 * Tab, line feed, form feed and carriage return are text.
 */
// eslint-disable-next-line no-control-regex -- control characters are exactly what is being counted
const NOT_TEXT = /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/g;

/** A NUL anywhere, or more than one character in a hundred that is a
 * control character: a binary renamed, or a UTF-16 file with no mark.
 * A real lyrics file can carry a stray one an editor left. */
const looksBinary = (text: string): boolean => {
  if (text.includes('\u0000')) {
    return true;
  }
  const controls = text.match(NOT_TEXT)?.length ?? 0;
  return controls > Math.max(2, text.length / 100);
};

/**
 * Lyrics as they will be written: no byte-order mark, every line ended with
 * a line feed, trailing blank lines gone, one line feed at the end. The words
 * and stamps are the listener's own and are not otherwise touched.
 */
const normalise = (text: string): string =>
  `${text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n|\r/g, '\n')
    .replace(/\s+$/, '')}\n`;

/**
 * Whether these words can be imported, and as what: a `.lrc` where the text
 * carries timing the Lyrics tab can follow, a `.txt` otherwise — decided by
 * the very reader that will read the file back (`lyricsFromText`), so what
 * is written is always what the tab then shows.
 */
export const checkLyricsImport = (text: string): TLyricsImportCheck => {
  if (new TextEncoder().encode(text).length > MAX_LYRICS_FILE_BYTES) {
    return { ok: false, reason: 'tooBig' };
  }
  if (looksBinary(text)) {
    return { ok: false, reason: 'notText' };
  }
  const normalised = normalise(text);
  const lyrics = lyricsFromText(normalised, 'txt');
  if (lyrics === undefined) {
    return { ok: false, reason: 'empty' };
  }
  return {
    ok: true,
    text: normalised,
    extension: lyrics.kind === 'synced' ? '.lrc' : '.txt',
  };
};

/**
 * A lyrics file FluidEQ may remove: the song's own `.lrc` or `.txt` beside
 * it, or FluidEQ's copy in its lyrics folder. Named by place and extension,
 * never by path — main builds the path from the song's id, so nothing else
 * can be named. Lyrics in the song's own tags are never removed: FluidEQ
 * does not rewrite a listener's audio files.
 */
export interface ILyricsRemoveTarget {
  place: TLyricsPlace;
  extension: TLyricsFileExtension;
}

export type TLyricsRemoveResult =
  | { state: 'removed' }
  /** Nothing is there any more: gone already, which is what was asked. */
  | { state: 'missing' }
  /** Something other than a plain file is there — a link, a folder. */
  | { state: 'refused' }
  | { state: 'failed' };

/** The window's request as main receives it: anything, until checked. */
export const asLyricsRemoveTarget = (
  value: unknown,
): ILyricsRemoveTarget | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { place, extension } = value as Record<string, unknown>;
  if (place !== 'beside' && place !== 'store') {
    return undefined;
  }
  const known = LYRICS_FILE_EXTENSIONS.find((ext) => ext === extension);
  return known === undefined ? undefined : { place, extension: known };
};
