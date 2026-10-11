/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import {
  STUDIO_CHAT_MODEL_VERSIONS,
  type TStudioChatEffort,
  type TStudioChatModel,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import { DOOR_SERVER } from './chatStream';
import { startClaudeCode } from './claudeCode';

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
