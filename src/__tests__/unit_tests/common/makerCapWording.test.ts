/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { LOCALES, loadLocale, translate } from '../../../common/i18n';
import type { TranslationKey } from '../../../common/i18n/en';

// Ivan, 2026-11-13: while makers earn credits, a scene earns at most 3 in all
// (fluideq-premium 0114), and the limit is removed when the marketplace
// opens. Every place that says a scene earns has to say the cap too, in
// every language, or a maker reads a promise the server does not keep.
const SAYS_THE_CAP: readonly TranslationKey[] = [
  'terms.scenes.p4',
  'terms.scenes.p4Payouts',
  'terms.sent.sceneGet.who',
  'terms.sent.sceneGet.whoPayouts',
  'plus.signedOut.studio.body',
];

beforeAll(async () => {
  await Promise.all(LOCALES.map(({ code }) => loadLocale(code)));
});

it('says the 3-credit cap wherever a scene earns, in every language', () => {
  LOCALES.forEach(({ code: locale }) => {
    SAYS_THE_CAP.forEach((key) => {
      expect([locale, key, translate(locale, key).includes('3')]).toEqual([
        locale,
        key,
        true,
      ]);
    });
  });
});

it('says, in English, that the limit lasts until the marketplace opens and then goes', () => {
  expect(translate('en', 'terms.scenes.p4')).toContain(
    'This limit is removed when the marketplace opens.',
  );
  expect(translate('en', 'plus.signedOut.studio.body')).toContain(
    'up to 3 credits per scene until the marketplace opens',
  );
});
