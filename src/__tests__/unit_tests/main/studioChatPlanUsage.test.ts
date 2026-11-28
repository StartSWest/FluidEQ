/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The plan's usage, kept per account (`planUsage.ts`). Ivan, 2026-11-28:
 * "make sure when I switch accounts it updates ... to get the session usage
 * values this is from the other account also it needs to get it each time I
 * open that windows but no less than a 1min". One reading used to be kept
 * for every account alike, so after a switch the card showed the previous
 * account's figures under the new account's name. Each rule beside its
 * control; the clock is the test's own.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  IStudioChatLimits,
  IStudioChatLimitsNews,
} from '../../../common/studioChat';
import type { TPlanWindows } from '../../../main/studioChat/chatUsage';
import createPlanUsage, {
  PLAN_USAGE_EVERY_MS,
} from '../../../main/studioChat/planUsage';

const A = 'first@example.com';
const B = 'second@example.com';
const HOUR = 3600 * 1000;
const T0 = Date.parse('2026-11-28T05:00:00Z');

/** An account's windows, `used` of the five hours and half that of the week. */
const windowsOf = (used: number, more: TPlanWindows = {}): TPlanWindows => ({
  fiveHour: { used, resetsAt: T0 + 5 * HOUR },
  week: { used: used / 2, resetsAt: T0 + 100 * HOUR },
  ...more,
});

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-plan-usage-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** The store over a Claude Code that starts a run whenever it is asked. */
const planUsageIn = (installed = true) => {
  let clock = T0;
  const sent: IStudioChatLimitsNews[] = [];
  const read = jest.fn(() => installed);
  const usage = createPlanUsage({
    root,
    read,
    send: (news) => sent.push(news),
    now: () => clock,
  });
  return {
    usage,
    read,
    sent,
    at: (time: number) => {
      clock = time;
    },
  };
};

/** The figures the window is given, by window, for comparing. */
const shownOf = (news: IStudioChatLimitsNews) => news.limits;

describe("the usage of the account shown, never another's", () => {
  it("drops the previous account's figures at a switch and reads the new one's", () => {
    const { usage, read, at } = planUsageIn();
    // A is signed in and read.
    usage.ask({ account: A });
    usage.reading({
      windows: windowsOf(1, {
        fable: { used: 0.35, resetsAt: T0 + 50 * HOUR },
      }),
      account: A,
      plan: 'Ultra',
    });
    usage.ended();
    expect(shownOf(usage.ask({ account: A }))).toMatchObject({
      account: A,
      plan: 'Ultra',
      fiveHour: { used: 1 },
    });
    expect(read).toHaveBeenCalledTimes(1);

    // Seconds later the member signs in to B: nothing of A's for B, and B
    // is read now, inside A's minute.
    at(T0 + 5000);
    const switched = usage.ask({ account: B });
    expect(switched.limits).toBeUndefined();
    expect(switched.checking).toBe(true);
    expect(read).toHaveBeenCalledTimes(2);

    // B's reading names no Fable window: none is carried over from A's.
    at(T0 + 7000);
    usage.reading({ windows: windowsOf(0.2), account: B, plan: 'Max' });
    usage.ended();
    const shownB = shownOf(usage.ask({ account: B }));
    expect(shownB).toMatchObject({
      account: B,
      plan: 'Max',
      fiveHour: { used: 0.2 },
    });
    expect(shownB?.fable).toBeUndefined();
    // B was read two seconds ago: nothing more asked of Claude Code.
    expect(read).toHaveBeenCalledTimes(2);

    // The control: A's own figures are still A's, kept apart, and A read
    // seconds ago is not read again either.
    expect(shownOf(usage.ask({ account: A }))).toMatchObject({
      account: A,
      plan: 'Ultra',
      fiveHour: { used: 1 },
      fable: { used: 0.35 },
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('keeps a reading of an account nobody asked for under that account alone', () => {
    const { usage } = planUsageIn();
    // The window shows A, but Claude Code was switched to B outside
    // FluidEQ: the run reads B.
    usage.ask({ account: A });
    usage.reading({ windows: windowsOf(0.9), account: B, plan: 'Max' });
    usage.ended();
    expect(usage.ask({ account: A }).limits).toBeUndefined();
    expect(shownOf(usage.ask({ account: B }))).toMatchObject({
      account: B,
      fiveHour: { used: 0.9 },
    });
  });

  it('tells the window each reading under the account it is of', () => {
    const { usage, sent } = planUsageIn();
    usage.ask({ account: A });
    usage.reading({ windows: windowsOf(0.4), account: A });
    usage.ended();
    usage.ask({ account: B });
    usage.reading({ windows: windowsOf(0.6), account: B });
    usage.ended();
    const told = sent.flatMap((news) => (news.limits ? [news.limits] : []));
    expect(told.map(({ account }) => account)).toEqual([A, B]);
    expect(told.map(({ fiveHour }) => fiveHour?.used)).toEqual([0.4, 0.6]);
    // Said while it reads, and once it is done.
    expect(sent[0]).toEqual({ checking: true });
    expect(sent[sent.length - 1]).toEqual({ checking: false });
  });

  it("keeps each account's figures apart across a restart, and no email on disk", () => {
    const first = planUsageIn();
    first.usage.ask({ account: A });
    first.usage.reading({ windows: windowsOf(0.7), account: A, plan: 'Ultra' });
    first.usage.ended();
    first.usage.ask({ account: B });
    first.usage.reading({ windows: windowsOf(0.1), account: B, plan: 'Pro' });
    first.usage.ended();

    const kept = fs.readFileSync(path.join(root, 'limits.json'), 'utf8');
    expect(kept).not.toMatch(/example\.com/);

    const next = planUsageIn();
    // Shown at once, as the next start reads them back, whoever asks.
    expect(shownOf(next.usage.ask({ account: B }))).toMatchObject({
      account: B,
      plan: 'Pro',
      fiveHour: { used: 0.1 },
    });
    expect(
      shownOf(next.usage.ask({ account: 'First@Example.com' })),
    ).toMatchObject({ plan: 'Ultra', fiveHour: { used: 0.7 } });
    expect(
      next.usage.ask({ account: 'third@example.com' }).limits,
    ).toBeUndefined();
  });

  it('gives nobody the one reading kept before readings were kept per account', () => {
    const old: IStudioChatLimits = {
      fiveHour: { used: 1, resetsAt: T0 + HOUR },
      week: { used: 0.81, resetsAt: T0 + 50 * HOUR },
      at: T0,
    };
    fs.writeFileSync(path.join(root, 'limits.json'), JSON.stringify(old));
    const { usage } = planUsageIn();
    expect(usage.ask({ account: A }).limits).toBeUndefined();
    expect(usage.ask({}).limits).toBeUndefined();
    // The control: a reading in today's shape is read back.
    usage.reading({ windows: windowsOf(0.3), account: A });
    usage.ended();
    expect(planUsageIn().usage.ask({ account: A }).limits).toMatchObject({
      fiveHour: { used: 0.3 },
    });
  });

  it('reads an ask that is not one as nobody’s', () => {
    const { usage, read } = planUsageIn();
    expect(usage.ask('A')).toEqual({ checking: true });
    usage.reading({ windows: windowsOf(0.5) });
    usage.ended();
    expect(read).toHaveBeenCalledTimes(1);
    expect(usage.ask({ account: 'not an email' }).limits).toMatchObject({
      fiveHour: { used: 0.5 },
    });
    // The control: an account that is one never gets nobody's reading.
    expect(usage.ask({ account: A }).limits).toBeUndefined();
  });
});

describe('at most once a minute', () => {
  it('reads again on an open only once the account’s last reading is a minute old', () => {
    const { usage, read, at } = planUsageIn();
    usage.ask({ account: A });
    usage.reading({ windows: windowsOf(0.3), account: A });
    usage.ended();
    expect(read).toHaveBeenCalledTimes(1);

    // Opened again within the minute: the last answer, nothing asked.
    at(T0 + PLAN_USAGE_EVERY_MS - 1);
    expect(usage.ask({ account: A })).toMatchObject({
      limits: { fiveHour: { used: 0.3 } },
      checking: false,
    });
    expect(read).toHaveBeenCalledTimes(1);

    // A minute on: asked again, the last figures shown meanwhile.
    at(T0 + PLAN_USAGE_EVERY_MS);
    expect(usage.ask({ account: A })).toMatchObject({
      limits: { fiveHour: { used: 0.3 } },
      checking: true,
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reads now when asked for a fresh reading, whatever the minute says', () => {
    const { usage, read, at } = planUsageIn();
    usage.ask({ account: A });
    usage.reading({ windows: windowsOf(0.3), account: A });
    usage.ended();
    at(T0 + 1000);
    usage.ask({ account: A, fresh: true });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reads after an answer only when nothing was read for a minute', () => {
    const { usage, read, at } = planUsageIn();
    usage.answered();
    expect(read).toHaveBeenCalledTimes(1);
    usage.reading({ windows: windowsOf(0.3), account: A });
    usage.ended();
    at(T0 + PLAN_USAGE_EVERY_MS - 1);
    usage.answered();
    expect(read).toHaveBeenCalledTimes(1);
    at(T0 + PLAN_USAGE_EVERY_MS);
    usage.answered();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('asks once a run ends for an account that came due while it was out', () => {
    const { usage, read, at } = planUsageIn();
    // A reply's end started a run while A was signed in.
    usage.answered();
    // The member switched to B meanwhile and opened the card.
    at(T0 + 1000);
    expect(usage.ask({ account: B })).toEqual({ checking: true });
    expect(read).toHaveBeenCalledTimes(1);
    // The run that was out read A's sign-in: B is asked for at its end.
    at(T0 + 2000);
    usage.reading({ windows: windowsOf(0.8), account: A });
    usage.ended();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('asks nothing more when the run that was out read the asked account', () => {
    const { usage, read, sent, at } = planUsageIn();
    usage.answered();
    at(T0 + 1000);
    usage.ask({ account: A });
    at(T0 + 2000);
    usage.reading({ windows: windowsOf(0.8), account: A });
    usage.ended();
    expect(read).toHaveBeenCalledTimes(1);
    expect(sent[sent.length - 1]).toEqual({ checking: false });
  });

  it('says nothing is being read where Claude Code is not installed', () => {
    const { usage, read, sent } = planUsageIn(false);
    expect(usage.ask({ account: A })).toEqual({ checking: false });
    // Asked again on the next open: nothing was read to wait a minute for.
    usage.ask({ account: A });
    expect(read).toHaveBeenCalledTimes(2);
    expect(sent).toEqual([]);
  });
});
