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

import { KARAOKE_TEXT_ADAPTERS } from '../karaoke/files';

/**
 * Every audio container a music folder is likely to hold.
 *
 * Deliberately longer than the Karaoke tab's list, which is what that feature
 * supports rather than what a library should show. See
 * `LIBRARY_UNPLAYABLE_EXTENSIONS` for the half Chromium refuses.
 */
export const LIBRARY_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'flac',
  'm4a',
  'opus',
  'aac',
  'aiff',
  'alac',
  'm4b',
  'wma',
] as const;

export const LIBRARY_VIDEO_EXTENSIONS = [
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
 * Recognised, and refused by Chromium's media stack.
 *
 * Electron ships Chromium's decoders and nothing else. A `<video>` or
 * `<audio>` pointed at one of these fires `error` and shows nothing, which
 * reads as a broken player. Listing them and saying so reads as an honest one.
 */
export const LIBRARY_UNPLAYABLE_EXTENSIONS = [
  'wma',
  'alac',
  'aiff',
  'avi',
  'flv',
  'mkv',
  'wmv',
  'mpg',
  'mpeg',
  'divx',
] as const;

const LYRIC_EXTENSIONS = ['lrc', 'elrc'] as const;

export const libraryFileExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.');
  return lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : '';
};

export const libraryFileKind = (
  name: string,
): 'audio' | 'video' | undefined => {
  const extension = libraryFileExtension(name);
  if (LIBRARY_AUDIO_EXTENSIONS.some((entry) => entry === extension)) {
    return 'audio';
  }
  if (LIBRARY_VIDEO_EXTENSIONS.some((entry) => entry === extension)) {
    return 'video';
  }
  return undefined;
};

export const isLibraryPlayable = (name: string): boolean => {
  const extension = libraryFileExtension(name);
  return (
    libraryFileKind(name) !== undefined &&
    !LIBRARY_UNPLAYABLE_EXTENSIONS.some((entry) => entry === extension)
  );
};

export const libraryBaseName = (name: string): string => {
  const extension = libraryFileExtension(name);
  const withoutExtension = extension
    ? name.slice(0, -(extension.length + 1))
    : name;
  return withoutExtension.toLowerCase();
};

/** Strips the track number and separators a filename uses instead of tags. */
export const libraryTitleFromFileName = (name: string): string => {
  const extension = libraryFileExtension(name);
  const stem = extension ? name.slice(0, -(extension.length + 1)) : name;
  return stem
    .replace(/^\s*\d{1,3}\s*[-._)]\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const ULTRASTAR_ADAPTER = KARAOKE_TEXT_ADAPTERS.find(
  (adapter) => adapter.id === 'ultrastar',
);

/**
 * One definition, two readers: this must agree with what the Karaoke tab will
 * actually open, or a song is excluded from the library and rejected there too.
 */
export const isUltraStarText = (contents: string): boolean =>
  ULTRASTAR_ADAPTER?.canParse(contents) ?? false;

export const karaokeLyricCandidates = (
  fileName: string,
  siblings: readonly string[],
): { certain: string[]; needsContentCheck: string[] } => {
  const base = libraryBaseName(fileName);
  const certain: string[] = [];
  const needsContentCheck: string[] = [];
  siblings.forEach((sibling) => {
    if (libraryBaseName(sibling) !== base) {
      return;
    }
    const extension = libraryFileExtension(sibling);
    if (LYRIC_EXTENSIONS.some((entry) => entry === extension)) {
      certain.push(sibling);
    } else if (extension === 'txt') {
      needsContentCheck.push(sibling);
    }
  });
  return { certain, needsContentCheck };
};
