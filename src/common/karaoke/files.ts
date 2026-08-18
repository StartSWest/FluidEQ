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

/** Cover and background artwork, in the formats a song folder actually uses. */
export const KARAOKE_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
] as const;

/**
 * Every video container a song folder is likely to hold — not every one this
 * app can play.
 *
 * The two lists are deliberately different. Recognising a file is how the
 * player gets to say "there is a video here and I cannot decode it", which is
 * a far better answer than pretending the song has no video at all. See
 * `isKaraokePlayableVideoFile` for the half that Chromium will actually open.
 */
export const KARAOKE_VIDEO_EXTENSIONS = [
  'mp4',
  'webm',
  'm4v',
  'mov',
  'ogv',
  'avi',
  'flv',
  'mkv',
  'wmv',
  'mpg',
  'mpeg',
  'divx',
] as const;

/**
 * The containers Chromium will actually decode, which is the shorter list.
 *
 * Electron ships Chromium's media stack and nothing else: MP4 and WebM, plus
 * QuickTime because it is demuxed by the same code as MP4. AVI, FLV, MKV, WMV
 * and the MPEG program streams have no demuxer in the build at all, so a
 * `<video>` pointed at one fires `error` and shows black — it does not fail
 * loudly enough for anybody to guess why.
 *
 * This matters for real libraries rather than in theory: UltraStar packs from
 * the 2000s are full of `[VD#0].avi`, and a player that shows a black rectangle
 * for them looks broken in a way that a plain "this format cannot be played
 * here" never does.
 */
export const KARAOKE_PLAYABLE_VIDEO_EXTENSIONS = [
  'mp4',
  'webm',
  'm4v',
  'mov',
  'ogv',
] as const;

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

export const isKaraokeImageFile = (file: File): boolean =>
  KARAOKE_IMAGE_EXTENSIONS.includes(
    karaokeFileExtension(
      file.name,
    ) as (typeof KARAOKE_IMAGE_EXTENSIONS)[number],
  );

export const isKaraokeVideoFile = (file: File): boolean =>
  KARAOKE_VIDEO_EXTENSIONS.includes(
    karaokeFileExtension(
      file.name,
    ) as (typeof KARAOKE_VIDEO_EXTENSIONS)[number],
  );

/** Whether this build can decode it, as opposed to merely recognising it. */
export const isKaraokePlayableVideoFile = (file: File): boolean =>
  KARAOKE_PLAYABLE_VIDEO_EXTENSIONS.includes(
    karaokeFileExtension(
      file.name,
    ) as (typeof KARAOKE_PLAYABLE_VIDEO_EXTENSIONS)[number],
  );

export interface IKaraokeStageMedia {
  cover?: File;
  background?: File;
  video?: File;
}

/**
 * The pictures and video that belong to one song.
 *
 * TWO WAYS OF ASKING, IN ORDER. A format that names its own media is believed
 * first — UltraStar writes `#COVER`, `#BACKGROUND` and `#VIDEO`, and a song
 * that says which file it wants should get that file even in a folder holding
 * several. Everything else falls back to the same rule the lyric pairing
 * already uses: same directory, same base name as the audio, which is what
 * makes this work for LRC and for a bare MP3 with a picture beside it.
 *
 * The last fallback is looser on purpose. Folders that name their art after
 * the folder rather than the track are common enough — `cover.jpg`,
 * `folder.jpg` — that ignoring them would mean showing nothing for a lot of
 * real libraries. It only applies when the directory holds exactly one
 * candidate, so it can never pick the wrong song's artwork out of a pile.
 */
export const selectKaraokeStageMedia = (
  audio: File,
  files: readonly File[],
  named?: {
    coverFileName?: string;
    backgroundFileName?: string;
    videoFileName?: string;
  },
): IKaraokeStageMedia => {
  const directory = karaokeFileDirectory(audio);
  const siblings = files.filter(
    (file) => karaokeFileDirectory(file) === directory,
  );
  const byName = (declared?: string): File | undefined => {
    if (!declared) {
      return undefined;
    }
    // Compared on the base name alone: the header may write a path with a
    // separator this platform does not use, and the file was imported with a
    // relative path of its own that need not match it character for character.
    const wanted = declared.replace(/\\/g, '/').split('/').pop()?.toLowerCase();
    return wanted
      ? siblings.find((file) => file.name.toLowerCase() === wanted)
      : undefined;
  };
  const audioBase = karaokeFileBaseName(audio.name);
  const pick = (
    declared: string | undefined,
    matches: (file: File) => boolean,
  ): File | undefined => {
    const declaredFile = byName(declared);
    if (declaredFile && matches(declaredFile)) {
      return declaredFile;
    }
    const candidates = siblings.filter(matches);
    return (
      candidates.find((file) => karaokeFileBaseName(file.name) === audioBase) ??
      (candidates.length === 1 ? candidates[0] : undefined)
    );
  };

  const cover = pick(named?.coverFileName, isKaraokeImageFile);
  // The background must not silently become the cover again. A folder with one
  // picture has a cover and no scenery, which is the honest reading — the
  // player stretches the cover behind the words only because it was asked to.
  const background = (() => {
    const declared = byName(named?.backgroundFileName);
    if (declared && isKaraokeImageFile(declared)) {
      return declared;
    }
    const images = siblings.filter(isKaraokeImageFile);
    return images.find((file) => file !== cover && images.length > 1);
  })();
  return {
    cover,
    background,
    video: pick(named?.videoFileName, isKaraokeVideoFile),
  };
};

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
