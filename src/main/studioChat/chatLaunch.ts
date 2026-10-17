/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ChildProcess } from 'child_process';
import path from 'path';
import {
  STUDIO_CHAT_MODEL_VERSIONS,
  type TStudioChatEffort,
  type TStudioChatEntry,
  type TStudioChatFailure,
  type TStudioChatModel,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import {
  createLineReader,
  DOOR_SERVER,
  readStreamLine,
  type TChatStreamEvent,
} from './chatStream';
import { readUsageLine, type TChatUsage } from './chatUsage';
import { startClaudeCode } from './claudeCode';

/*
 * What FluidEQ does, and what it will not, follow Anthropic's conditions for
 * a product running Claude Code (code.claude.com/docs/en/legal-and-compliance):
 *
 * - It runs the member's own Claude Code, unmodified, as installed, signed in
 *   by the member through Claude Code's own sign-in. It never reads, keeps or
 *   sends that sign-in, and pays for or meters nothing: the use is the
 *   member's own plan's.
 * - Claude works in the open project's folder and nowhere else: its tools are
 *   reading, searching and writing files there (`--permission-mode dontAsk`
 *   refuses everything else without asking), and FluidEQ's tools on the
 *   chat's own door (`chatServer.ts`): look at and hear the scene, and make
 *   pictures with the member's ChatGPT, which asks the member every time
 *   (`chatPictures.ts`).
 */

/** The tools Claude Code is given, and what each may touch. */
const TOOLS = 'Read,Edit,Write,Glob,Grep';
const ALLOWED = [
  'Read(./**)',
  'Edit(./**)',
  'Write(./**)',
  'Glob',
  'Grep',
  `mcp__${DOOR_SERVER}__look_at_scene`,
  `mcp__${DOOR_SERVER}__hear_the_music`,
  `mcp__${DOOR_SERVER}__make_picture`,
  `mcp__${DOOR_SERVER}__pack_artwork`,
];

/** A project's running Claude Code, as the chat keeps it. */
export interface IChatSession {
  child: ChildProcess;
  folder: string;
  /** What it was started with: a different pick starts it again. */
  model: TStudioChatModel;
  effort: TStudioChatEffort;
  /** The reply being written, when one is. */
  reply?: Extract<TStudioChatEntry, { kind: 'claude' }>;
  /** Aborted when that reply ends or is stopped: what it started ends too. */
  controller?: AbortController;
  stopping: boolean;
  /**
   * Every line written and not yet read, oldest first: the queued messages
   * it carried, by id, or none for a line of the chat's own (a message shown
   * when it was sent, /compact). Claude Code reads them in order and says so
   * once for each (`read`), so the head is always the one just read.
   */
  written: string[][];
}

export interface IClaudeLaunch {
  /** The chat's own folder for this project, where its files are kept. */
  own: string;
  /** The project's folder, where Claude works. */
  folder: string;
  executable: string;
  brief: string;
  /** The chat's door (`chatServer.ts`), or nothing when it did not open. */
  tools: { url: string; key: string } | undefined;
  model: TStudioChatModel;
  effort: TStudioChatEffort;
  /** The conversation to carry on, when there is one. */
  sessionId: string | undefined;
}

/**
 * The member's Claude Code started on a project: the brief in a file beside
 * the chat, the door in another that only this account reads, and the
 * project's folder as its world.
 */
export const launchClaudeCode = ({
  own,
  folder,
  executable,
  brief,
  tools,
  model,
  effort,
  sessionId,
}: IClaudeLaunch) => {
  const briefFile = path.join(own, 'brief.txt');
  writeFileAtomically(briefFile, brief, 0o600);
  const args = [
    '-p',
    '--input-format',
    'stream-json',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    // Every line written comes back once Claude Code has read it, which is
    // how a message queued mid-reply knows when Claude took it.
    '--replay-user-messages',
    '--append-system-prompt-file',
    briefFile,
    '--permission-mode',
    'dontAsk',
    '--tools',
    TOOLS,
    '--allowedTools',
    ...ALLOWED,
    '--strict-mcp-config',
    ...(model === 'default'
      ? []
      : ['--model', STUDIO_CHAT_MODEL_VERSIONS[model].id]),
    ...(effort === 'default' ? [] : ['--effort', effort]),
  ];
  if (tools) {
    // The door's key goes in a file only this account reads, beside the
    // chat, never on the command line where any process can list it.
    const mcpFile = path.join(own, 'fluideq-mcp.json');
    writeFileAtomically(
      mcpFile,
      JSON.stringify({
        mcpServers: {
          [DOOR_SERVER]: {
            type: 'http',
            url: tools.url,
            headers: { Authorization: `Bearer ${tools.key}` },
          },
        },
      }),
      0o600,
    );
    args.push('--mcp-config', mcpFile);
  }
  if (sessionId) {
    args.push('--resume', sessionId);
  }
  return startClaudeCode(executable, args, {
    cwd: folder,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
};

/**
 * What a started Claude Code says, as the chat's events, line by line, and
 * how it ended: `missing` when it could not start, `crashed` when it
 * closed, with the last of what it wrote to stderr for the log.
 */
export const watchClaudeCode = (
  child: ChildProcess,
  onEvent: (event: TChatStreamEvent) => void,
  onUsage: (usage: TChatUsage) => void,
  onEnded: (failure: TStudioChatFailure, errors: string) => void,
) => {
  let errors = '';
  // The use first, so a turn's last line has its window counted before the
  // reply it ends is saved.
  const reader = createLineReader((line) => {
    readUsageLine(line).forEach(onUsage);
    readStreamLine(line).forEach(onEvent);
  });
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => reader.push(chunk));
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    errors = `${errors}${chunk}`.slice(-2000);
  });
  child.on('error', () => onEnded('missing', errors));
  child.on('close', () => onEnded('crashed', errors));
  // A write to a process that has just ended is reported here, and its
  // close follows; the reply is finished there.
  child.stdin?.on('error', () => undefined);
};
