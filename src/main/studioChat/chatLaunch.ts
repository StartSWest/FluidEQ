/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
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
  DOOR_SERVER,
  readStreamLine,
  type TChatStreamEvent,
} from './chatStream';
import type {
  IChatCommand,
  IChatProcess,
  IChatProcessEvents,
} from './chatProcess';
import { readUsageLine, type TChatUsage } from './chatUsage';

/*
 * What FluidEQ does, and what it will not, follow Anthropic's conditions for
 * a product running Claude Code (code.claude.com/docs/en/legal-and-compliance):
 *
 * - It runs the member's own Claude Code, unmodified, as installed, signed in
 *   by the member through Claude Code's own sign-in. It never reads, keeps or
 *   sends that sign-in, and pays for or meters nothing: the use is the
 *   member's own plan's.
 * - Claude has the member's Claude Code with their plugins' skills and
 *   commands (Ivan, 2026-11-07: "claude need to have access to all plugins
 *   that claude has"), the files and the shell those skills run through
 *   (chatTools), and FluidEQ's own tools on the chat's own door
 *   (`chatServer.ts`): look at and hear the scene, lay out its artwork. Not the member's own
 *   tool servers, nor Claude Code's tools that make no scene, which cost the
 *   member's plan on every message (Ivan: "so it doent consujme more ussage
 *   from claude thatn it should"). Reading, searching and writing in the
 *   project's folder, and FluidEQ's tools, are allowed; so is whatever the
 *   member's own settings allow. Everything else is asked of the member, on a card in the chat,
 *   before it runs (`chatPermission.ts`), in Claude Code's own manual mode —
 *   never a mode the member's settings may have chosen that asks nobody,
 *   because the chat reads files in a project anybody may have shared.
 *   It used to be held to the five file tools with everything else refused
 *   unasked: a member's own picture plugin could not be reached at all.
 * - The member's Claude Code is driven as published, over its own stream,
 *   and never through the Agent SDK: Anthropic does not let a third-party
 *   app offer claude.ai login through the SDK, and does allow the member's
 *   own unmodified Claude Code signed in with their own plan. Its prompt
 *   caching is its own and needs nothing from FluidEQ but a prefix that
 *   stays put: the brief, the tools and the door are fixed for the life of
 *   the process.
 */

/**
 * Claude Code's built-in tools the chat offers: the files, the shell a
 * plugin's skill runs its scripts through (Bash, or PowerShell where Windows
 * has no Bash), and the skills themselves. Every built-in tool is sent with
 * every message, and Claude Code's whole set is 34 of them — scheduling,
 * agents, worktrees — none of which make a scene. Measured on 2.1.316, three
 * messages on one process: the whole set with the member's 92 plugin tool
 * servers came to about 52,000 input tokens a message, and the list grew
 * from 66 tools to 200 while those servers connected, so the second message
 * wrote a fresh cache instead of reading it; this set, with no tool server
 * of the member's, comes to about 29,400, every message after the first read
 * from Claude Code's own prompt cache (the old five file tools: 13,000).
 * The plugins' skills and commands all stay: a picture plugin such as
 * gpt-studio is a skill that runs `node`. PowerShell is Claude Code's on
 * Windows alone, so it is named there alone.
 */
export const chatTools = (platform: NodeJS.Platform = process.platform) =>
  platform === 'win32'
    ? 'Read,Edit,Write,Glob,Grep,Bash,PowerShell,Skill'
    : 'Read,Edit,Write,Glob,Grep,Bash,Skill';

/** Allowed without a card: the project's files, and FluidEQ's own tools. */
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
  `mcp__${DOOR_SERVER}__look_at_animation`,
];

/** A brief as a running chat remembers it: short, and the same for the same text. */
export const briefKey = (brief: string) =>
  createHash('sha256').update(brief).digest('hex');

/** A project's running Claude Code, as the chat keeps it. */
export interface IChatSession {
  process: IChatProcess;
  folder: string;
  /** Where it reaches FluidEQ's tools, kept to open them there again. */
  door?: { url: string; key: string };
  /** What it was started with: a different pick starts it again. */
  model: TStudioChatModel;
  effort: TStudioChatEffort;
  /**
   * The brief it was started with, as its hash (`briefKey`): a message
   * carrying another - FluidEQ's newer one - starts it again on the same
   * conversation, so every scene's chat works from the current brief.
   */
  brief: string;
  /** The reply being written, when one is. */
  reply?: Extract<TStudioChatEntry, { kind: 'claude' }>;
  /**
   * Where that reply began in the process's stream (`position`): a
   * restart reads the reply again from there (`chatAdopt.ts`).
   */
  replyFrom?: number;
  /** Aborted when that reply ends or is stopped: what it started ends too. */
  controller?: AbortController;
  stopping: boolean;
  /** Send now was pressed: the turn Claude Code ends for it ends well. */
  sendingNow: boolean;
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
  /**
   * FluidEQ's agent skills as a plugin folder of its own (`studioSkills.ts`),
   * when it could be placed.
   */
  skills?: string;
}

/**
 * How the member's Claude Code is started on a project: the brief in a file
 * beside the chat, the door in another that only this account reads, and
 * the project's folder as its world.
 */
export const claudeCodeCommand = ({
  own,
  folder,
  executable,
  brief,
  tools,
  model,
  effort,
  sessionId,
  skills,
}: IClaudeLaunch): IChatCommand => {
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
    // The working folder and the machine's details go in the first message,
    // out of the system prompt, which with the brief the same for every
    // project (`chatPrompt`) is then one cache for every scene's chat: a
    // second scene's chat read 13,700 tokens of it where it read 9,665 and
    // wrote the rest again (Claude Code 2.1.316).
    '--exclude-dynamic-system-prompt-sections',
    '--permission-mode',
    'manual',
    // Claude Code's questions come to the chat over its own stream.
    '--permission-prompt-tool',
    'stdio',
    '--tools',
    chatTools(),
    '--allowedTools',
    ...ALLOWED,
    // FluidEQ's door only (`--mcp-config` below): see chatTools for what the
    // member's own tool servers cost every message.
    '--strict-mcp-config',
    // The member's own settings and plugins, never a scene folder's: a
    // folder may have come from a forum post, and Claude Code obeys the
    // allow rules and hooks in a folder's .claude wherever it trusts that
    // folder.
    '--setting-sources',
    'user',
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
  if (skills) {
    // FluidEQ's own skills, from FluidEQ's own folder: the member's plugins
    // still come through their settings, and a scene folder's never do.
    args.push('--plugin-dir', skills);
  }
  if (sessionId) {
    args.push('--resume', sessionId);
  }
  return { executable, args, cwd: folder };
};

/**
 * What a started Claude Code says, as the chat's events, line by line, and
 * how it ended: `missing` when it could not start, `crashed` when it
 * closed, with the last of what it wrote to stderr for the log.
 */
export const claudeCodeEvents = (
  onEvent: (event: TChatStreamEvent) => void,
  onUsage: (usage: TChatUsage) => void,
  onEnded: (failure: TStudioChatFailure, errors: string) => void,
): IChatProcessEvents => {
  let errors = '';
  return {
    // The use first, so a turn's last line has its window counted before the
    // reply it ends is saved.
    line: (line) => {
      readUsageLine(line).forEach(onUsage);
      readStreamLine(line).forEach(onEvent);
    },
    errors: (chunk) => {
      errors = `${errors}${chunk}`.slice(-2000);
    },
    failed: () => onEnded('missing', errors),
    closed: () => onEnded('crashed', errors),
  };
};
