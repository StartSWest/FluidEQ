/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  accountEmailOf,
  accountPlanOf,
  type TStudioChatAvailability,
} from '../../common/studioChat';

/**
 * The member's own Claude Code: found where it was installed, asked whether
 * it is signed in, and started — always the program as Anthropic ships it,
 * never a copy of FluidEQ's, and never with a sign-in of FluidEQ's.
 *
 * FluidEQ does not read the member's sign-in: `auth status` is asked only
 * whether it is signed in, the plan's name and the account's email, to show
 * whose plan the chat runs on, and the sign-in itself is
 * Claude Code's own (`auth login`), on Anthropic's page in the browser.
 */

export interface IClaudeCodeEnv {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  home: string;
  isFile(target: string): boolean;
}

const isFile = (target: string) => {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
};

export const systemEnv = (): IClaudeCodeEnv => ({
  platform: process.platform,
  env: process.env,
  home: os.homedir(),
  isFile,
});

/**
 * Where Claude Code is, or undefined. The member's PATH first — the one
 * they run from a terminal — and then the places its installers put it,
 * because an app started from the Start menu, the Dock or a desktop file is
 * often given a PATH without the member's own additions.
 */
export const findClaudeCode = ({
  platform,
  env,
  home,
  isFile: exists,
}: IClaudeCodeEnv): string | undefined => {
  const windows = platform === 'win32';
  const names = windows ? ['claude.exe', 'claude.cmd'] : ['claude'];
  const onPath = (env.PATH ?? env.Path ?? '')
    .split(windows ? ';' : ':')
    .filter(Boolean)
    .flatMap((dir) => names.map((name) => path.join(dir, name)));
  const installed = windows
    ? [
        path.join(home, '.local', 'bin', 'claude.exe'),
        ...(env.APPDATA ? [path.join(env.APPDATA, 'npm', 'claude.cmd')] : []),
      ]
    : [
        path.join(home, '.local', 'bin', 'claude'),
        path.join(home, '.claude', 'local', 'claude'),
        '/opt/homebrew/bin/claude',
        '/usr/local/bin/claude',
        '/usr/bin/claude',
      ];
  return [...onPath, ...installed].find(exists);
};

/**
 * Starts Claude Code with `args`. An npm install leaves a `.cmd` on Windows,
 * which only the command processor runs: each argument is quoted for it.
 * Every argument FluidEQ passes is a flag or a path in its own folders, and
 * the member's words go over stdin, never on this line.
 */
export const startClaudeCode = (
  executable: string,
  args: string[],
  options: SpawnOptions,
): ChildProcess => {
  if (process.platform === 'win32' && /\.cmd$/i.test(executable)) {
    const line = [executable, ...args].map((arg) => `"${arg}"`).join(' ');
    return spawn(
      process.env.ComSpec ?? 'cmd.exe',
      ['/d', '/s', '/c', `"${line}"`],
      {
        ...options,
        windowsVerbatimArguments: true,
      },
    );
  }
  return spawn(executable, args, options);
};

/** What `claude auth status --json` says, read for two things only. */
export const readAuthStatus = (
  stdout: string,
): TStudioChatAvailability | undefined => {
  try {
    const raw: unknown = JSON.parse(stdout);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return undefined;
    }
    const { loggedIn, subscriptionType, email } = raw as Record<
      string,
      unknown
    >;
    if (typeof loggedIn !== 'boolean') {
      return undefined;
    }
    if (!loggedIn) {
      return { state: 'signed-out' };
    }
    const plan = accountPlanOf(subscriptionType);
    const account = accountEmailOf(email);
    return {
      state: 'ready',
      ...(plan ? { plan } : {}),
      ...(account ? { email: account } : {}),
    };
  } catch {
    return undefined;
  }
};

/** Everything a process wrote to stdout, once it has ended. */
const outputOf = (child: ChildProcess) =>
  new Promise<{ code: number | null; stdout: string }>((resolve) => {
    let stdout = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.on('error', () => resolve({ code: null, stdout }));
    child.on('close', (code) => resolve({ code, stdout }));
  });

/** Whether the chat can be used here, asked of Claude Code itself. */
export const claudeCodeAvailability = async (
  where: IClaudeCodeEnv = systemEnv(),
): Promise<TStudioChatAvailability> => {
  const executable = findClaudeCode(where);
  if (!executable) {
    return { state: 'missing' };
  }
  const { stdout } = await outputOf(
    startClaudeCode(executable, ['auth', 'status', '--json'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }),
  );
  // Installed but answering nothing readable: an older Claude Code without
  // `auth status`, which the chat's own reply will say more about.
  return readAuthStatus(stdout) ?? { state: 'ready' };
};

/**
 * Claude Code's own sign-in, which opens Anthropic's page in the browser.
 * On Windows it runs in a console window of its own, so anything it asks
 * is in front of the member; settles when it has ended, however it ended.
 */
export const signInToClaudeCode = async (
  where: IClaudeCodeEnv = systemEnv(),
): Promise<void> => {
  const executable = findClaudeCode(where);
  if (!executable) {
    return;
  }
  const child =
    process.platform === 'win32'
      ? spawn(
          process.env.ComSpec ?? 'cmd.exe',
          [
            '/d',
            '/s',
            '/c',
            `"start "Claude Code" /wait "${executable}" auth login"`,
          ],
          { windowsVerbatimArguments: true, stdio: 'ignore' },
        )
      : startClaudeCode(executable, ['auth', 'login'], { stdio: 'ignore' });
  await new Promise<void>((resolve) => {
    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
};
