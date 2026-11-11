/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { DOOR_SERVER } from './chatStream';
import { insideFolder } from './projectPath';

/**
 * The chat of a scene that came from outside FluidEQ
 * (`memberScenes/projectOrigin.ts`). Its files are somebody else's words,
 * and a line in one can tell the AI to run a command; a member whose own
 * Claude Code allows the shell broadly would never see a card. So in such a
 * project every command, every tool server and every file outside the
 * scene's folder is asked of the member, whatever their own rules allow,
 * and nothing can be allowed for always from there.
 *
 * How: an ask rule beats an allow rule from any settings file, so the
 * chat's own settings file (`--settings`) makes each of these a question;
 * the question comes to FluidEQ (`--permission-prompt-tool stdio`), which
 * answers the harmless ones itself - the scene's own files, FluidEQ's own
 * tools - and puts the rest on the card. Checked on Claude Code 2.1.321: a
 * bare `Bash` ask rule asks even for `cat` and `ls`, which Claude Code runs
 * unasked otherwise, and `mcp__*` asks for every tool server's tools.
 */
export const CAREFUL_SETTINGS = {
  permissions: {
    ask: [
      'Bash',
      'PowerShell',
      'mcp__*',
      'Read',
      'Edit',
      'Write',
      'MultiEdit',
      'NotebookEdit',
      'Glob',
      'Grep',
      'WebFetch',
      'WebSearch',
    ],
  },
};

const FILE_TOOLS = ['Read', 'Edit', 'Write', 'MultiEdit'];

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

/**
 * Whether a question in a careful chat needs no card: FluidEQ's own tools,
 * and the scene's own files, by where they really are. Everything else is
 * the member's to answer.
 */
export const needsNoCard = (
  folder: string,
  tool: string,
  input: Record<string, unknown>,
): boolean => {
  if (tool.startsWith(`mcp__${DOOR_SERVER}__`)) {
    return true;
  }
  if (FILE_TOOLS.includes(tool)) {
    return insideFolder(folder, input.file_path) !== undefined;
  }
  if (tool === 'Glob' || tool === 'Grep') {
    return (
      insideFolder(folder, input.path === undefined ? '.' : input.path) !==
        undefined &&
      relativePattern(tool === 'Glob' ? input.pattern : input.glob)
    );
  }
  return false;
};

/** Ends the key a careful chat was started on (`chatSessions.ts`). */
const CAREFUL_MARK = ':asks';

/** The key a chat's process was started on, with whether it is careful. */
export const startKey = (key: string, careful: boolean) =>
  careful ? `${key}${CAREFUL_MARK}` : key;

/** Whether a process was started careful, by the key it was started on. */
export const startedCareful = (key: string) => key.endsWith(CAREFUL_MARK);
