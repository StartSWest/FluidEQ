/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  HELP_CHAPTERS,
  isLiveFigure,
  type HelpChapterId,
} from 'common/helpGuide';
import {
  LOCALES,
  loadLocale,
  translate,
  type TranslationKey,
} from 'common/i18n';
import { DSP_PLAYBACK_SECTIONS, DSP_SECTIONS } from 'renderer/dsp/sections';
import { buildHelpIndex, searchHelp } from 'renderer/help/helpSearch';

/**
 * Help once showed a DSP rail from before Dynamics and De-esser and could
 * name a feature without explaining how to use it. Keep the visible workflow
 * covered, and let readers find its detailed guide by the label they see.
 */
const DETAILS: readonly [HelpChapterId, TranslationKey][] = [
  ['dynamics', 'dsp.dynamics.title'],
  ['deesser', 'dsp.deEsser.title'],
  ['normalizer', 'dsp.normalizer.title'],
  ['crossfade', 'dsp.crossfade.title'],
  ['gamefilter', 'dsp.footsteps.title'],
  ['songs', 'songSound.switch'],
  ['mycurves', 'myCurves.tab.mine'],
];

beforeAll(() => Promise.all(LOCALES.map(({ code }) => loadLocale(code))));

it('explains every stage and playback option visible in the DSP rail', () => {
  const overview = HELP_CHAPTERS.find(({ id }) => id === 'dsp');
  const drawing = overview?.figures.find(
    (figure) => isLiveFigure(figure) && figure.live === 'dsp-overview',
  );
  expect(drawing && isLiveFigure(drawing)).toBe(true);
  const named = drawing?.controls?.map(({ name }) => name) ?? [];
  expect(
    [...DSP_SECTIONS, ...DSP_PLAYBACK_SECTIONS]
      .filter(({ labelKey }) => !named.includes(labelKey))
      .map(({ id }) => id),
  ).toEqual([]);
});

it.each(LOCALES.map(({ code }) => code))(
  'finds detailed instructions from the actual controls in %s',
  (locale) => {
    const index = buildHelpIndex(HELP_CHAPTERS, locale);
    [...DETAILS, ['library', 'library.browse.playlist'] as const].forEach(
      ([id, label]) => {
        const query = translate(locale, label);
        expect({
          locale,
          query,
          found: searchHelp(index, query)
            ?.hits.slice(0, 3)
            .some(({ chapterId }) => chapterId === id),
        }).toEqual({ locale, query, found: true });
      },
    );
  },
);

it.each(LOCALES.map(({ code }) => code))(
  'ships complete how-to chapters in %s',
  (locale) => {
    DETAILS.forEach(([id]) => {
      expect(HELP_CHAPTERS.some((chapter) => chapter.id === id)).toBe(true);
      const fields = ['title', 'intro', 'steps', 'tip'] as const;
      fields.forEach((field) => {
        const key = `help.${id}.${field}` as TranslationKey;
        const text = translate(locale, key);
        expect(text).not.toBe(key);
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/\{[A-Z_]+\}/);
      });
      const steps = translate(locale, `help.${id}.steps` as TranslationKey);
      expect(steps.split('\n').length).toBeGreaterThanOrEqual(5);
    });
  },
);

it.each(LOCALES.filter(({ code }) => code !== 'en').map(({ code }) => code))(
  'translates the detailed instructions in %s instead of falling back to English',
  (locale) => {
    DETAILS.forEach(([id]) => {
      (['title', 'intro', 'steps', 'tip'] as const).forEach((field) => {
        const key = `help.${id}.${field}` as TranslationKey;
        expect(translate(locale, key)).not.toBe(translate('en', key));
      });
    });
  },
);
