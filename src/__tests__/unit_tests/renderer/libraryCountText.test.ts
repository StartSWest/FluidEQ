/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The Library's counts say one thing in the singular: the record header read
 * "1 albums" and "1 songs" while the playlists already said "1 song". The
 * singular is its own key in every language, read for exactly one.
 */

import {
  LOCALES,
  loadLocale,
  translate,
  type LocaleCode,
  type Translate,
} from 'common/i18n';
import { countText } from 'renderer/library/libraryFormat';

const KEYS = [
  'library.trackCount',
  'library.albumCount',
  'library.artistCount',
] as const;

const translatorFor =
  (locale: LocaleCode): Translate =>
  (key, vars) =>
    translate(locale, key, vars);

beforeAll(() => Promise.all(LOCALES.map(({ code }) => loadLocale(code))));

describe('a Library count', () => {
  it('says one song, one album and one artist in the singular', () => {
    const t = translatorFor('en');
    expect(countText(t, 'library.trackCount', 1)).toBe('1 song');
    expect(countText(t, 'library.albumCount', 1)).toBe('1 album');
    expect(countText(t, 'library.artistCount', 1)).toBe('1 artist');
  });

  it('says every other count in the plural, nothing included', () => {
    const t = translatorFor('en');
    expect(countText(t, 'library.trackCount', 2)).toBe('2 songs');
    expect(countText(t, 'library.albumCount', 0)).toBe('0 albums');
    expect(countText(t, 'library.artistCount', 14)).toBe('14 artists');
  });

  it('reads the singular’s own words wherever a language has them', () => {
    // Languages whose noun takes the count unchanged (Japanese, Chinese,
    // Korean) say the same either way; these four do not, so the plural's
    // words for one would be wrong in each of them.
    (['es', 'de', 'ru', 'pt'] as const).forEach((code) => {
      const t = translatorFor(code);
      KEYS.forEach((key) => {
        expect(countText(t, key, 1)).not.toBe(t(key, { count: 1 }));
      });
    });
    LOCALES.forEach(({ code }) => {
      const t = translatorFor(code);
      KEYS.forEach((key) => {
        expect(countText(t, key, 1)).not.toContain('{count}');
      });
    });
  });
});
