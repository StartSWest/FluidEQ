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

/**
 * A count the way the reader's language groups digits: "14,032" in English,
 * "14.032" in German, "14 032" in French. The rail and the status line carry
 * library-sized numbers, and five bare digits are read one at a time.
 */
export const formatCount = (count: number, locale: string): string => {
  try {
    return new Intl.NumberFormat(locale).format(count);
  } catch {
    // An unknown locale tag: the digits as they are still say the number.
    return String(count);
  }
};

/** The Library's counts, and the key that says each one of it. */
const SINGULAR = {
  'library.trackCount': 'library.trackCountOne',
  'library.albumCount': 'library.albumCountOne',
  'library.artistCount': 'library.artistCountOne',
} as const;

/**
 * "1 album", never "1 albums": the singular from its own key, any other count
 * from the plural's. One key per form, as the playlists' "1 song" already
 * is, rather than a plural engine (`common/i18n`'s reason).
 */
export const countText = (
  t: Translate,
  key: keyof typeof SINGULAR,
  count: number,
): string => (count === 1 ? t(SINGULAR[key]) : t(key, { count }));

/**
 * How long a run of songs lasts, in the words a person says it: "38 min",
 * "2 h 14 min". Under a minute is "1 min" rather than nothing, because a list
 * that is there should not read as empty. Unknown lengths count as nothing.
 */
export const formatLength = (durationMs: number, t: Translate): string => {
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  if (minutes < 60) {
    return t('library.length.minutes', { minutes });
  }
  return t('library.length.hours', {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
};
