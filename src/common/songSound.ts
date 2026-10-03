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
  isBandEnabled,
} from './constants';
import { ISongIdentity } from './songIdentity';
import {
  ISongMemoryEntryBase,
  ISongMemorySettings,
  emptySongMemory,
  forgetSongMemory,
  lookupSongMemory,
  putSongMemory,
} from './songMemory';
import { ITone, TONE_KNOBS, toTone } from './tone';

/**
 * The sound a song was played with, remembered so it comes back with the song
 * (Ivan, 2026-10-02: "save also the Preset per song ... when that song is on
 * play again it automatically load that preset for it", and "should include
 * also the tone curve and the EQ"): the preset chosen on the equaliser, Bass,
 * Mid and Treble, and the bands. Per output, like everything the equaliser
 * holds — a song tuned on the headphones is not tuned for the speakers.
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

export interface ISongSoundEntry extends ISongMemoryEntryBase {
  sound: ISongSound;
}

export type ISongSoundSettings = ISongMemorySettings<ISongSoundEntry>;

/**
 * A ceiling per output, as the Smart EQ memory keeps (`SONG_EQ_MAX_ENTRIES`):
 * an entry is about a kilobyte for a fifteen-band EQ.
 */
export const SONG_SOUND_MAX_ENTRIES = 2000;

/** Longer than any preset id the app or a saved chain has. */
const PRESET_ID_MAX_LENGTH = 120;

const FILTER_TYPES: ReadonlySet<string> = new Set(
  Object.values(FilterTypeEnum),
);

export const getDefaultSongSoundSettings = (): ISongSoundSettings =>
  emptySongMemory<ISongSoundEntry>();

const toFilter = (id: string, value: unknown): IFilter | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { frequency, gain, quality, type, isEnabled } = value as Record<
    string,
    unknown
  >;
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

/** A song's sound as stored or sent, or nothing when any part fails to read. */
export const toSongSound = (value: unknown): ISongSound | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { presetId, tone, filters } = value as Record<string, unknown>;
  const bands = toSongFilters(filters);
  if (
    typeof presetId !== 'string' ||
    presetId.length > PRESET_ID_MAX_LENGTH ||
    !bands
  ) {
    return undefined;
  }
  const dials = toTone(tone);
  return { presetId, ...(dials ? { tone: dials } : {}), filters: bands };
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

export const lookupSongSound = (
  settings: ISongSoundSettings,
  deviceId: string,
  identity: ISongIdentity,
): ISongSoundEntry | undefined =>
  lookupSongMemory(settings, deviceId, identity);

/** File the sound a song ended with, and count the play. */
export const saveSongSound = (
  settings: ISongSoundSettings,
  deviceId: string,
  identity: ISongIdentity,
  sound: ISongSound,
  now: number,
): ISongSoundSettings =>
  putSongMemory(
    settings,
    deviceId,
    identity,
    (existing) => ({
      sound,
      title: identity.title,
      artist: identity.artist,
      alias: identity.alias,
      plays: (existing?.plays ?? 0) + 1,
      updatedAt: now,
    }),
    SONG_SOUND_MAX_ENTRIES,
  );

export const forgetSongSound = (
  settings: ISongSoundSettings,
  deviceId: string,
  identity: ISongIdentity,
): ISongSoundSettings => forgetSongMemory(settings, deviceId, identity);

/** A stored entry as it may be played, or nothing when any part fails. */
export const toSongSoundEntry = (
  value: unknown,
): ISongSoundEntry | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { sound, title, artist, alias, plays, updatedAt } = value as Record<
    string,
    unknown
  >;
  const played = toSongSound(sound);
  if (
    !played ||
    typeof title !== 'string' ||
    typeof plays !== 'number' ||
    !Number.isFinite(plays) ||
    typeof updatedAt !== 'number' ||
    !Number.isFinite(updatedAt)
  ) {
    return undefined;
  }
  return {
    sound: played,
    title,
    ...(typeof artist === 'string' ? { artist } : {}),
    ...(typeof alias === 'string' ? { alias } : {}),
    plays,
    updatedAt,
  };
};

/** What a song's sound put on left in the state, as main replies with it. */
export type TSongSoundLanded = Pick<
  IState,
  'filters' | 'tone' | 'voicing' | 'eqFormat'
>;
