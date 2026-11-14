/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TStudioChatEntry } from '../../common/studioChat';
import {
  STUDIO_CHAT_SAID_MAX,
  type IStudioChatLimitHit,
  type TStudioChatFailure,
  type TStudioChatLimitHit,
} from '../../common/studioChatStop';

/**
 * Why a turn ended early, read from what Claude Code reports and never
 * guessed (Ivan, 2026-11-13: "make sure the chat shows the messages well,
 * like the session limit for Fable and Opus, or if it needs to re-login").
 *
 * The report that started this: Claude Code ended a turn with "You've hit
 * your weekly limit · resets Nov 15, 9am (America/New_York)" and the chat
 * said "Claude Code stopped before it finished". The reason was read from
 * the result's words alone, against four phrasings of a limit - "usage
 * limit", "rate limit", "limit reached", "out of usage" - and "hit your
 * weekly limit" is none of them. The words change with Claude Code's
 * versions (the same limit read "session limit" in 2.1.266 and "5-hour
 * limit" in 2.1.321); what it names beside them does not.
 *
 * What a failed turn ends with, as Claude Code 2.1.321 writes it (every
 * shape below was captured from it or taken from its own records):
 * - an `assistant` line, `is_api_error_message`, with `error` (the kind:
 *   `rate_limit`, `authentication_failed`, `oauth_org_not_allowed`,
 *   `server_error`, `invalid_request`, `unknown`), the response's
 *   `api_error_status`, and, where it has one, `api_error`
 *   (`usage_limit_reached`, `connection_failed`) with the limit's
 *   `rate_limit_info` in its params: which window, and when it resets;
 * - the `result` line, `is_error`, with the same status and `api_error`, a
 *   `terminal_reason` (`api_error`, `prompt_too_long`), and the words.
 *
 * The words are read last, for a Claude Code older than those fields and
 * for the few things only the words tell apart (Fable's limit, which window
 * where no `rate_limit_info` came).
 */

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

/** What the chat says of a turn that failed. */
export interface IChatStop {
  failure: TStudioChatFailure;
  limit?: IStudioChatLimitHit;
  /** Claude Code's own words, where the chat has no notice for them. */
  said?: string;
}

/** What the turn's lines before its result named about its end. */
export interface IStopClues {
  /** The `assistant` error line's kind. */
  error?: string;
  apiError?: string;
  status?: number;
  /** The limit refused, from `rate_limit_info`. */
  limitType?: string;
  /** In seconds, as the server gives it. */
  limitResetsAt?: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown) =>
  typeof value === 'string' ? value : undefined;
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** A refused limit's window and reset, from a `rate_limit_info`. */
const refusedLimit = (
  info: unknown,
): Pick<IStopClues, 'limitType' | 'limitResetsAt'> => {
  if (!isRecord(info) || info.status !== 'rejected') {
    return {};
  }
  const limitType = text(info.rateLimitType);
  const limitResetsAt = number(info.resetsAt);
  return {
    ...(limitType ? { limitType } : {}),
    ...(limitResetsAt ? { limitResetsAt } : {}),
  };
};

/**
 * `clues` with what one more line of the turn names about its end: the
 * error line, or a limit event refusing. Most lines are words being written
 * and are passed over unread.
 */
export const withStopClues = (line: string, clues: IStopClues): IStopClues => {
  if (
    !line.includes('is_api_error_message') &&
    !line.includes('rate_limit_event')
  ) {
    return clues;
  }
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return clues;
  }
  if (!isRecord(message)) {
    return clues;
  }
  if (message.type === 'rate_limit_event') {
    return { ...clues, ...refusedLimit(message.rate_limit_info) };
  }
  if (message.type !== 'assistant' || message.is_api_error_message !== true) {
    return clues;
  }
  const params = isRecord(message.api_error_params)
    ? message.api_error_params
    : {};
  const error = text(message.error);
  const apiError = text(message.api_error);
  const status = number(message.api_error_status);
  return {
    ...clues,
    ...(error ? { error } : {}),
    ...(apiError ? { apiError } : {}),
    ...(status ? { status } : {}),
    ...refusedLimit(params.rate_limit_info),
  };
};

/** Claude Code's name for a limit's window, as the chat's. */
const WINDOW_OF: Record<string, TStudioChatLimitHit | 'fable'> = {
  five_hour: 'fiveHour',
  seven_day: 'week',
  seven_day_opus: 'opus',
  // The per-model weekly bucket, which Claude Code calls the "Fable limit"
  // wherever it speaks of it (`chatUsage.ts`).
  seven_day_overage_included: 'fable',
};

/** The window a limit's own words name, for where nothing else did. */
const windowInWords = (
  words: string,
): TStudioChatLimitHit | 'fable' | undefined => {
  if (/\bFable limit\b/i.test(words)) {
    return 'fable';
  }
  if (/\bOpus\b.{0,24}\blimit\b/i.test(words)) {
    return 'opus';
  }
  if (/\b(session|5-hour|five-hour) limit\b/i.test(words)) {
    return 'fiveHour';
  }
  return /\bweekly limit\b/i.test(words) ? 'week' : undefined;
};

const LIMIT_WORDS =
  /usage limit|limit reached|out of (extra )?usage|\b(hit|reached) your\b.{0,40}\blimit\b/i;
const SIGN_IN_WORDS =
  /\/login|\blog(ged)? ?in\b|sign ?in|oauth (token|session)|api key|authenticat/i;
const NETWORK_WORDS =
  /connection (refused|lost|error|reset|timed out)|can't reach|unable to connect|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|fetch failed/i;

/**
 * Why a turn that ended in an error ended: from its `result` line and what
 * the lines before it named. In the order a wrong answer would cost most: a
 * limit first (Claude Code can say "Prompt is too long · automatic
 * compaction failed: You've hit your weekly limit", and the limit is the
 * cause), an account the subscription may not be used on before a lost
 * sign-in (its words offer "an Anthropic API key instead", which reads as
 * one), a lost connection before a failing server (it reports both as
 * `server_error`).
 */
export const stopOf = (
  result: Record<string, unknown>,
  clues: IStopClues = {},
): IChatStop => {
  const words = text(result.result)?.trim() ?? '';
  const apiError = text(result.api_error) ?? clues.apiError;
  const status = number(result.api_error_status) ?? clues.status;
  const { error } = clues;

  if (apiError === 'usage_limit_reached' || LIMIT_WORDS.test(words)) {
    const window =
      (clues.limitType ? WINDOW_OF[clues.limitType] : undefined) ??
      windowInWords(words);
    const resetsAt = clues.limitResetsAt
      ? { resetsAt: clues.limitResetsAt * 1000 }
      : {};
    if (window === 'fable') {
      return { failure: 'fable-limit' };
    }
    const limit = { ...(window ? { window } : {}), ...resetsAt };
    return {
      failure: 'limit',
      ...(limit.window || limit.resetsAt ? { limit } : {}),
    };
  }
  if (
    error === 'oauth_org_not_allowed' ||
    /\bClaude subscription\b/i.test(words)
  ) {
    return { failure: 'subscription' };
  }
  if (
    error === 'authentication_failed' ||
    status === 401 ||
    SIGN_IN_WORDS.test(words)
  ) {
    return { failure: 'signed-out' };
  }
  if (
    result.terminal_reason === 'prompt_too_long' ||
    /prompt is too long/i.test(words)
  ) {
    return { failure: 'too-long' };
  }
  if (apiError === 'connection_failed' || NETWORK_WORDS.test(words)) {
    return { failure: 'network' };
  }
  if (
    error === 'server_error' ||
    error === 'rate_limit' ||
    (status !== undefined && (status === 429 || status >= 500)) ||
    /\boverloaded\b|server error|server-side|\brate limit\b/i.test(words)
  ) {
    return { failure: 'server' };
  }
  return {
    failure: 'crashed',
    ...(words ? { said: words.slice(0, STUDIO_CHAT_SAID_MAX) } : {}),
  };
};

/**
 * Everything Claude Code named about a stop the chat has no notice for, in
 * one line for the log: what a bug report needs to give that stop a notice.
 */
export const stopReport = (
  result: Record<string, unknown>,
  clues: IStopClues = {},
): string =>
  JSON.stringify({
    subtype: result.subtype,
    terminal: result.terminal_reason,
    status: result.api_error_status ?? clues.status,
    apiError: result.api_error ?? clues.apiError,
    error: clues.error,
    words: text(result.result)?.slice(0, 600),
  });

/** A stop as the fields of the reply it ended. */
export const stopFields = ({
  failure,
  limit,
  said,
}: IChatStop): Pick<TReply, 'failure' | 'limit' | 'said'> => ({
  failure,
  ...(limit ? { limit } : {}),
  ...(said ? { said } : {}),
});
