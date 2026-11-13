/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a maker writes about a version of a scene when they publish it — "the
 * mountains are no longer cut on wide panels" — and how long a version counts
 * as new to everybody else.
 *
 * NO IMPORTS, on purpose: the publishing function vendors this file into Deno
 * as it is, so the note the Studio lets through and the note the server keeps
 * are cleaned by the same bytes.
 */

/**
 * Characters, as a text field counts them.
 *
 * Was 140 — one line, an old tweet's worth — and the line a maker's AI writes
 * about what it changed kept running into it, so a real answer had to be cut
 * to a headline. Two hundred and eighty holds two sentences, which is what
 * "the mountains are no longer cut on wide panels, and the fog is off the
 * music" actually takes. Nothing breaks at that length: the look picker
 * truncates this line with an ellipsis, and the versions list wraps it.
 */
export const MAX_VERSION_NOTE = 280;

/** A version is shown as new to listeners for this long after it is published. */
export const NEW_VERSION_DAYS = 7;

/**
 * A scene's content may only change under a HIGHER version number.
 *
 * Without this a maker could publish again under the version everybody
 * already had, and every listener who installed it would quietly be given
 * different code: the update notice never fires, the versions page shows
 * nothing new, and the number a listener would use to say what they are
 * running names two different scenes. It is the same shape of hole as
 * unsigned content, one level up — the signature says who wrote it, the
 * version says which one it is.
 *
 * Read `held` as "what is already there": the gallery's row when publishing,
 * the installed copy when a listener is offered an update. Undefined is
 * nothing there yet, which anything may fill. A version that is not a whole
 * number is refused rather than compared, so a manifest carrying text or NaN
 * fails closed instead of comparing false against everything.
 */
export const isLaterSceneVersion = (
  version: unknown,
  held?: number,
): boolean => {
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return false;
  }
  return held === undefined || !Number.isInteger(held) || version > held;
};

/**
 * The version a publication goes out under: one above the one the gallery
 * holds, and 1 for a scene's first. The number counts the versions people
 * see in the gallery (Ivan, 2026-11-09: "Only when publishing"), so it moves
 * only here, and never by more than one: whatever the project's own file
 * says is not asked. A maker's AI used to raise it for every change it was
 * asked for, and a scene the gallery had at v10 went out as v23.
 *
 * The Studio sets it for them. Asking a maker to hand-edit a number in a
 * file before every publication is how the rule above turns into a wall —
 * they would meet it as a refusal with no way forward, on a press that has
 * already drawn a cover and written a note.
 */
export const versionToPublish = (held?: number): number =>
  held !== undefined && Number.isInteger(held) && held >= 1 ? held + 1 : 1;

/**
 * Control, zero-width, joiner, direction, filler, blank and tag characters,
 * built from code points: none of them draws anything, and each can hide text
 * or turn the line around it backwards.
 */
const NOTE_INVISIBLE = new RegExp(
  `[${[
    [0x00, 0x1f],
    [0x7f, 0x9f],
    [0xad, 0xad],
    [0x34f, 0x34f],
    [0x61c, 0x61c],
    [0x115f, 0x1160],
    [0x180e, 0x180e],
    [0x200b, 0x200f],
    [0x2028, 0x202e],
    [0x2060, 0x206f],
    [0x2800, 0x2800],
    [0x3164, 0x3164],
    [0xfe00, 0xfe0f],
    [0xfeff, 0xfeff],
    [0xffa0, 0xffa0],
  ]
    .map(
      ([from, to]) =>
        `\\u${from.toString(16).padStart(4, '0')}-\\u${to
          .toString(16)
          .padStart(4, '0')}`,
    )
    .join('')}\\u{e0000}-\\u{e007f}]`,
  'gu',
);

/**
 * A line as it is kept and shown: one line, invisible characters gone,
 * spaces collapsed. Null for no line — nothing sent, or nothing left once
 * cleaned. Undefined for one that cannot be kept: not text, or longer than
 * `max`, which is refused whole and never cut.
 */
function readLineUpTo(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  // Whitespace becomes a space before the invisible characters go: a line
  // break or a tab is one of those, and removed first it glued the words on
  // either side of it together.
  const cleaned = value
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(NOTE_INVISIBLE, '')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (cleaned.length === 0) {
    return null;
  }
  return cleaned.length <= max ? cleaned : undefined;
}

/** A version's note as it is kept and shown (`readLineUpTo`). */
export const readVersionNote = (value: unknown): string | null | undefined =>
  readLineUpTo(value, MAX_VERSION_NOTE);

/**
 * Every language the note is written in, FluidEQ's own (`LocaleCode`; this
 * file imports nothing, so `sceneVersionNote.test.ts` holds the two lists
 * together). English is the one every reader falls back to.
 */
export const VERSION_NOTE_LOCALES = [
  'en',
  'de',
  'es',
  'fr',
  'hi',
  'it',
  'ja',
  'ko',
  'pt',
  'ru',
  'zh',
  'zh-Hant',
] as const;

export type TVersionNoteLocale = (typeof VERSION_NOTE_LOCALES)[number];

/** A version's note in each language it was written in, English always. */
export type TVersionNotes = Partial<Record<TVersionNoteLocale, string>> & {
  en: string;
};

const isNoteLocale = (key: string): key is TVersionNoteLocale =>
  (VERSION_NOTE_LOCALES as readonly string[]).includes(key);

/**
 * The note in every language, each line cleaned as `readVersionNote` cleans
 * one (Ivan, 2026-11-12: the line in all twelve languages, a listener
 * reading their own). Null for no note: nothing sent, or no English line
 * left once cleaned, since English is what every reader falls back to. A
 * line that cleans to nothing is dropped. Undefined for notes that cannot
 * be kept: not a plain object, a key that names no language, or any line
 * that is not text or is too long - refused whole, never half kept.
 */
function readLinesUpTo(
  value: unknown,
  max: number,
): TVersionNotes | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const lines = Object.entries(value).map(
    ([key, line]) => [key, readLineUpTo(line, max)] as const,
  );
  if (lines.some(([key, line]) => !isNoteLocale(key) || line === undefined)) {
    return undefined;
  }
  const kept: Partial<Record<TVersionNoteLocale, string>> = {};
  lines.forEach(([key, line]) => {
    if (isNoteLocale(key) && typeof line === 'string') {
      kept[key] = line;
    }
  });
  const { en } = kept;
  return en === undefined ? null : { ...kept, en };
}

/** A version's note in every language (`readLinesUpTo`). */
export const readVersionNotes = (
  value: unknown,
): TVersionNotes | null | undefined => readLinesUpTo(value, MAX_VERSION_NOTE);

/** The same line in every language: what goes out when nothing translated it. */
export const notesAsWritten = (line: string): TVersionNotes => {
  const all: Partial<Record<TVersionNoteLocale, string>> = {};
  VERSION_NOTE_LOCALES.forEach((locale) => {
    all[locale] = line;
  });
  return { ...all, en: line };
};

/** The note a reader sees: their language's line, or English. */
export const noteIn = (notes: TVersionNotes, locale: string): string =>
  (isNoteLocale(locale) ? notes[locale] : undefined) ?? notes.en;

/**
 * The admin's line to a maker whose scene was declined, in each language
 * (Ivan, 2026-11-13: "rejection notes need to be written completely ... and
 * be written in all languages so when they see them they will see them in
 * their app language"). Longer than a version's note: it names every
 * problem the review found, with what to change, and a version note's 280
 * cut the reviewer's line in half. Never cut: a longer line is refused, and
 * whoever writes one is told this limit.
 */
export const MAX_REVIEW_NOTE = 1000;

/** The declined scene's line in every language (`readLinesUpTo`). */
export const readReviewNotes = (
  value: unknown,
): TVersionNotes | null | undefined => readLinesUpTo(value, MAX_REVIEW_NOTE);

/**
 * The line an app before 2.5.2 is told, which shows the one line it reads
 * only when it fits a version's note: the leading whole sentences of
 * `line` that fit, never a sentence cut in two. Null when even the first
 * does not fit; the maker then reads the reason alone, as with no line.
 */
export const wholeSentencesUpTo = (
  line: string,
  max: number = MAX_VERSION_NOTE,
): string | null => {
  if (line.length <= max) {
    return line;
  }
  // A sentence ends at a full stop, a question or an exclamation followed by
  // a space (so "1.5 dB" and "0:13." in a time are not ends), or at a CJK
  // one, which takes no space after it.
  let end = 0;
  Array.from(line.matchAll(/[.!?]+(?=\s)|[。！？]+/gu)).forEach((match) => {
    const after = (match.index ?? 0) + match[0].length;
    if (after <= max) {
      end = after;
    }
  });
  return end > 0 ? line.slice(0, end) : null;
};

/**
 * Whether a scene's current version is new to somebody opening the gallery
 * now: it is not the first version the scene was published at, and it was
 * published within `NEW_VERSION_DAYS`.
 */
/**
 * Whether the scene itself first went out within the last week: the "New"
 * the gallery's card wears, ahead of "New version", and what the week's new
 * scenes are made of on the server. Only from the server's own first-publish
 * time; a scene it keeps none for is never called new.
 */
export const isNewScene = (
  scene: { firstPublishedAt?: string | null },
  now: number,
): boolean => {
  const first = scene.firstPublishedAt
    ? Date.parse(scene.firstPublishedAt)
    : NaN;
  return (
    Number.isFinite(first) &&
    now - first <= NEW_VERSION_DAYS * 24 * 60 * 60 * 1000
  );
};

export const isNewSceneVersion = (
  scene: { version: number; firstVersion?: number; updatedAt: string },
  now: number,
): boolean => {
  const published = Date.parse(scene.updatedAt);
  return (
    scene.firstVersion !== undefined &&
    scene.version > scene.firstVersion &&
    Number.isFinite(published) &&
    now - published <= NEW_VERSION_DAYS * 24 * 60 * 60 * 1000
  );
};
