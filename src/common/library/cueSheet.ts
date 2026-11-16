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
 * A CUE sheet: the one standard file an album folder carries that says, in
 * words, what the album is (Ivan, 2026-11-16, asked whether "some
 * international format" lets an album's own notes be read; a .nfo or a web
 * page has no format, a .cue does). Written by every CD ripper since EAC:
 *
 *   REM GENRE Rock
 *   REM DATE 2011
 *   PERFORMER "Avril Lavigne"
 *   TITLE "Goodbye Lullaby"
 *   FILE "01 - Black Star.flac" WAVE
 *     TRACK 01 AUDIO
 *       TITLE "Black Star"
 *       INDEX 01 00:00:00
 *
 * Only what names the album and its songs is read; times and indexes are
 * not, because FluidEQ does not split a single-file rip into its songs.
 */

export interface ICueTrack {
  number: number;
  title?: string;
  performer?: string;
  songwriter?: string;
  /** The FILE line this track was under, as written in the sheet. */
  file?: string;
}

export interface ICueSheet {
  title?: string;
  performer?: string;
  songwriter?: string;
  date?: string;
  genre?: string;
  tracks: ICueTrack[];
  /** Distinct FILE lines: one for a whole-album image, one per song else. */
  fileCount: number;
}

/** A sheet past this is no CUE sheet: a 99-track album is a few kilobytes. */
export const MAX_CUE_BYTES = 256 * 1024;

/**
 * The text of a sheet: UTF-8 where the bytes are valid UTF-8 (a BOM is
 * dropped), Windows-1252 otherwise — what EAC and foobar2000 wrote before
 * UTF-8, and what Spanish titles in an old rip are encoded in.
 */
export const decodeCueText = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(
      bytes,
    );
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
};

/** A line's value: the quoted string, or the rest of the line. */
const valueOf = (rest: string): string => {
  const quoted = /^"([^"]*)"/.exec(rest);
  return (quoted ? quoted[1] : rest).trim();
};

/** Every line read in turn; anything unknown is passed over. */
export const parseCueSheet = (text: string): ICueSheet => {
  const sheet: ICueSheet = { tracks: [], fileCount: 0 };
  let file: string | undefined;
  let track: ICueTrack | undefined;
  text.split(/\r\n|\r|\n/).forEach((raw) => {
    const line = raw.trim();
    const match = /^([A-Za-z]+)\s+(.*)$/.exec(line);
    if (match === null) {
      return;
    }
    const command = match[1].toUpperCase();
    const rest = match[2];
    if (command === 'FILE') {
      // `FILE "name" WAVE`: the name, without the type after it.
      file = valueOf(rest.replace(/\s+[A-Z0-9]+$/, ''));
      sheet.fileCount += 1;
      return;
    }
    if (command === 'TRACK') {
      const number = Number.parseInt(rest, 10);
      track = Number.isFinite(number) ? { number, file } : undefined;
      if (track) {
        sheet.tracks.push(track);
      }
      return;
    }
    if (command === 'REM') {
      const rem = /^([A-Za-z]+)\s+(.*)$/.exec(rest);
      const key = rem?.[1].toUpperCase();
      const value = rem ? valueOf(rem[2]) : '';
      if (track === undefined && value !== '') {
        if (key === 'DATE') {
          sheet.date = value;
        } else if (key === 'GENRE') {
          sheet.genre = value;
        }
      }
      return;
    }
    const value = valueOf(rest);
    if (value === '') {
      return;
    }
    const target = track ?? sheet;
    if (command === 'TITLE') {
      target.title = value;
    } else if (command === 'PERFORMER') {
      target.performer = value;
    } else if (command === 'SONGWRITER') {
      target.songwriter = value;
    }
  });
  return sheet;
};

const stem = (name: string): string =>
  (name.split(/[\\/]/).pop() ?? name)
    .replace(/\.[^.]+$/, '')
    .toLocaleLowerCase()
    .trim();

/**
 * The sheet's track for one song: the track under a FILE line naming the
 * song's file (its extension aside, since a rip is often converted after
 * the sheet was written), or, for a sheet of one file per song whose names
 * match nothing, the track with the song's number. A whole-album image
 * names no song, so nothing is matched in it.
 */
export const cueTrackFor = (
  sheet: ICueSheet,
  fileName: string,
  trackNo: number | undefined,
): ICueTrack | undefined => {
  // One FILE for the whole album: that file is every track at once, and its
  // first track's title is not the file's.
  if (sheet.fileCount <= 1) {
    return undefined;
  }
  const own = stem(fileName);
  const byFile = sheet.tracks.find(
    (track) => track.file !== undefined && stem(track.file) === own,
  );
  if (byFile) {
    return byFile;
  }
  return trackNo === undefined
    ? undefined
    : sheet.tracks.find((track) => track.number === trackNo);
};
