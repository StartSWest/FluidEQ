/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Why a reply stopped short, as the chat says it (Ivan, 2026-11-13: "make
 * sure the chat shows the messages well, like the session limit for Fable
 * and Opus, or if it needs to re-login"). Each is something Claude Code
 * itself reported at the end of the turn (`main/studioChat/chatStop.ts`);
 * `crashed` is only what is left when it reported nothing the chat knows.
 */
export const STUDIO_CHAT_FAILURES = [
  /** Claude Code is not on this computer. */
  'missing',
  /** No sign-in, or one that expired, was revoked or was refused. */
  'signed-out',
  /** One of the plan's usage limits; which, in the reply's `limit`. */
  'limit',
  /** Fable's own weekly limit, which another model is not held to. */
  'fable-limit',
  /** The sign-in is good and the subscription may not be used: unpaid, or the organisation turned it off. */
  'subscription',
  /** Claude could not be reached from this computer. */
  'network',
  /** Claude's side was overloaded, failed, or took no more requests for now. */
  'server',
  /** The conversation no longer fits what Claude can read. */
  'too-long',
  /** Claude Code ended, or said something the chat has no notice for. */
  'crashed',
] as const;
export type TStudioChatFailure = (typeof STUDIO_CHAT_FAILURES)[number];

export const isStudioChatFailure = (
  value: unknown,
): value is TStudioChatFailure =>
  typeof value === 'string' &&
  (STUDIO_CHAT_FAILURES as readonly string[]).includes(value);

/**
 * The plan's limits a reply can stop on. Fable's is `fable-limit`, a failure
 * of its own, because another model can carry on.
 */
export const STUDIO_CHAT_LIMIT_HITS = ['fiveHour', 'week', 'opus'] as const;
export type TStudioChatLimitHit = (typeof STUDIO_CHAT_LIMIT_HITS)[number];

/** Which limit stopped a reply, and when that one resets, as far as Claude Code said. */
export interface IStudioChatLimitHit {
  window?: TStudioChatLimitHit;
  /** Milliseconds since the epoch. */
  resetsAt?: number;
}

/** A limit as a saved chat or the stream gave it, or undefined when it is none. */
export const readStudioChatLimitHit = (
  raw: unknown,
): IStudioChatLimitHit | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { window, resetsAt } = raw as Record<string, unknown>;
  const named = STUDIO_CHAT_LIMIT_HITS.find((known) => known === window);
  const hit: IStudioChatLimitHit = {
    ...(named ? { window: named } : {}),
    ...(typeof resetsAt === 'number' &&
    Number.isFinite(resetsAt) &&
    resetsAt > 0
      ? { resetsAt }
      : {}),
  };
  return hit.window || hit.resetsAt ? hit : undefined;
};

/** The longest of Claude Code's own words kept with a reply it ended. */
export const STUDIO_CHAT_SAID_MAX = 300;
