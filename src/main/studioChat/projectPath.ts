/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';

/**
 * Whether a path FluidEQ's own Studio tools are handed lies inside the open
 * project's folder, by where it really is: links and junctions followed,
 * never by a reparse attribute — a OneDrive folder marks every file as a
 * reparse point (a cloud placeholder), and a check on the attribute would
 * call every one of them a link. FluidEQ's tools (the sheets, the animation
 * import) read and write only inside the project; Claude's own tools follow
 * the member's own Claude Code permissions.
 */

const sameCase = (value: string) =>
  process.platform === 'win32' ? value.toLowerCase() : value;

/**
 * Where `target` really is: the deepest part of it that exists, resolved
 * through every link and junction, with the rest that does not exist yet
 * after it. A file about to be written does not exist; the folder it goes
 * in does, and that is where a junction would lead out.
 */
const realLocation = (
  target: string,
  rest: readonly string[] = [],
): string | undefined => {
  try {
    return path.join(fs.realpathSync.native(target), ...rest);
  } catch {
    const parent = path.dirname(target);
    return parent === target
      ? undefined
      : realLocation(parent, [path.basename(target), ...rest]);
  }
};

/**
 * The real location of `raw`, read from the project folder, when it lies
 * inside that folder; undefined when it is anywhere else or cannot be told.
 */
export const insideFolder = (
  folder: string,
  raw: unknown,
): string | undefined => {
  if (typeof raw !== 'string' || raw === '' || raw.includes('\0')) {
    return undefined;
  }
  const root = realLocation(path.resolve(folder));
  const real = realLocation(path.resolve(folder, raw));
  if (!root || !real) {
    return undefined;
  }
  const base = sameCase(root);
  const here = sameCase(real);
  return here === base || here.startsWith(`${base}${path.sep}`)
    ? real
    : undefined;
};
