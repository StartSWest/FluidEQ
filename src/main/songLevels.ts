/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How loud each song the engine has levelled turned out to be.
 *
 * Live leveling cannot know a song's loudest passage until it has played, so
 * the first time through, a quiet opening is raised and then turned down when
 * the chorus arrives. The engine reports what it learned when a song ends
 * (`lastSong` in its status), this keeps it, and the next time the song
 * starts the engine is told its level up front and levels it from the first
 * second (`songProgramme.ts`).
 *
 * `%APPDATA%\FluidEQ\song-levels.json`, keyed by the app's hash of the player,
 * title and artist — never the title itself — and capped, the least recently
 * heard songs going first.
 */

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import type { IFinishedSong } from '../common/engineHealth';
import writeFileAtomically from './atomicWrite';

export const SONG_LEVELS_FILENAME = 'song-levels.json';

/** More songs than this and the least recently heard are forgotten. */
export const SONG_LEVELS_LIMIT = 2000;

/**
 * A song heard for less than this taught the leveler its opening, not its
 * level: remembered, it would level the whole song at its intro's loudness
 * and the chorus would come in too loud on every later play.
 */
export const MIN_LEARNED_SECONDS = 30;

export interface ISongLevel {
  levelLufs: number;
  peakDb: number;
  seconds: number;
  /** `Date.now()` when last reported, for forgetting the oldest first. */
  heardAt: number;
}

export interface ISongLevelStore {
  lookup: (id: string) => ISongLevel | undefined;
  /** False when the report was too short to learn from. */
  record: (song: IFinishedSong) => boolean;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const readLevels = (filePath: string): Map<string, ISongLevel> => {
  const songs = new Map<string, ISongLevel>();
  try {
    const input: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!isObject(input) || input.version !== 1 || !isObject(input.songs)) {
      return songs;
    }
    Object.entries(input.songs).forEach(([id, entry]) => {
      if (
        /^[0-9a-f]{16}$/.test(id) &&
        isObject(entry) &&
        isFiniteNumber(entry.levelLufs) &&
        isFiniteNumber(entry.peakDb) &&
        isFiniteNumber(entry.seconds) &&
        isFiniteNumber(entry.heardAt)
      ) {
        songs.set(id, {
          levelLufs: entry.levelLufs,
          peakDb: entry.peakDb,
          seconds: entry.seconds,
          heardAt: entry.heardAt,
        });
      }
    });
  } catch {
    // Missing at first launch, or half-written after a power cut. Either way
    // the cost is songs levelled live again until they are relearned.
  }
  return songs;
};

export const createSongLevelStore = (
  userDataDir: string,
  now: () => number = Date.now,
): ISongLevelStore => {
  const filePath = path.join(userDataDir, SONG_LEVELS_FILENAME);
  let songs: Map<string, ISongLevel> | undefined;
  const loaded = () => {
    songs ??= readLevels(filePath);
    return songs;
  };

  const save = (all: Map<string, ISongLevel>) => {
    const kept = [...all.entries()]
      .sort(([, a], [, b]) => b.heardAt - a.heardAt)
      .slice(0, SONG_LEVELS_LIMIT);
    if (kept.length < all.size) {
      all.clear();
      kept.forEach(([id, level]) => all.set(id, level));
    }
    try {
      writeFileAtomically(
        filePath,
        JSON.stringify({ version: 1, songs: Object.fromEntries(kept) }),
      );
    } catch (error) {
      log.error('Could not save the song levels', error);
    }
  };

  return {
    lookup: (id) => loaded().get(id),
    record: (song) => {
      if (song.seconds < MIN_LEARNED_SECONDS) {
        return false;
      }
      const all = loaded();
      const known = all.get(song.id);
      // The loudest either play heard. A later play that was skipped before
      // its chorus measured less of the song, not a quieter song, and the
      // engine starts a remembered song from this level and only ever raises
      // it — so a level once learned is never talked down again.
      all.set(song.id, {
        levelLufs: Math.max(known?.levelLufs ?? -Infinity, song.levelLufs),
        peakDb: Math.max(known?.peakDb ?? -Infinity, song.peakDb),
        seconds: Math.max(known?.seconds ?? 0, song.seconds),
        heardAt: now(),
      });
      save(all);
      return true;
    },
  };
};
