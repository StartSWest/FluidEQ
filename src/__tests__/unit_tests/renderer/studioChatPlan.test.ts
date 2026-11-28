/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IStudioChatModels,
  TStudioChatAvailability,
} from '../../../common/studioChat';
import {
  planName,
  planShown,
} from '../../../renderer/studio/chat/studioChatPlan';

/**
 * The plan the Studio chat's head names (Ivan, 2026-11-25: "Claude now has
 * Max and Ultra plans, or whatever plan the user has"): Claude Code's own
 * name for it where its answer gave one for the account signed in now, the
 * plan's kind from `auth status` otherwise, and nothing where neither said.
 */

const EMAIL = 'member@example.com';
const ready = (plan?: string, email = EMAIL): TStudioChatAvailability => ({
  state: 'ready',
  email,
  ...(plan ? { plan } : {}),
});
const answered = (
  account?: IStudioChatModels['account'],
): IStudioChatModels => ({
  checked: true,
  lines: [],
  ...(account ? { account } : {}),
});

describe('a plan by the name it is sold under', () => {
  it.each([
    ['pro', 'Pro'],
    ['max', 'Max'],
    ['team', 'Team'],
    ['enterprise', 'Enterprise'],
    ['prolite', 'Pro Lite'],
    ['ultra', 'Ultra'],
    ['Ultra', 'Ultra'],
    ['Max 20x', 'Max 20x'],
    ['platinum_plus', 'Platinum Plus'],
  ])('%s is %s', (plan, name) => {
    expect(planName(plan)).toBe(name);
  });
});

describe('the plan the head names', () => {
  it("is Claude Code's own name for it, where auth status says only its kind", () => {
    // An Ultra account's auth status reports its kind, "max".
    expect(
      planShown(ready('max'), answered({ email: EMAIL, plan: 'Ultra' })),
    ).toBe('Ultra');
    expect(planShown(ready('max'), answered({ plan: 'Max' }))).toBe('Max');
  });

  it('is the kind auth status gave, where the answer named no plan', () => {
    expect(planShown(ready('max'), answered())).toBe('Max');
    expect(planShown(ready('pro'), answered({ email: EMAIL }))).toBe('Pro');
    // A kind this app never heard of, as given, never another plan's name.
    expect(planShown(ready('ultra'), answered())).toBe('Ultra');
    expect(planShown(ready('quantum'), answered())).toBe('Quantum');
  });

  it("is not another account's: a sign-in since the answer has its own plan", () => {
    expect(
      planShown(
        ready('pro', 'other@example.com'),
        answered({ email: EMAIL, plan: 'Ultra' }),
      ),
    ).toBe('Pro');
    // The same account, however its address is written.
    expect(
      planShown(
        ready('pro', 'Member@Example.com'),
        answered({ email: EMAIL, plan: 'Ultra' }),
      ),
    ).toBe('Ultra');
  });

  it("is the usage reading's name for it, only where that reading is this account's", () => {
    // Every reading of the plan's usage names its account and its plan, in
    // the same run (Ivan, 2026-11-28: the plan "needs to update properly
    // when I switch accounts").
    const reading = (account: string | undefined, plan: string) => ({
      ...(account ? { account } : {}),
      plan,
      at: 1,
    });
    expect(
      planShown(
        ready('max'),
        answered(),
        reading('Member@Example.com', 'Ultra'),
      ),
    ).toBe('Ultra');
    // Newer than the model list's answer, read once a run: it wins.
    expect(
      planShown(
        ready('max'),
        answered({ email: EMAIL, plan: 'Max' }),
        reading(EMAIL, 'Ultra'),
      ),
    ).toBe('Ultra');
    // Another account's reading, or one naming nobody, never names this
    // account's plan: its own kind does until its own reading comes.
    expect(
      planShown(
        ready('pro', 'other@example.com'),
        answered(),
        reading(EMAIL, 'Ultra'),
      ),
    ).toBe('Pro');
    expect(
      planShown(ready('pro'), answered(), reading(undefined, 'Ultra')),
    ).toBe('Pro');
  });

  it("never takes the model list's plan from an answer that named no account", () => {
    // The model list is asked once a run: an answer naming nobody may be of
    // the account before a switch.
    expect(planShown(ready('pro'), answered({ plan: 'Ultra' }))).toBe('Pro');
    // The control: the same answer naming this account is taken.
    expect(
      planShown(ready('pro'), answered({ email: EMAIL, plan: 'Ultra' })),
    ).toBe('Ultra');
  });

  it('is nothing where nothing named one, so the head says Claude Code alone', () => {
    expect(planShown(ready(), answered())).toBe('');
    expect(
      planShown(
        { state: 'signed-out' },
        answered({ email: EMAIL, plan: 'Max' }),
      ),
    ).toBe('');
    expect(planShown({ state: 'checking' }, answered())).toBe('');
  });
});
