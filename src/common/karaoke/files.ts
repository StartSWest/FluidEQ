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
import { parseLrc } from './lrc';
import { parseUltraStar } from './ultrastar';

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
    canParse: (contents) =>
      /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(contents),
    parse: parseLrc,
  },
  {
    id: 'ultrastar',
    extensions: ['txt'],
    canParse: (contents) =>
      /^#(?:BPM|TITLE|ARTIST|GAP):/im.test(contents) &&
      /^[*:F]\s+-?\d+\s+\d+\s+-?\d+/im.test(contents),
    parse: parseUltraStar,
  },
];

export const KARAOKE_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'flac',
  'm4a',
] as const;
export const KARAOKE_LYRIC_EXTENSIONS: readonly string[] = Array.from(
  new Set(KARAOKE_TEXT_ADAPTERS.flatMap((adapter) => adapter.extensions)),
);

export const KARAOKE_FILE_PICKER_ACCEPT = [
  ...KARAOKE_AUDIO_EXTENSIONS,
  ...KARAOKE_LYRIC_EXTENSIONS,
]
  .map((extension) => `.${extension}`)
  .concat('audio/*')
  .join(',');

export const karaokeFileExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.');
  return lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : '';
};

export const karaokeFileBaseName = (name: string): string => {
  const extension = karaokeFileExtension(name);
  const withoutExtension = extension
    ? name.slice(0, -(extension.length + 1))
    : name;
  return withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const DRAGGED_RELATIVE_PATH = Symbol('karaokeRelativePath');
const RESTORED_FILE_TOKEN = Symbol('karaokeRestoredFileToken');

type TKaraokePathFile = File & {
  readonly webkitRelativePath?: string;
  [DRAGGED_RELATIVE_PATH]?: string;
  [RESTORED_FILE_TOKEN]?: string;
};

/** Preserve a folder drop's relative path without copying its file bytes. */
export const setKaraokeRelativePath = (file: File, path: string): File => {
  (file as TKaraokePathFile)[DRAGGED_RELATIVE_PATH] = path;
  return file;
};

export const karaokeFileRelativePath = (file: File): string =>
  (file as TKaraokePathFile)[DRAGGED_RELATIVE_PATH] ||
  (file as TKaraokePathFile).webkitRelativePath ||
  file.name;

/** Attach the opaque main-process capability used to reopen a restored file. */
export const setKaraokeRestoredFileToken = (
  file: File,
  token: string,
): File => {
  (file as TKaraokePathFile)[RESTORED_FILE_TOKEN] = token;
  return file;
};

export const karaokeRestoredFileToken = (file: File): string | undefined =>
  (file as TKaraokePathFile)[RESTORED_FILE_TOKEN];

const karaokeFileDirectory = (file: File): string => {
  const path = karaokeFileRelativePath(file).replace(/\\/g, '/');
  const lastSlash = path.lastIndexOf('/');
  return lastSlash < 0 ? '' : path.slice(0, lastSlash).toLowerCase();
};

export const isKaraokeAudioFile = (file: File): boolean =>
  KARAOKE_AUDIO_EXTENSIONS.includes(
    karaokeFileExtension(
      file.name,
    ) as (typeof KARAOKE_AUDIO_EXTENSIONS)[number],
  );

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
        karaokeFileBaseName(lyrics.name) === karaokeFileBaseName(audio.name),
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
      .filter(
        (lyricFile) =>
          karaokeFileBaseName(lyricFile.name) ===
          karaokeFileBaseName(audioFile.name),
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

const readWithFileReader = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });

export const readKaraokeTextFile = (file: File): Promise<string> => {
  const modernFile = file as File & { text?: () => Promise<string> };
  return modernFile.text ? modernFile.text() : readWithFileReader(file);
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

export const karaokeAudioMimeType = (file: File): string => {
  if (file.type) {
    return file.type;
  }
  return (
    {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      flac: 'audio/flac',
      m4a: 'audio/mp4',
    }[karaokeFileExtension(file.name)] ?? ''
  );
};
