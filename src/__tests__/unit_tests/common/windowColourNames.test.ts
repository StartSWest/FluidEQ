/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The Window colours menu names three colours a scene lends the window -
 * surface, accent, glow - beside the Brightness slider and the Tint, and no
 * two of them may answer to one word. In Spanish the Glow role and the
 * Brightness slider were both "Brillo" in the same menu (5cebe7d82: the role
 * is "Resplandor"), and Portuguese ("Brilho") and Hindi ("चमक") had the
 * same clash.
 */

import {
  loadLocale,
  LOCALES,
  translate,
  type TranslationKey,
} from 'common/i18n';

const codes = LOCALES.map(({ code }) => code);

beforeAll(() => Promise.all(codes.map((code) => loadLocale(code))));

/** What the one menu shows by name, side by side. */
const IN_ONE_MENU: TranslationKey[] = [
  'graph.sceneTint.brightness',
  'graph.windowTint',
  'graph.sceneColours.surface',
  'graph.sceneColours.accent',
  'graph.sceneColours.glow',
];

/** The names that answer to the same word in `names`, if any. */
const clashes = (names: readonly string[]) =>
  names.filter(
    (name, index) =>
      names.findIndex(
        (other) => other.toLocaleLowerCase() === name.toLocaleLowerCase(),
      ) !== index,
  );

it('calls the glow in Spanish Resplandor, and its line says so', () => {
  expect(translate('es', 'graph.sceneColours.glow')).toBe('Resplandor');
  expect(translate('es', 'graph.sceneColours.glowAbout')).toBe(
    '«Activado» y el resplandor',
  );
  expect(translate('es', 'graph.sceneTint.brightness')).toBe('Brillo');
});

it.each(codes)(
  'gives every name in the Window colours menu a word of its own in %s',
  (code) => {
    expect(clashes(IN_ONE_MENU.map((key) => translate(code, key)))).toEqual([]);
  },
);

it('would notice two names on one word (the control)', () => {
  expect(clashes(['Brillo', 'Tono', 'brillo'])).toEqual(['brillo']);
});
