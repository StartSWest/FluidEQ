/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  studioChatLimitsKey,
  type IStudioChatLimits,
  type IStudioChatModels,
  type TStudioChatAvailability,
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
 * answer, which every reading of the plan's usage asks in the same run
 * (`limits.plan`, read again on every switch and at most a minute old), and
 * the model list asks once per run of the app (`models.account`); `auth
 * status` gives only the plan's kind ("max"), which is what an Ultra account
 * showed as. Either name is taken only for the account `auth status` says
 * is signed in now, never for an answer that named another account or none
 * (Ivan, 2026-11-28: the plan "needs to update properly when I switch
 * accounts"): a sign-in with another account has its own plan, and its kind
 * is all there is until that account's own answer comes.
 */
export const planShown = (
  availability: TStudioChatAvailability,
  models: IStudioChatModels,
  limits?: IStudioChatLimits,
): string => {
  if (availability.state !== 'ready') {
    return '';
  }
  const shown = studioChatLimitsKey(availability.email);
  const isShown = (account: string | undefined) =>
    studioChatLimitsKey(account) === shown;
  if (limits?.plan && isShown(limits.account)) {
    return planName(limits.plan);
  }
  if (models.account?.plan && isShown(models.account.email)) {
    return planName(models.account.plan);
  }
  return availability.plan ? planName(availability.plan) : '';
};
