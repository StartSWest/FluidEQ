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
 * 2026-10-24: "31% weecly is not refreshing"). Now FluidEQ asks
 * (`get_usage`), and the answer is read like any other report.
 */

import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import createChatUsage, {
  readUsageLine,
  usageRequestLine,
} from '../../../main/studioChat/chatUsage';
import createUsageRead from '../../../main/studioChat/chatUsageRead';

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

const askedId = () => {
  const asked: unknown = JSON.parse(usageRequestLine());
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
    expect(readUsageLine(answer(askedId()))).toEqual([
      {
        type: 'limits',
        limits: {
          fiveHour: {
            used: 0.08,
            resetsAt: Date.parse('2026-10-25T06:59:59.760401+00:00'),
          },
          week: {
            used: 0.12,
            resetsAt: Date.parse('2026-10-31T20:59:59.760419+00:00'),
          },
        },
      },
    ]);
  });

  it('takes no control answer it did not ask for', () => {
    // The control: the same body under FluidEQ's id is read, above.
    expect(readUsageLine(answer('another-client-request'))).toEqual([]);
    // An id that only carries FluidEQ's words further in is not one of its asks.
    expect(readUsageLine(answer(`other-${askedId()}`))).toEqual([]);
  });

  it('still reads the limit status Claude Code sends of its own accord', () => {
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: {
        unifiedWindows: {
          five_hour: { utilization: 0.1, resetsAt: 1792371000 },
          seven_day: { utilization: 0.31, resetsAt: 1792875600 },
        },
      },
    });
    expect(readUsageLine(line)).toEqual([
      {
        type: 'limits',
        limits: {
          fiveHour: { used: 0.1, resetsAt: 1792371000000 },
          week: { used: 0.31, resetsAt: 1792875600000 },
        },
      },
    ]);
  });
});

describe('keeping the plan usage', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-chat-usage-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const usageIn = () => {
    const send = jest.fn();
    const usage = createChatUsage({
      root,
      contextOf: () => undefined,
      setContext: () => undefined,
      send,
    });
    return { usage, send };
  };

  it('replaces the reading with every report, and tells the window', () => {
    const { usage, send } = usageIn();
    const hour = Date.now() + 3600 * 1000;
    usage.note(undefined, {
      type: 'limits',
      limits: {
        fiveHour: { used: 0.1, resetsAt: hour },
        week: { used: 0.31, resetsAt: hour * 2 },
      },
    });
    usage.note(undefined, {
      type: 'limits',
      limits: {
        fiveHour: { used: 0.2, resetsAt: hour },
        week: { used: 0.12, resetsAt: hour * 2 },
      },
    });
    expect(usage.limits()).toMatchObject({
      fiveHour: { used: 0.2 },
      week: { used: 0.12 },
    });
    expect(send).toHaveBeenCalledTimes(2);
    // Kept for the next start too.
    expect(
      JSON.parse(fs.readFileSync(path.join(root, 'limits.json'), 'utf8')),
    ).toMatchObject({ week: { used: 0.12 } });
  });

  it('keeps a window a report leaves out, until that window resets', () => {
    const { usage } = usageIn();
    const now = Date.now();
    usage.note(undefined, {
      type: 'limits',
      limits: {
        fiveHour: { used: 0.4, resetsAt: now - 1000 },
        week: { used: 0.3, resetsAt: now + 86400 * 1000 },
      },
    });
    usage.note(undefined, {
      type: 'limits',
      limits: { fiveHour: { used: 0.05, resetsAt: now + 3600 * 1000 } },
    });
    // The week is still the week it was read in; nothing new said otherwise.
    expect(usage.limits()?.week).toMatchObject({ used: 0.3 });

    usage.note(undefined, {
      type: 'limits',
      limits: { week: { used: 0.5, resetsAt: now + 86400 * 1000 } },
    });
    // The five hours read before still stands; the first one, already
    // reset when it was left out, was never carried.
    expect(usage.limits()?.fiveHour).toMatchObject({ used: 0.05 });
  });

  it('drops a left-out window whose reset has passed', () => {
    const { usage } = usageIn();
    const now = Date.now();
    usage.note(undefined, {
      type: 'limits',
      limits: {
        fiveHour: { used: 0.4, resetsAt: now + 3600 * 1000 },
        week: { used: 0.31, resetsAt: now - 1000 },
      },
    });
    usage.note(undefined, {
      type: 'limits',
      limits: { fiveHour: { used: 0.1, resetsAt: now + 3600 * 1000 } },
    });
    expect(usage.limits()?.week).toBeUndefined();
  });
});

describe('asking with no chat running', () => {
  /** A Claude Code that answers what it is asked, as the real one does. */
  const fakeClaude = () => {
    const child = new EventEmitter() as EventEmitter & {
      stdin: PassThrough;
      stdout: PassThrough;
    };
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    let written = '';
    child.stdin.on('data', (chunk: Buffer) => {
      written += chunk.toString('utf8');
    });
    child.stdin.on('finish', () => {
      const asked: unknown = JSON.parse(written);
      const id =
        typeof asked === 'object' && asked !== null && 'request_id' in asked
          ? String(asked.request_id)
          : '';
      child.stdout.end(`${answer(id)}\n`, () => child.emit('close', 0));
    });
    return child as unknown as ChildProcess;
  };

  it('starts one Claude Code for the question and reads its answer', async () => {
    const start = jest.fn(() => fakeClaude());
    const heard = new Promise((resolve) => {
      const read = createUsageRead({
        executable: () => 'claude',
        start,
        cwd: os.tmpdir(),
        onUsage: resolve,
      });
      read.read();
      // A second ask while the first is out starts nothing more.
      read.read();
    });
    await expect(heard).resolves.toMatchObject({
      type: 'limits',
      limits: { week: { used: 0.12 } },
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
  });

  it('starts nothing where Claude Code is not installed', () => {
    const start = jest.fn(() => fakeClaude());
    createUsageRead({
      executable: () => undefined,
      start,
      cwd: os.tmpdir(),
      onUsage: () => undefined,
    }).read();
    expect(start).not.toHaveBeenCalled();
  });
});
