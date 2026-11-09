/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import {
  ANIMATIONS_DIR,
  MAX_ANIMATION_FILE_BYTES,
  MAX_ANIMATIONS,
  readStudioAnimation,
  type IStudioAnimation,
} from '../../common/studioAnimation';

/**
 * A project's animations, read as a stranger's files (`projectFiles.ts`):
 * `animations/<name>.json` beside the sheet each one names. Every file is
 * found by its real path, which must stay inside the project's own folder,
 * and read only when it is a plain file within its size.
 */

/** A sheet larger than this is not one an animation's few frames need. */
export const MAX_SHEET_BYTES = 16 * 1024 * 1024;

export interface IProjectAnimation {
  animation: IStudioAnimation;
  /** The sheet's bytes, for the window to decode and cut. */
  sheet: Uint8Array;
}

/** The real path of `relative` when it is a plain file inside `folder`. */
const plainFileInside = async (
  folder: string,
  relative: string,
  limit: number,
): Promise<string | undefined> => {
  try {
    const home = await fs.promises.realpath(folder);
    const real = await fs.promises.realpath(path.join(folder, relative));
    const inside = path.relative(home, real);
    if (inside === '' || inside.startsWith('..') || path.isAbsolute(inside)) {
      return undefined;
    }
    const stats = await fs.promises.stat(real);
    return stats.isFile() && stats.nlink === 1 && stats.size <= limit
      ? real
      : undefined;
  } catch {
    return undefined;
  }
};

/** One animation by its name, or undefined when it cannot be read. */
export const readProjectAnimation = async (
  folder: string,
  name: string,
): Promise<IProjectAnimation | undefined> => {
  const file = await plainFileInside(
    folder,
    path.join(ANIMATIONS_DIR, `${name}.json`),
    MAX_ANIMATION_FILE_BYTES,
  );
  if (!file) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(await fs.promises.readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
  const animation = readStudioAnimation(name, raw);
  if (!animation) {
    return undefined;
  }
  const sheet = await plainFileInside(folder, animation.sheet, MAX_SHEET_BYTES);
  if (!sheet) {
    return undefined;
  }
  return {
    animation,
    sheet: new Uint8Array(await fs.promises.readFile(sheet)),
  };
};

/** Every animation the project keeps, by name, at most `MAX_ANIMATIONS`. */
export const readProjectAnimations = async (
  folder: string,
): Promise<IProjectAnimation[]> => {
  let names: string[];
  try {
    const home = await fs.promises.realpath(folder);
    const directory = path.join(home, ANIMATIONS_DIR);
    const stats = await fs.promises.lstat(directory);
    if (!stats.isDirectory()) {
      return [];
    }
    names = (await fs.promises.readdir(directory))
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.slice(0, -'.json'.length))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, MAX_ANIMATIONS);
  } catch {
    return [];
  }
  const read = await Promise.all(
    names.map((name) => readProjectAnimation(folder, name)),
  );
  return read.filter((found) => found !== undefined);
};
