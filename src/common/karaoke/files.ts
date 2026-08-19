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

import { IKaraokeParsedLyrics } from './types';
import { LINE_TIMESTAMP, parseLrc } from './lrc';
import { parseUltraStar } from './ultrastar';
import { decodeKaraokeText } from './textEncoding';
import {
  KARAOKE_AUDIO_EXTENSIONS,
  KARAOKE_IMAGE_EXTENSIONS,
  KARAOKE_PLAYABLE_VIDEO_EXTENSIONS,
  isKaraokeAudioFile,
  isKaraokeImageFile,
  isKaraokeVideoFile,
  karaokeFileDirectory,
  karaokeFileExtension,
  karaokeFileNamesMatch,
  karaokeFileRelativePath,
} from './fileTypes';

export * from './fileTypes';
export * from './stageMedia';

export interface IKaraokeTextAdapter {
  /** Stable provider/format id used in diagnostics and song metadata. */
  id: string;
  extensions: readonly string[];
  /** Allows content-based detection when extensions are missing or shared. */
  canParse: (contents: string) => boolean;
  /** Must return FluidEQ-normalized milliseconds and MIDI semitones. */
  parse: (contents: string) => IKaraokeParsedLyrics;
}

export const KARAOKE_TEXT_ADAPTERS: readonly IKaraokeTextAdapter[] = [
  {
    id: 'lrc',
    extensions: ['lrc', 'elrc'],
    canParse: (contents) => {
      // Reset on both sides: `.test()` on a global regex leaves `lastIndex`
      // wherever it matched, and `matchAll` copies that offset into the clone
      // it iterates with — so a dirty index here would make the next reader of
      // this shared pattern skip the start of its file rather than fail.
      LINE_TIMESTAMP.lastIndex = 0;
      const matches = LINE_TIMESTAMP.test(contents);
      LINE_TIMESTAMP.lastIndex = 0;
      return matches;
    },
    parse: parseLrc,
  },
  {
    id: 'ultrastar',
    extensions: ['txt'],
    canParse: (contents) =>
      /^#(?:BPM|TITLE|ARTIST|GAP):/im.test(contents) &&
      // Any visible ASCII but space and `#` is a legal note type, so a
      // rap-only song has no `:` line anywhere in it. Naming three markers
      // here made a whole legal file undetectable whenever its extension did
      // not already say what it was.
      /^[!-"$-,.-~]\s+-?\d+\s+\d+\s+-?\d+/m.test(contents),
    parse: parseUltraStar,
  },
];

export const KARAOKE_LYRIC_EXTENSIONS: readonly string[] = Array.from(
  new Set(KARAOKE_TEXT_ADAPTERS.flatMap((adapter) => adapter.extensions)),
);

/**
 * What the "Add files" dialog offers, which must be what the import accepts.
 *
 * Artwork is on the list because a folder add was previously the only way to
 * get a cover in at all: picking a song and its `cover.jpg` together simply
 * dropped the picture. The `audio/*` wildcard that used to be here is gone —
 * it let the dialog offer `.wma`, which `isKaraokeAudioFile` then refused with
 * "none of those files is supported", blaming the user for a file the app had
 * just invited them to choose.
 *
 * Video is the playable list rather than the recognised one: a format the
 * dialog offers is a format this build promises to open. The wider list still
 * applies to folder imports, where an `[VD#0].avi` gets a named refusal
 * instead of a black rectangle.
 */
export const KARAOKE_FILE_PICKER_ACCEPT = [
  ...KARAOKE_AUDIO_EXTENSIONS,
  ...KARAOKE_LYRIC_EXTENSIONS,
  ...KARAOKE_IMAGE_EXTENSIONS,
  ...KARAOKE_PLAYABLE_VIDEO_EXTENSIONS,
]
  .map((extension) => `.${extension}`)
  .join(',');

export const isKaraokeLyricFile = (file: File): boolean =>
  KARAOKE_LYRIC_EXTENSIONS.includes(karaokeFileExtension(file.name));

export type TKaraokeFileSelection =
  | { kind: 'ready'; audio: File; lyrics?: File; ignored: File[] }
  | { kind: 'missing-audio'; lyrics: File[]; ignored: File[] }
  | { kind: 'ambiguous'; audio: File[]; lyrics: File[]; ignored: File[] }
  | { kind: 'unsupported'; files: File[] };

export interface IKaraokePlaylistItem {
  id: string;
  audio: File;
  lyrics?: File;
  title: string;
  relativePath: string;
  /**
   * The pictures and video sitting in this song's own directory.
   *
   * Carried unresolved rather than picked here, because choosing between them
   * needs the lyric file parsed — UltraStar names its cover, background and
   * video in the header, and only the session has read that by the time it
   * matters. This is the shortlist; `selectKaraokeStageMedia` makes the call.
   *
   * It has to travel on the item at all because loading a playlist entry hands
   * the session that entry's files and nothing else. Without this the folder
   * import — which is how a real library arrives — dropped every cover on the
   * floor while a two-file drag-and-drop kept its own.
   */
  media: File[];
}

export interface IKaraokePlaylistSelection {
  items: IKaraokePlaylistItem[];
  ignored: File[];
  unpairedLyrics: File[];
  ambiguousLyrics: File[];
}

const playlistItemId = (audio: File): string =>
  karaokeFileRelativePath(audio).toLowerCase();

/**
 * Build every unambiguous audio/lyrics pair in a multi-file or folder import.
 *
 * Pairing is deliberately scoped to the same relative directory and normalized
 * basename, so two album folders can each contain `Track 01` safely. License,
 * cover and background files remain available to future importers but are not
 * mistaken for a song's lyrics.
 */
export const selectKaraokePlaylist = (
  selectedFiles: readonly File[],
): IKaraokePlaylistSelection => {
  const files = Array.from(selectedFiles);
  const audioFiles = files
    .filter(isKaraokeAudioFile)
    .sort((left, right) =>
      karaokeFileRelativePath(left).localeCompare(
        karaokeFileRelativePath(right),
      ),
    );
  const lyricFiles = files.filter(isKaraokeLyricFile);
  const usedLyrics = new Set<File>();
  const ambiguousLyrics = new Set<File>();
  const items = audioFiles.map((audio) => {
    const matchingLyrics = lyricFiles.filter(
      (lyrics) =>
        karaokeFileDirectory(lyrics) === karaokeFileDirectory(audio) &&
        karaokeFileNamesMatch(lyrics.name, audio.name),
    );
    const lyrics = matchingLyrics.length === 1 ? matchingLyrics[0] : undefined;
    if (lyrics) {
      usedLyrics.add(lyrics);
    } else if (matchingLyrics.length > 1) {
      matchingLyrics.forEach((file) => ambiguousLyrics.add(file));
    }
    const extension = karaokeFileExtension(audio.name);
    return {
      id: playlistItemId(audio),
      audio,
      lyrics,
      title: (extension
        ? audio.name.slice(0, -(extension.length + 1))
        : audio.name
      )
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      relativePath: karaokeFileRelativePath(audio),
      media: files.filter(
        (file) =>
          karaokeFileDirectory(file) === karaokeFileDirectory(audio) &&
          (isKaraokeImageFile(file) || isKaraokeVideoFile(file)),
      ),
    };
  });
  return {
    items,
    ignored: files.filter(
      (file) => !isKaraokeAudioFile(file) && !isKaraokeLyricFile(file),
    ),
    unpairedLyrics: lyricFiles.filter(
      (file) => !usedLyrics.has(file) && !ambiguousLyrics.has(file),
    ),
    ambiguousLyrics: Array.from(ambiguousLyrics),
  };
};

/** Pair only files the user explicitly selected; never inspect sibling paths. */
export const selectKaraokeFiles = (
  selectedFiles: readonly File[],
): TKaraokeFileSelection => {
  const files = Array.from(selectedFiles);
  const audio = files.filter(isKaraokeAudioFile);
  const lyrics = files.filter(isKaraokeLyricFile);
  const ignored = files.filter(
    (file) => !isKaraokeAudioFile(file) && !isKaraokeLyricFile(file),
  );
  if (!audio.length && !lyrics.length) {
    return { kind: 'unsupported', files };
  }
  if (!audio.length) {
    return { kind: 'missing-audio', lyrics, ignored };
  }
  if (audio.length === 1 && lyrics.length <= 1) {
    return { kind: 'ready', audio: audio[0], lyrics: lyrics[0], ignored };
  }

  const pairs = audio.flatMap((audioFile) =>
    lyrics
      .filter((lyricFile) =>
        karaokeFileNamesMatch(lyricFile.name, audioFile.name),
      )
      .map((lyricFile) => ({ audio: audioFile, lyrics: lyricFile })),
  );
  if (pairs.length === 1) {
    return { kind: 'ready', ...pairs[0], ignored };
  }
  if (audio.length === 1 && !lyrics.length) {
    return { kind: 'ready', audio: audio[0], ignored };
  }
  return { kind: 'ambiguous', audio, lyrics, ignored };
};

/** The bytes path for environments whose File has no `arrayBuffer`. */
const readWithFileReader = (file: File): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.onload = () => {
      const { result } = reader;
      resolve(
        result instanceof ArrayBuffer
          ? new Uint8Array(result)
          : new Uint8Array(),
      );
    };
    reader.readAsArrayBuffer(file);
  });

/**
 * Read a lyric file as the text its author wrote, whatever encoding that was.
 *
 * Bytes rather than `File.text()`, which is UTF-8 by specification: a CP1252
 * `.lrc` came through as `Canci�n` with the timings intact and nothing
 * warning anybody. `readAsText` has the same defect, so the FileReader
 * fallback reads bytes too and both paths land in the same decoder — a
 * restored session must read a file exactly as a freshly opened one does.
 */
export const readKaraokeTextFile = async (file: File): Promise<string> => {
  const modernFile = file as File & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  const bytes = modernFile.arrayBuffer
    ? new Uint8Array(await modernFile.arrayBuffer())
    : await readWithFileReader(file);
  return decodeKaraokeText(bytes);
};

export const parseKaraokeText = (
  fileName: string,
  contents: string,
  adapters: readonly IKaraokeTextAdapter[] = KARAOKE_TEXT_ADAPTERS,
): IKaraokeParsedLyrics => {
  const extension = karaokeFileExtension(fileName);
  const extensionAdapters = adapters.filter((adapter) =>
    adapter.extensions.includes(extension),
  );
  const detectedAdapters = adapters.filter(
    (adapter) =>
      !extensionAdapters.includes(adapter) && adapter.canParse(contents),
  );
  const candidates = [...extensionAdapters, ...detectedAdapters];
  const parseCandidate = (
    index: number,
    previousError?: unknown,
  ): IKaraokeParsedLyrics => {
    const adapter = candidates[index];
    if (!adapter) {
      if (previousError) {
        throw previousError;
      }
      throw new Error(`Unsupported lyric extension: ${extension || 'none'}`);
    }
    try {
      return adapter.parse(contents);
    } catch (error) {
      return parseCandidate(index + 1, error);
    }
  };
  return parseCandidate(0);
};

export const parseKaraokeLyricFile = async (
  file: File,
): Promise<IKaraokeParsedLyrics> =>
  parseKaraokeText(file.name, await readKaraokeTextFile(file));
