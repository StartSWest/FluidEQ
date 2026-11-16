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

import type { Translate } from '../../common/i18n';
import {
  type ISubtitleFile,
  subtitleLanguage,
  subtitleQualifiers,
} from '../../common/library/subtitles';
import karaokeLanguageName from '../karaoke/karaokeLanguageName';

/**
 * Each of a video's subtitle files by what it is, NEVER by its file name
 * (Ivan, 2026-11-15, of a picker that showed "TAYLOR SWIFT MISS AMERICANA
 * [2020].2.srt" wrapped over three lines): its language in that language's
 * own words ("español"), what kind of track it is after it ("English ·
 * forced"), and a file that names no language numbered among the others
 * that name none ("Subtitles 1", "Subtitles 2"). Two files that would still
 * read the same — an `.srt` and a `.vtt` of one language — are numbered
 * apart, or the list would offer two identical choices.
 */
const subtitleLabels = (
  files: readonly ISubtitleFile[],
  t: Translate,
): Map<string, string> => {
  let unnamed = 0;
  const named = files.map((file) => {
    const language = subtitleLanguage(file.tag);
    if (language === undefined) {
      unnamed += 1;
      return t('library.subtitles.unnamed', { number: unnamed });
    }
    const name = karaokeLanguageName(language);
    const variant = subtitleQualifiers(file.tag).join(' ');
    return variant === ''
      ? name
      : t('library.subtitles.variant', { language: name, variant });
  });
  const seen = new Map<string, number>();
  return new Map(
    files.map((file, at) => {
      const label = named[at];
      if (named.indexOf(label) === named.lastIndexOf(label)) {
        return [file.fileName, label];
      }
      const count = (seen.get(label) ?? 0) + 1;
      seen.set(label, count);
      return [
        file.fileName,
        t('library.subtitles.variant', {
          language: label,
          variant: String(count),
        }),
      ];
    }),
  );
};

export default subtitleLabels;
