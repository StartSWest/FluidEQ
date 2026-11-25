/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IStudioChatModels,
  TStudioChatAvailability,
} from 'common/studioChat';

/**
 * Plans whose names are not their kind with a capital. Claude Code's
 * `auth status` reports a plan's kind as one lower-case word ("max",
 * "prolite").
 */
const PLAN_NAMES: Record<string, string> = {
  prolite: 'Pro Lite',
};

/** Each word with a capital, the rest as it was: "max" is Max, "Max 20x" stays. */
const titled = (plan: string) =>
  plan
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** A plan by the name it is sold under; one this does not know, as given, with capitals. */
export const planName = (plan: string) =>
  PLAN_NAMES[plan.toLowerCase()] ?? titled(plan);

/**
 * The plan the chat runs on, as Claude Code names it (Ivan, 2026-11-25:
 * "Claude now has Max and Ultra plans, or whatever plan the user has"), or
 * '' when it named none - the head then says "Claude Code" alone.
 *
 * Claude Code's own name for the plan ("Ultra") is in its `initialize`
 * answer (`models.account`), read once per run; `auth status` gives only
 * the plan's kind ("max"), which is what an Ultra account showed as. The
 * answer's name is taken only for the account `auth status` says is signed
 * in now: a sign-in with another account since that answer has its own
 * plan, and its kind is all there is until the next run asks again.
 */
export const planShown = (
  availability: TStudioChatAvailability,
  models: IStudioChatModels,
): string => {
  if (availability.state !== 'ready') {
    return '';
  }
  const named = models.account?.plan;
  const sameAccount =
    !availability.email ||
    !models.account?.email ||
    availability.email.toLowerCase() === models.account.email.toLowerCase();
  if (named && sameAccount) {
    return planName(named);
  }
  return availability.plan ? planName(availability.plan) : '';
};
