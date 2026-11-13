/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { LOCALES } from 'common/i18n';
import {
  readVersionNotes,
  VERSION_NOTE_LOCALES,
  type TVersionNoteLocale,
  type TVersionNotes,
} from 'common/sceneVersionNote';

/**
 * The "What's new" line in every language, as the publish dialog holds it
 * (Ivan, 2026-11-12: each listener reads it in their own; the chat writes
 * them, and "only if it can, otherwise it just [puts] it on all other
 * languages").
 *
 * `base` is the last set the chat wrote, or the lines the dialog settled on
 * after a translation; `lines` what the boxes hold now; `edited` the
 * languages the member typed in since `base`. A line the member typed is
 * never written over by a newer offer, and a change to the line the member
 * reads (theirs, or English) makes every language they did not type in out
 * of date until it is translated again.
 */
export type TNoteLines = Record<TVersionNoteLocale, string>;

export interface INoteLines {
  base: TNoteLines;
  lines: TNoteLines;
  edited: readonly TVersionNoteLocale[];
}

/** Every box filled from what the chat offered, empty where it wrote none. */
export const linesFrom = (
  offered: TVersionNotes | undefined,
  line?: string,
): TNoteLines => {
  const at = (locale: TVersionNoteLocale) => offered?.[locale] ?? '';
  return {
    en: at('en') || (line ?? ''),
    de: at('de'),
    es: at('es'),
    fr: at('fr'),
    hi: at('hi'),
    it: at('it'),
    ja: at('ja'),
    ko: at('ko'),
    pt: at('pt'),
    ru: at('ru'),
    zh: at('zh'),
    'zh-Hant': at('zh-Hant'),
  };
};

export const startLines = (
  offered: TVersionNotes | undefined,
  line?: string,
): INoteLines => {
  const lines = linesFrom(offered, line);
  return { base: lines, lines, edited: [] };
};

/** One box typed in. */
export const typeLine = (
  state: INoteLines,
  locale: TVersionNoteLocale,
  text: string,
): INoteLines => ({
  ...state,
  lines: { ...state.lines, [locale]: text },
  edited: state.edited.includes(locale)
    ? state.edited
    : [...state.edited, locale],
});

/**
 * A newer offer from the chat: it becomes the base, and fills every box the
 * member has not typed in.
 */
export const takeOffer = (state: INoteLines, offer: TNoteLines): INoteLines => {
  const lines = { ...offer };
  state.edited.forEach((locale) => {
    lines[locale] = state.lines[locale];
  });
  return { base: offer, lines, edited: state.edited };
};

/**
 * A translation the chat finished: its lines in every box but the ones the
 * member typed, whose words stay theirs, and the whole set settled as the
 * new base, so nothing reads as out of date any more.
 */
export const settleTranslation = (
  state: INoteLines,
  offer: TNoteLines,
): INoteLines => {
  const { lines } = takeOffer(state, offer);
  return { base: lines, lines, edited: [] };
};

const changed = (state: INoteLines, locale: TVersionNoteLocale) =>
  state.edited.includes(locale) &&
  state.lines[locale].trim() !== state.base[locale].trim();

/**
 * The line every other language follows: the member's own when they changed
 * it, else English when they changed that, else English as it stands.
 */
export const sourceOf = (
  state: INoteLines,
  mine: TVersionNoteLocale,
): TVersionNoteLocale => {
  if (changed(state, mine) && state.lines[mine].trim()) {
    return mine;
  }
  return 'en';
};

/**
 * The languages still to be written before the line goes out: empty ones,
 * and, once the member has changed the line they read, every one they did
 * not type in themselves.
 */
export const toTranslate = (
  state: INoteLines,
  mine: TVersionNoteLocale,
): TVersionNoteLocale[] => {
  const sourceChanged = changed(state, mine) || changed(state, 'en');
  const source = sourceOf(state, mine);
  return VERSION_NOTE_LOCALES.filter(
    (locale) =>
      locale !== source &&
      (!state.lines[locale].trim() ||
        (sourceChanged && !state.edited.includes(locale))),
  );
};

/** The lines as they go out, or undefined when there is no line at all. */
export const notesOf = (lines: TNoteLines): TVersionNotes | undefined =>
  readVersionNotes(lines) ?? undefined;

/**
 * What goes out when nothing translated it: every language still to be
 * written given the source line as written, the ones the member typed kept.
 */
export const asWritten = (
  state: INoteLines,
  mine: TVersionNoteLocale,
): TVersionNotes | undefined => {
  const source = state.lines[sourceOf(state, mine)];
  const lines = { ...state.lines };
  toTranslate(state, mine).forEach((locale) => {
    lines[locale] = source;
  });
  return notesOf(lines);
};

/** The language FluidEQ speaks, as a note's language, English otherwise. */
export const noteLocaleOf = (locale: string): TVersionNoteLocale =>
  VERSION_NOTE_LOCALES.find((known) => known === locale) ?? 'en';

/** A language's own name for itself, as the language menu shows it. */
export const languageName = (locale: TVersionNoteLocale): string =>
  LOCALES.find((entry) => entry.code === locale)?.name ?? locale;
