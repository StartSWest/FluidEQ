/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { IProjectList, IStoredProject } from './studioProjects';

/**
 * Where a Studio project's files came from, as far as FluidEQ can tell
 * (Ivan, 2026-11-10: "we need to protect engine from allowing to run
 * malicious code", "they can build scenes with a Chinese model outside Fluid
 * and load them in Studio").
 *
 * The Studio's chat reads a project's files, and since 2.4 it has the
 * member's shell under the member's own rules. Text in a file nobody here
 * wrote - a shader comment, a note, a file's name - can tell the AI to run a
 * command, and a member whose own Claude Code allows the shell broadly would
 * get no card. So a project is one of:
 *
 * - own: made here ("New project", a restore of the member's own scene) and
 *   not changed outside FluidEQ's chat since;
 * - outside: a folder opened from elsewhere, or a project whose files changed
 *   between two chat turns by anything but the chat. Its chat asks before
 *   every command, whatever the member's rules allow (`chatForeign.ts`);
 * - trusted: the member said, in the Studio, that the scene is theirs.
 *   That stands for good: they answer for what is in it from then on.
 *
 * Kept in the app's own data with the project list, never in the folder,
 * where the scene itself could write it.
 */
export type TProjectOrigin = 'own' | 'outside' | 'trusted';

export const originOf = (project: IStoredProject): TProjectOrigin =>
  project.origin ?? 'own';

/** More files than a scene has; a folder past it is not read as untouched. */
const MAX_SEALED_FILES = 4000;
const MAX_SEAL_DEPTH = 8;

/**
 * What FluidEQ itself writes between chat turns - a control's value in
 * `pack.json`, pictures, sheets and their history - and the checks they
 * pass on the way in. Left out of the seal, or every slider moved would read
 * as a change from outside. What an AI is most likely to take as words to
 * follow - the shader, the world, notes, anything else - is all sealed.
 */
const UNSEALED = new Set([
  'pack.json',
  'art',
  'animations',
  'animation-history',
]);

/**
 * A digest of the project's files by name, size and time written, without
 * reading one: the same while nothing was added, removed or rewritten.
 * Undefined when the folder cannot be read whole, which is never "untouched".
 */
export const sealOf = (folder: string): string | undefined => {
  const hash = createHash('sha256');
  let count = 0;
  const walk = (dir: string, relative: string, depth: number): boolean => {
    let names: string[];
    try {
      names = fs.readdirSync(dir).sort();
    } catch {
      return false;
    }
    return names.every((name) => {
      if (depth === 0 && UNSEALED.has(name.toLowerCase())) {
        return true;
      }
      count += 1;
      if (count > MAX_SEALED_FILES) {
        return false;
      }
      const here = `${relative}/${name}`;
      let stats: fs.Stats;
      try {
        stats = fs.lstatSync(path.join(dir, name));
      } catch {
        return false;
      }
      if (stats.isDirectory() && !stats.isSymbolicLink()) {
        hash.update(`d:${here}\n`);
        return depth < MAX_SEAL_DEPTH
          ? walk(path.join(dir, name), here, depth + 1)
          : false;
      }
      hash.update(`f:${here}:${stats.size}:${Math.round(stats.mtimeMs)}\n`);
      return true;
    });
  };
  return walk(folder, '', 0) ? hash.digest('hex') : undefined;
};

const change = (
  list: IProjectList,
  id: string,
  next: (project: IStoredProject) => IStoredProject,
): IProjectList => ({
  ...list,
  projects: list.projects.map((project) =>
    project.id === id ? next(project) : project,
  ),
});

/**
 * The list after looking at a project's files before a chat turn: a project
 * of the member's own whose files are not as the last turn left them is from
 * outside from now on. One never sealed (listed before FluidEQ kept seals)
 * is sealed as it stands.
 */
export const withSealChecked = (
  list: IProjectList,
  id: string,
  seal: string | undefined,
): IProjectList => {
  const project = list.projects.find((entry) => entry.id === id);
  if (!project || originOf(project) !== 'own') {
    return list;
  }
  if (project.seal === undefined && seal !== undefined) {
    return change(list, id, (entry) => ({ ...entry, seal }));
  }
  if (project.seal === seal && seal !== undefined) {
    return list;
  }
  return change(list, id, ({ seal: _was, ...entry }) => ({
    ...entry,
    origin: 'outside',
  }));
};

/** The list after a chat turn wrote in a project: its own is sealed again. */
export const withSeal = (
  list: IProjectList,
  id: string,
  seal: string | undefined,
): IProjectList => {
  const project = list.projects.find((entry) => entry.id === id);
  if (!project || originOf(project) !== 'own' || seal === undefined) {
    return list;
  }
  return project.seal === seal
    ? list
    : change(list, id, (entry) => ({ ...entry, seal }));
};

/** The list with a project the member said is theirs. */
export const withTrusted = (list: IProjectList, id: string): IProjectList =>
  change(list, id, ({ seal: _was, ...entry }) => ({
    ...entry,
    origin: 'trusted',
  }));
