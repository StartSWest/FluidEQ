/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { scheduleWrite } from './asyncWriter';
import { ISongMemoryOutput } from '../common/songMemory';
import {
  ISongSoundEntry,
  ISongSoundSettings,
  getDefaultSongSoundSettings,
  toSongSoundEntry,
} from '../common/songSound';

/**
 * Where the sound each song was played with lives: `song-eq.json`'s
 * neighbour, read and written the same way (`songEqStore.ts`), with no rules
 * of its own beyond the file's shape.
 *
 * Every entry is read through `toSongSoundEntry` on the way in, unlike the
 * Smart EQ file's: what is in here is put straight onto the bands, the Tone
 * and the preset, and a hand-edited or half-written entry must cost that one
 * song its memory rather than play a band that does not read.
 */
const SETTINGS_FILENAME = 'song-sound.json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toOutput = (value: unknown): ISongMemoryOutput<ISongSoundEntry> => {
  const { entries, aliases } = isRecord(value)
    ? value
    : { entries: undefined, aliases: undefined };
  const kept: Record<string, ISongSoundEntry> = {};
  if (isRecord(entries)) {
    Object.entries(entries).forEach(([key, raw]) => {
      const entry = toSongSoundEntry(raw);
      if (entry) {
        kept[key] = entry;
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
  return { entries: kept, aliases: pointers };
};

export const loadSongSoundSettings = (
  userDataDir: string,
): ISongSoundSettings => {
  const settingsPath = path.join(userDataDir, SETTINGS_FILENAME);
  try {
    const input: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (!isRecord(input) || input.version !== 1 || !isRecord(input.outputs)) {
      return getDefaultSongSoundSettings();
    }
    const outputs: ISongSoundSettings['outputs'] = {};
    Object.entries(input.outputs).forEach(([deviceId, output]) => {
      outputs[deviceId] = toOutput(output);
    });
    return { version: 1, outputs };
  } catch {
    // Missing at first launch; corrupt after a power cut mid-write. Either way
    // the worst it costs is songs to tune again.
    return getDefaultSongSoundSettings();
  }
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
