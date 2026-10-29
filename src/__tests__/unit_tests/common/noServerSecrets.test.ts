/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  loadLocale,
  LOCALES,
  translate,
  type TranslationKey,
} from '../../../common/i18n';
import en from '../../../common/i18n/en';

/**
 * Every line of every dictionary the app ships: a server secret's name
 * anywhere in them is in every member's copy of the app.
 */
describe('the dictionaries the app ships', () => {
  it('name no server secret in any language', async () => {
    await Promise.all(LOCALES.map(({ code }) => loadLocale(code)));
    const keys = Object.keys(en) as TranslationKey[];
    const naming = LOCALES.flatMap(({ code }) =>
      keys
        .map((key) => translate(code, key))
        .filter((line) =>
          /USAGE_ACCESS_TOKEN|SERVICE_ROLE|Edge Functions → Secrets/.test(line),
        ),
    );
    expect(naming).toEqual([]);
    // The positive control: the languages were loaded, so every one was read.
    expect(translate('de', 'app.dismiss')).not.toBe(
      translate('en', 'app.dismiss'),
    );
  });
});
