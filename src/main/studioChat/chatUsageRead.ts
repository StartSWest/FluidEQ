/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { createLineReader } from './chatStream';
import {
  readLimitsLine,
  usageRequestLine,
  type TPlanWindows,
} from './chatUsage';
import { accountOf } from './claudeModelsAnswer';
import endProcessTree from './endProcessTree';

/** One run's reading: the plan's windows, and whose they are. */
export interface IPlanReading {
  windows: TPlanWindows;
  /** The account's email as that same run named it; none where it named none. */
  account?: string;
  /** Claude Code's own name for that account's plan ("Ultra"). */
  plan?: string;
}

interface IUsageReadDeps {
  /** The member's Claude Code, when it is installed. */
  executable: () => string | undefined;
  start: (executable: string, args: string[], cwd: string) => ChildProcess;
  /** Where the one-off run is started: the chat's own folder. */
  cwd: string;
  onReading: (reading: IPlanReading) => void;
  /** The run is over, with a reading or without one. */
  onEnded: () => void;
}

/** The request ids FluidEQ gives the account ask that goes with each reading. */
const ACCOUNT_REQUEST = 'fluideq-account-';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Claude Code's `initialize` control request, which it answers with the
 * account it is signed in to among much else, as the Agent SDK asks it.
 */
const accountRequestLine = (id: string) =>
  `${JSON.stringify({
    type: 'control_request',
    request_id: id,
    request: { subtype: 'initialize' },
  })}\n`;

type TAnsweredAccount = NonNullable<ReturnType<typeof accountOf>>;

/**
 * The account in Claude Code's answer to the `initialize` asked as `id`:
 * undefined for any other line, and nothing named for an answer that names
 * no account (an API key, or a refusal).
 */
export const readAccountLine = (
  line: string,
  id: string,
): TAnsweredAccount | undefined => {
  if (!line.includes(id)) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (
    !isRecord(raw) ||
    raw.type !== 'control_response' ||
    !isRecord(raw.response) ||
    raw.response.request_id !== id
  ) {
    return undefined;
  }
  const inner = isRecord(raw.response.response)
    ? raw.response.response
    : raw.response;
  return accountOf(inner.account) ?? {};
};

/**
 * The plan's usage asked of a Claude Code started for nothing else: the
 * account it is signed in to (`initialize`) and the plan's windows
 * (`get_usage`), both on its input, which then closes, and Claude Code ends
 * once it has answered (both answers in 1.5 s, the run over in 2.2 s,
 * measured 2026-11-28). No model is called and no conversation is kept
 * (`--no-session-persistence`), and the member's MCP servers are not started
 * for it.
 *
 * Both questions go to the same run because that run reads the sign-in once,
 * as it starts: the usage it reports is the account it names, whatever has
 * been switched since or meanwhile. A reading is told once both answers are
 * in; one whose account never came is told at the run's end, as nobody's.
 *
 * One run at a time: `read` answers false, and starts nothing, while one is
 * out (`planUsage.ts` asks again once it ends) or where Claude Code is not
 * installed.
 */
const createUsageRead = ({
  executable,
  start,
  cwd,
  onReading,
  onEnded,
}: IUsageReadDeps) => {
  let running: ChildProcess | undefined;

  return {
    read: (): boolean => {
      const found = executable();
      if (running || !found) {
        return false;
      }
      const child = start(
        found,
        [
          '-p',
          '--input-format',
          'stream-json',
          '--output-format',
          'stream-json',
          '--verbose',
          '--no-session-persistence',
          '--strict-mcp-config',
        ],
        cwd,
      );
      running = child;
      const accountId = `${ACCOUNT_REQUEST}${randomUUID()}`;
      let account: TAnsweredAccount | undefined;
      let windows: TPlanWindows | undefined;
      let told = false;
      let over = false;
      const tell = (named: TAnsweredAccount) => {
        if (told || !windows) {
          return;
        }
        told = true;
        onReading({
          windows,
          ...(named.email ? { account: named.email } : {}),
          ...(named.plan ? { plan: named.plan } : {}),
        });
      };
      // `error` and `close` can both come for one run.
      const done = () => {
        if (over) {
          return;
        }
        over = true;
        if (running === child) {
          running = undefined;
        }
        tell(account ?? {});
        onEnded();
      };
      const reader = createLineReader((line) => {
        account ??= readAccountLine(line, accountId);
        windows ??= readLimitsLine(line);
        if (account) {
          tell(account);
        }
      });
      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk: string) => reader.push(chunk));
      child.on('error', done);
      child.on('close', done);
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(`${accountRequestLine(accountId)}${usageRequestLine()}`);
      return true;
    },
    /** FluidEQ is closing: a run still out ends with it. */
    dispose: () => {
      if (running) {
        endProcessTree(running);
        running = undefined;
      }
    },
  };
};

export default createUsageRead;
