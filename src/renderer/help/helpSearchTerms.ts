/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { HelpChapterId } from 'common/helpGuide';
import en, { type TranslationKey } from 'common/i18n/en';

/**
 * The app's own names for what a chapter covers where the chapter's text does
 * not spell them out. The guide explains the DSP rack without listing its
 * stages, so a search for a stage by the name on its card found nothing; the
 * same went for every style, room, chain and filter shape.
 *
 * They are searched and never shown, and they are the labels themselves, so
 * they read right in every language, and a stage, style or chain added later
 * joins its chapter without anyone remembering to: each family is a pattern
 * over the dictionary's keys for exactly that reason. `control` is the
 * control on the chapter's capture where those names are chosen — a found
 * name is quoted under it and the article goes to it. A name that is itself a
 * control's name goes to that control.
 */
interface ITermFamily {
  readonly keys: RegExp;
  readonly control?: TranslationKey;
}

const CHAINS = /^dsp\.(preset|eqPreset)\.[a-zA-Z0-9]+$/;

const FAMILIES: Partial<Record<HelpChapterId, readonly ITermFamily[]>> = {
  eq: [
    { keys: /^dsp\.eq\.type\.[a-zA-Z]+$/, control: 'eq.filter' },
    { keys: CHAINS, control: 'dsp.presets' },
  ],
  dsp: [
    { keys: /^dsp\.[a-zA-Z]+\.title$/ },
    { keys: CHAINS, control: 'dsp.presets' },
    { keys: /^dsp\.masterPreset\.[a-zA-Z0-9]+$/, control: 'dsp.master.title' },
  ],
  room: [
    {
      keys: /^dsp\.room\.(preset|profile)\.[a-zA-Z0-9]+$/,
      control: 'dsp.room.presets',
    },
  ],
  looks: [
    {
      keys: /^graph\.styleName\.[a-zA-Z0-9]+$/,
      control: 'graph.picker.styles',
    },
  ],
  games: [{ keys: /^games\.source\.[a-zA-Z]+$/, control: 'games.add' }],
  lighting: [
    { keys: /^lighting\.effect\.[a-zA-Z]+$/, control: 'lighting.tuning.title' },
  ],
  gallery: [
    {
      keys: /^plus\.category\.[a-zA-Z]+$/,
      control: 'help.gallery.categoriesName',
    },
  ],
};

export interface IHelpSearchTerm {
  readonly key: TranslationKey;
  /** The control it belongs to, if the chapter shows one. */
  readonly control?: TranslationKey;
}

const isKey = (key: string): key is TranslationKey => key in en;

const KEYS = Object.keys(en).filter(isKey);

// The same in every language, so looked up once however often the guide is
// read again in another one.
const found = new Map<HelpChapterId, readonly IHelpSearchTerm[]>();

/** The labels a chapter answers to besides its own text. */
export const helpSearchTerms = (
  id: HelpChapterId,
): readonly IHelpSearchTerm[] => {
  const known = found.get(id);
  if (known) {
    return known;
  }
  const terms = (FAMILIES[id] ?? []).flatMap(({ keys, control }) =>
    KEYS.filter((key) => keys.test(key)).map((key) => ({ key, control })),
  );
  found.set(id, terms);
  return terms;
};
