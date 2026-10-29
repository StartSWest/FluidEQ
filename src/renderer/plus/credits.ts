/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Translate, TranslationKey } from 'common/i18n';
import { pluralCategory } from '../utils/pluralCategory';

/**
 * A number of credits in words, in the reader's own plural: "1 credit",
 * "2 credits", and Russian's "1 кредит", "3 кредита", "5 кредитов". Every
 * other count in the app gets by on one-or-many keys and phrasing around the
 * number; a price is said too often, and too close to money, to read wrong.
 * The form is `pluralCategory`'s.
 */

/** "{count} credits", the count written in the reader's digits. */
export const creditsText = (t: Translate, locale: string, count: number) =>
  t(`store.credit.${pluralCategory(count, locale)}` as TranslationKey, {
    count: new Intl.NumberFormat(locale).format(count),
  });

/** The word alone, for under a figure drawn large: "credits". */
export const creditsUnit = (t: Translate, locale: string, count: number) =>
  t(`store.credits.unit.${pluralCategory(count, locale)}` as TranslationKey);
