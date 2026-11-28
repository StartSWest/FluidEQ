/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The plan's usage windows on the chat's accounts card (`chatUsage.ts`,
 * `chatUsageRead.ts`). They were read only from `rate_limit_event`, which
 * Claude Code sends when the limit status changes: the card showed one
 * reading from October 18 for a week, 31% where the week was at 12% (Ivan,
 * 2026-10-24: "31% weecly is not refreshing"). Then FluidEQ asked
 * (`get_usage`) - of a chat's own Claude Code when one ran, and that one
 * keeps the sign-in it started with: after a switch of accounts the card
 * showed the previous account's usage under the new one's name (Ivan,
 * 2026-11-28). Now the usage is asked only of a run started for it, which
 * names its account in the same run.
 */

import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import os from 'os';
import { PassThrough } from 'stream';
import {
  readLimitsLine,
  readUsageLine,
  usageRequestLine,
} from '../../../main/studioChat/chatUsage';
import createUsageRead, {
  type IPlanReading,
} from '../../../main/studioChat/chatUsageRead';

/** Claude Code 2.1.302's answer to `get_usage`, cut to what is read. */
const answer = (requestId: string) =>
  JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: requestId,
      response: {
        subscription_type: 'max',
        rate_limits_available: true,
        rate_limits: {
          five_hour: {
            utilization: 8,
            resets_at: '2026-10-25T06:59:59.760401+00:00',
          },
          seven_day: {
            utilization: 12,
            resets_at: '2026-10-31T20:59:59.760419+00:00',
          },
        },
      },
    },
  });

/** The two windows `answer` carries, as they are read. */
const READ = {
  fiveHour: {
    used: 0.08,
    resetsAt: Date.parse('2026-10-25T06:59:59.760401+00:00'),
  },
  week: {
    used: 0.12,
    resetsAt: Date.parse('2026-10-31T20:59:59.760419+00:00'),
  },
};

const idOf = (line: string): string => {
  const asked: unknown = JSON.parse(line);
  if (
    typeof asked !== 'object' ||
    asked === null ||
    !('request_id' in asked) ||
    typeof asked.request_id !== 'string'
  ) {
    throw new Error('the ask carries no request id');
  }
  return asked.request_id;
};

const askedId = () => idOf(usageRequestLine());

describe('reading the plan usage', () => {
  it('asks Claude Code for its usage without a transcript scan', () => {
    expect(JSON.parse(usageRequestLine())).toMatchObject({
      type: 'control_request',
      request: { subtype: 'get_usage', skip_behaviors: true },
    });
    // Each ask is its own.
    expect(askedId()).not.toBe(askedId());
  });

  it('reads the answer to its own ask as both windows, used as a share', () => {
    expect(readLimitsLine(answer(askedId()))).toEqual(READ);
  });

  it('takes no control answer it did not ask for', () => {
    // The control: the same body under FluidEQ's id is read, above.
    expect(readLimitsLine(answer('another-client-request'))).toBeUndefined();
    // An id that only carries FluidEQ's words further in is not one of its asks.
    expect(readLimitsLine(answer(`other-${askedId()}`))).toBeUndefined();
  });

  it("never takes the plan's usage from a chat's own stream", () => {
    // A chat's Claude Code keeps the sign-in it started with: whatever it
    // says of the plan may be the account before a switch.
    const usage = answer(askedId());
    const event = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: {
        unifiedWindows: {
          five_hour: { utilization: 0.1, resetsAt: 1792371000 },
          seven_day: { utilization: 0.31, resetsAt: 1792875600 },
        },
      },
    });
    expect(readUsageLine(usage)).toEqual([]);
    expect(readUsageLine(event)).toEqual([]);
    // The controls: the same answer is read where it was asked for, and the
    // chat's stream still says the size of its conversation.
    expect(readLimitsLine(usage)).toEqual(READ);
    expect(
      readUsageLine(
        JSON.stringify({
          type: 'assistant',
          message: { model: 'opus', usage: { input_tokens: 1200 } },
        }),
      ),
    ).toEqual([{ type: 'context', used: 1200, model: 'opus' }]);
  });
});

describe('asking a Claude Code started for the question', () => {
  const EMAIL = 'member@example.com';

  /**
   * A Claude Code that answers what it is asked, as the real one does: the
   * account (`initialize`) and the usage (`get_usage`), in the order given,
   * or the usage alone where it names no account.
   */
  const fakeClaude = ({
    account = { email: EMAIL, subscriptionType: 'Claude Ultra' },
    usageFirst = false,
  }: {
    account?: Record<string, string> | 'unanswered';
    usageFirst?: boolean;
  } = {}) => {
    const written: string[] = [];
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough;
      stdout: PassThrough;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    let input = '';
    child.stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString('utf8');
    });
    child.stdin.on('finish', () => {
      const lines = input.split('\n').filter(Boolean);
      written.push(...lines);
      const answers = lines.flatMap((line) => {
        const asked: unknown = JSON.parse(line);
        const subtype =
          typeof asked === 'object' &&
          asked !== null &&
          'request' in asked &&
          typeof asked.request === 'object' &&
          asked.request !== null &&
          'subtype' in asked.request
            ? asked.request.subtype
            : undefined;
        if (subtype === 'get_usage') {
          return [answer(idOf(line))];
        }
        if (subtype === 'initialize' && account !== 'unanswered') {
          return [
            JSON.stringify({
              type: 'control_response',
              response: {
                subtype: 'success',
                request_id: idOf(line),
                response: { models: [], account },
              },
            }),
          ];
        }
        return [];
      });
      const ordered = usageFirst ? [...answers].reverse() : answers;
      child.stdout.end(`${ordered.join('\n')}\n`, () => child.emit('close', 0));
    });
    return { child: child as unknown as ChildProcess, written };
  };

  /** One run's reading, and its end, as they are told. */
  const readOnce = (claude: ReturnType<typeof fakeClaude>) => {
    const told: { reading?: IPlanReading; ended: boolean } = { ended: false };
    const start = jest.fn(() => claude.child);
    const ended = new Promise<void>((resolve) => {
      const read = createUsageRead({
        executable: () => 'claude',
        start,
        cwd: os.tmpdir(),
        onReading: (reading) => {
          // A reading is told before the run's end, never after it.
          expect(told.ended).toBe(false);
          told.reading = reading;
        },
        onEnded: () => {
          told.ended = true;
          resolve();
        },
      });
      expect(read.read()).toBe(true);
      // A second ask while the first is out starts nothing more.
      expect(read.read()).toBe(false);
    });
    return { start, ended, told };
  };

  it('asks one run for its account and its usage, and tells them together', async () => {
    const claude = fakeClaude();
    const { start, ended, told } = readOnce(claude);
    await ended;
    expect(told.reading).toEqual({
      windows: READ,
      account: EMAIL,
      plan: 'Ultra',
    });
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0]).toEqual([
      'claude',
      expect.arrayContaining([
        '-p',
        '--input-format',
        'stream-json',
        '--no-session-persistence',
      ]),
      os.tmpdir(),
    ]);
    // Both questions on the same run's input, the account first.
    expect(
      claude.written.map(
        (line) =>
          (JSON.parse(line) as { request: { subtype: string } }).request
            .subtype,
      ),
    ).toEqual(['initialize', 'get_usage']);
  });

  it('waits for the account where the usage answer comes first', async () => {
    const { ended, told } = readOnce(fakeClaude({ usageFirst: true }));
    await ended;
    expect(told.reading).toEqual({
      windows: READ,
      account: EMAIL,
      plan: 'Ultra',
    });
  });

  it('tells a reading whose run named no account as nobody’s', async () => {
    const unanswered = readOnce(fakeClaude({ account: 'unanswered' }));
    await unanswered.ended;
    expect(unanswered.told.reading).toEqual({ windows: READ });
    // An answer naming no account (an API key) is nobody's too; the
    // control above it names one and is told under it.
    const none = readOnce(fakeClaude({ account: {} }));
    await none.ended;
    expect(none.told.reading).toEqual({ windows: READ });
  });

  it('starts nothing where Claude Code is not installed', () => {
    const start = jest.fn(() => fakeClaude().child);
    const read = createUsageRead({
      executable: () => undefined,
      start,
      cwd: os.tmpdir(),
      onReading: () => undefined,
      onEnded: () => undefined,
    });
    expect(read.read()).toBe(false);
    expect(start).not.toHaveBeenCalled();
  });
});
