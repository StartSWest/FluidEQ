/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What an import has to say for itself, as sentences.
 *
 * Two questions, both pure and both previously living in the middle of a
 * 1,943-line component where nothing could reach them: why a lyric file failed
 * to parse, and which files an import put down and never picked up again.
 * Neither needs React, a ref or a render, and both are exactly the shape a
 * test wants — a value in, a sentence out.
 */
import { Translate, TranslationKey } from '../../common/i18n';
import {
  IKaraokePlaylistSelection,
  isKaraokeImageFile,
  isKaraokeVideoFile,
  karaokeFileExtension,
} from '../../common/karaoke/files';
import { TKaraokeParseErrorCode } from '../../common/karaoke/types';

/**
 * One sentence per way a lyric file can fail, chosen by the parser's own code.
 *
 * The `Record` is exhaustive by type, so a new `TKaraokeParseErrorCode` in
 * `src/common` cannot reach the strip as the generic "could not be parsed"
 * line — it stops the build here instead, where the missing sentence is.
 */
const LYRIC_WARNING_KEYS: Record<TKaraokeParseErrorCode, TranslationKey> = {
  empty: 'karaoke.warning.lyricsEmpty',
  'missing-timing': 'karaoke.warning.lyricsMissingTiming',
  'missing-bpm': 'karaoke.warning.lyricsMissingBpm',
  'invalid-bpm': 'karaoke.warning.lyricsInvalidBpm',
  'malformed-note': 'karaoke.warning.lyricsMalformedNote',
  'unsupported-variant': 'karaoke.warning.lyricsUnsupportedVariant',
};

/**
 * Only the two fields the sentence turns on.
 *
 * Deliberately not `IKaraokeSessionWarning`: naming that type would drag the
 * whole session hook — and the media element it owns — into a module that is
 * three string lookups, and into every test of one.
 */
export interface IKaraokeLyricWarningFacts {
  code?: TKaraokeParseErrorCode;
  line?: number;
}

/**
 * The parser names the failure and this says it in the user's language.
 *
 * The thrown `Error.message` is never shown: those strings are English
 * diagnostics written for whoever is reading a stack trace, and a duet, a
 * mis-encoded pack and a plain untimed lyric sheet each deserve their own
 * sentence rather than the one that used to cover all three.
 */
export const karaokeLyricWarningSentence = (
  warning: IKaraokeLyricWarningFacts,
  t: Translate,
): string =>
  [
    t(
      warning.code
        ? LYRIC_WARNING_KEYS[warning.code]
        : 'karaoke.warning.lyrics',
    ),
    warning.line === undefined
      ? undefined
      : t('karaoke.warning.lyricsAtLine', { line: warning.line }),
  ]
    .filter((part): part is string => part !== undefined)
    .join(' ');

export interface IKaraokeSetAsideFiles {
  /** Upper-case extensions, de-duplicated: `CDG, SRT` rather than nine names. */
  formats: string[];
  unpaired: string[];
  ambiguous: string[];
}

/**
 * How many filenames the notice will name before it starts counting.
 *
 * The notice is one strip above the player and it wraps rather than scrolls,
 * so a folder import with fifty unpaired lyric files rendered fifty names in
 * it and pushed the stage off the screen. Six names is the most that strip
 * holds at its narrowest without becoming a directory listing, and past six
 * the user is not reading names anyway — they are reading "a lot".
 */
const SET_ASIDE_NAME_LIMIT = 6;

const nameList = (names: readonly string[], t: Translate): string =>
  (names.length <= SET_ASIDE_NAME_LIMIT
    ? [...names]
    : [
        ...names.slice(0, SET_ASIDE_NAME_LIMIT),
        t('karaoke.warning.andMore', {
          count: names.length - SET_ASIDE_NAME_LIMIT,
        }),
      ]
  ).join(', ');

/**
 * What an import put down and never picked up again.
 *
 * `selectKaraokePlaylist` has computed this on every import since it was
 * written and nothing had ever read it, so `Song.mp3` beside `Song.srt`
 * played with no lyrics and said nothing — indistinguishable from a broken
 * feature.
 *
 * Pictures and video are filtered back out of `ignored`: that list means
 * "neither audio nor lyrics", which includes the cover the stage is at that
 * moment showing behind the words. Naming it would be telling the user a file
 * was dropped while they are looking at it.
 */
export const karaokeSetAsideFiles = (
  selection: IKaraokePlaylistSelection,
): IKaraokeSetAsideFiles | undefined => {
  const formats = Array.from(
    new Set(
      selection.ignored
        .filter(
          (file) => !isKaraokeImageFile(file) && !isKaraokeVideoFile(file),
        )
        .map((file) => karaokeFileExtension(file.name).toUpperCase())
        .filter((extension) => extension.length > 0),
    ),
  ).sort();
  const unpaired = selection.unpairedLyrics.map((file) => file.name);
  const ambiguous = selection.ambiguousLyrics.map((file) => file.name);
  return formats.length || unpaired.length || ambiguous.length
    ? { formats, unpaired, ambiguous }
    : undefined;
};

export const karaokeSetAsideSentences = (
  files: IKaraokeSetAsideFiles,
  t: Translate,
): string[] => {
  const sentences: string[] = [];
  if (files.formats.length) {
    sentences.push(
      // Formats are already de-duplicated down to a handful of extensions, so
      // this list cannot run away the way the filename lists can.
      t('karaoke.warning.setAside', { formats: files.formats.join(', ') }),
    );
  }
  if (files.unpaired.length) {
    sentences.push(
      t('karaoke.warning.unpairedLyrics', {
        files: nameList(files.unpaired, t),
      }),
    );
  }
  if (files.ambiguous.length) {
    sentences.push(
      t('karaoke.warning.ambiguousLyrics', {
        files: nameList(files.ambiguous, t),
      }),
    );
  }
  return sentences;
};
