/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  ISongMemoryEntryBase,
  ISongMemoryOutput,
} from '../common/songMemory';
import { type ISongSound, toSongSound } from '../common/songSound';
import {
  type ISongSoundEntry,
  type ISongSoundSettings,
  type TSoundScope,
  SONG_SOUND_MAX_ENTRIES,
  getDefaultSongSoundSettings,
} from '../common/songSoundMemory';
import { scopedSongAlias } from './songMemoryNames';

/**
 * The songs "Remember each song's sound" kept (`song-sound.json` version 1,
 * one store per output), moved into Auto EQ's (version 2, one store for every
 * output and two worlds — `songSoundMemory.ts`). Nothing is lost that was a
 * song's sound: every entry that reads is carried over.
 *
 * - One store for every output: where two outputs kept the same song, the
 *   newest save is the one kept (it is the sound last chosen for it) and the
 *   plays of all of them are counted together.
 * - Its world from what the version-1 file kept: a name stays only for the
 *   listener's own files (`songMemoryNames.ts`, since 2026-10-26), so an entry
 *   with a title is a Library or Karaoke song and one without is another
 *   player's. The one thing this cannot tell apart is a file of one's own with
 *   no title at all, which is read as another player's; the fingerprint it is
 *   filed under cannot be read back to its source.
 * - Its alias filed with that world (`scopedSongAlias`), the alias map
 *   rebuilt from the entries kept, newest first.
 * - No track id: the fingerprint it is filed under cannot be read back to
 *   one; the Library names its songs later (`nameLibrarySongSounds`).
 */

/** A version-1 entry: an object with a whole sound, a title and a count. */
interface ILegacySongSoundEntry extends ISongMemoryEntryBase {
  sound: ISongSound;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A version-1 entry as it may be carried over, or nothing. */
export const toLegacySongSoundEntry = (
  value: unknown,
): ILegacySongSoundEntry | undefined => {
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
    !isFiniteNumber(plays) ||
    !isFiniteNumber(updatedAt)
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

const scopeOf = (entry: ILegacySongSoundEntry): TSoundScope =>
  entry.title !== '' ? 'library' : 'other';

/**
 * Every output's songs as one store of Auto EQ's. The outputs have been filed
 * by fingerprints already (`fingerprintSongMemory`), as every version-1 file
 * is on its way in.
 */
export const migrateSongSoundV1 = (
  outputs: Record<string, ISongMemoryOutput<ILegacySongSoundEntry>>,
): ISongSoundSettings => {
  const merged: Record<string, ISongSoundEntry> = {};
  Object.values(outputs).forEach((output) => {
    Object.entries(output.entries).forEach(([key, legacy]) => {
      const scope = scopeOf(legacy);
      const kept = merged[key];
      const isNewer = !kept || legacy.updatedAt > kept.updatedAt;
      const plays = (kept?.plays ?? 0) + legacy.plays;
      const newest: ISongSoundEntry = isNewer
        ? {
            sound: legacy.sound,
            scope,
            title: legacy.title,
            ...(legacy.artist === undefined ? {} : { artist: legacy.artist }),
            ...(legacy.alias === undefined
              ? {}
              : { alias: scopedSongAlias(scope, legacy.alias) }),
            plays,
            updatedAt: legacy.updatedAt,
          }
        : { ...kept, plays };
      merged[key] = newest;
    });
  });
  // Inside the ceiling the store keeps, the oldest left out first.
  const keys = Object.keys(merged)
    .sort((a, b) => merged[b].updatedAt - merged[a].updatedAt)
    .slice(0, SONG_SOUND_MAX_ENTRIES);
  const entries: Record<string, ISongSoundEntry> = {};
  const aliases: Record<string, string> = {};
  // Newest first, so an alias two songs shared points at the newer one, as a
  // save would have left it.
  keys.forEach((key) => {
    const entry = merged[key];
    entries[key] = entry;
    if (entry.alias !== undefined && aliases[entry.alias] === undefined) {
      aliases[entry.alias] = key;
    }
  });
  return { ...getDefaultSongSoundSettings(), songs: { entries, aliases } };
};
