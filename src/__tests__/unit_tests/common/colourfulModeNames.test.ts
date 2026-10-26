/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * RAINBOW MODE IS COLOURFUL MODE, IN EVERY LANGUAGE, BY THE NAMES IVAN GAVE
 * (2026-10-25: "also change all ui that says rainbow to colorful mode"). The
 * keys keep their old names; what they say on screen is pinned here, and no
 * string the mode's switch, its pill, the Look designer or the Support card
 * shows may name a rainbow again.
 */

import {
  loadLocale,
  LOCALES,
  translate,
  type LocaleCode,
  type TranslationKey,
} from 'common/i18n';

const NAMES: Record<LocaleCode, string> = {
  en: 'Colourful mode',
  es: 'Modo colorido',
  pt: 'Modo colorido',
  de: 'Bunter Modus',
  fr: 'Mode coloré',
  it: 'Modalità colorata',
  ru: 'Цветной режим',
  ja: 'カラフルモード',
  zh: '多彩模式',
  hi: 'रंगीन मोड',
};

/** The one word the meter's pill and the Look designer's heading show. */
const WORDS: Record<LocaleCode, string> = {
  en: 'Colourful',
  es: 'Colorido',
  pt: 'Colorido',
  de: 'Bunt',
  fr: 'Coloré',
  it: 'Colorata',
  ru: 'Цветной',
  ja: 'カラフル',
  zh: '多彩',
  hi: 'रंगीन',
};

/** Each language's rainbow, as its strings used to write it. */
const RAINBOW =
  /rainbow|arco[íi]ris|arco-íris|regenbogen|arc-en-ciel|arcobaleno|радуг|радуж|レインボー|虹|इंद्रधनुष/i;

const SHOWN: TranslationKey[] = [
  'graph.sceneTint.rainbow',
  'graph.sceneTint.rainbowHint',
  'waveform.rainbow',
  'look.rainbow',
  'look.needsRainbow',
  'look.rainbowBorder',
  'look.rainbowBorderHint',
  'support.game.shareEuphoria',
];

const codes = LOCALES.map((locale) => locale.code);

beforeAll(() => Promise.all(codes.map((code) => loadLocale(code))));

describe('Colourful mode’s name', () => {
  it('covers all ten languages', () => {
    expect([...codes].sort()).toEqual(Object.keys(NAMES).sort());
  });

  it.each(codes)('is Ivan’s in %s', (code) => {
    expect(translate(code, 'graph.sceneTint.rainbow')).toBe(NAMES[code]);
    expect(translate(code, 'waveform.rainbow')).toBe(WORDS[code]);
    expect(translate(code, 'look.rainbow')).toBe(WORDS[code]);
  });

  it.each(codes)('names no rainbow anywhere the mode shows, in %s', (code) => {
    SHOWN.forEach((key) => {
      expect(translate(code, key)).not.toMatch(RAINBOW);
    });
  });

  it.each(codes)('finds the window’s Help page by it, in %s', (code) => {
    // Searched for by the name on its switch; the old word stays beside it
    // in the keywords for anybody who still remembers it.
    expect(translate(code, 'help.window.keywords')).toMatch(
      new RegExp(NAMES[code].toLowerCase()),
    );
  });
});
