/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { accountEmailOf, accountPlanOf } from '../../common/studioChat';
import { startClaudeCode as startInstalled } from './claudeCode';
import endProcessTree from './endProcessTree';

/**
 * Which ChatGPT account the member's Codex is signed in to, and its plan
 * (Ivan, 2026-10-13: "I need to know in studio which claude account and gpt
 * account is logged in").
 *
 * Asked the way Codex's own editor extensions ask it: its app-server's
 * `account/read`, which answers with the account's email and plan and
 * nothing secret. FluidEQ never opens Codex's sign-in file; `login status`
 * says only that it is ChatGPT, not whose.
 *
 * The app-server is started for the one question and ended when it has
 * answered, or when it ends on its own; a Codex too old to know the method
 * answers with an error, which reads as no account named.
 */

export interface ICodexAccount {
  email?: string;
  plan?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The account from `account/read`'s answer, or nothing if it names none. */
export const readCodexAccount = (result: unknown): ICodexAccount => {
  const account = isRecord(result) ? result.account : undefined;
  if (!isRecord(account) || account.type !== 'chatgpt') {
    return {};
  }
  const email = accountEmailOf(account.email);
  const plan = accountPlanOf(account.planType);
  return { ...(email ? { email } : {}), ...(plan ? { plan } : {}) };
};

const INITIALIZE = 1;
const ACCOUNT = 2;

export const codexAccount = (executable: string): Promise<ICodexAccount> =>
  new Promise((resolve) => {
    const child = startInstalled(executable, ['app-server'], {
      stdio: ['pipe', 'pipe', 'ignore'],
      windowsHide: true,
    });
    let answered = false;
    const answer = (account: ICodexAccount) => {
      if (!answered) {
        answered = true;
        resolve(account);
      }
      endProcessTree(child);
    };
    const send = (message: Record<string, unknown>) => {
      child.stdin?.write(`${JSON.stringify(message)}\n`);
    };
    let buffer = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk;
      let end = buffer.indexOf('\n');
      while (end !== -1) {
        const line = buffer.slice(0, end).trim();
        buffer = buffer.slice(end + 1);
        end = buffer.indexOf('\n');
        let message: unknown;
        try {
          message = JSON.parse(line);
        } catch {
          message = undefined;
        }
        if (isRecord(message) && message.id === INITIALIZE) {
          send({ method: 'initialized', params: {} });
          send({ id: ACCOUNT, method: 'account/read', params: {} });
        } else if (isRecord(message) && message.id === ACCOUNT) {
          answer(readCodexAccount(message.result));
        }
      }
    });
    child.stdin?.on('error', () => undefined);
    child.on('error', () => answer({}));
    child.on('close', () => answer({}));
    send({
      id: INITIALIZE,
      method: 'initialize',
      params: {
        clientInfo: { name: 'fluideq', title: 'FluidEQ', version: '1' },
        capabilities: {},
      },
    });
  });
