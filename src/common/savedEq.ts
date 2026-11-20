/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ISongSound, sameSongSound, toSongSound } from './songSound';

/**
 * A saved EQ (Ivan, 2026-11-20: "if user has a nice EQ I want them to save it
 * in Auto EQ"; the mockup approved with its recommendations the same day): the
 * listener's own bands and Tone, and the preset with them unless they left it
 * out, kept under a name in Auto EQ's store (`savedEqStore.ts`). It is the
 * same shape as a song's saved sound (`ISongSound`), so it plays the same way:
 * it is Your EQ and the Tone, never a layer over them, which is what tells it
 * apart from an own preset (a curve and a rack added on top of Your EQ). An
 * empty `presetId` is a sound saved without its preset, which plays over
 * whatever preset is on, as a song's sound with an unnamed rack already does.
 *
 * Songs and albums given one keep a link to it (`IEqLink`) and follow it:
 * Update changes every song on it, and deleting it leaves each song the sound
 * it had as its own.
 */
export interface ISavedEq {
  id: string;
  name: string;
  sound: ISongSound;
  updatedAt: number;
}

/** A song or an album that plays a saved EQ, and follows it. */
export interface IEqLink {
  eqId: string;
}

/** Names as the field takes them; the list is short enough to read. */
export const SAVED_EQ_NAME_MAX = 64;
export const SAVED_EQ_MAX = 200;

const ID_PATTERN = /^eq-[0-9a-z-]{1,60}$/;

export const isSavedEqId = (value: unknown): value is string =>
  typeof value === 'string' && ID_PATTERN.test(value);

export const isEqLink = (value: unknown): value is IEqLink =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  isSavedEqId((value as Record<string, unknown>).eqId);

/** A link as stored or sent: the id alone, nothing beside it. */
export const toEqLink = (value: unknown): IEqLink | undefined =>
  isEqLink(value) ? { eqId: value.eqId } : undefined;

/** A name as it is kept: trimmed, one line, no longer than the field. */
export const cleanSavedEqName = (name: string): string =>
  Array.from(name, (char) => {
    // Control characters would print as nothing and still make two names
    // that look alike different ones.
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SAVED_EQ_NAME_MAX)
    .trim();

const NUMBERED = / \((\d+)\)$/;

/**
 * A name none of `taken` has, compared without case: the name itself, or the
 * first free "Name (2)", "Name (3)"… — the rule own presets and saved rooms
 * follow (`uniqueUserPresetName`), numbered from the stem so a copy of
 * "Night (2)" is "Night (3)".
 */
export const uniqueSavedEqName = (
  name: string,
  taken: readonly string[],
): string => {
  const clean = cleanSavedEqName(name);
  const used = new Set(taken.map((one) => one.trim().toLowerCase()));
  if (clean === '' || !used.has(clean.toLowerCase())) {
    return clean;
  }
  const stem = clean.replace(NUMBERED, '').trim();
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${stem
      .slice(0, SAVED_EQ_NAME_MAX - suffix.length)
      .trim()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A stored saved EQ as it may be played, or nothing when any part fails. */
export const toSavedEq = (value: unknown): ISavedEq | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const { id, name, sound, updatedAt } = value as Record<string, unknown>;
  const played = toSongSound(sound);
  const clean = typeof name === 'string' ? cleanSavedEqName(name) : '';
  if (
    !isSavedEqId(id) ||
    clean === '' ||
    !played ||
    !isFiniteNumber(updatedAt)
  ) {
    return undefined;
  }
  return { id, name: clean, sound: played, updatedAt };
};

/**
 * Whether what plays is this saved EQ: the same bands and Tone, and the same
 * preset unless it was saved without one.
 */
export const playsSavedEq = (live: ISongSound, eq: ISavedEq): boolean =>
  sameSongSound(
    live,
    eq.sound.presetId === ''
      ? { ...eq.sound, presetId: live.presetId }
      : eq.sound,
  );
