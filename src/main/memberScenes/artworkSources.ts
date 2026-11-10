/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';
import { insideFolder } from '../studioChat/projectPath';
import { HISTORY_DIR } from './animationHistory';

/**
 * Which picture each piece of the scene's artwork was packed from: region
 * id → `art/<name>.png`, so the Animations tab can tell which animations
 * the scene plays (Ivan, 2026-11-10: an unused animation deletes at once; a
 * used one asks the chat to take it out and fix the scene). pack.json keeps
 * only where each region is - the server holds a region to its id, place
 * and size, and nothing else may ride there - so the record is an authoring
 * file of the project's, beside the animations' history, which publishing
 * never reads.
 *
 * Read and written like the history: inside the project by real path,
 * plain folders that are no links, a plain one-name file within bounds,
 * written through a temporary file and a rename. Only well-formed entries
 * are ever read back.
 */

export const ARTWORK_SOURCES_FILE = `${HISTORY_DIR}/artwork-sources.json`;
const MAX_BYTES = 64 * 1024;
/** As many as pack_artwork packs in one artwork. */
const MAX_ENTRIES = 64;
const REGION_ID = /^[a-z][a-z0-9_-]{0,31}$/;
const SOURCE = /^art\/[a-z][a-z0-9-]{0,39}\.png$/;

export type TArtworkSources = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Only the entries that are a region id and a picture in `art/`. */
export const cleanSources = (raw: unknown): TArtworkSources =>
  isRecord(raw)
    ? Object.fromEntries(
        Object.entries(raw)
          .filter(
            (entry): entry is [string, string] =>
              REGION_ID.test(entry[0]) &&
              typeof entry[1] === 'string' &&
              SOURCE.test(entry[1]),
          )
          .slice(0, MAX_ENTRIES),
      )
    : {};

/** The project's record, empty when it has none or it cannot be read. */
export const readArtworkSources = (folder: string): TArtworkSources => {
  const file = insideFolder(folder, ARTWORK_SOURCES_FILE);
  if (!file) {
    return {};
  }
  try {
    const stats = fs.lstatSync(file);
    if (!stats.isFile() || stats.nlink !== 1 || stats.size > MAX_BYTES) {
      return {};
    }
    return cleanSources(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return {};
  }
};

/**
 * Writes the record whole: a piece left out of the artwork is gone from it.
 * False when the folder is not a plain one inside the project.
 */
export const writeArtworkSources = (
  folder: string,
  sources: TArtworkSources,
): boolean => {
  // Where the folder would be, links followed, before anything is made.
  if (!insideFolder(folder, HISTORY_DIR)) {
    return false;
  }
  const dir = path.join(folder, HISTORY_DIR);
  try {
    const stats = fs.lstatSync(dir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      return false;
    }
  } catch {
    fs.mkdirSync(dir, { recursive: true });
  }
  const file = insideFolder(folder, ARTWORK_SOURCES_FILE);
  if (!file) {
    return false;
  }
  writeFileAtomically(
    file,
    `${JSON.stringify(cleanSources(sources), null, 2)}\n`,
  );
  return true;
};
