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
 * What kind of file this is, and which name it belongs to.
 *
 * Split out of `files.ts` so that the stage-media picker can ask these
 * questions without importing the module that re-exports it.
 */

/**
 * The audio containers Chromium decodes, which is what the app can play.
 *
 * Opus and AAC are here because Chromium plays both — `.opus` in Ogg and raw
 * ADTS `.aac` — and the picker used to offer them through `audio/*` only for
 * `isKaraokeAudioFile` to answer "none of those files is supported". WMA is
 * absent for the opposite reason: the dialog must not offer what nothing
 * downstream can open.
 */
export const KARAOKE_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'opus',
  'flac',
  'm4a',
  'aac',
] as const;

/**
 * Cover and background artwork — every still format Chromium will decode.
 *
 * Deliberately the whole list rather than the three a UltraStar pack usually
 * ships, because the cost of a missing entry is silent: the picture is simply
 * never offered to the stage and the song looks like it has no artwork.
 *
 * TIFF, HEIC and RAW are absent because Electron cannot display them, not
 * because they are rare. Listing one would mean handing `<img>` a file it
 * renders as a broken frame, which is worse than the gradient.
 */
export const KARAOKE_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'jfif',
  'png',
  'apng',
  'webp',
  'gif',
  'avif',
  'bmp',
  'ico',
  'svg',
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

export const karaokeFileExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.');
  return lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : '';
};

/**
 * Drop a combining mark only where it decorates an ASCII letter.
 *
 * The point of the fold is that `Café del Mar.mp3` should meet
 * `cafe del mar.lrc`, which is a fact about how people type ASCII names. It is
 * not a licence to rewrite other alphabets: the same U+0300..U+036F range that
 * carries the acute on `é` carries the breve on Cyrillic `й`, so a blanket
 * strip paired `Цой.mp3` with a different song called `Цои.lrc`.
 *
 * Marks outside that range are kept rather than merely un-stripped — U+3099,
 * the Japanese voiced-sound mark NFKD splits off, is a Mark and not a Letter,
 * so the class below would otherwise have turned it into a space and left
 * `ダンス` normalising to `タ ンス`.
 */
const withoutAsciiCombiningMarks = (value: string): string =>
  Array.from(value)
    .filter((character, index, characters) => {
      const code = character.codePointAt(0) ?? 0;
      if (code < 0x300 || code > 0x36f) {
        return true;
      }
      const base = characters[index - 1]?.codePointAt(0) ?? 0;
      return base > 0x7f;
    })
    .join('');

/**
 * The name two files must share to be the same song.
 *
 * `\p{L}\p{N}` rather than `a-z0-9`: the old class kept nothing at all from a
 * name with no ASCII letters, so `夜に駆ける.mp3`, `강남스타일.lrc` and
 * `Кино - Группа крови.mp3` each normalised to the empty string. Two empty
 * names compare equal, so in a folder of Japanese songs every lyric file
 * matched every song, all of them were filed as ambiguous, and not one song
 * got its words. NFKD plus the combining-mark strip stays because it is what
 * makes `Café del Mar.mp3` meet `cafe del mar.lrc`.
 */
export const karaokeFileBaseName = (name: string): string => {
  const extension = karaokeFileExtension(name);
  const withoutExtension = extension
    ? name.slice(0, -(extension.length + 1))
    : name;
  const normalized = withoutAsciiCombiningMarks(
    withoutExtension.normalize('NFKD'),
  )
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    // Recomposed, because NFKD left the marks it did not strip standing on
    // their own: the result compared unequal to the same name typed composed,
    // which is how it arrives from a file dialog on another platform.
    .normalize('NFC')
    .trim();
  // A stem of pure punctuation — `!!!.mp3`, `♪.lrc` — still normalises away.
  // The raw stem keeps those pairing with their own lyric file instead of with
  // every other punctuation-named song in the folder.
  return normalized || withoutExtension.trim().toLowerCase();
};

/**
 * Whether two file names name the same song.
 *
 * The emptiness guard is the point: a name that normalises to nothing is not
 * evidence of anything, and `.lrc` must never be read as the lyrics of `.mp3`.
 */
export const karaokeFileNamesMatch = (left: string, right: string): boolean => {
  const base = karaokeFileBaseName(left);
  return base.length > 0 && base === karaokeFileBaseName(right);
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

/**
 * The folder a file arrived in, or `''` when nobody told us.
 *
 * A loose drop and a file-dialog selection both give `''`, which makes every
 * selected file everyone else's sibling. Callers that infer anything from
 * proximity have to treat that case as no information at all.
 */
export const karaokeFileDirectory = (file: File): string => {
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
