/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SONG_ENERGIES,
  type ISongMap,
  type ISongSecond,
  type ISongSection,
} from '../../common/songMap';
import type { TStudioAgentHeardAnswer } from '../../common/studioAgent';

/**
 * The window's answer to hear_the_music (`studioTools.ts`), read as a
 * stranger's before any of it reaches the member's AI: finite numbers where
 * the map has numbers, its own words where it has words, and no more of
 * anything than ten minutes of song could make. A field the map does not have
 * is dropped, never passed on.
 */

/** The journal keeps ten minutes of a song; a few seconds of slack past it. */
const MOST_SECONDS = 10 * 60 + 5;

type TFields = Record<string, unknown>;

const isFields = (raw: unknown): raw is TFields =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** `keys` of `raw`, every one a finite number; or nothing. */
const numbers = <TKey extends string>(
  raw: TFields,
  keys: readonly TKey[],
): Record<TKey, number> | undefined => {
  const out: Partial<Record<TKey, number>> = {};
  const whole = keys.every((key) => {
    const value = raw[key];
    if (!isNumber(value)) {
      return false;
    }
    out[key] = value;
    return true;
  });
  return whole ? (out as Record<TKey, number>) : undefined;
};

const SECTION_NUMBERS = [
  'from',
  'to',
  'strength',
  'intensity',
  'level',
  'voice',
  'kicks',
  'snares',
  'hats',
  'bass',
  'mid',
  'treble',
  'rise',
] as const;

const readSection = (raw: unknown): ISongSection | undefined => {
  if (!isFields(raw)) {
    return undefined;
  }
  const values = numbers(raw, SECTION_NUMBERS);
  const energy = SONG_ENERGIES.find((word) => word === raw.energy);
  if (!values || !energy || typeof raw.builds !== 'boolean') {
    return undefined;
  }
  return {
    ...values,
    ...(isNumber(raw.pitch) ? { pitch: raw.pitch } : {}),
    energy,
    builds: raw.builds,
  };
};

const SECOND_NUMBERS = [
  't',
  'strength',
  'intensity',
  'level',
  'bass',
  'mid',
  'treble',
  'voice',
  'kicks',
  'snares',
  'hats',
  'build',
] as const;

const readSecond = (raw: unknown): ISongSecond | undefined => {
  if (!isFields(raw)) {
    return undefined;
  }
  const values = numbers(raw, SECOND_NUMBERS);
  if (!values || typeof raw.drop !== 'boolean') {
    return undefined;
  }
  return {
    ...values,
    ...(isNumber(raw.pitch) ? { pitch: raw.pitch } : {}),
    drop: raw.drop,
  };
};

/** Every item read by `read`, or nothing if any is not what it should be. */
const all = <TItem>(
  raw: unknown,
  read: (item: unknown) => TItem | undefined,
): TItem[] | undefined => {
  if (!Array.isArray(raw) || raw.length > MOST_SECONDS) {
    return undefined;
  }
  const out: TItem[] = [];
  const whole = raw.every((item) => {
    const value = read(item);
    if (value === undefined) {
      return false;
    }
    out.push(value);
    return true;
  });
  return whole ? out : undefined;
};

const readMap = (raw: unknown): ISongMap | undefined => {
  if (!isFields(raw)) {
    return undefined;
  }
  const values = numbers(raw, [
    'seconds',
    'tempo',
    'steadiness',
    'peakAt',
    'voicedSeconds',
  ] as const);
  const sections = all(raw.sections, readSection);
  const drops = all(raw.drops, (item) => (isNumber(item) ? item : undefined));
  const perSecond = all(raw.perSecond, readSecond);
  if (!values || !sections || !drops || !perSecond) {
    return undefined;
  }
  return {
    ...values,
    ...(isNumber(raw.voiceFrom) ? { voiceFrom: raw.voiceFrom } : {}),
    ...(isNumber(raw.voiceLow) ? { voiceLow: raw.voiceLow } : {}),
    ...(isNumber(raw.voiceHigh) ? { voiceHigh: raw.voiceHigh } : {}),
    sections,
    drops,
    perSecond,
  };
};

/** How much of the other song was heard: a count of seconds, or none. */
const otherOf = (raw: TFields) =>
  isNumber(raw.otherSeconds) && raw.otherSeconds > 0
    ? Math.min(Math.round(raw.otherSeconds), MOST_SECONDS)
    : 0;

const readHeardAnswer = (raw: unknown): TStudioAgentHeardAnswer => {
  if (!isFields(raw)) {
    return { ok: false, reason: 'no-sound', otherSeconds: 0 };
  }
  const otherSeconds = otherOf(raw);
  const map = raw.ok === true ? readMap(raw.map) : undefined;
  return map
    ? { ok: true, map, otherSeconds }
    : { ok: false, reason: 'no-sound', otherSeconds };
};

export default readHeardAnswer;
