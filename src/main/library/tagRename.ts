/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A song's file renamed in its own folder, for the tag editor's file names
 * (Ivan, 2026-11-17: "rename the files too to have better format").
 *
 * NEVER OVER ANOTHER FILE. Node's rename on Windows replaces what is at the
 * target, so a check that the name is free followed by the rename would
 * lose a file that arrived between the two. The name is taken first, by
 * creating it empty with `wx` — which fails if anything is there — and the
 * rename then replaces only that empty file of our own. A name that differs
 * only in case is the same file on Windows and macOS, and is renamed
 * directly.
 *
 * What travels with the song: its lyrics beside it (`song.lrc`, `song.txt`,
 * the names every player looks for) and the copy FluidEQ keeps of them in
 * its own folder, which is filed under the song's path. A sidecar that
 * cannot follow is left where it is: the song is renamed all the same, and
 * the lyrics are still in the folder for anybody to rename.
 */

import fs from 'fs';
import path from 'path';
import { LYRICS_FILE_EXTENSIONS } from '../../common/library/lyricsImport';
import { sidecarPath, storedLyricsPath } from './libraryLyricsPlaces';
import { isLockError } from './tagWrite';

export type TRenameOutcome =
  | { state: 'renamed'; newPath: string }
  | { state: 'missing' | 'locked' }
  | { state: 'failed'; reason: 'taken' | 'rename' };

const statOf = async (filePath: string): Promise<fs.Stats | undefined> => {
  try {
    return await fs.promises.stat(filePath);
  } catch {
    return undefined;
  }
};

const isSameFile = (a: fs.Stats, b: fs.Stats): boolean =>
  a.dev === b.dev && a.ino === b.ino;

/** Moves `from` to `to` only where nothing else is at `to` (the same file
 * is, for a change of case alone); quietly otherwise. */
const follow = async (from: string, to: string): Promise<void> => {
  const source = await statOf(from);
  const target = await statOf(to);
  if (
    source === undefined ||
    from === to ||
    (target !== undefined && !isSameFile(source, target))
  ) {
    return;
  }
  try {
    await fs.promises.rename(from, to);
  } catch (error) {
    // eslint-disable-next-line no-console -- context-rich error before it is dropped; the song itself is renamed
    console.error(`Could not move ${from} beside its renamed song`, error);
  }
};

/** The lyrics a renamed song had, moved after it. */
const moveLyrics = async (
  fromPath: string,
  toPath: string,
  lyricsStoreDir: string,
): Promise<void> => {
  await LYRICS_FILE_EXTENSIONS.reduce(async (done, extension) => {
    await done;
    await follow(
      sidecarPath(fromPath, extension),
      sidecarPath(toPath, extension),
    );
    await follow(
      storedLyricsPath(lyricsStoreDir, fromPath, extension),
      storedLyricsPath(lyricsStoreDir, toPath, extension),
    );
  }, Promise.resolve());
};

/** A CUE sheet past this is not one; it is left alone. */
const MAX_CUE_BYTES = 256 * 1024;

const escapePattern = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A CUE sheet beside the song that names its file (`FILE "old.mp3" MP3`)
 * names the new one, so a player reading the sheet still finds it. Only a
 * sheet that reads as UTF-8 — which plain ASCII does — is touched: one in
 * an old code page would be written back in the wrong one. Written through
 * a copy renamed into place, like every file here.
 */
const followInCueSheets = async (
  folder: string,
  fromName: string,
  toName: string,
): Promise<void> => {
  let names: string[];
  try {
    names = await fs.promises.readdir(folder);
  } catch {
    return;
  }
  const quoted = new RegExp(
    `^(\\s*FILE\\s+")${escapePattern(fromName)}("\\s)`,
    'gim',
  );
  await names
    .filter((name) => name.toLowerCase().endsWith('.cue'))
    .reduce(async (done, name) => {
      await done;
      const sheetPath = path.join(folder, name);
      try {
        const bytes = await fs.promises.readFile(sheetPath);
        if (bytes.length > MAX_CUE_BYTES) {
          return;
        }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const next = text.replace(
          quoted,
          (_, head: string, tail: string) => `${head}${toName}${tail}`,
        );
        if (next === text) {
          return;
        }
        // TextDecoder drops a byte order mark; one the file had is kept.
        const hasMark =
          bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
        const temporary = `${sheetPath}.${process.pid}.fluideq-cue`;
        await fs.promises.writeFile(
          temporary,
          `${hasMark ? String.fromCharCode(0xfeff) : ''}${next}`,
          'utf8',
        );
        await fs.promises.rename(temporary, sheetPath);
      } catch (error) {
        // eslint-disable-next-line no-console -- context-rich error before it is dropped; the song itself is renamed
        console.error(`Could not name ${toName} in ${sheetPath}`, error);
      }
    }, Promise.resolve());
};

/**
 * Renames `filePath` to `fileName` plus its own extension, in its folder.
 * `fileName` is already clean (`cleanFileName`); the guard saw to that.
 */
export const renameTrackFile = async (
  filePath: string,
  fileName: string,
  lyricsStoreDir: string,
): Promise<TRenameOutcome> => {
  const parsed = path.parse(filePath);
  const newPath = path.join(parsed.dir, `${fileName}${parsed.ext}`);
  const current = await statOf(filePath);
  if (current === undefined) {
    return { state: 'missing' };
  }
  if (newPath === filePath) {
    return { state: 'renamed', newPath };
  }
  const there = await statOf(newPath);
  if (there !== undefined && !isSameFile(there, current)) {
    return { state: 'failed', reason: 'taken' };
  }
  // Nothing at the name: hold it, so nothing can arrive there before the
  // rename replaces it.
  let isHeld = false;
  if (there === undefined) {
    try {
      await (await fs.promises.open(newPath, 'wx')).close();
      isHeld = true;
    } catch (error) {
      const code =
        error instanceof Error && 'code' in error ? error.code : undefined;
      return {
        state: 'failed',
        reason: code === 'EEXIST' ? 'taken' : 'rename',
      };
    }
  }
  try {
    await fs.promises.rename(filePath, newPath);
  } catch (error) {
    if (isHeld) {
      await fs.promises.rm(newPath, { force: true }).catch(() => undefined);
    }
    if (isLockError(error)) {
      return { state: 'locked' };
    }
    // eslint-disable-next-line no-console -- context-rich error before it is flattened to a reason for the window
    console.error(`Could not rename ${filePath}`, error);
    return { state: 'failed', reason: 'rename' };
  }
  await moveLyrics(filePath, newPath, lyricsStoreDir);
  await followInCueSheets(
    parsed.dir,
    path.basename(filePath),
    path.basename(newPath),
  );
  return { state: 'renamed', newPath };
};
