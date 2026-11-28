/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import {
  STUDIO_CHAT_LIMIT_WINDOWS,
  type IStudioChatContext,
  type IStudioChatLimit,
  type TStudioChatLimitWindow,
} from '../../common/studioChat';

/**
 * What the chat shows of the member's use (Ivan, 2026-10-14: "show the
 * session usage and the context windows … the 5h and weekly limits"):
 *
 * - each message Claude writes carries the tokens it was sent, which is the
 *   conversation's size at that moment, and the turn's result names each
 *   model's whole window; a compaction says the size it left. These are read
 *   from the chat's own stream (`readUsageLine`).
 * - the plan's usage windows, five hours and seven days, are asked of a
 *   Claude Code started for that question alone (`chatUsageRead.ts`), which
 *   is asked in the same run which account it is signed in to, and read from
 *   its answer (`readLimitsLine`; kept per account by `planUsage.ts`).
 *
 * The plan's windows are no longer read from a chat's own Claude Code, by
 * `get_usage` or from `rate_limit_event`: a Claude Code keeps the sign-in it
 * started with for as long as it runs, so once the member had switched
 * accounts the chat's process went on reporting the previous account's
 * usage, and the card showed it under the new account's name (Ivan,
 * 2026-11-28).
 *
 * Read as untrusted like the rest of the stream: a line that is not what
 * this expects reports nothing.
 */

/** What a chat's own stream says of its conversation's size. */
export type TChatUsage =
  | { type: 'context'; used: number; model?: string }
  | { type: 'windows'; sizes: Record<string, number> };

/** The plan's windows one answer carried, without the ones it did not. */
export type TPlanWindows = Partial<
  Record<TStudioChatLimitWindow, IStudioChatLimit>
>;

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

/** The windows read, without the ones the answer did not carry. */
const known = (
  windows: Record<TStudioChatLimitWindow, IStudioChatLimit | undefined>,
): TPlanWindows => {
  const kept: TPlanWindows = {};
  STUDIO_CHAT_LIMIT_WINDOWS.forEach((name) => {
    const limit = windows[name];
    if (limit) {
      kept[name] = limit;
    }
  });
  return kept;
};

/**
 * Fable's window in a `get_usage` answer: one of `model_scoped`, the
 * per-model weekly windows, by the label the server gives its bucket
 * ("Fable"; Claude Code's own /usage shows it as "Current week (Fable)").
 * 0-100 used and an ISO reset time, like the plan's own windows.
 */
const answeredFableOf = (scoped: unknown): IStudioChatLimit | undefined => {
  if (!Array.isArray(scoped)) {
    return undefined;
  }
  const fable = scoped.find(
    (bucket: unknown) =>
      isRecord(bucket) &&
      typeof bucket.display_name === 'string' &&
      /^fable\b/i.test(bucket.display_name.trim()),
  );
  return answeredLimitOf(fable);
};

/**
 * The plan's windows in Claude Code's answer to one of FluidEQ's own
 * `get_usage` asks; undefined for any other line, for an answer to an ask
 * that was not FluidEQ's, and for an answer that carries no window at all.
 */
export const readLimitsLine = (line: string): TPlanWindows | undefined => {
  // Most lines are something else entirely: passed over unread.
  if (!line.includes(USAGE_REQUEST)) {
    return undefined;
  }
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (
    !isRecord(message) ||
    message.type !== 'control_response' ||
    !isRecord(message.response)
  ) {
    return undefined;
  }
  const { response } = message;
  if (
    response.subtype !== 'success' ||
    typeof response.request_id !== 'string' ||
    !response.request_id.startsWith(USAGE_REQUEST) ||
    !isRecord(response.response) ||
    !isRecord(response.response.rate_limits)
  ) {
    return undefined;
  }
  const windows = response.response.rate_limits;
  const read = known({
    fiveHour: answeredLimitOf(windows.five_hour),
    week: answeredLimitOf(windows.seven_day),
    fable: answeredFableOf(windows.model_scoped),
    opus: answeredLimitOf(windows.seven_day_opus),
  });
  return Object.keys(read).length > 0 ? read : undefined;
};

const usageOfMessage = (message: Record<string, unknown>): TChatUsage[] => {
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
  return [];
};

/** What one line of a chat's stream says of its conversation; nothing for most. */
export const readUsageLine = (line: string): TChatUsage[] => {
  // Most lines are words as they are written: they are passed over unread.
  if (
    !line.includes('"usage"') &&
    !line.includes('"modelUsage"') &&
    !line.includes('compact_boundary')
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

interface IChatUsageDeps {
  /** A project's context, kept with its chat. */
  contextOf(projectId: string): IStudioChatContext | undefined;
  setContext(projectId: string, context: IStudioChatContext): void;
  /** The window is told of a change. */
  send(channel: string, payload: unknown): void;
}

/** Each project's context, as its chat's Claude Code reports it. */
const createChatUsage = ({
  contextOf: keptContextOf,
  setContext,
  send,
}: IChatUsageDeps) => {
  /** The model each project's last message was written by. */
  const models = new Map<string, string>();

  const changeContext = (projectId: string, context: IStudioChatContext) => {
    setContext(projectId, context);
    send('studio-chat-context', { projectId, context });
  };

  return {
    /** A report from a project's chat. */
    note: (projectId: string, usage: TChatUsage) => {
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
