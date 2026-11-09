/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * FluidEQ's own agent skills for making scenes (Ivan, 2026-11-09: "do this
 * as agents skills that works for any agent gpt, claude, etc"): folders in
 * the open Agent Skills format (a SKILL.md with a name and a description,
 * read by Claude Code, Codex, Gemini CLI and the rest), shipped in
 * `assets/studio/skills` and handed to an agent two ways:
 * - the Studio's own chat loads them as a plugin of FluidEQ's own, from the
 *   chat's folder (`--plugin-dir`): it reads nothing from a scene folder's
 *   `.claude`, which may have come from anybody (`chatLaunch.ts`);
 * - any other agent finds them in the project, in `.agents/skills`, where
 *   Codex, Gemini CLI and the others look.
 * Only folders named `fluideq-*` are FluidEQ's: nothing else in either place
 * is touched.
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

/** Beside the packaged app's resources, or the checkout's own assets. */
export const shippedSkillsDir = (): string => {
  const { resourcesPath: resources } = process as TProcessWithResources;
  const packaged =
    resources === undefined
      ? undefined
      : path.join(resources, 'assets', 'studio', 'skills');
  return packaged !== undefined && fs.existsSync(packaged)
    ? packaged
    : path.join(__dirname, '../../../assets/studio/skills');
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
  dir: string = shippedSkillsDir(),
): IStudioSkill[] => {
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
    const files = readSkillFiles(folder).slice(0, MAX_FILES);
    return files.some(({ relative }) => relative === 'SKILL.md')
      ? [{ name, files }]
      : [];
  });
};

/**
 * Every directory from `base` down to `target` is a plain one, or not there
 * yet: a scene folder may hold a link named `.agents`, and writing through
 * it would write wherever it points.
 */
const noLinkBetween = (base: string, target: string) => {
  const parts = path.relative(base, target).split(path.sep).filter(Boolean);
  let at = base;
  return parts.every((part) => {
    at = path.join(at, part);
    try {
      const stats = fs.lstatSync(at);
      return stats.isDirectory() && !stats.isSymbolicLink();
    } catch {
      return true;
    }
  });
};

const sameBytes = (file: string, bytes: Buffer) => {
  try {
    const stats = fs.lstatSync(file);
    return stats.isFile() && fs.readFileSync(file).equals(bytes);
  } catch {
    return false;
  }
};

/**
 * The skills written under `target` (`base` the folder it must stay inside),
 * each file only where it differs, written beside and renamed over so an
 * agent never reads half of one. A `fluideq-*` folder FluidEQ no longer
 * ships is left as it is: removing a folder in somebody's project is not
 * worth what a stale skill costs. False where a link stood in the way.
 */
export const placeSkills = (
  base: string,
  target: string,
  skills: readonly IStudioSkill[],
): boolean => {
  if (!isPlainDirectory(base)) {
    return false;
  }
  return skills.every(({ name, files }) =>
    files.every(({ relative, bytes }) => {
      const file = path.join(target, name, ...relative.split('/'));
      if (!noLinkBetween(base, path.dirname(file))) {
        return false;
      }
      if (!sameBytes(file, bytes)) {
        writeFileAtomically(file, bytes);
      }
      return true;
    }),
  );
};

// Checked with `claude plugin validate` and, loaded the way the chat loads it
// (`--plugin-dir` with `--setting-sources user`), `claude plugin details`:
// both skills listed, about 280 tokens a message until one is used
// (Claude Code 2.1.316).
const PLUGIN_MANIFEST = `${JSON.stringify(
  {
    name: 'fluideq',
    version: '1.0.0',
    description:
      "FluidEQ's own skills for making visualizer scenes in the Studio.",
    license: 'GPL-3.0-or-later',
  },
  null,
  2,
)}\n`;

/**
 * The Studio chat's plugin of FluidEQ's skills, in the chat's own folder,
 * for `--plugin-dir`; none when FluidEQ ships no skills.
 */
export const placeChatSkills = (
  root: string,
  skills: readonly IStudioSkill[],
): string | undefined => {
  if (skills.length === 0) {
    return undefined;
  }
  const plugin = path.join(root, 'skills-plugin');
  fs.mkdirSync(plugin, { recursive: true });
  const manifest = path.join(plugin, '.claude-plugin', 'plugin.json');
  const bytes = Buffer.from(PLUGIN_MANIFEST);
  if (!sameBytes(manifest, bytes)) {
    writeFileAtomically(manifest, bytes);
  }
  return placeSkills(root, path.join(plugin, 'skills'), skills)
    ? plugin
    : undefined;
};

/** The skills in a project, in `.agents/skills`, for any agent working there. */
export const placeProjectSkills = (
  folder: string,
  skills: readonly IStudioSkill[],
): boolean =>
  placeSkills(folder, path.join(folder, '.agents', 'skills'), skills);
