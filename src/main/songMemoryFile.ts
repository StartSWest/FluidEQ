/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import type {
  ISongMemoryEntryBase,
  ISongMemorySettings,
} from '../common/songMemory';
import { fingerprintSongMemory } from './songMemoryNames';

/**
 * How the two song memories' files are read and taken in
 * (`songEqStore.ts`, `songSoundStore.ts`): the same rules for both, so one
 * cannot lose somebody's songs where the other keeps them.
 */

/** A song memory's file as read, before anything is done about it. */
export interface ISongMemoryLoad<Entry> {
  /** What is held from here on: filed by fingerprints (`songMemoryNames`). */
  settings: ISongMemorySettings<Entry>;
  /** The file says more than it may, or holds what was left out of it, and
   * is written again. */
  rewrite: boolean;
  /** Entries that are not entries at all, left out. */
  dropped: number;
  /** The file is there and is not a song memory: set aside, never written
   * over (`keepSongMemory`). */
  damaged: boolean;
}

/** A store's reading of its file's text: the settings and the entries it
 * left out, or nothing for text that is not its file at all. */
export type TParseSongMemory<Entry> = (
  input: unknown,
) => { settings: ISongMemorySettings<Entry>; dropped: number } | undefined;

/** The file's text, or nothing where there is no file to read. */
export const readSongMemoryText = (filePath: string): string | undefined => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    // Missing at first launch. A file that is there and cannot be opened is
    // treated the same: the worst it costs is songs to learn again.
    return undefined;
  }
};

/** `readSongMemoryText`, off the main thread. */
export const readSongMemoryTextSoon = async (
  filePath: string,
): Promise<string | undefined> => {
  try {
    return await fs.promises.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
};

export const settleSongMemory = <Entry extends ISongMemoryEntryBase>(
  text: string | undefined,
  parse: TParseSongMemory<Entry>,
  empty: () => ISongMemorySettings<Entry>,
): ISongMemoryLoad<Entry> => {
  if (text === undefined) {
    return { settings: empty(), rewrite: false, dropped: 0, damaged: false };
  }
  let parsed: ReturnType<TParseSongMemory<Entry>>;
  try {
    parsed = parse(JSON.parse(text));
  } catch {
    parsed = undefined;
  }
  if (parsed === undefined) {
    return { settings: empty(), rewrite: false, dropped: 0, damaged: true };
  }
  const named = fingerprintSongMemory(parsed.settings);
  return {
    settings: named.settings,
    rewrite: named.rewrite || parsed.dropped > 0,
    dropped: parsed.dropped + named.dropped,
    damaged: false,
  };
};

/**
 * Take a read file in: a damaged one moved aside, a converted one written
 * again, and the settings to hold from here on handed back.
 *
 * A damaged file is renamed, `<name>.damaged-<time>.json`, before anything
 * can save over it: whatever songs it still holds stay on disk to be
 * recovered, where the next save would have lost them for good (the way
 * `myCurvesFile.ts` keeps My curves). The log names the file and the count,
 * never a song.
 */
export const keepSongMemory = <Entry extends ISongMemoryEntryBase>(
  filePath: string,
  loaded: ISongMemoryLoad<Entry>,
  save: (settings: ISongMemorySettings<Entry>) => void,
  now: () => number = Date.now,
): ISongMemorySettings<Entry> => {
  const name = path.basename(filePath, '.json');
  if (loaded.damaged) {
    const aside = path.join(
      path.dirname(filePath),
      `${name}.damaged-${now()}.json`,
    );
    try {
      fs.renameSync(filePath, aside);
      log.error(
        `Song memory: ${name}.json could not be read; kept as ${aside}`,
      );
    } catch (error) {
      log.error(`Song memory: ${name}.json could not be read or kept`, error);
    }
    return loaded.settings;
  }
  if (loaded.dropped > 0) {
    log.warn(
      `Song memory: ${loaded.dropped} entries in ${name}.json could not be read and were left out`,
    );
  }
  if (loaded.rewrite) {
    save(loaded.settings);
  }
  return loaded.settings;
};
