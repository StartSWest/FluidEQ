/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { LOCALES, loadLocale, translate } from 'common/i18n';
import { STARTER_CREDITS } from 'common/sceneStore';

// Help and the support dialog are prose, so nothing reads the number or the
// edition from code: these hold them to what the app does. A new account
// starts with STARTER_CREDITS (the signed-out Scenes page and the welcome say
// it), and since 2.5 every build is signed and free, so nothing of FluidEQ
// itself is sold.
beforeAll(() => Promise.all(LOCALES.map((locale) => loadLocale(locale.code))));

const codes = LOCALES.map((locale) => locale.code);

it.each(codes)('Help names the starter credits by number in %s', (locale) => {
  expect(translate(locale, 'help.plus.intro')).toContain(
    String(STARTER_CREDITS),
  );
});

// The control: each chapter read is the locale's own, not English filling in.
it.each(codes.filter((code) => code !== 'en'))(
  'reads the chapter in %s from its own words',
  (locale) => {
    expect(translate(locale, 'help.plus.intro')).not.toBe(
      translate('en', 'help.plus.intro'),
    );
  },
);

it('says nothing of a sold build in the support pitch', () => {
  const pitch = translate('en', 'support.pitch');
  expect(pitch).toContain('free for everyone');
  expect(pitch).not.toMatch(/what is sold|ready-to-run build/i);
});
