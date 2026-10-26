/* FluidEQ — GPL-3.0-or-later */

/** The plural forms a counted phrase is written in, one key each. */
export type TPluralCategory = 'one' | 'few' | 'many' | 'other';

/**
 * Which of a counted phrase's forms the reader's language uses for `count`:
 * "1 computer", "2 computers", and Russian's "1 компьютер", "3 компьютера",
 * "5 компьютеров".
 *
 * The CLDR categories `Intl.PluralRules` answers with. Every locale writes
 * all four keys of a set, because a key missing in one falls back to
 * English rather than to that language's other form. `zero` and `two` belong
 * to languages FluidEQ does not ship, and read as `other`.
 */
export const pluralCategory = (
  count: number,
  locale: string,
): TPluralCategory => {
  const category = new Intl.PluralRules(locale).select(count);
  return category === 'one' || category === 'few' || category === 'many'
    ? category
    : 'other';
};
