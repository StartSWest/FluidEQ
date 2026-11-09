/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * FluidEQ's own agent skills for making scenes (Ivan, 2026-11-09: "do this
 * as agents skills that works for any agent gpt, claude, etc"), in the open
 * Agent Skills format, shipped inside FluidEQ in `assets/studio/fluideq`:
 * a plugin folder Claude Code loads as it is (`--plugin-dir`; with no
 * manifest it is named after the folder, `fluideq`), and the text a prompt
 * for another AI carries (`aiPromptSkills.ts`).
 *
 * They live in FluidEQ and nowhere else, and update with it (Ivan, same
 * night: "we remove from the scenes and we store in fluid source code and
 * each time user open a chat gets injected"). The first version copied them
 * into every project's `.agents/skills` and into the chat's own folder;
 * a copy in a scene folder is a copy an update never reaches, so both are
 * gone, and `removePlacedSkills` takes back what that version placed.
 */

const SKILL_NAME = /^fluideq-[a-z0-9-]{1,48}$/;
const SKILL_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
/** Far above any skill's text; a file past it is not one FluidEQ shipped. */
const MAX_FILE_BYTES = 256 * 1024;
const MAX_FILES = 32;

export interface IStudioSkill {
  name: string;
  /** Each file by its path inside the skill's folder, `/`-separated. */
  files: ReadonlyArray<{ relative: string; bytes: Buffer }>;
}

/** `resourcesPath` is Electron's addition to `process` (see `roomHead.ts`). */
type TProcessWithResources = NodeJS.Process & { resourcesPath?: string };

/**
 * The plugin folder FluidEQ ships, beside the packaged app's resources or in
 * the checkout's own assets.
 */
export const shippedPluginDir = (): string => {
  const { resourcesPath: resources } = process as TProcessWithResources;
  const packaged =
    resources === undefined
      ? undefined
      : path.join(resources, 'assets', 'studio', 'fluideq');
  return packaged !== undefined && fs.existsSync(packaged)
    ? packaged
    : path.join(__dirname, '../../../assets/studio/fluideq');
};

const isPlainDirectory = (target: string) => {
  try {
    const stats = fs.lstatSync(target);
    return stats.isDirectory() && !stats.isSymbolicLink();
  } catch {
    return false;
  }
};

/** A skill's files, one folder deep at most, plain files only. */
const readSkillFiles = (dir: string, prefix = '', depth = 0) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry): { relative: string; bytes: Buffer }[] => {
      if (!SKILL_FILE.test(entry.name) || entry.isSymbolicLink()) {
        return [];
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return depth === 0
          ? readSkillFiles(full, `${prefix}${entry.name}/`, 1)
          : [];
      }
      const stats = fs.statSync(full);
      return entry.isFile() && stats.size <= MAX_FILE_BYTES
        ? [{ relative: `${prefix}${entry.name}`, bytes: fs.readFileSync(full) }]
        : [];
    });

/** Every skill FluidEQ ships: a `fluideq-*` folder holding a SKILL.md. */
export const readShippedSkills = (
  plugin: string = shippedPluginDir(),
): IStudioSkill[] => {
  const dir = path.join(plugin, 'skills');
  let names: string[];
  try {
    names = fs.readdirSync(dir).filter((name) => SKILL_NAME.test(name));
  } catch {
    return [];
  }
  return names.sort().flatMap((name): IStudioSkill[] => {
    const folder = path.join(dir, name);
    if (!isPlainDirectory(folder)) {
      return [];
    }
    const files = readSkillFiles(folder)
      .sort((a, b) => a.relative.localeCompare(b.relative))
      .slice(0, MAX_FILES);
    return files.some(({ relative }) => relative === 'SKILL.md')
      ? [{ name, files }]
      : [];
  });
};

/**
 * What the skills say, as one hash: a chat started on other skills is
 * started again on its next message, as it is for another brief, and a
 * release that leaves them alone costs it nothing.
 */
export const skillsDigest = (skills: readonly IStudioSkill[]): string => {
  const hash = createHash('sha256');
  skills.forEach(({ name, files }) => {
    hash.update(`${name}\u0000`);
    files.forEach(({ relative, bytes }) => {
      hash.update(`${relative}\u0000${bytes.length}\u0000`);
      hash.update(bytes);
    });
  });
  return hash.digest('hex');
};

/** Every file under `dir`, `/`-separated, plain files only; none past a link. */
const plainFilesUnder = (
  dir: string,
  prefix = '',
): { relative: string; full: string }[] | undefined => {
  const found: { relative: string; full: string }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const allPlain = entries.every((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      return false;
    }
    if (entry.isDirectory()) {
      const inner = plainFilesUnder(full, `${prefix}${entry.name}/`);
      if (!inner) {
        return false;
      }
      found.push(...inner);
      return true;
    }
    if (entry.isFile()) {
      found.push({ relative: `${prefix}${entry.name}`, full });
      return true;
    }
    return false;
  });
  return allPlain ? found : undefined;
};

/** Removes `dir` and the folders under it once they are empty. */
const removeEmptyFolders = (dir: string) => {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      removeEmptyFolders(path.join(dir, entry.name));
    }
  });
  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
};

/**
 * Takes back the skills the first version of this placed in a project's
 * `.agents/skills`: a `fluideq-*` folder whose files are, byte for byte, a
 * skill FluidEQ ships and nothing else. One the member or their AI changed,
 * or added to, is theirs and stays; nothing is followed through a link; and
 * `.agents` goes only once nothing is left in it. True when anything went.
 */
export const removePlacedSkills = (
  folder: string,
  shipped: readonly IStudioSkill[],
): boolean => {
  const agents = path.join(folder, '.agents');
  const skills = path.join(agents, 'skills');
  if (!isPlainDirectory(agents) || !isPlainDirectory(skills)) {
    return false;
  }
  let removed = false;
  shipped.forEach(({ name, files }) => {
    const placed = path.join(skills, name);
    if (!isPlainDirectory(placed)) {
      return;
    }
    const there = plainFilesUnder(placed);
    const ours =
      there !== undefined &&
      there.length === files.length &&
      there.every(({ relative, full }) => {
        const file = files.find((one) => one.relative === relative);
        return file !== undefined && fs.readFileSync(full).equals(file.bytes);
      });
    if (!ours) {
      return;
    }
    there.forEach(({ full }) => fs.unlinkSync(full));
    removeEmptyFolders(placed);
    removed = true;
  });
  if (removed) {
    [skills, agents].forEach((dir) => {
      if (fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
      }
    });
  }
  return removed;
};

/**
 * Takes back the copy of the plugin the first version of this kept in the
 * chat's own folder: FluidEQ's own, so it goes whole, unless it is a link.
 */
export const removeOldChatPlugin = (root: string): void => {
  const copy = path.join(root, 'skills-plugin');
  if (isPlainDirectory(copy) && plainFilesUnder(copy) !== undefined) {
    fs.rmSync(copy, { recursive: true });
  }
};
