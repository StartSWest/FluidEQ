/* FluidEQ — GPL-3.0-or-later */

/**
 * The Share Audio group's header counts its computers in each language's own
 * plural. With nobody linked it read "1 computers": the label had one form,
 * and Russian dodged its three by writing "Компьютеров: 1".
 */

import {
  LOCALES,
  loadLocale,
  translate,
  type LocaleCode,
  type TranslationKey,
} from 'common/i18n';
import { pluralCategory } from 'renderer/utils/pluralCategory';

/** The header's words for `count` computers, as the group builds them. */
const header = (locale: LocaleCode, count: number) =>
  translate(
    locale,
    `remoteAudio.group.count.${pluralCategory(count, locale)}` as TranslationKey,
    { count: new Intl.NumberFormat(locale).format(count) },
  );

beforeAll(() => Promise.all(LOCALES.map(({ code }) => loadLocale(code))));

describe('the plural form a count takes', () => {
  it('follows each language’s own rule', () => {
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(2, 'en')).toBe('other');
    expect(pluralCategory(1, 'ru')).toBe('one');
    expect(pluralCategory(3, 'ru')).toBe('few');
    expect(pluralCategory(5, 'ru')).toBe('many');
    expect(pluralCategory(21, 'ru')).toBe('one');
    // A language with one form, and French, whose singular takes zero too.
    expect(pluralCategory(1, 'ja')).toBe('other');
    expect(pluralCategory(0, 'fr')).toBe('one');
  });
});

describe('the group header', () => {
  it('says one computer, two computers and five computers', () => {
    expect([1, 2, 5].map((count) => header('en', count))).toEqual([
      '1 computer',
      '2 computers',
      '5 computers',
    ]);
    expect([1, 2, 5].map((count) => header('ru', count))).toEqual([
      '1 компьютер',
      '2 компьютера',
      '5 компьютеров',
    ]);
    expect([1, 2, 5].map((count) => header('es', count))).toEqual([
      '1 equipo',
      '2 equipos',
      '5 equipos',
    ]);
  });

  // A form missing in a language is caught by i18n.test.ts, which holds
  // every dictionary to English's keys.
  it('writes the count into every form of every language', () => {
    LOCALES.forEach(({ code }) => {
      [1, 2, 3, 5, 21, 1_000_000].forEach((count) => {
        const words = header(code, count);
        expect(words).not.toContain('{count}');
        expect(words).toContain(new Intl.NumberFormat(code).format(count));
      });
    });
  });
});
