/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FilterTypeEnum,
  IFilter,
  IFiltersMap,
  IState,
  MAX_NUM_FILTERS,
  MIN_NUM_FILTERS,
  clampFrequency,
  clampGain,
  clampQuality,
  isBandChannel,
  isBandEnabled,
} from './constants';
import { ITone, TONE_KNOBS, toTone } from './tone';

/**
 * The sound a song plays with, as Auto EQ keeps it for the song or its album
 * (Ivan, 2026-10-02: "save also the Preset per song ... when that song is on
 * play again it automatically load that preset for it", and "should include
 * also the tone curve and the EQ"): the preset chosen on the equaliser, Bass,
 * Mid and Treble, and the bands. Where it is kept is `songSoundMemory.ts`.
 *
 * The preamp is not part of it. Auto normalize sets it from the curve, and a
 * level stored with a song would be an hour-old reading of a curve that
 * Auto normalize reads afresh anyway.
 */
export interface ISongSound {
  /**
   * The preset picker's own id for what it shows: `none` for None, and empty
   * for a rack with no name, which a song then leaves as it finds it.
   */
  presetId: string;
  /** Bass, Mid and Treble; absent at flat (`toTone`). */
  tone?: ITone;
  filters: IFiltersMap;
}

/**
 * A preset picked for a song or an album in the Library, with nothing else:
 * it plays with the listener's own Tone and bands (Ivan, 2026-11-19: "pick
 * the sound preset from the lib"). "Use what's playing now" keeps a whole
 * sound instead.
 */
export interface IPresetPick {
  presetId: string;
}

/** What Auto EQ keeps for a song or an album. */
export type TSavedSound = ISongSound | IPresetPick;

export const isWholeSound = (sound: TSavedSound): sound is ISongSound =>
  'filters' in sound;

/**
 * The sound a saved one plays as: itself when whole, or its preset over the
 * sound it would otherwise play with — the listener's own, never a song's
 * that happened to be playing before.
 */
export const soundToPlay = (
  saved: TSavedSound,
  base: ISongSound,
): ISongSound =>
  isWholeSound(saved) ? saved : { ...base, presetId: saved.presetId };

/** Longer than any preset id the app or a saved chain has. */
const PRESET_ID_MAX_LENGTH = 120;

const FILTER_TYPES: ReadonlySet<string> = new Set(
  Object.values(FilterTypeEnum),
);

const toFilter = (id: string, value: unknown): IFilter | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { frequency, gain, quality, type, isEnabled, channel } =
    value as Record<string, unknown>;
  if (
    typeof frequency !== 'number' ||
    typeof gain !== 'number' ||
    typeof quality !== 'number' ||
    typeof type !== 'string' ||
    !FILTER_TYPES.has(type)
  ) {
    return undefined;
  }
  return {
    id,
    frequency: clampFrequency(frequency),
    gain: clampGain(gain),
    quality: clampQuality(quality),
    type: type as FilterTypeEnum,
    ...(isEnabled === false ? { isEnabled: false } : {}),
    ...(isBandChannel(channel) ? { channel } : {}),
  };
};

/**
 * Bands as the equaliser may be given them, or nothing.
 *
 * Every band whole or none of them: a stored set with one band that does not
 * read is not a set to play with a band missing, because the song was tuned
 * with all of them. Bounded as every other path that sets bands is.
 */
export const toSongFilters = (value: unknown): IFiltersMap | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value);
  if (entries.length < MIN_NUM_FILTERS || entries.length > MAX_NUM_FILTERS) {
    return undefined;
  }
  const filters: IFiltersMap = {};
  const whole = entries.every(([id, raw]) => {
    const filter = id ? toFilter(id, raw) : undefined;
    if (filter) {
      filters[id] = filter;
    }
    return filter !== undefined;
  });
  return whole ? filters : undefined;
};

const isPresetId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= PRESET_ID_MAX_LENGTH;

/** A song's sound as stored or sent, or nothing when any part fails to read. */
export const toSongSound = (value: unknown): ISongSound | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { presetId, tone, filters } = value as Record<string, unknown>;
  const bands = toSongFilters(filters);
  if (!isPresetId(presetId) || !bands) {
    return undefined;
  }
  const dials = toTone(tone);
  return { presetId, ...(dials ? { tone: dials } : {}), filters: bands };
};

/**
 * A saved sound as stored or sent, or nothing. Bands that are there and do
 * not read fail the whole of it: a whole sound with its bands lost is not the
 * preset alone the listener picked, and must not quietly play as one.
 */
export const toSavedSound = (value: unknown): TSavedSound | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  if ('filters' in value) {
    return toSongSound(value);
  }
  const { presetId } = value as Record<string, unknown>;
  // An empty id names no preset, and a pick of nothing is not a pick.
  return isPresetId(presetId) && presetId !== '' ? { presetId } : undefined;
};

const sameBand = (a: IFilter, b: IFilter): boolean =>
  a.frequency === b.frequency &&
  a.gain === b.gain &&
  a.quality === b.quality &&
  a.type === b.type &&
  isBandEnabled(a) === isBandEnabled(b);

/**
 * Whether two sounds play the same.
 *
 * Bands by their id, and by value — never by the order their keys came back
 * in, which a round trip through main does not keep. A tone at flat is the
 * same as none.
 */
export const sameSongSound = (a: ISongSound, b: ISongSound): boolean => {
  if (a.presetId !== b.presetId) {
    return false;
  }
  if (
    TONE_KNOBS.some((knob) => (a.tone?.[knob] ?? 0) !== (b.tone?.[knob] ?? 0))
  ) {
    return false;
  }
  const aIds = Object.keys(a.filters);
  const bIds = Object.keys(b.filters);
  return (
    aIds.length === bIds.length &&
    aIds.every((id) => {
      const other = b.filters[id];
      return other !== undefined && sameBand(a.filters[id], other);
    })
  );
};

/** What a song's sound put on left in the state, as main replies with it. */
export type TSongSoundLanded = Pick<
  IState,
  'filters' | 'tone' | 'voicing' | 'eqFormat'
>;
