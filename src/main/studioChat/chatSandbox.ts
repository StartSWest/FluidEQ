/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { DOOR_SERVER } from './chatStream';

/**
 * Where the Studio's agents may work: the open scene's project folder, on
 * that visualizer, and nothing else (Ivan, 2026-11-09: "make sure it doent
 * work outside of the viz folder or do extra task not related to the
 * vizulier", "like if I ask it to create app or modify fliid or anting it
 * doent have access from there"). Enforced, not asked for: the brief says
 * so too, but what a chat can do is decided here, whatever the member, a
 * scene file or the model itself writes.
 *
 * Three walls, each standing if another fails:
 *
 * - No tool that reaches past files. No shell (Claude Code runs Bash and
 *   PowerShell unsandboxed on Windows, and a command can go anywhere), no
 *   web, no agents: they are left out of the tool set (`chatTools`) and
 *   denied by name besides (`SANDBOX_DENIED`), which takes them out of
 *   Claude's context whatever the member's own settings allow.
 * - Every use of a file tool is a question (`SANDBOX_SETTINGS`: an ask rule
 *   beats an allow rule from any source, so the member's own allow rules and
 *   extra directories cannot answer it first), and FluidEQ answers every
 *   question itself (`sandboxAnswer`): yes for a path whose real location —
 *   links and junctions followed — is inside the project folder, no for
 *   anything else. No question reaches the member: there is nothing for them
 *   to say yes to.
 * - Claude Code's own fences on top: reads and writes outside the working
 *   folder blocked, the mode that asks nobody disabled, and no hooks.
 */

/** Claude Code's file tools, each asked of FluidEQ on every use. */
const FILE_TOOLS = ['Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep'];

/**
 * Taken out of the chat by name, beside being left out of `chatTools`: a
 * deny by bare name removes a tool from Claude's context, and outranks an
 * allow in any settings file.
 */
export const SANDBOX_DENIED = [
  'Bash',
  'PowerShell',
  'WebFetch',
  'WebSearch',
  'Task',
  'Agent',
  'NotebookEdit',
];

/** The chat's own settings file (`--settings`), above the member's own. */
export const SANDBOX_SETTINGS = {
  permissions: {
    ask: FILE_TOOLS,
    deny: SANDBOX_DENIED,
    blockReadsOutsideWorkingDirectories: true,
    blockWritesOutsideWorkingDirectories: true,
    disableBypassPermissionsMode: 'disable',
  },
  // A hook runs a command of its own before the permission rules are read;
  // none belongs in a chat that works on one scene.
  disableAllHooks: true,
};

/**
 * Inside the project, and still not the agent's to write: what another
 * program reads as instructions. A project's `.claude` is obeyed by the
 * member's own Claude Code wherever they open the folder (its hooks run
 * commands), and `.git` holds hooks git runs.
 */
const NOT_WRITTEN = ['.claude', '.git'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

/**
 * A pattern Glob or Grep reads from the folder they search, kept to that
 * folder: never a path of its own (absolute, from home, or climbing out).
 */
const relativePattern = (pattern: unknown) =>
  pattern === undefined ||
  (typeof pattern === 'string' &&
    !path.isAbsolute(pattern) &&
    !/^[a-zA-Z]:/.test(pattern) &&
    !pattern.startsWith('~') &&
    !pattern.split(/[\\/]/).includes('..'));

/** Whether the real path is one of the folders the agent may not write in. */
const inUnwritten = (folder: string, real: string) => {
  const root = realLocation(path.resolve(folder));
  if (!root) {
    return true;
  }
  const [first] = path.relative(root, real).split(path.sep);
  return NOT_WRITTEN.some((name) => sameCase(name) === sameCase(first ?? ''));
};

export type TSandboxAnswer =
  { allowed: true } | { allowed: false; why: string };

const OUTSIDE =
  "Refused by FluidEQ: the Studio works only inside this scene's project folder. Tell the member it cannot be done from the Studio, and do not try another way.";
const NOT_THIS_SCENE =
  "Refused by FluidEQ: the Studio's chat works only on this visualizer, with its files and FluidEQ's own tools. Tell the member it cannot be done from the Studio, and do not try another way.";
const NOT_WRITABLE =
  "Refused by FluidEQ: the project's .claude and .git folders are not the Studio's to change. Tell the member it cannot be done from the Studio, and do not try another way.";

/**
 * FluidEQ's answer to one of Claude Code's permission questions, from the
 * tool's own name (never its display name) and input. Allowed: a file tool
 * on a path inside the project folder, a skill (instructions, with no shell
 * to run anything through), and FluidEQ's own tools on the chat's door.
 */
export const sandboxAnswer = (
  folder: string,
  tool: string,
  input: Record<string, unknown>,
): TSandboxAnswer => {
  if (tool === 'Skill' || tool.startsWith(`mcp__${DOOR_SERVER}__`)) {
    return { allowed: true };
  }
  if (!FILE_TOOLS.includes(tool) || !isRecord(input)) {
    return { allowed: false, why: NOT_THIS_SCENE };
  }
  if (tool === 'Glob' || tool === 'Grep') {
    const searched = input.path === undefined ? '.' : input.path;
    const fine =
      insideFolder(folder, searched) !== undefined &&
      relativePattern(tool === 'Glob' ? input.pattern : input.glob);
    return fine ? { allowed: true } : { allowed: false, why: OUTSIDE };
  }
  const real = insideFolder(folder, input.file_path);
  if (!real) {
    return { allowed: false, why: OUTSIDE };
  }
  if (tool !== 'Read' && inUnwritten(folder, real)) {
    return { allowed: false, why: NOT_WRITABLE };
  }
  return { allowed: true };
};
