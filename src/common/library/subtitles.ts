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
 * A video's subtitles, for the Library's Subtitles tab (Ivan, 2026-11-15:
 * "they can also have movies and subtitles can get loaded in
 * lyrics/subtitles"): the SubRip and WebVTT files beside a video under its
 * own name, as every player names them — `Movie.srt`, `Movie.vtt`, and with
 * a language and its qualifiers between the name and the extension,
 * `Movie.en.srt`, `Movie.pt-BR.vtt`, `Movie.en.forced.srt`.
 *
 * They are read as the timed lines the Lyrics tab already draws, so a line
 * lights as it is spoken and a press plays from it, exactly as a song's.
 * Subtitle files are never library tracks (`libraryFileKind` knows neither
 * extension), so nothing here can hide a video or add a row.
 */

import { type ILyricsLine } from './lyrics';
import { libraryLinesOf } from './lyricsFormats';
import { parseSrt, parseVtt } from './lyricsMarkup';

export const SUBTITLE_EXTENSIONS = ['srt', 'vtt'] as const;

/**
 * A film's dialogue runs to well over a song's line cap
 * (`MAX_LYRICS_LINES`, 2000): a three-hour film with the hard-of-hearing
 * captions carries about 3000 cues. Past this a file is cut, not refused.
 */
export const MAX_SUBTITLE_LINES = 6000;

/** That many cues in SubRip are about 450 KB; a WebVTT file with styling and
 * positions on every cue is two to three times its SubRip. */
export const MAX_SUBTITLE_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Words players write after the language that say what kind of track it is,
 * never which language. `sdh` is also the ISO 639-3 code for Southern
 * Kurdish, and `Movie.sdh.srt` means the hard-of-hearing track far more often.
 */
const QUALIFIERS = new Set([
  'cc',
  'default',
  'forced',
  'full',
  'hi',
  'sdh',
  'signs',
]);

export interface ISubtitleFile {
  fileName: string;
  /** What stands between the video's name and the extension — `en`,
   * `pt-BR`, `en.forced` — or nothing for a file of the video's own name. */
  tag?: string;
}

export interface ILibrarySubtitlesAnswer {
  /** Every subtitle file beside the video, the one of its own name first
   * and the rest in name order. */
  files: ISubtitleFile[];
  /** The one read, by the window's pick or `pickSubtitle`. Its lines are
   * empty where the file held no cue that could be read. */
  shown?: { fileName: string; lines: ILyricsLine[] };
  /** The names looked for, by name only, for the empty state. */
  looked: string[];
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

const stemOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? name : name.slice(0, dot);
};

/**
 * The file of the video's own name first, then the rest by name without
 * case, compared by code unit: the same order in main and in the window,
 * whatever locale either runs in.
 */
const subtitleOrder = (a: ISubtitleFile, b: ISubtitleFile): number => {
  if ((a.tag === undefined) !== (b.tag === undefined)) {
    return a.tag === undefined ? -1 : 1;
  }
  const left = a.fileName.toLowerCase();
  const right = b.fileName.toLowerCase();
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
};

/**
 * The subtitle files among a video's siblings: a `.srt` or `.vtt` whose name
 * is the video's own, or the video's own followed by a dot and a tag. Names
 * are compared without case, as Windows and macOS compare them; a file named
 * `Movie 2.srt` beside `Movie.mp4` belongs to another video.
 */
export const subtitleFilesOf = (
  videoFileName: string,
  siblings: readonly string[],
): ISubtitleFile[] => {
  const stem = stemOf(videoFileName).toLowerCase();
  return siblings
    .filter((sibling) =>
      (SUBTITLE_EXTENSIONS as readonly string[]).includes(extensionOf(sibling)),
    )
    .flatMap((sibling): ISubtitleFile[] => {
      const own = stemOf(sibling);
      const lower = own.toLowerCase();
      if (lower === stem) {
        return [{ fileName: sibling }];
      }
      if (!lower.startsWith(`${stem}.`)) {
        return [];
      }
      const tag = own.slice(stem.length + 1);
      return tag === '' ? [] : [{ fileName: sibling, tag }];
    })
    .sort(subtitleOrder);
};

/** The names an empty tab says were looked for: the video's own name with
 * each extension. */
export const lookedSubtitleNames = (videoFileName: string): string[] =>
  SUBTITLE_EXTENSIONS.map(
    (extension) => `${stemOf(videoFileName)}.${extension}`,
  );

/** One English name table is enough to tell a language from a word: a code
 * Intl has no name for is not a language anybody tags a file with. */
const namer = new Intl.DisplayNames(['en'], {
  type: 'language',
  fallback: 'none',
});

/**
 * The language a tag opens with, canonical (`eng` → `en`, `pt-br` →
 * `pt-BR`), or nothing where its first part is a qualifier, a word
 * (`English`) or no language at all.
 */
export const subtitleLanguage = (
  tag: string | undefined,
): string | undefined => {
  const first = tag?.split('.')[0];
  if (first === undefined || QUALIFIERS.has(first.toLowerCase())) {
    return undefined;
  }
  try {
    const [canonical] = Intl.getCanonicalLocales(first);
    return canonical !== undefined && namer.of(canonical) !== undefined
      ? canonical
      : undefined;
  } catch {
    // Not a language tag at all (`x`, `1080p`): this file names none.
    return undefined;
  }
};

/** The parts of a tag after its language: `forced`, `sdh`. */
export const subtitleQualifiers = (tag: string | undefined): string[] => {
  const parts = tag?.split('.') ?? [];
  return subtitleLanguage(tag) === undefined ? parts : parts.slice(1);
};

const baseOf = (language: string): string =>
  language.split('-')[0].toLowerCase();

/**
 * The file to show first. Each preferred language in turn — the one the
 * listener last picked, then the app's — exactly, then by its base language
 * (`pt` takes `pt-BR`), a full track before a forced or captioned one,
 * because forced subtitles carry only the lines in a foreign language. Then
 * the file of the video's own name, then the first by name.
 */
export const pickSubtitle = (
  files: readonly ISubtitleFile[],
  preferred: readonly string[],
): ISubtitleFile | undefined => {
  const plainFirst = [...files].sort(
    (a, b) =>
      subtitleQualifiers(a.tag).length - subtitleQualifiers(b.tag).length,
  );
  const wanted = preferred.flatMap((entry) => {
    const language = subtitleLanguage(entry);
    return language === undefined ? [] : [language];
  });
  const found = wanted
    .map(
      (language) =>
        plainFirst.find((file) => subtitleLanguage(file.tag) === language) ??
        plainFirst.find((file) => {
          const own = subtitleLanguage(file.tag);
          return own !== undefined && baseOf(own) === baseOf(language);
        }),
    )
    .find((file) => file !== undefined);
  return found ?? files.find((file) => file.tag === undefined) ?? files[0];
};

/**
 * A subtitle file's text as timed lines, read by its extension rather than
 * by sniffing: a SubRip file with no cue numbers, or a WebVTT one missing
 * its header, still has its timing rows, and those are what is read.
 */
export const subtitleLines = (text: string, fileName: string): ILyricsLine[] =>
  libraryLinesOf(
    extensionOf(fileName) === 'vtt' ? parseVtt(text) : parseSrt(text),
    MAX_SUBTITLE_LINES,
  );
