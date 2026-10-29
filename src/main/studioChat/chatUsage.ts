/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import type {
  IStudioChatContext,
  IStudioChatLimit,
  IStudioChatLimits,
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';

/**
 * What the chat shows of the member's use (Ivan, 2026-10-14: "show the
 * session usage and the context windows … the 5h and weekly limits"), read
 * from the same stream the replies come in on, never asked for on its own:
 *
 * - each message Claude writes carries the tokens it was sent, which is the
 *   conversation's size at that moment, and the turn's result names each
 *   model's whole window;
 * - a compaction says the size it left;
 * - the plan's usage windows, five hours and seven days, are asked for
 *   (`usageRequestLine`) when a chat starts, after each answer and when the
 *   accounts card opens, and Claude Code answers on the same stream.
 *
 * The windows used to be read only from `rate_limit_event`, which Claude
 * Code sends when the plan's limit status changes, not on every request:
 * for a member who never nears a limit it came once, and the card showed
 * that one reading for days (Ivan, 2026-10-24: "31% weecly is not
 * refreshing" - it was 12% that evening, the week having reset at 5 PM).
 * It is still read when it comes.
 *
 * Read as untrusted like the rest of the stream: a line that is not what
 * this expects reports nothing.
 */

export type TChatUsage =
  | { type: 'context'; used: number; model?: string }
  | { type: 'windows'; sizes: Record<string, number> }
  | { type: 'limits'; limits: Omit<IStudioChatLimits, 'at'> };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

/** The tokens a message was sent with: the conversation it carried. */
const contextOf = (usage: Record<string, unknown>) =>
  count(usage.input_tokens) +
  count(usage.cache_creation_input_tokens) +
  count(usage.cache_read_input_tokens) +
  count(usage.output_tokens);

const limitOf = (raw: unknown): IStudioChatLimit | undefined => {
  if (
    !isRecord(raw) ||
    typeof raw.utilization !== 'number' ||
    typeof raw.resetsAt !== 'number' ||
    !Number.isFinite(raw.utilization) ||
    !Number.isFinite(raw.resetsAt)
  ) {
    return undefined;
  }
  // The server's time is in seconds.
  return {
    used: Math.min(1, Math.max(0, raw.utilization)),
    resetsAt: raw.resetsAt * 1000,
  };
};

/**
 * The request ids FluidEQ gives its usage asks: an answer is taken only to
 * one of them, never to a control response it did not ask for.
 */
const USAGE_REQUEST = 'fluideq-usage-';

/**
 * Claude Code's `get_usage` control request, as a line of its input: the
 * plan's windows as the usage endpoint reports them now, with no model
 * called and no tokens spent. `skip_behaviors` spares the scan of a week of
 * local transcripts that only the terminal's /usage screen shows.
 * Claude Code marks it experimental; an answer of another shape reports
 * nothing, and the card keeps its last reading.
 */
export const usageRequestLine = () =>
  `${JSON.stringify({
    type: 'control_request',
    request_id: `${USAGE_REQUEST}${randomUUID()}`,
    request: { subtype: 'get_usage', skip_behaviors: true },
  })}\n`;

/** One window of a `get_usage` answer: 0-100 used, an ISO reset time. */
const answeredLimitOf = (raw: unknown): IStudioChatLimit | undefined => {
  if (
    !isRecord(raw) ||
    typeof raw.utilization !== 'number' ||
    !Number.isFinite(raw.utilization) ||
    typeof raw.resets_at !== 'string'
  ) {
    return undefined;
  }
  const resetsAt = Date.parse(raw.resets_at);
  return Number.isFinite(resetsAt)
    ? {
        used: Math.min(1, Math.max(0, raw.utilization / 100)),
        resetsAt,
      }
    : undefined;
};

const limitsUsage = (
  fiveHour: IStudioChatLimit | undefined,
  week: IStudioChatLimit | undefined,
): TChatUsage[] =>
  fiveHour || week
    ? [
        {
          type: 'limits',
          limits: {
            ...(fiveHour ? { fiveHour } : {}),
            ...(week ? { week } : {}),
          },
        },
      ]
    : [];

const usageOfMessage = (message: Record<string, unknown>): TChatUsage[] => {
  if (message.type === 'control_response' && isRecord(message.response)) {
    const { response } = message;
    if (
      response.subtype !== 'success' ||
      typeof response.request_id !== 'string' ||
      !response.request_id.startsWith(USAGE_REQUEST) ||
      !isRecord(response.response) ||
      !isRecord(response.response.rate_limits)
    ) {
      return [];
    }
    const windows = response.response.rate_limits;
    return limitsUsage(
      answeredLimitOf(windows.five_hour),
      answeredLimitOf(windows.seven_day),
    );
  }
  if (
    message.type === 'assistant' &&
    // A subagent's messages are its own conversation, not this one.
    (message.parent_tool_use_id ?? null) === null &&
    isRecord(message.message) &&
    isRecord(message.message.usage)
  ) {
    const used = contextOf(message.message.usage);
    const { model } = message.message;
    return used > 0
      ? [
          {
            type: 'context',
            used,
            ...(typeof model === 'string' ? { model } : {}),
          },
        ]
      : [];
  }
  if (message.type === 'result' && isRecord(message.modelUsage)) {
    const sizes = Object.fromEntries(
      Object.entries(message.modelUsage).flatMap(([model, usage]) =>
        isRecord(usage) && count(usage.contextWindow) > 0
          ? [[model, count(usage.contextWindow)]]
          : [],
      ),
    );
    return Object.keys(sizes).length > 0 ? [{ type: 'windows', sizes }] : [];
  }
  if (
    message.type === 'system' &&
    message.subtype === 'compact_boundary' &&
    isRecord(message.compact_metadata) &&
    count(message.compact_metadata.post_tokens) > 0
  ) {
    return [
      { type: 'context', used: count(message.compact_metadata.post_tokens) },
    ];
  }
  if (
    message.type === 'rate_limit_event' &&
    isRecord(message.rate_limit_info)
  ) {
    const windows = message.rate_limit_info.unifiedWindows;
    if (!isRecord(windows)) {
      return [];
    }
    return limitsUsage(limitOf(windows.five_hour), limitOf(windows.seven_day));
  }
  return [];
};

/** What one line of the stream says of the member's use; nothing for most. */
export const readUsageLine = (line: string): TChatUsage[] => {
  // Most lines are words as they are written: they are passed over unread.
  if (
    !line.includes('"usage"') &&
    !line.includes('"modelUsage"') &&
    !line.includes('compact_boundary') &&
    !line.includes('rate_limit_event') &&
    !line.includes(USAGE_REQUEST)
  ) {
    return [];
  }
  try {
    const message: unknown = JSON.parse(line);
    return isRecord(message) ? usageOfMessage(message) : [];
  } catch {
    return [];
  }
};

/** A context as kept in a project's chat file, or nothing if it is not one. */
export const readChatContext = (
  raw: unknown,
): IStudioChatContext | undefined =>
  isRecord(raw) && count(raw.used) > 0
    ? {
        used: count(raw.used),
        ...(count(raw.window) > 0 ? { window: count(raw.window) } : {}),
      }
    : undefined;

const readLimits = (raw: unknown): IStudioChatLimits | undefined => {
  if (!isRecord(raw) || count(raw.at) === 0) {
    return undefined;
  }
  const keep = (limit: unknown) => {
    if (!isRecord(limit)) {
      return undefined;
    }
    const used = count(limit.used);
    const resetsAt = count(limit.resetsAt);
    return used <= 1 && resetsAt > 0 ? { used, resetsAt } : undefined;
  };
  const fiveHour = keep(raw.fiveHour);
  const week = keep(raw.week);
  return {
    at: count(raw.at),
    ...(fiveHour ? { fiveHour } : {}),
    ...(week ? { week } : {}),
  };
};

interface IChatUsageDeps {
  root: string;
  /** A project's context, kept with its chat. */
  contextOf(projectId: string): IStudioChatContext | undefined;
  setContext(projectId: string, context: IStudioChatContext): void;
  /** The window is told of a change. */
  send(channel: string, payload: unknown): void;
  logger?: { warn(message: string): void };
}

/**
 * The member's use, as it is reported: each project's context, and the
 * plan's limits, which are the account's and kept in one file for all.
 */
const createChatUsage = ({
  root,
  contextOf: keptContextOf,
  setContext,
  send,
  logger,
}: IChatUsageDeps) => {
  const limitsFile = path.join(root, 'limits.json');
  /** The model each project's last message was written by. */
  const models = new Map<string, string>();
  let limits: IStudioChatLimits | undefined;
  let limitsRead = false;

  const currentLimits = () => {
    if (!limitsRead) {
      limitsRead = true;
      try {
        limits = readLimits(JSON.parse(fs.readFileSync(limitsFile, 'utf8')));
      } catch {
        limits = undefined;
      }
    }
    return limits;
  };

  const changeContext = (projectId: string, context: IStudioChatContext) => {
    setContext(projectId, context);
    send('studio-chat-context', { projectId, context });
  };

  return {
    limits: currentLimits,

    /** A report from a project's chat, or from no chat (`projectId` none). */
    note: (projectId: string | undefined, usage: TChatUsage) => {
      if (usage.type === 'limits') {
        // A report with one window leaves the other as it was read, until
        // that one's own reset makes the old figure wrong.
        const now = Date.now();
        const still = (limit: IStudioChatLimit | undefined) =>
          limit && limit.resetsAt > now ? limit : undefined;
        const before = currentLimits();
        const fiveHour = usage.limits.fiveHour ?? still(before?.fiveHour);
        const week = usage.limits.week ?? still(before?.week);
        limits = {
          ...(fiveHour ? { fiveHour } : {}),
          ...(week ? { week } : {}),
          at: now,
        };
        limitsRead = true;
        try {
          writeFileAtomically(limitsFile, JSON.stringify(limits), 0o600);
        } catch (error) {
          // Shown all the same; only the copy for the next start is missing.
          logger?.warn(
            `The Studio chat's limits were not kept: ${String(error)}`,
          );
        }
        send('studio-chat-limits', limits);
        return;
      }
      if (projectId === undefined) {
        return;
      }
      const kept = keptContextOf(projectId);
      if (usage.type === 'context') {
        if (usage.model) {
          models.set(projectId, usage.model);
        }
        changeContext(projectId, {
          used: usage.used,
          ...(kept?.window ? { window: kept.window } : {}),
        });
        return;
      }
      const model = models.get(projectId);
      const window = model ? usage.sizes[model] : undefined;
      if (kept && window) {
        changeContext(projectId, { ...kept, window });
      }
    },
  };
};

export default createChatUsage;
