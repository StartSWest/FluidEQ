/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  LOCALES,
  loadLocale,
  translate,
  type TranslationKey,
} from '../../../common/i18n';
import { STARTER_CREDITS } from '../../../common/sceneStore';
import { termsValues } from '../../../renderer/account/PlusTermsDocument';

// Ivan, 2026-11-24: a new account starts with one free credit, not three
// (server 0119). The number is a constant, but the sentences around it are
// not: the welcome, the signed-out Scenes page, the tour and the terms say
// "your first scene", "claim it", "1 credit". These hold the copy to the
// number, so neither moves without the other.
beforeAll(() => Promise.all(LOCALES.map((locale) => loadLocale(locale.code))));

const codes = LOCALES.map((locale) => locale.code);

it('offers the one credit the server grants', () => {
  expect(STARTER_CREDITS).toBe(1);
});

it.each(codes)('the terms quote the starter credit by number in %s', (code) => {
  const said = translate(code, 'terms.credits.p2', termsValues(code));
  expect(said).toContain(String(STARTER_CREDITS));
  expect(said).not.toContain('{');
});

// The control: the number comes from the constant, not from the text.
it('fills the terms number from the constant, in the singular', () => {
  expect(translate('en', 'terms.credits.p2', {})).toContain('{starterCredits}');
  expect(translate('en', 'terms.credits.p2', termsValues('en'))).toContain(
    `gets ${STARTER_CREDITS} credit once`,
  );
});

/** The copy that names no number and is written for a single credit. */
const SINGULAR: TranslationKey[] = [
  'store.credits.getFree',
  'store.welcome.body',
  'store.welcome.claimedBody',
  'store.welcome.pick',
  'store.welcome.cardBody',
  'plus.signedOut.line',
  'plus.signedOut.account.body',
  'plus.signedOut.offerBody',
  'plus.signedOut.step.pick',
  'tour.plus.point1',
  'account.welcome.createTitle.one',
  'account.welcome.step.pick.one',
  'plus.signedOut.title.one',
];

/** What the copy said while there were three. */
const SEVERAL =
  /\b(free credits|starting credits|first scenes|first ones|claim them|scenes to keep|your (first )?\{count\} scenes?)\b/i;

it.each(SINGULAR)('speaks of one credit in English: %s', (key) => {
  expect(translate('en', key)).not.toMatch(SEVERAL);
});

// The control: the plural forms, shown for any other count, still match.
it('still tells several credits apart from one', () => {
  expect(translate('en', 'store.welcome.title.other')).toMatch(SEVERAL);
  expect(translate('en', 'plus.signedOut.title.other')).toMatch(/scenes/);
});

// The starter's own counted titles are read in the form the reader's
// language uses for STARTER_CREDITS, and each still carries the number or
// was written for exactly one.
it.each(codes)('fills every counted starter title in %s', (code) => {
  const category = new Intl.PluralRules(code).select(STARTER_CREDITS);
  const form = ['one', 'few', 'many'].includes(category) ? category : 'other';
  (
    [
      'store.welcome.title',
      'store.welcome.claimedTitle',
      'store.welcome.cardTitle',
      'store.welcome.cardClaimedTitle',
      'account.welcome.createLine',
      'account.google.doneInvite',
      'plus.signedOut.createSub',
      'plus.signedOut.offerTitle',
    ] as const
  ).forEach((stem) => {
    const said = translate(code, `${stem}.${form}` as TranslationKey, {
      count: String(STARTER_CREDITS),
    });
    expect(`${stem}: ${said}`).toContain(String(STARTER_CREDITS));
  });
});
