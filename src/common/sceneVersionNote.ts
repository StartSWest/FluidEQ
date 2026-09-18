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
 * The version a publication has to go out under: always above the one the
 * gallery holds, and never below where the maker has already taken it.
 *
 * The Studio raises it for them. Asking a maker to hand-edit a number in a
 * file before every publication is how the rule above turns into a wall —
 * they would meet it as a refusal with no way forward, on a press that has
 * already drawn a cover and written a note.
 */
export const versionToPublish = (local: unknown, held?: number): number => {
  const from = typeof local === 'number' && Number.isInteger(local) ? local : 1;
  return held !== undefined && Number.isInteger(held)
    ? Math.max(from, held + 1)
    : from;
};

/**
 * Control, zero-width, joiner, direction, filler, blank and tag characters,
 * built from code points: none of them draws anything, and each can hide text
 * or turn the line around it backwards.
 */
const INVISIBLE = new RegExp(
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
 * The note as it is kept and shown: one line, invisible characters gone,
 * spaces collapsed. Null for no note — nothing sent, or nothing left once
 * cleaned. Undefined for one that cannot be kept: not text, or too long.
 */
export const readVersionNote = (value: unknown): string | null | undefined => {
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
    .replace(INVISIBLE, '')
    .replace(/ {2,}/g, ' ')
    .trim();
  if (cleaned.length === 0) {
    return null;
  }
  return cleaned.length <= MAX_VERSION_NOTE ? cleaned : undefined;
};

/**
 * Whether a scene's current version is new to somebody opening the gallery
 * now: it is not the first version the scene was published at, and it was
 * published within `NEW_VERSION_DAYS`.
 */
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
