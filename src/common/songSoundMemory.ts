/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongIdentity, TSongSource } from './songIdentity';
import {
  ISongMemoryEntryBase,
  ISongMemoryOutput,
  emptySongMemoryOutput,
  forgetInSongMemory,
  forgetKeyInSongMemory,
  lookupInSongMemory,
  putInSongMemory,
} from './songMemory';
import { TSavedSound, isWholeSound, toSavedSound } from './songSound';
import type { IAlbumSoundMatch } from './songSoundEvents';
import { IEqLink, ISavedEq, isEqLink, toEqLink } from './savedEq';

/**
 * Where Auto EQ keeps the sounds songs and albums play with: one store for
 * every output (Auto EQ, 2026-11-20: a song's sound follows it to every
 * output; the headphone correction stays the output's), in two worlds that
 * never meet.
 *
 * - The Library's: songs that are the listener's own files, and the albums
 *   they are on. A song's own preset beats its album's (Ivan, 2026-11-19:
 *   "if one of the song o the album has a differnt preset it plays that one
 *   for that song"), and albums exist here alone ("this is only for the
 *   liberary").
 * - Other players': Spotify, YouTube, the browser, another computer —
 *   sounds saved while the song played ("saved sound is more for system
 *   audio").
 *
 * A Library file and the same song on Spotify used to meet through the alias
 * (`songIdentity.ts`); each world now has its own aliases (main files every
 * alias with its world, `storedSoundIdentity`) and a lookup takes nothing
 * from the other world, so a sound picked in the Library never plays on
 * Spotify and one saved from Spotify never overrides the Library.
 *
 * Pure, like `songMemory.ts` underneath it.
 */

export type TSoundScope = 'library' | 'other';

/** Which world a song belongs to: the listener's own files, or not. */
export const soundScopeOf = (source: TSongSource): TSoundScope =>
  source === 'library' || source === 'karaoke' ? 'library' : 'other';

/**
 * Whether a song plays a saved sound at all. Never a film or a video (Auto
 * EQ: "films and videos never get a song or album sound"), and never another
 * player's page with no artist, which `normalizeSongAlias` already reads as a
 * page and not a song — a podcast, a livestream, a video essay.
 */
export const canKeepSongSound = (identity: ISongIdentity): boolean =>
  !identity.isVideo &&
  (soundScopeOf(identity.source) === 'library' || identity.alias !== undefined);

/**
 * What a song or an album keeps: a sound of its own, or a link to a saved EQ
 * it follows (`savedEq.ts`), which a lookup answers with the EQ's sound.
 */
export type TStoredSound = TSavedSound | IEqLink;

/** A kept sound as stored or sent, or nothing. */
export const toStoredSound = (value: unknown): TStoredSound | undefined =>
  toEqLink(value) ?? toSavedSound(value);

export interface ISongSoundEntry extends ISongMemoryEntryBase {
  sound: TStoredSound;
  scope: TSoundScope;
  /**
   * A Library song's track id, so the Library can say which of its songs
   * have a sound of their own without asking about each. Absent for other
   * players' songs, whose names this store never keeps (`songMemoryNames.ts`),
   * and for a Library entry from before Auto EQ until the Library names it.
   */
  trackId?: string;
}

/** An album's sound, picked in the Library. */
export interface IAlbumSoundEntry {
  /** The album and its artist as the Library shows them, for Manage. */
  title: string;
  artist: string;
  sound: TStoredSound;
  updatedAt: number;
}

/**
 * Version 3 added the saved EQs (2026-11-20); version 2 is read into it with
 * none, and nothing else about it changes (`songSoundStore.ts`).
 */
export interface ISongSoundSettings {
  version: 3;
  songs: ISongMemoryOutput<ISongSoundEntry>;
  /** By the Library's own album key (`albumKey` in `library/grouping.ts`). */
  albums: Record<string, IAlbumSoundEntry>;
  /** Newest saved last, in the order the panel lists them. */
  eqs: ISavedEq[];
}

/**
 * A ceiling, as the Smart EQ memory keeps one per output: an entry is about a
 * kilobyte for a fifteen-band EQ. Every output's songs share it now, so it is
 * three outputs' worth of the old per-output ceiling (2000): a store moved
 * from version 1 keeps every song unless somebody filled more than three
 * outputs to the brim.
 */
export const SONG_SOUND_MAX_ENTRIES = 6000;

/** Keys an object holds of its own and a store must never be given. */
const OBJECT_INTERNALS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** An album key the Library could have made and a store can hold. */
export const isAlbumKey = (key: string): boolean =>
  key !== '' && !OBJECT_INTERNALS.has(key);

/** Albums are picked one by one in the Library; this only bounds a file. */
export const ALBUM_SOUND_MAX_ENTRIES = 4000;

export const getDefaultSongSoundSettings = (): ISongSoundSettings => ({
  version: 3,
  songs: emptySongMemoryOutput<ISongSoundEntry>(),
  albums: {},
  eqs: [],
});

/** The saved EQ of this id, if it is still kept. */
export const findSavedEq = (
  settings: ISongSoundSettings,
  eqId: string,
): ISavedEq | undefined => settings.eqs.find((eq) => eq.id === eqId);

/**
 * A kept sound as it plays: itself, or the saved EQ it links to. A link to an
 * EQ that is gone is no sound — deleting one turns its links into copies
 * first (`deleteSavedEq`), so only a hand-edited file holds such a link.
 */
export const resolveStoredSound = (
  settings: ISongSoundSettings,
  sound: TStoredSound,
): TSavedSound | undefined =>
  isEqLink(sound) ? findSavedEq(settings, sound.eqId)?.sound : sound;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** A stored entry as it may be played, or nothing when any part fails. */
export const toSongSoundEntry = (
  value: unknown,
): ISongSoundEntry | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { sound, scope, trackId, title, artist, alias, plays, updatedAt } =
    value as Record<string, unknown>;
  const saved = toStoredSound(sound);
  if (
    !saved ||
    (scope !== 'library' && scope !== 'other') ||
    typeof title !== 'string' ||
    !isFiniteNumber(plays) ||
    !isFiniteNumber(updatedAt)
  ) {
    return undefined;
  }
  return {
    sound: saved,
    scope,
    ...(scope === 'library' && typeof trackId === 'string' ? { trackId } : {}),
    title,
    ...(typeof artist === 'string' ? { artist } : {}),
    ...(typeof alias === 'string' ? { alias } : {}),
    plays,
    updatedAt,
  };
};

export const toAlbumSoundEntry = (
  value: unknown,
): IAlbumSoundEntry | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { title, artist, sound, updatedAt } = value as Record<string, unknown>;
  const saved = toStoredSound(sound);
  if (
    !saved ||
    typeof title !== 'string' ||
    typeof artist !== 'string' ||
    !isFiniteNumber(updatedAt)
  ) {
    return undefined;
  }
  return { title, artist, sound: saved, updatedAt };
};

/** What the song's own world keeps for it, if anything. */
export const lookupSongSound = (
  settings: ISongSoundSettings,
  identity: ISongIdentity,
  scope: TSoundScope,
): ISongSoundEntry | undefined => {
  const entry = lookupInSongMemory(settings.songs, identity);
  return entry?.scope === scope ? entry : undefined;
};

/**
 * File a song's sound: a pick in the Library, "Save for this song" or Save
 * changes. Every save is a press (Ivan approved explicit saving, 2026-11-20),
 * so nothing here counts a play: `plays` keeps what "Remember each song's
 * sound" counted, which a moved file carries over.
 */
export const saveSongSound = (
  settings: ISongSoundSettings,
  identity: ISongIdentity,
  scope: TSoundScope,
  sound: TStoredSound,
  now: number,
  { trackId }: { trackId?: string } = {},
): ISongSoundSettings => ({
  ...settings,
  songs: putInSongMemory(
    settings.songs,
    identity,
    (existing) => {
      // An entry of the other world filed under this key is not this song's
      // history: the key names one player, and its count starts again.
      const kept = existing?.scope === scope ? existing : undefined;
      const named = trackId ?? kept?.trackId;
      return {
        sound,
        scope,
        ...(scope === 'library' && named !== undefined
          ? { trackId: named }
          : {}),
        title: identity.title,
        artist: identity.artist,
        alias: identity.alias,
        plays: kept?.plays ?? 0,
        updatedAt: now,
      };
    },
    SONG_SOUND_MAX_ENTRIES,
  ),
});

/** Forget a song in its world: exactly the entry a lookup would answer. */
export const forgetSongSound = (
  settings: ISongSoundSettings,
  identity: ISongIdentity,
  scope: TSoundScope,
): ISongSoundSettings => {
  if (!lookupSongSound(settings, identity, scope)) {
    return settings;
  }
  const songs = forgetInSongMemory(settings.songs, identity) ?? settings.songs;
  return songs === settings.songs ? settings : { ...settings, songs };
};

/** Forget every song of one world (Manage's "Forget all"). */
export const forgetSongSoundsOf = (
  settings: ISongSoundSettings,
  scope: TSoundScope,
): ISongSoundSettings => {
  let { songs } = settings;
  Object.entries(settings.songs.entries).forEach(([key, entry]) => {
    if (entry.scope === scope) {
      songs = forgetKeyInSongMemory(songs, key);
    }
  });
  return songs === settings.songs ? settings : { ...settings, songs };
};

/** Forget every album's sound (Manage's "Forget all" on Albums). */
export const forgetAlbumSounds = (
  settings: ISongSoundSettings,
): ISongSoundSettings =>
  Object.keys(settings.albums).length === 0
    ? settings
    : { ...settings, albums: {} };

export const lookupAlbumSound = (
  settings: ISongSoundSettings,
  albumKey: string,
): IAlbumSoundEntry | undefined =>
  Object.prototype.hasOwnProperty.call(settings.albums, albumKey)
    ? settings.albums[albumKey]
    : undefined;

/** An album's sound set, or taken away with `undefined`. */
export const setAlbumSound = (
  settings: ISongSoundSettings,
  albumKey: string,
  entry: IAlbumSoundEntry | undefined,
): ISongSoundSettings => {
  const albums = { ...settings.albums };
  if (entry) {
    albums[albumKey] = entry;
  } else {
    delete albums[albumKey];
  }
  const keys = Object.keys(albums);
  if (keys.length > ALBUM_SOUND_MAX_ENTRIES) {
    keys
      .sort((a, b) => albums[a].updatedAt - albums[b].updatedAt)
      .slice(0, keys.length - ALBUM_SOUND_MAX_ENTRIES)
      .forEach((key) => delete albums[key]);
  }
  return { ...settings, albums };
};

/** What is kept for a song, as a lookup answers: its own sound, and its
 * album's (the Library's songs only). */
export interface ISongSoundMatch {
  song?: TSavedSound;
  /** The saved EQ the song's own sound is, when it follows one. */
  songEqId?: string;
  album?: IAlbumSoundMatch;
}

/** A Library song's own sound, by track id, as the Library lists them. */
export interface ILibrarySongSound {
  trackId: string;
  title: string;
  artist?: string;
  presetId: string;
  /** Its Tone and bands too, not the preset alone. */
  isWhole: boolean;
  /** The saved EQ it follows, named from the index's own list. */
  eqId?: string;
  updatedAt: number;
}

/** A saved EQ as the panel, Manage and the pickers list it. */
export interface ISavedEqSummary {
  id: string;
  name: string;
  sound: ISavedEq['sound'];
  /** Songs of either world, and albums, that follow it. */
  songCount: number;
  albumCount: number;
  updatedAt: number;
}

/**
 * What the Library and Manage show: every Library song with a sound of its
 * own and a track id to find it by, every album's sound, how many of other
 * players' songs have one, and whether a Library song still lacks its track
 * id (`nameLibrarySongSounds` in main fills them in).
 */
export interface ISongSoundIndex {
  songs: ILibrarySongSound[];
  albums: Array<{
    key: string;
    title: string;
    artist: string;
    presetId: string;
    isWhole: boolean;
    eqId?: string;
  }>;
  otherCount: number;
  hasUnnamed: boolean;
  eqs: ISavedEqSummary[];
}

/** What the index says of a kept sound: its preset, whether it is whole, and
 * the saved EQ it follows — or nothing for a link to an EQ that is gone. */
const describe = (
  settings: ISongSoundSettings,
  sound: TStoredSound,
): { presetId: string; isWhole: boolean; eqId?: string } | undefined => {
  const played = resolveStoredSound(settings, sound);
  if (!played) {
    return undefined;
  }
  return {
    presetId: played.presetId,
    isWhole: isWholeSound(played),
    ...(isEqLink(sound) ? { eqId: sound.eqId } : {}),
  };
};

export const songSoundIndex = (
  settings: ISongSoundSettings,
): ISongSoundIndex => {
  const songs: ILibrarySongSound[] = [];
  const songCounts = new Map<string, number>();
  const albumCounts = new Map<string, number>();
  const count = (counts: Map<string, number>, sound: TStoredSound) => {
    if (isEqLink(sound)) {
      counts.set(sound.eqId, (counts.get(sound.eqId) ?? 0) + 1);
    }
  };
  let otherCount = 0;
  let hasUnnamed = false;
  Object.values(settings.songs.entries).forEach((entry) => {
    count(songCounts, entry.sound);
    if (entry.scope === 'other') {
      otherCount += 1;
      return;
    }
    const described = describe(settings, entry.sound);
    if (entry.trackId === undefined) {
      hasUnnamed = true;
      return;
    }
    if (!described) {
      return;
    }
    songs.push({
      trackId: entry.trackId,
      title: entry.title,
      ...(entry.artist === undefined ? {} : { artist: entry.artist }),
      ...described,
      updatedAt: entry.updatedAt,
    });
  });
  const albums: ISongSoundIndex['albums'] = [];
  Object.entries(settings.albums).forEach(([key, album]) => {
    count(albumCounts, album.sound);
    const described = describe(settings, album.sound);
    if (described) {
      albums.push({
        key,
        title: album.title,
        artist: album.artist,
        ...described,
      });
    }
  });
  return {
    songs,
    albums,
    otherCount,
    hasUnnamed,
    eqs: settings.eqs.map((eq) => ({
      id: eq.id,
      name: eq.name,
      sound: eq.sound,
      songCount: songCounts.get(eq.id) ?? 0,
      albumCount: albumCounts.get(eq.id) ?? 0,
      updatedAt: eq.updatedAt,
    })),
  };
};

/** A Library song's track id, which its exact key carries (`libraryTrackIdentity`). */
export const libraryTrackIdOf = (
  identity: ISongIdentity,
): string | undefined =>
  identity.source === 'library' && identity.key.startsWith('library:')
    ? identity.key.slice('library:'.length)
    : undefined;

/**
 * Give a Library song's entry its track id, where it was kept without one —
 * a song "Remember each song's sound" filed before Auto EQ. Nothing else
 * about it changes, its save time included.
 */
export const nameSongSound = (
  settings: ISongSoundSettings,
  key: string,
  trackId: string,
): ISongSoundSettings => {
  const entry = settings.songs.entries[key];
  if (!entry || entry.scope !== 'library' || entry.trackId !== undefined) {
    return settings;
  }
  return {
    ...settings,
    songs: {
      ...settings.songs,
      entries: { ...settings.songs.entries, [key]: { ...entry, trackId } },
    },
  };
};
