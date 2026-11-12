/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * Which version of each project was last published from this computer, and
 * what its folder held at that moment (Ivan, 2026-11-08: "show in the list
 * published if last version is on the lib on the server ... and no more
 * changes were made"). The gallery says what is live; only this can say
 * whether the folder still holds exactly what went out.
 *
 * The folder is judged whole, not the files `pack.json` names: a scene's
 * files are named in more than one place (its world's models are listed in
 * the world, which may be a file of its own), and a change anywhere in the
 * scene's folder - a new picture, an edit - is a change the member made
 * since publishing. Names starting with a dot are not the scene's: a tool's
 * own folder, the system's.
 */

export interface IPublishedRecord {
  sceneId: string;
  version: number;
  /** The folder's files, by path, size and time written, at that moment. */
  fingerprint: string;
}

export interface IProjectPublished {
  sceneId: string;
  version: number;
  /** The folder holds exactly what it held when this version went out. */
  unchanged: boolean;
}

/** Past this many entries the walk stops: a folder that size is no scene. */
const MAX_ENTRIES = 4000;
const MAX_DEPTH = 4;

const lineOf = (folder: string, full: string, stats: fs.Stats) =>
  `${path.relative(folder, full)}\t${stats.size}\t${Math.round(stats.mtimeMs)}`;

const hashOf = (lines: string[]) =>
  createHash('sha256').update(lines.sort().join('\n')).digest('hex');

/** Whether a walk goes into an entry: never a dot-name, never a link. */
const walked = (entry: fs.Dirent) =>
  !entry.name.startsWith('.') && !entry.isSymbolicLink();

/**
 * What a folder holds, as one hash of each file's path, size and time; read
 * here at once, for the one folder a publication just went out from.
 */
export const folderFingerprint = (folder: string): string | undefined => {
  const lines: string[] = [];
  const walk = (dir: string, depth: number) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      if (!walked(entry) || lines.length > MAX_ENTRIES) {
        return;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) {
          walk(full, depth + 1);
        }
      } else if (entry.isFile()) {
        lines.push(lineOf(folder, full, fs.statSync(full)));
      }
    });
  };
  try {
    walk(folder, 0);
  } catch {
    return undefined;
  }
  return hashOf(lines);
};

/**
 * `folderFingerprint`, read without holding FluidEQ up: on a OneDrive folder
 * each file costs about 0.1 ms, and the project list's 52 folders took 330 ms
 * read at once - on every save of the open scene.
 */
export const readFolderFingerprint = async (
  folder: string,
): Promise<string | undefined> => {
  const lines: string[] = [];
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (lines.length > MAX_ENTRIES) {
      return;
    }
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries.filter(walked).map(async (entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (depth < MAX_DEPTH) {
            await walk(full, depth + 1);
          }
        } else if (entry.isFile() && lines.length <= MAX_ENTRIES) {
          lines.push(lineOf(folder, full, await fs.promises.stat(full)));
        }
      }),
    );
  };
  try {
    await walk(folder, 0);
  } catch {
    return undefined;
  }
  return hashOf(lines);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRecord = (raw: unknown): IPublishedRecord | undefined =>
  isRecord(raw) &&
  typeof raw.sceneId === 'string' &&
  typeof raw.version === 'number' &&
  Number.isSafeInteger(raw.version) &&
  typeof raw.fingerprint === 'string'
    ? {
        sceneId: raw.sceneId,
        version: raw.version,
        fingerprint: raw.fingerprint,
      }
    : undefined;

/** One folder, however its path is spelled. */
export const folderKey = (folder: string) => {
  const resolved = path.resolve(folder);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};

export const createPublishedRecords = (
  userDataDir: string,
  logger?: { warn(message: string): void },
) => {
  const file = path.join(userDataDir, 'studio-published.json');
  const read = (): Record<string, IPublishedRecord> => {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isRecord(raw)) {
        return {};
      }
      return Object.fromEntries(
        Object.entries(raw).flatMap(([key, value]) => {
          const one = readRecord(value);
          return one ? [[key, one]] : [];
        }),
      );
    } catch {
      return {};
    }
  };
  let records = read();

  return {
    /**
     * A version just went out from this folder: what it holds now is it.
     * Never throws: the publication stands whether or not this is kept.
     */
    record: (folder: string, sceneId: string, version: number) => {
      const fingerprint = folderFingerprint(folder);
      if (!fingerprint) {
        return;
      }
      records = {
        ...records,
        [folderKey(folder)]: { sceneId, version, fingerprint },
      };
      try {
        writeFileAtomically(file, JSON.stringify(records), 0o600);
      } catch (error) {
        logger?.warn(
          `The published folder could not be kept: ${String(error)}`,
        );
      }
    },

    /** Whether a version of the scene in this folder went out, as known here. */
    has: (folder: string): boolean => records[folderKey(folder)] !== undefined,

    /**
     * What was last published from this folder and whether it is still what
     * the folder holds; nothing for a folder never published from here.
     */
    stateOf: async (folder: string): Promise<IProjectPublished | undefined> => {
      const one = records[folderKey(folder)];
      if (!one) {
        return undefined;
      }
      const now = await readFolderFingerprint(folder);
      return {
        sceneId: one.sceneId,
        version: one.version,
        unchanged: now === one.fingerprint,
      };
    },
  };
};

export type TPublishedRecords = ReturnType<typeof createPublishedRecords>;
