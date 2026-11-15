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
 * A song's lyrics, read in main for the Library's Lyrics tab: from its own
 * tags, or from a lyrics file of the same name beside it.
 *
 * WHERE THEY LIVE, every standard place:
 * - ID3v2 (MP3, AIFF, WAV): USLT, unsynced, and SYLT, synced, which the
 *   parser hands over structured;
 * - Vorbis comments (FLAC, Ogg, Opus): LYRICS, UNSYNCEDLYRICS, SYNCEDLYRICS;
 * - MP4 and M4A: ©lyr; APEv2: Lyrics; ASF and WMA: WM/Lyrics.
 * The text tags are read RAW from the native tags rather than through the
 * parser's common `lyrics`: its LRC reading keeps one stamp per line and only
 * the `[mm:ss.xx]` form, and an LRC text in a tag deserves the full reading
 * (`parseLrc`) a sidecar gets.
 *
 * THE ORDER: words with timing first — the tags', then a `.lrc` file — and
 * plain words after — the tags', then a `.txt` file. A synced file beside a
 * song whose tags carry the same words unsynced is the better of the two.
 * Lyrics the listener imported where the song's folder could not be written
 * are kept in FluidEQ's own folder and come last within each kind.
 *
 * The path comes from the store by the song's id (`library-track-lyrics`),
 * never from the window, and a sidecar is only ever the song's own name with
 * another extension, in the song's own folder.
 */

import fs from 'fs';
import path from 'path';
import { parseFile } from 'music-metadata';
import {
  type ILibraryLyrics,
  type ILibraryLyricsAnswer,
  type ILyricsLine,
  type TLyricsSource,
  lyricsFromText,
  MAX_LYRICS_FILE_BYTES,
  MAX_LYRICS_LINE_CHARS,
  MAX_LYRICS_LINES,
  MAX_LYRICS_WORDS,
  wordsFromPieces,
} from '../../common/library/lyrics';
import {
  libraryLinesOf,
  readLyricsFormat,
} from '../../common/library/lyricsFormats';
import { LYRICS_FILE_EXTENSIONS } from '../../common/library/lyricsImport';
import {
  stanzaLayoutOf,
  withStanzas,
} from '../../common/library/lyricsStanzas';
import { sidecarPath, storedLyricsPath } from './libraryLyricsPlaces';

/**
 * Text tags that hold lyrics, by their native name upper-cased, any tag
 * format: Vorbis and APE by name, MP4's atom, ASF's attribute, and the ID3
 * user frames (`TXXX:LYRICS` and kin) some taggers write instead of USLT.
 */
const TEXT_TAGS = new Set([
  'SYNCEDLYRICS',
  'LYRICS',
  'UNSYNCEDLYRICS',
  'UNSYNCED LYRICS',
  '©LYR',
  'WM/LYRICS',
  'TXXX:SYNCEDLYRICS',
  'TXXX:LYRICS',
  'TXXX:UNSYNCEDLYRICS',
  'TXXX:UNSYNCED LYRICS',
]);

/** ID3v2's two frames (and v2.2's USLT), which arrive as objects. */
const ID3_FRAMES = new Set(['USLT', 'ULT', 'SYLT']);

/** SYLT's own timing unit for milliseconds (`TimestampFormat`). */
const SYLT_MILLISECONDS = 2;

/** SYLT content types that are words to sing: other, lyrics, transcription.
 * Movements, events, chords and trivia are not lyrics. */
const SYLT_WORDS = new Set([0, 1, 2]);

/** ID3's mark for a syllable that begins a new line. */
const STARTS_LINE = /^[\r\n]/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface ISyltEntry {
  text: string;
  timestamp: number;
}

const isSyltEntry = (row: unknown): row is ISyltEntry =>
  isRecord(row) &&
  typeof row.text === 'string' &&
  typeof row.timestamp === 'number' &&
  Number.isFinite(row.timestamp);

/**
 * A SYLT frame with millisecond stamps, as timed lines; nothing otherwise.
 * MPEG-frame stamps need the stream's frame rate to mean anything, so such a
 * frame is read for nothing (its words are in USLT where a tagger wrote
 * both). The ID3 spec lets an entry be a syllable, with a newline at the
 * start of each one that opens a line: where any entry carries one, the
 * syllables are joined into lines and keep their own times as the line's
 * words, the way Enhanced LRC's word stamps do. Otherwise each entry is a
 * line.
 */
const syltLines = (
  value: Record<string, unknown>,
): ILyricsLine[] | undefined => {
  const rows = value.syncText;
  if (
    !Array.isArray(rows) ||
    value.timeStampFormat !== SYLT_MILLISECONDS ||
    !SYLT_WORDS.has(Number(value.contentType))
  ) {
    return undefined;
  }
  const entries = rows.filter(isSyltEntry);
  const bySyllable = entries.some(
    (entry, index) => index > 0 && STARTS_LINE.test(entry.text),
  );
  const lines: ILyricsLine[] = [];
  if (bySyllable) {
    const groups: ISyltEntry[][] = [];
    entries.forEach((entry, index) => {
      if (index === 0 || STARTS_LINE.test(entry.text)) {
        groups.push([]);
      }
      groups[groups.length - 1].push(entry);
    });
    groups.slice(0, MAX_LYRICS_LINES).forEach((group) => {
      const words = wordsFromPieces(
        group.slice(0, MAX_LYRICS_WORDS).map((entry) => ({
          timeMs: entry.timestamp,
          text: entry.text,
        })),
      );
      lines.push({
        timeMs: Math.max(0, group[0].timestamp),
        text: group
          .map((entry) => entry.text)
          .join('')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, MAX_LYRICS_LINE_CHARS),
        ...(words === undefined ? {} : { words }),
      });
    });
  } else {
    entries.slice(0, MAX_LYRICS_LINES).forEach((entry) => {
      lines.push({
        timeMs: Math.max(0, entry.timestamp),
        text: entry.text.trim().slice(0, MAX_LYRICS_LINE_CHARS),
      });
    });
  }
  const timed = lines
    .map((line, index) => ({ line, index }))
    .sort((a, b) => a.line.timeMs - b.line.timeMs || a.index - b.index)
    .map(({ line }) => line);
  return timed.some((line) => line.text !== '') ? timed : undefined;
};

/**
 * A lyrics text as the Library reads it, WHATEVER ITS FORMAT, whatever the
 * file is called (Ivan, 2026-11-15: "it is not taking the lyrics to the
 * Karaoke with the synced words already"). His word-timed YAML had been
 * kept as the song's `.txt` by an import from before the formats were
 * read, and the reader took any `.txt` for plain words: the song showed a
 * line-timed `.lrc` instead and handed the Karaoke lines without words. A
 * text in any of the formats the import reads (`readLyricsFormat`: the
 * lines/words JSON and YAML, Spotify, Musixmatch, TTML, SRT, WebVTT) is now
 * read as the timed lines it holds; LRC and plain words as before.
 */
const lyricsOfText = (
  text: string,
  source: TLyricsSource,
  fileName?: string,
): ILibraryLyrics | undefined => {
  const read = readLyricsFormat(text);
  // Words as written and no timing: those words, never the document's
  // metadata around them (already-kept files of that shape included).
  if (read.plainText !== undefined) {
    return lyricsFromText(read.plainText, source, fileName);
  }
  if (read.lines !== undefined) {
    const lines = libraryLinesOf(read.lines);
    if (lines.some((line) => line.text !== '')) {
      return {
        kind: 'synced',
        source,
        ...(fileName === undefined ? {} : { fileName }),
        lines,
      };
    }
  }
  return lyricsFromText(text, source, fileName);
};

/** How much timing lyrics carry: words, then lines, then none. */
const timingRank = (lyrics: ILibraryLyrics): number => {
  if (lyrics.kind === 'plain') {
    return 0;
  }
  return lyrics.lines.some((line) => line.words !== undefined) ? 2 : 1;
};

/**
 * What the song's tags hold, in the order they were found: timed lines from
 * SYLT, and every lyrics text — which `lyricsFromText` reads as LRC where it
 * carries stamps.
 */
const fromTags = async (trackPath: string): Promise<ILibraryLyrics[]> => {
  const { native } = await parseFile(trackPath, {
    skipCovers: true,
    duration: false,
  });
  const found: ILibraryLyrics[] = [];
  Object.values(native).forEach((tags) => {
    tags.forEach(({ id, value }) => {
      const name = id.toUpperCase();
      if (typeof value === 'string' && TEXT_TAGS.has(name)) {
        const lyrics = lyricsOfText(value, 'tags');
        if (lyrics) {
          found.push(lyrics);
        }
        return;
      }
      if (!ID3_FRAMES.has(name) || !isRecord(value)) {
        return;
      }
      const lines = syltLines(value);
      if (lines) {
        found.push({ kind: 'synced', source: 'tags', lines });
        return;
      }
      if (typeof value.text === 'string') {
        const lyrics = lyricsOfText(value.text, 'tags');
        if (lyrics) {
          found.push(lyrics);
        }
      }
    });
  });
  return found;
};

/**
 * A lyrics file's text: UTF-8 (a BOM is dropped by the reader), or the
 * Windows code page an older editor saved it in when it is not valid UTF-8.
 * Nothing for a file that is not there, or too big to be lyrics.
 */
const readSidecar = async (file: string): Promise<string | undefined> => {
  try {
    const stats = await fs.promises.stat(file);
    if (!stats.isFile() || stats.size > MAX_LYRICS_FILE_BYTES) {
      return undefined;
    }
    const bytes = await fs.promises.readFile(file);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('windows-1252').decode(bytes);
    }
  } catch {
    // Not there, or not readable: this place simply has no lyrics.
    return undefined;
  }
};

/** What FluidEQ kept in its own folder for this song, where an import could
 * not write beside it: read as the files beside it are, said as kept. */
const fromStore = async (
  storeDir: string,
  trackPath: string,
): Promise<ILibraryLyrics[]> => {
  const kept = await Promise.all(
    LYRICS_FILE_EXTENSIONS.map(
      async (extension): Promise<ILibraryLyrics | undefined> => {
        const text = await readSidecar(
          storedLyricsPath(storeDir, trackPath, extension),
        );
        const lyrics =
          text === undefined
            ? undefined
            : lyricsOfText(text, extension === '.lrc' ? 'lrc' : 'txt');
        return lyrics === undefined ? undefined : { ...lyrics, kept: true };
      },
    ),
  );
  return kept.filter(
    (lyrics): lyrics is ILibraryLyrics => lyrics !== undefined,
  );
};

/**
 * `storeDir` is FluidEQ's own lyrics folder (`libraryLyricsPlaces.ts`),
 * looked in after the tags and the files beside the song; without it only
 * the song's own places are read.
 */
export const readTrackLyrics = async (
  trackPath: string,
  storeDir?: string,
): Promise<ILibraryLyricsAnswer> => {
  const lrcPath = sidecarPath(trackPath, '.lrc');
  const txtPath = sidecarPath(trackPath, '.txt');
  const looked = [path.basename(lrcPath), path.basename(txtPath)];

  let tagged: ILibraryLyrics[] = [];
  try {
    tagged = await fromTags(trackPath);
  } catch (error) {
    // The tags would not parse; the files beside the song may still answer.
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; the sidecars are still read
    console.error(`Could not read the lyrics tags of ${trackPath}`, error);
  }
  const [lrcText, txtText] = await Promise.all([
    readSidecar(lrcPath),
    readSidecar(txtPath),
  ]);
  const lrc =
    lrcText === undefined
      ? undefined
      : lyricsOfText(lrcText, 'lrc', path.basename(lrcPath));
  const txt =
    txtText === undefined
      ? undefined
      : lyricsOfText(txtText, 'txt', path.basename(txtPath));

  const kept =
    storeDir === undefined ? [] : await fromStore(storeDir, trackPath);

  const candidates = [...tagged, lrc, txt, ...kept].filter(
    (lyrics): lyrics is ILibraryLyrics => lyrics !== undefined,
  );
  // The first timed answer, in the order tags, the `.lrc`, the `.txt`,
  // FluidEQ's own folder; then the first plain one. NOT the richest timing:
  // that was tried (2026-11-15) and put a stale word-timed `.txt` from an
  // old import over the `.lrc` the listener had timed by hand and saved -
  // the `.lrc` is the file the Library itself writes, so it speaks for the
  // song.
  const chosen =
    candidates.find((candidate) => candidate.kind === 'synced') ??
    candidates.find((candidate) => candidate.kind === 'plain');
  if (chosen === undefined) {
    return { looked };
  }
  // Timed lines parted into the stanzas of the words as written beside them,
  // where the song has such words (`lyricsStanzas.ts`).
  let lyrics = chosen;
  if (chosen.kind === 'synced') {
    const layout = candidates
      .filter((candidate) => candidate !== chosen)
      .map(stanzaLayoutOf)
      .find((found) => found !== undefined);
    const parted =
      layout === undefined ? undefined : withStanzas(chosen.lines, layout);
    if (parted !== undefined) {
      lyrics = { ...chosen, lines: parted };
    }
  }
  // For the Karaoke, the most timing any source carries (`forKaraoke`).
  const richest = candidates.reduce(
    (best, candidate) =>
      timingRank(candidate) > timingRank(best) ? candidate : best,
    chosen,
  );
  return richest === chosen
    ? { lyrics, looked }
    : { lyrics, forKaraoke: richest, looked };
};
