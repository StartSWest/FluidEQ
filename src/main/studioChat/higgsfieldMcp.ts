/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn, type ChildProcess } from 'child_process';
import type { THiggsfieldAccount } from '../../common/studioMakers';
import {
  findClaudeCode,
  startClaudeCode,
  systemEnv,
  type IClaudeCodeEnv,
} from './claudeCode';
import {
  chooseHiggsfield,
  HIGGSFIELD_MCP_URL,
  HIGGSFIELD_SERVER,
  readHiggsfieldServers,
  type IHiggsfieldServer,
} from './studioMakers';

/**
 * Higgsfield in the member's own Claude Code, through Claude Code's own
 * `mcp` commands (Ivan, 2026-11-11: "que Fluid sea capaz de que la gente
 * pueda instalar el último MCP de Higgsfield"):
 *
 * - whether it is there and signed in (`claude mcp list`), which the chat
 *   then corrects by what its own Claude Code reports (`chooseHiggsfield`):
 *   the list connects afresh, and a claude.ai connector it calls Connected
 *   reaches no headless Claude Code;
 * - adding it for the member (`claude mcp add --transport http --scope user
 *   higgsfield https://mcp.higgsfield.ai/mcp`), on their press. It is hosted
 *   by Higgsfield, so it is always their newest and nothing is installed;
 * - its sign-in (`claude mcp login`), which opens Higgsfield's own page in
 *   the browser. The chat cannot do this: it runs Claude Code over a stream,
 *   where nothing can be answered, so it is run here in a window of its own.
 *
 * Claude Code keeps the sign-in. FluidEQ passes these fixed words and
 * nothing a scene or a page supplied, and reads only what Claude Code
 * prints.
 */

const MAX_OUTPUT = 256 * 1024;

/**
 * A server's name as these commands will pass it on: one Claude Code
 * printed, held to letters, digits, spaces and . _ @ - because it goes into
 * a command line inside quotes, where a quote would end the quoting and a
 * percent sign would be read as a variable.
 */
const SAFE_NAME = /^[\w .@-]{1,80}$/;

const outputOf = (child: ChildProcess): Promise<string> =>
  new Promise((resolve) => {
    let out = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      out = (out + chunk.toString('utf8')).slice(0, MAX_OUTPUT);
    });
    child.on('error', () => resolve(''));
    child.on('close', () => resolve(out));
  });

/** Every Higgsfield among the member's servers, as `claude mcp list` has them. */
export const higgsfieldServers = async (
  where: IClaudeCodeEnv = systemEnv(),
): Promise<IHiggsfieldServer[]> => {
  const executable = findClaudeCode(where);
  if (!executable) {
    return [];
  }
  return readHiggsfieldServers(
    await outputOf(
      startClaudeCode(executable, ['mcp', 'list'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      }),
    ),
  );
};

/**
 * Higgsfield among the member's servers as a chat no turn has reported
 * on yet can use it (`chooseHiggsfield`), or undefined when it is not there.
 */
export const higgsfieldServer = async (
  where: IClaudeCodeEnv = systemEnv(),
): Promise<IHiggsfieldServer | undefined> =>
  chooseHiggsfield(await higgsfieldServers(where));

export const higgsfieldAccount = async (
  where: IClaudeCodeEnv = systemEnv(),
): Promise<THiggsfieldAccount> =>
  (await higgsfieldServer(where))?.account ?? { state: 'missing' };

/** Adds Higgsfield's hosted server to the member's own Claude Code. */
export const addHiggsfield = async (
  where: IClaudeCodeEnv = systemEnv(),
): Promise<void> => {
  const executable = findClaudeCode(where);
  if (!executable) {
    return;
  }
  await outputOf(
    startClaudeCode(
      executable,
      [
        'mcp',
        'add',
        '--transport',
        'http',
        '--scope',
        'user',
        HIGGSFIELD_SERVER,
        HIGGSFIELD_MCP_URL,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
    ),
  );
};

/**
 * Has Claude Code forget its sign-in to the server called `name`
 * (`claude mcp logout`), which is how another account gets used: the
 * sign-in that follows starts from nobody.
 */
export const signOutOfHiggsfield = async (
  name: string,
  where: IClaudeCodeEnv = systemEnv(),
): Promise<void> => {
  const executable = findClaudeCode(where);
  if (!executable || !SAFE_NAME.test(name)) {
    return;
  }
  await outputOf(
    startClaudeCode(executable, ['mcp', 'logout', name], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }),
  );
};

/**
 * Claude Code's own sign-in to the server called `name`, which opens
 * Higgsfield's page in the browser. On Windows it runs in a console window
 * of its own, as Claude Code's sign-in does (`signInToClaudeCode`), so
 * anything it says or asks is in front of the member. Settles when that
 * has ended, however it ended: the state is asked again afterwards.
 */
export const signInToHiggsfield = async (
  name: string,
  where: IClaudeCodeEnv = systemEnv(),
): Promise<void> => {
  const executable = findClaudeCode(where);
  if (!executable || !SAFE_NAME.test(name)) {
    return;
  }
  const child =
    where.platform === 'win32'
      ? spawn(
          where.env.ComSpec ?? 'cmd.exe',
          [
            '/d',
            '/s',
            '/c',
            `"start "Higgsfield" /wait "${executable}" mcp login "${name}""`,
          ],
          { windowsVerbatimArguments: true, stdio: 'ignore' },
        )
      : startClaudeCode(executable, ['mcp', 'login', name], {
          stdio: 'ignore',
        });
  await new Promise<void>((resolve) => {
    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
};
