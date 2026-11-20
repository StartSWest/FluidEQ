/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import log from 'electron-log';
import { scheduleWrite } from './asyncWriter';
import {
  type ISongMemoryLoad,
  keepSongMemory,
  readSongMemoryText,
  readSongMemoryTextSoon,
} from './songMemoryFile';
import type { ISongMemoryOutput } from '../common/songMemory';
import {
  type IAlbumSoundEntry,
  type ISongSoundSettings,
  type TStoredSound,
  getDefaultSongSoundSettings,
  isAlbumKey,
  toAlbumSoundEntry,
  toSongSoundEntry,
} from '../common/songSoundMemory';
import {
  type ISavedEq,
  SAVED_EQ_MAX,
  isEqLink,
  toSavedEq,
} from '../common/savedEq';
import { fingerprintSongMemory } from './songMemoryNames';
import { migrateSongSoundV1, toLegacySongSoundEntry } from './songSoundMigrate';

/**
 * Where Auto EQ keeps the sounds songs and albums play with
 * (`songSoundMemory.ts`): `song-eq.json`'s neighbour, read and taken in the
 * same way (`songMemoryFile.ts`).
 *
 * Every entry is read through `toSongSoundEntry` on the way in, unlike the
 * Smart EQ file's: what is in here is put straight onto the bands, the Tone
 * and the preset, and a hand-edited or half-written entry must cost that one
 * song its sound rather than play a band that does not read. Such an entry is
 * counted, and the count logged (`keepSongMemory`).
 *
 * Version 1 is what "Remember each song's sound" wrote, one store per output;
 * it is moved as it is read (`songSoundMigrate.ts`) and written again at once,
 * so the move happens one time. Version 2 is Auto EQ's first store, and
 * version 3 the same with the saved EQs (`savedEq.ts`) beside it.
 */
const SETTINGS_FILENAME = 'song-sound.json';

/** What version 2 files every key and alias by (`songMemoryNames.ts`). */
const FINGERPRINT = /^[0-9a-f]{40}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One store's entries and aliases, each entry read by `read`, aliases only
 * to an entry that survived: an alias to nothing would answer a lookup with
 * an entry that is not there. */
const readStore = <Entry>(
  value: unknown,
  read: (raw: unknown) => Entry | undefined,
  isKey: (key: string) => boolean,
): { output: ISongMemoryOutput<Entry>; dropped: number } => {
  const { entries, aliases } = isRecord(value)
    ? value
    : { entries: undefined, aliases: undefined };
  const kept: Record<string, Entry> = {};
  let dropped = 0;
  if (isRecord(entries)) {
    Object.entries(entries).forEach(([key, raw]) => {
      const entry = isKey(key) ? read(raw) : undefined;
      if (entry) {
        kept[key] = entry;
      } else {
        dropped += 1;
      }
    });
  }
  const pointers: Record<string, string> = {};
  if (isRecord(aliases)) {
    Object.entries(aliases).forEach(([alias, key]) => {
      if (typeof key === 'string' && isKey(alias) && kept[key]) {
        pointers[alias] = key;
      }
    });
  }
  return { output: { entries: kept, aliases: pointers }, dropped };
};

const isFingerprint = (key: string) => FINGERPRINT.test(key);

/** The saved EQs a file keeps, each read whole, an id kept once, no more
 * than the list holds. */
const readSavedEqs = (value: unknown): { eqs: ISavedEq[]; dropped: number } => {
  if (!Array.isArray(value)) {
    return { eqs: [], dropped: 0 };
  }
  const eqs: ISavedEq[] = [];
  let dropped = 0;
  value.forEach((raw) => {
    const eq = toSavedEq(raw);
    if (
      eq &&
      eqs.length < SAVED_EQ_MAX &&
      !eqs.some((one) => one.id === eq.id)
    ) {
      eqs.push(eq);
    } else {
      dropped += 1;
    }
  });
  return { eqs, dropped };
};

/**
 * Versions 2 and 3 are the same file, 3 with the saved EQs beside the songs
 * and albums; a version-2 file is read as a version 3 with none, and written
 * again once as 3. A song or album linked to a saved EQ the file does not
 * keep has no sound left to play and is dropped like any entry that does
 * not read.
 */
const readVersion2or3 = (
  input: Record<string, unknown>,
  version: 2 | 3,
): ISongMemoryLoad<ISongSoundSettings> => {
  const saved =
    version === 3 ? readSavedEqs(input.eqs) : { eqs: [], dropped: 0 };
  const ids = new Set(saved.eqs.map((eq) => eq.id));
  const linksHold = (sound: TStoredSound) =>
    !isEqLink(sound) || ids.has(sound.eqId);
  const songs = readStore(
    input.songs,
    (raw) => {
      const entry = toSongSoundEntry(raw);
      return entry && linksHold(entry.sound) ? entry : undefined;
    },
    isFingerprint,
  );
  const albums: Record<string, IAlbumSoundEntry> = {};
  let dropped = songs.dropped + saved.dropped;
  if (isRecord(input.albums)) {
    Object.entries(input.albums).forEach(([key, raw]) => {
      const album = isAlbumKey(key) ? toAlbumSoundEntry(raw) : undefined;
      if (album && linksHold(album.sound)) {
        albums[key] = album;
      } else {
        dropped += 1;
      }
    });
  }
  return {
    settings: { version: 3, songs: songs.output, albums, eqs: saved.eqs },
    rewrite: dropped > 0 || version === 2,
    dropped,
    damaged: false,
  };
};

const readVersion1 = (
  input: Record<string, unknown>,
): ISongMemoryLoad<ISongSoundSettings> | undefined => {
  if (!isRecord(input.outputs)) {
    return undefined;
  }
  let dropped = 0;
  const outputs: Record<
    string,
    ISongMemoryOutput<NonNullable<ReturnType<typeof toLegacySongSoundEntry>>>
  > = {};
  Object.entries(input.outputs).forEach(([deviceId, value]) => {
    const read = readStore(value, toLegacySongSoundEntry, () => true);
    outputs[deviceId] = read.output;
    dropped += read.dropped;
  });
  // Filed by fingerprints first, as every song memory is (a file from before
  // 2026-10-26 names the songs in it), then moved.
  const named = fingerprintSongMemory({ version: 1, outputs });
  return {
    settings: migrateSongSoundV1(named.settings.outputs),
    rewrite: true,
    dropped: dropped + named.dropped,
    damaged: false,
  };
};

/**
 * The file read just now and what has to happen to it — see
 * `ISongMemoryLoad`. Missing at first launch: no songs, and nothing to do.
 * Contents that are not this file at all are set aside, never written over.
 */
const settle = (
  text: string | undefined,
): ISongMemoryLoad<ISongSoundSettings> => {
  const empty = getDefaultSongSoundSettings();
  if (text === undefined) {
    return { settings: empty, rewrite: false, dropped: 0, damaged: false };
  }
  const damaged = {
    settings: empty,
    rewrite: false,
    dropped: 0,
    damaged: true,
  };
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return damaged;
  }
  if (!isRecord(input)) {
    return damaged;
  }
  if (input.version === 3 || input.version === 2) {
    return readVersion2or3(input, input.version);
  }
  if (input.version === 1) {
    return readVersion1(input) ?? damaged;
  }
  return damaged;
};

const fileOf = (userDataDir: string) =>
  path.join(userDataDir, SETTINGS_FILENAME);

export const saveSongSoundSettings = (
  userDataDir: string,
  settings: ISongSoundSettings,
): void => {
  // Through the writer, off the main thread and whole or not at all: a save
  // lands as a song changes, and a crash mid-write leaves the previous file
  // rather than a truncated one. Saves made faster than the disk fold into
  // the last, which is complete.
  scheduleWrite(fileOf(userDataDir), JSON.stringify(settings)).catch(
    (error: unknown) => log.error('Failed to save the songs’ sounds', error),
  );
};

/** A read file taken in: set aside if damaged, written again if it was
 * moved or named songs, and what to hold handed back. */
export const keepSongSoundSettings = (
  userDataDir: string,
  loaded: ISongMemoryLoad<ISongSoundSettings>,
): ISongSoundSettings =>
  keepSongMemory(fileOf(userDataDir), loaded, (settings) =>
    saveSongSoundSettings(userDataDir, settings),
  );

/** Read now, and taken in at once. */
export const loadSongSoundSettings = (
  userDataDir: string,
): ISongSoundSettings =>
  keepSongSoundSettings(
    userDataDir,
    settle(readSongMemoryText(fileOf(userDataDir))),
  );

/**
 * Read off the main thread, for the read just after launch
 * (`ipc/songSound.ts`), which takes it in only if nothing has read the file
 * since: by then a lookup may have read it and saved a song over it.
 */
export const readSongSoundSettings = async (
  userDataDir: string,
): Promise<ISongMemoryLoad<ISongSoundSettings>> =>
  settle(await readSongMemoryTextSoon(fileOf(userDataDir)));
