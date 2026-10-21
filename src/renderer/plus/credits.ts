/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate, TranslationKey } from 'common/i18n';

/**
 * A number of credits in words, in the reader's own plural: "1 credit",
 * "2 credits", and Russian's "1 кредит", "3 кредита", "5 кредитов". Every
 * other count in the app gets by on one-or-many keys and phrasing around the
 * number; a price is said too often, and too close to money, to read wrong.
 *
 * The categories are the CLDR ones `Intl.PluralRules` answers with, and every
 * locale writes all four keys of each set — a key missing in one falls back
 * to English, not to that language's other form.
 */

type TCategory = 'one' | 'few' | 'many' | 'other';

const categoryOf = (count: number, locale: string): TCategory => {
  const category = new Intl.PluralRules(locale).select(count);
  return category === 'one' || category === 'few' || category === 'many'
    ? category
    : 'other';
};

/** "{count} credits", the count written in the reader's digits. */
export const creditsText = (t: Translate, locale: string, count: number) =>
  t(`store.credit.${categoryOf(count, locale)}` as TranslationKey, {
    count: new Intl.NumberFormat(locale).format(count),
  });

/** The word alone, for under a figure drawn large: "credits". */
export const creditsUnit = (t: Translate, locale: string, count: number) =>
  t(`store.credits.unit.${categoryOf(count, locale)}` as TranslationKey);
