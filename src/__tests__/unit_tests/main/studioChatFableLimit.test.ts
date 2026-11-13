/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Fable's own limit (Ivan, 2026-11-13: "show fable session limit too … and
 * when fable reaches the session limit show that in the chat"). Claude Code
 * keeps no five-hour window per model: Fable's is a week long, reported as
 * one of `get_usage`'s `model_scoped` windows and as the
 * `seven_day_overage_included` window of a limit event, both shapes and
 * words taken from Claude Code 2.1.321. Each case beside its control.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { failureOf } from '../../../main/studioChat/chatStream';
import createChatUsage, {
  readUsageLine,
  usageRequestLine,
} from '../../../main/studioChat/chatUsage';

const askedId = (): string => {
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

const answer = (rateLimits: Record<string, unknown>) =>
  JSON.stringify({
    type: 'control_response',
    response: {
      subtype: 'success',
      request_id: askedId(),
      response: { rate_limits: rateLimits },
    },
  });

const FIVE = { utilization: 40, resets_at: '2026-11-13T22:00:00+00:00' };
const WEEK = { utilization: 55, resets_at: '2026-11-17T20:00:00+00:00' };
const FABLE_RESET = '2026-11-16T09:00:00+00:00';

describe('reading Fable’s window', () => {
  it('reads Fable’s bucket among the per-model windows, and Opus’s own', () => {
    expect(
      readUsageLine(
        answer({
          five_hour: FIVE,
          seven_day: WEEK,
          seven_day_opus: { utilization: 20, resets_at: FABLE_RESET },
          model_scoped: [
            { display_name: 'Sonnet', utilization: 5, resets_at: FABLE_RESET },
            { display_name: 'Fable', utilization: 100, resets_at: FABLE_RESET },
          ],
        }),
      ),
    ).toEqual([
      {
        type: 'limits',
        limits: {
          fiveHour: { used: 0.4, resetsAt: Date.parse(FIVE.resets_at) },
          week: { used: 0.55, resetsAt: Date.parse(WEEK.resets_at) },
          fable: { used: 1, resetsAt: Date.parse(FABLE_RESET) },
          opus: { used: 0.2, resetsAt: Date.parse(FABLE_RESET) },
        },
      },
    ]);
  });

  it('reads no Fable window where the answer lists none for it', () => {
    const [read] = readUsageLine(
      answer({
        five_hour: FIVE,
        seven_day: WEEK,
        model_scoped: [
          { display_name: 'Sonnet', utilization: 5, resets_at: FABLE_RESET },
          { display_name: 'Fable', utilization: null, resets_at: null },
        ],
      }),
    );
    expect(read).toEqual({
      type: 'limits',
      limits: {
        fiveHour: { used: 0.4, resetsAt: Date.parse(FIVE.resets_at) },
        week: { used: 0.55, resetsAt: Date.parse(WEEK.resets_at) },
      },
    });
  });

  it('reads the per-model weekly bucket of a limit event as Fable’s', () => {
    const line = JSON.stringify({
      type: 'rate_limit_event',
      rate_limit_info: {
        status: 'rejected',
        rateLimitType: 'seven_day_overage_included',
        unifiedWindows: {
          five_hour: { utilization: 0.3, resetsAt: 1794600000 },
          seven_day_overage_included: { utilization: 1, resetsAt: 1794900000 },
        },
      },
    });
    expect(readUsageLine(line)).toEqual([
      {
        type: 'limits',
        limits: {
          fiveHour: { used: 0.3, resetsAt: 1794600000000 },
          fable: { used: 1, resetsAt: 1794900000000 },
        },
      },
    ]);
  });
});

describe('a reply Fable’s limit stopped', () => {
  it('is told apart from the plan’s limit by Claude Code’s own words', () => {
    expect(
      failureOf(
        "You've reached your Fable limit. Switch to another model, or manage usage credits at claude.ai/settings/usage, to continue.",
      ),
    ).toBe('fable-limit');
    expect(
      failureOf("You've reached your Fable limit. /model to switch models."),
    ).toBe('fable-limit');
    // The controls: the plan's own limit, and an ordinary crash.
    expect(failureOf('Claude AI usage limit reached|1794600000')).toBe('limit');
    expect(failureOf('Something went wrong')).toBe('crashed');
  });
});

describe('keeping Fable’s window', () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-fable-limit-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const usageIn = () =>
    createChatUsage({
      root,
      contextOf: () => undefined,
      setContext: () => undefined,
      send: () => undefined,
    });

  it('keeps it through a report that leaves it out, and across a restart', () => {
    const now = Date.now();
    const usage = usageIn();
    usage.note(undefined, {
      type: 'limits',
      limits: {
        fiveHour: { used: 0.2, resetsAt: now + 3600 * 1000 },
        fable: { used: 1, resetsAt: now + 86400 * 1000 },
      },
    });
    // A limit event carrying the plan's windows alone.
    usage.note(undefined, {
      type: 'limits',
      limits: { fiveHour: { used: 0.3, resetsAt: now + 3600 * 1000 } },
    });
    expect(usage.limits()?.fable).toEqual({
      used: 1,
      resetsAt: now + 86400 * 1000,
    });
    // The next start reads it back from the kept copy.
    expect(usageIn().limits()).toMatchObject({
      fiveHour: { used: 0.3 },
      fable: { used: 1 },
    });
  });

  it('drops it once its week has reset', () => {
    const now = Date.now();
    const usage = usageIn();
    usage.note(undefined, {
      type: 'limits',
      limits: { fable: { used: 1, resetsAt: now - 1000 } },
    });
    usage.note(undefined, {
      type: 'limits',
      limits: { fiveHour: { used: 0.1, resetsAt: now + 3600 * 1000 } },
    });
    expect(usage.limits()?.fable).toBeUndefined();
    // The control: the window read with it is kept.
    expect(usage.limits()?.fiveHour).toMatchObject({ used: 0.1 });
  });
});
