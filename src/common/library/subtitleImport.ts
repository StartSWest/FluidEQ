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
 * Subtitles a listener brings to a video — a `.srt` or `.vtt` downloaded
 * from a subtitle site, picked or dropped on the Subtitles tab — checked the
 * same way in the window and in main, and named for the place beside the
 * video where every player looks for them.
 *
 * KEPT AS THEY CAME. Unlike lyrics, which are rewritten as the song's
 * Enhanced LRC, a subtitle file stays SubRip or WebVTT: a video's player
 * reads those, and the cue ends, positions and styling a subtitle carries
 * would be lost in an LRC. Only the encoding and the line ends are made
 * plain (UTF-8, no byte-order mark, line feeds).
 *
 * NEVER OVER A FILE. A subtitle beside the video may be the one the
 * listener tuned; an import that would land on a name already taken takes
 * the next free one (`Movie.en.2.srt`) instead.
 */

import { looksBinary } from './lyricsImport';
import { isSrt, isVtt } from './lyricsMarkup';
import { parseSubtitleCues } from './subtitleCues';
import {
  MAX_SUBTITLE_FILE_BYTES,
  SUBTITLE_EXTENSIONS,
  subtitleLanguage,
} from './subtitles';

export type TSubtitleExtension = (typeof SUBTITLE_EXTENSIONS)[number];

export type TSubtitleImportRefusal =
  | 'empty'
  | 'tooBig'
  | 'notText'
  /** Not a SubRip or WebVTT file, by its name or its text. */
  | 'notSubtitles';

export type TSubtitleImportCheck =
  | { ok: true; text: string; extension: TSubtitleExtension }
  | { ok: false; reason: TSubtitleImportRefusal };

export type TSubtitleImportResult =
  | { state: 'saved'; fileName: string }
  | { state: 'canceled' }
  | { state: 'refused'; reason: TSubtitleImportRefusal }
  /** The video's folder could not be written. */
  | { state: 'failed' };

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

const stemOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? name : name.slice(0, dot);
};

const asSubtitleExtension = (
  extension: string,
): TSubtitleExtension | undefined =>
  SUBTITLE_EXTENSIONS.find((known) => known === extension);

/** A name that is a subtitle file by its extension, any case. */
export const isSubtitleFileName = (name: string): boolean =>
  asSubtitleExtension(extensionOf(name)) !== undefined;

/**
 * Whether this text can be kept as the video's subtitles, and as which
 * format: the source's own extension where it names one, its text's
 * signature otherwise (a paste, a file saved as `.txt`). Accepted only where
 * the very reader that will show it finds a cue with words in it.
 */
export const checkSubtitleImport = (
  text: string,
  sourceName: string,
): TSubtitleImportCheck => {
  if (new TextEncoder().encode(text).length > MAX_SUBTITLE_FILE_BYTES) {
    return { ok: false, reason: 'tooBig' };
  }
  if (looksBinary(text)) {
    return { ok: false, reason: 'notText' };
  }
  // A byte-order mark is dropped by its code: written as a character, an
  // editor's save turns it into an invisible one nobody can review.
  const unmarked = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const plain = `${unmarked.replace(/\r\n|\r/g, '\n').replace(/\s+$/, '')}\n`;
  let extension = asSubtitleExtension(extensionOf(sourceName));
  if (extension === undefined) {
    if (isVtt(plain)) {
      extension = 'vtt';
    } else if (isSrt(plain)) {
      extension = 'srt';
    } else {
      return { ok: false, reason: 'notSubtitles' };
    }
  }
  return parseSubtitleCues(plain).length > 0
    ? { ok: true, text: plain, extension }
    : { ok: false, reason: 'empty' };
};

/**
 * The language the source's own name ends on — `The.Film.2019.1080p.en.srt`
 * is English — which the kept file carries after the video's name, so the
 * tab's picker can name it. Nothing where the name says none.
 */
export const sourceSubtitleLanguage = (
  sourceName: string,
): string | undefined => {
  const parts = stemOf(sourceName).split('.');
  return parts.length > 1
    ? subtitleLanguage(parts[parts.length - 1])
    : undefined;
};

/**
 * Where an imported subtitle goes beside the video: the video's name, the
 * source's language where it has one, and its extension; where that name is
 * taken (`isTaken`, compared without case by the caller), the same with a
 * number after it. Nothing once a hundred are taken.
 */
export const subtitleDestinationName = (
  videoFileName: string,
  sourceName: string,
  extension: TSubtitleExtension,
  isTaken: (fileName: string) => boolean,
): string | undefined => {
  const language = sourceSubtitleLanguage(sourceName);
  const base =
    language === undefined
      ? stemOf(videoFileName)
      : `${stemOf(videoFileName)}.${language}`;
  const first = `${base}.${extension}`;
  if (!isTaken(first)) {
    return first;
  }
  for (let count = 2; count <= 100; count += 1) {
    const next = `${base}.${count}.${extension}`;
    if (!isTaken(next)) {
      return next;
    }
  }
  return undefined;
};
