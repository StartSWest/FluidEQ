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
  type TParseSongMemory,
  keepSongMemory,
  readSongMemoryText,
  readSongMemoryTextSoon,
  settleSongMemory,
} from './songMemoryFile';
import { ISongMemoryOutput } from '../common/songMemory';
import {
  ISongSoundEntry,
  ISongSoundSettings,
  getDefaultSongSoundSettings,
  toSongSoundEntry,
} from '../common/songSound';

/**
 * Where the sound each song was played with lives: `song-eq.json`'s
 * neighbour, read and written the same way (`songEqStore.ts`, through
 * `songMemoryFile.ts`), with no rules of its own beyond the file's shape.
 *
 * Every entry is read through `toSongSoundEntry` on the way in, unlike the
 * Smart EQ file's: what is in here is put straight onto the bands, the Tone
 * and the preset, and a hand-edited or half-written entry must cost that one
 * song its memory rather than play a band that does not read. Such an entry
 * is counted, and the count logged (`keepSongMemory`).
 */
const SETTINGS_FILENAME = 'song-sound.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toOutput = (
  value: unknown,
): { output: ISongMemoryOutput<ISongSoundEntry>; dropped: number } => {
  const { entries, aliases } = isRecord(value)
    ? value
    : { entries: undefined, aliases: undefined };
  const kept: Record<string, ISongSoundEntry> = {};
  let dropped = 0;
  if (isRecord(entries)) {
    Object.entries(entries).forEach(([key, raw]) => {
      const entry = toSongSoundEntry(raw);
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
      // Only to an entry that survived: an alias to nothing would answer a
      // lookup with an entry that is not there.
      if (typeof key === 'string' && kept[key]) {
        pointers[alias] = key;
      }
    });
  }
  return { output: { entries: kept, aliases: pointers }, dropped };
};

export const saveSongSoundSettings = (
  userDataDir: string,
  settings: ISongSoundSettings,
): void => {
  // Through the writer, off the main thread and whole or not at all: a save
  // lands as a song changes, and a crash mid-write leaves the previous file
  // rather than a truncated one. Saves made faster than the disk fold into
  // the last, which is complete.
  scheduleWrite(
    path.join(userDataDir, SETTINGS_FILENAME),
    JSON.stringify(settings),
  ).catch((error: unknown) =>
    log.error('Failed to save the songs’ sounds', error),
  );
};

/**
 * The file's contents as settings, or nothing for contents that are not this
 * file — another version's, or not a song memory at all — which is then set
 * aside rather than saved over (`keepSongMemory`).
 */
const parse: TParseSongMemory<ISongSoundEntry> = (input) => {
  if (!isRecord(input) || input.version !== 1 || !isRecord(input.outputs)) {
    return undefined;
  }
  const outputs: ISongSoundSettings['outputs'] = {};
  let dropped = 0;
  Object.entries(input.outputs).forEach(([deviceId, value]) => {
    const read = toOutput(value);
    outputs[deviceId] = read.output;
    dropped += read.dropped;
  });
  return { settings: { version: 1, outputs }, dropped };
};

const fileOf = (userDataDir: string) =>
  path.join(userDataDir, SETTINGS_FILENAME);

/**
 * The file read just now, filed by fingerprints with every name of a song
 * not the listener's own gone (`songMemoryNames.ts`), and what has to happen
 * to it — see `ISongMemoryLoad`. Missing at first launch: no songs, and
 * nothing to do.
 */
const settle = (text: string | undefined) =>
  settleSongMemory(text, parse, getDefaultSongSoundSettings);

/** A read file taken in: set aside if damaged, written again if it names
 * songs, and what to hold handed back. */
export const keepSongSoundSettings = (
  userDataDir: string,
  loaded: ISongMemoryLoad<ISongSoundEntry>,
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
): Promise<ISongMemoryLoad<ISongSoundEntry>> =>
  settle(await readSongMemoryTextSoon(fileOf(userDataDir)));
