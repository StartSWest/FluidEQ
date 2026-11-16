/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type IKaraokeChordSegment } from '../../common/karaoke/chords';
import {
  looksLikeChordPro,
  parseChordLab,
  parseChordPro,
  timeChordSheet,
} from '../../common/karaoke/chordSheets';
import {
  isKaraokeChordSheetFile,
  karaokeFileDirectory,
  karaokeFileExtension,
  karaokeFileNamesMatch,
  readKaraokeTextFile,
} from '../../common/karaoke/files';
import { type IKaraokeParsedLyrics } from '../../common/karaoke/types';

/** How long the last chord of a sheet lasts past the last sung line. */
const TAIL_MS = 8_000;

/**
 * The chords a song's own files write, or nothing (Ivan, 2026-11-16: "if
 * the karaoke already brings the song's chords we need to use those").
 *
 * A chord sheet beside the song and named like it comes first - a .lab
 * annotation is timed already, a ChordPro sheet is timed by the song's timed
 * lyrics - and the chords written inside the lyric file second. A sheet that
 * cannot be read, or that matches too few of the lyrics, falls through to
 * the next; with neither, the chords are heard from the audio.
 */
const readKaraokeSongChords = async (
  audio: File,
  files: readonly File[],
  parsed: IKaraokeParsedLyrics | undefined,
  readFile: (file: File) => Promise<File | undefined>,
): Promise<IKaraokeChordSegment[] | undefined> => {
  const sheet = files.find(
    (file) =>
      isKaraokeChordSheetFile(file) &&
      karaokeFileDirectory(file) === karaokeFileDirectory(audio) &&
      karaokeFileNamesMatch(file.name, audio.name),
  );
  if (sheet) {
    try {
      const readable = await readFile(sheet);
      const text = readable ? await readKaraokeTextFile(readable) : '';
      const lines = parsed?.lines ?? [];
      const lastLine = lines[lines.length - 1];
      const endMs = (lastLine?.endMs ?? lastLine?.startMs ?? 0) + TAIL_MS;
      const chords =
        karaokeFileExtension(sheet.name) === 'lab'
          ? parseChordLab(text)
          : looksLikeChordPro(text) &&
            timeChordSheet(parseChordPro(text), lines, endMs);
      if (chords && chords.length) {
        return chords;
      }
    } catch (error) {
      // eslint-disable-next-line no-console -- context-rich error before the song falls back to heard chords
      console.error(`Could not read the chord sheet ${sheet.name}`, error);
    }
  }
  return parsed?.chords?.length ? parsed.chords : undefined;
};

export default readKaraokeSongChords;
