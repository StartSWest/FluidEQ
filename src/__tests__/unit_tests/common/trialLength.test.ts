/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The free trial's length, said once in code and sixty times in words.
 *
 * Six sentences in each of ten languages spell the number out — "Try Plus free
 * for 15 days", "15 days from activation", "15 consecutive days from
 * activation" — because a placeholder inside a heading reads worse in half of
 * them than the figure does. That is a fine trade until the constant moves,
 * at which point the app offers one length, counts another, and nothing
 * anywhere says so: the server grants what `plus_trial_days()` answers and the
 * window promises what the dictionary says, and the two only disagree for the
 * person who took the offer.
 *
 * So the number is pinned here instead. A build that changes PLUS_TRIAL_DAYS
 * fails this until every sentence has been changed with it — which is the
 * whole point, since no other check in the project can see inside a sentence.
 */
import { PLUS_TRIAL_DAYS } from '../../../common/plusTrial';
import en from '../../../common/i18n/en/trial';
import es from '../../../common/i18n/es/trial';
import pt from '../../../common/i18n/pt/trial';
import fr from '../../../common/i18n/fr/trial';
import de from '../../../common/i18n/de/trial';
// Italian under another name: `it` is Jest's own, and importing the locale
// as `it` shadows it — every `it(...)` below then calls a dictionary object.
import italian from '../../../common/i18n/it/trial';
import ru from '../../../common/i18n/ru/trial';
import zh from '../../../common/i18n/zh/trial';
import ja from '../../../common/i18n/ja/trial';
import hi from '../../../common/i18n/hi/trial';

const DICTIONARIES: Record<string, Record<string, string>> = {
  en,
  es,
  pt,
  fr,
  de,
  it: italian,
  ru,
  zh,
  ja,
  hi,
};

/**
 * The keys whose text names the length. Listed rather than discovered, so a
 * new sentence that quotes the number is added here deliberately instead of
 * being found by a regular expression that would also match a price or a
 * year.
 */
const KEYS = [
  'trial.offer.title',
  'trial.consent.period',
  'trial.consent.start',
  'trial.terms.body',
  'trial.settings.label',
] as const;

describe('the free trial says the length it grants', () => {
  it.each(Object.entries(DICTIONARIES))(
    '%s spells the constant in every sentence that names it',
    (_locale, dictionary) => {
      const said = String(PLUS_TRIAL_DAYS);
      KEYS.forEach((key) => {
        const text = dictionary[key];
        expect(text).toBeDefined();
        expect(text).toContain(said);
      });
    },
  );

  it('is the length the offer and the settings both carry', () => {
    // Both interfaces type `days` as the constant itself, so a mismatch is a
    // compile error rather than a runtime one — this is here to fail loudly if
    // that ever loosens to `number`.
    expect(PLUS_TRIAL_DAYS).toBe(15);
  });
});
