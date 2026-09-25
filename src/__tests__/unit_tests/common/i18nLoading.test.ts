/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Only English is part of the bundle; every other language is loaded when it
 * is first asked for (`loadLocale`). The nine others were 3.75 MB of each
 * process's script, parsed at every launch for languages nobody was reading.
 * A module is fresh per test file, so nothing here has been loaded before the
 * first assertion.
 */

import {
  isLocaleLoaded,
  loadLocale,
  LOCALES,
  translate,
} from '../../../common/i18n';

it('holds English alone until another language is asked for', () => {
  expect(isLocaleLoaded('en')).toBe(true);
  LOCALES.filter(({ code }) => code !== 'en').forEach(({ code }) => {
    expect(isLocaleLoaded(code)).toBe(false);
  });
  // A language not yet loaded answers in English, never with the key.
  expect(translate('es', 'graph.view.fullscreen')).toBe('Full screen');
});

it('answers in the language once it has loaded', async () => {
  await loadLocale('es');

  expect(isLocaleLoaded('es')).toBe(true);
  expect(translate('es', 'graph.view.fullscreen')).toBe('Pantalla completa');
  // Loading one language loads nothing else.
  expect(isLocaleLoaded('fr')).toBe(false);
});

it('shares one load between two asks for the same language', async () => {
  const first = loadLocale('fr');
  const second = loadLocale('fr');

  expect(second).toBe(first);
  await first;
  expect(isLocaleLoaded('fr')).toBe(true);
});
