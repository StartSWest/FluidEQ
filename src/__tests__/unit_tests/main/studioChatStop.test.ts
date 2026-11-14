/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Why a reply stopped short, read from what Claude Code reports (Ivan,
 * 2026-11-13: "make sure the chat shows the messages well, like the session
 * limit for Fable and Opus, or if it needs to re-login"). The report: a
 * turn Claude Code ended with "You've hit your weekly limit · resets Nov 15,
 * 9am" was shown as "Claude Code stopped before it finished".
 *
 * Every ending in `fixtures/claudeCodeStops.json` is real:
 * - `stream`: the last two lines Claude Code 2.1.321 wrote on its stream,
 *   untouched, with a stand-in for Anthropic's server answering it each
 *   failure (a refused key, 403, 429, 500, 529, a refused connection, a
 *   prompt too long, a refusal nobody has a notice for) and with no sign-in;
 * - `record`: a failed turn of this machine's own Claude Code, from its
 *   session records - the limits, a revoked and an expired sign-in, an
 *   unpaid plan, a lost connection - written out under the stream's names
 *   for the same fields (the record's `apiError` is the stream's
 *   `api_error`, as one run's record set beside its stream showed).
 * The time zone Claude Code named is the one thing replaced in them.
 *
 * Each case's name begins with the reason the chat must give it.
 */

jest.mock('../../../main/studioChat/chatVersions', () => ({
  keepReplyVersion: jest.fn(() => undefined),
  nextReplyVersion: jest.fn(() => 1),
}));

/* eslint-disable import/first -- the mock above must be installed first */
import type { TStudioChatEntry } from '../../../common/studioChat';
import {
  STUDIO_CHAT_FAILURES,
  STUDIO_CHAT_SAID_MAX,
} from '../../../common/studioChatStop';
import {
  claudeCodeEvents,
  type IChatSession,
} from '../../../main/studioChat/chatLaunch';
import createChatQueue from '../../../main/studioChat/chatQueue';
import { stopOf } from '../../../main/studioChat/chatStop';
import {
  failureOf,
  type TChatStreamEvent,
} from '../../../main/studioChat/chatStream';
import { readEntry } from '../../../main/studioChat/chatTranscript';
import createChatTurns from '../../../main/studioChat/chatTurns';
import stops from './fixtures/claudeCodeStops.json';
/* eslint-enable import/first */

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;
type TEnd = Extract<TChatStreamEvent, { type: 'end' }>;
interface IStopCase {
  source: string;
  version: string;
  assistant: string;
  result: string;
}
const CASES = Object.entries(stops as Record<string, IStopCase>);
const named = (name: string): IStopCase => {
  const found = CASES.find(([known]) => known === name);
  if (!found) {
    throw new Error(`no case called "${name}"`);
  }
  return found[1];
};
/** The reason a case's name says the chat must give. */
const reasonOf = (name: string) => name.slice(0, name.indexOf(':'));
const wordsOf = (line: string) =>
  String((JSON.parse(line) as { result?: unknown }).result ?? '');

/** The turn's end, as the lines given come to the chat one after another. */
const endOf = (...lines: string[]): TEnd => {
  const ends: TEnd[] = [];
  const events = claudeCodeEvents(
    (event) => {
      if (event.type === 'end') {
        ends.push(event);
      }
    },
    () => undefined,
    () => undefined,
  );
  lines.forEach((line) => events.line(line));
  if (ends.length !== 1) {
    throw new Error(`${ends.length} turns ended`);
  }
  return ends[0];
};

const WEEKLY = 'limit: the weekly limit, with which window and when it resets';
const FIVE_HOUR =
  'limit: the 5-hour limit, with which window and when it resets';
const UNKNOWN = 'crashed: a refusal the chat has no notice for';

describe('why Claude Code ended a turn early', () => {
  it('holds an ending for every reason the chat can give but two', () => {
    // `missing` is Claude Code not starting, and Fable's limit is below.
    const covered = new Set(CASES.map(([name]) => reasonOf(name)));
    expect(
      STUDIO_CHAT_FAILURES.filter((failure) => !covered.has(failure)),
    ).toEqual(['missing', 'fable-limit']);
    expect(CASES.length).toBeGreaterThanOrEqual(24);
  });

  it.each(CASES)('%s', (name, { assistant, result }) => {
    expect(endOf(assistant, result).failure).toBe(reasonOf(name));
  });

  it.each(CASES)('from its closing words alone: %s', (name, { result }) => {
    // A Claude Code from before it named anything beside its words.
    expect(failureOf(wordsOf(result))).toBe(reasonOf(name));
  });

  it('ends a turn that went well with no reason', () => {
    const end = endOf(
      JSON.stringify({ type: 'result', subtype: 'success', is_error: false }),
    );
    expect(end).toEqual({ type: 'end' });
  });
});

describe("the plan's limit that stopped a reply", () => {
  it('is the weekly one with its reset, the stop this was written for', () => {
    const { assistant, result } = named(WEEKLY);
    expect(wordsOf(result)).toMatch(/^You've hit your weekly limit/);
    expect(endOf(assistant, result)).toEqual({
      type: 'end',
      failure: 'limit',
      limit: { window: 'week', resetsAt: 1794751200 * 1000 },
    });
  });

  it('is the 5-hour one with its reset, under either of its names', () => {
    const now = named(FIVE_HOUR);
    expect(endOf(now.assistant, now.result).limit).toEqual({
      window: 'fiveHour',
      resetsAt: 1794386400 * 1000,
    });
    const older = named(
      'limit: the 5-hour limit under its older name, session limit',
    );
    expect(endOf(older.assistant, older.result).limit?.window).toBe('fiveHour');
  });

  it('is named by the words where Claude Code named no window', () => {
    const weekly = named(
      'limit: the weekly limit in words alone, from an older Claude Code',
    );
    expect(endOf(weekly.assistant, weekly.result).limit).toEqual({
      window: 'week',
    });
    const session = named(
      'limit: the session limit in words alone, from an older Claude Code',
    );
    expect(endOf(session.assistant, session.result).limit).toEqual({
      window: 'fiveHour',
    });
    // The control: a limit that names no window has none.
    const credits = named('limit: out of usage credits');
    expect(endOf(credits.assistant, credits.result).limit).toBeUndefined();
  });

  it('is the window a limit event refused, where the result names none', () => {
    const { result } = named(
      'limit: the session limit in words alone, from an older Claude Code',
    );
    // A limit event's `rate_limit_info`, as the 5-hour record above has it.
    const refused = (status: string) =>
      JSON.stringify({
        type: 'rate_limit_event',
        rate_limit_info: {
          status,
          resetsAt: 1794386400,
          rateLimitType: 'five_hour',
        },
      });
    expect(endOf(refused('rejected'), result).limit).toEqual({
      window: 'fiveHour',
      resetsAt: 1794386400 * 1000,
    });
    // The control: an event that refused nothing says nothing of the stop.
    expect(endOf(refused('allowed_warning'), result).limit).toEqual({
      window: 'fiveHour',
    });
  });

  it('is Fable’s own, a reason apart, by its words or by its window', () => {
    // Claude Code 2.1.321's words (`studioChatFableLimit.test.ts`).
    const words =
      "You've reached your Fable limit. Run /model to switch models, or wait until your limit resets.";
    expect(stopOf({ result: words })).toEqual({ failure: 'fable-limit' });
    // The per-model weekly bucket is Fable's (`chatUsage.ts`).
    expect(
      stopOf(
        {
          result: "You've hit your weekly limit",
          api_error: 'usage_limit_reached',
        },
        { limitType: 'seven_day_overage_included', limitResetsAt: 1794751200 },
      ),
    ).toEqual({ failure: 'fable-limit' });
    // The control: the same stop on the plan's own week is the plan's.
    expect(
      stopOf(
        {
          result: "You've hit your weekly limit",
          api_error: 'usage_limit_reached',
        },
        { limitType: 'seven_day' },
      ).failure,
    ).toBe('limit');
  });
});

describe('what Claude Code names beside its words', () => {
  // Its words change from one version to the next ("session limit" became
  // "5-hour limit"); here they say nothing the chat knows, and each name
  // Claude Code 2.1.321 gives still decides. The names are the fixture's.
  const WORDS = 'Words no version has used yet.';

  it.each([
    ['limit', { api_error: 'usage_limit_reached' }, {}],
    ['subscription', {}, { error: 'oauth_org_not_allowed' }],
    ['signed-out', {}, { error: 'authentication_failed' }],
    ['signed-out', { api_error_status: 401 }, {}],
    ['too-long', { terminal_reason: 'prompt_too_long' }, {}],
    ['network', { api_error: 'connection_failed' }, {}],
    ['network', {}, { apiError: 'connection_failed', error: 'server_error' }],
    ['server', {}, { error: 'server_error' }],
    ['server', {}, { error: 'rate_limit' }],
    ['server', { api_error_status: 529 }, {}],
    ['server', { api_error_status: 500 }, {}],
    ['server', { api_error_status: 429 }, {}],
  ] as const)('%s, from %j and %j', (failure, result, clues) => {
    expect(stopOf({ result: WORDS, ...result }, clues).failure).toBe(failure);
  });

  it('decides nothing from a kind and a status the chat has no notice for', () => {
    // The control: the same words under names that are nobody's.
    expect(
      stopOf(
        { result: WORDS, api_error_status: 400, terminal_reason: 'api_error' },
        { error: 'unknown' },
      ),
    ).toEqual({ failure: 'crashed', said: WORDS });
    expect(stopOf({ result: WORDS, api_error_status: 404 }).failure).toBe(
      'crashed',
    );
  });
});

describe('a stop the chat has no notice for', () => {
  it("keeps Claude Code's own words, and what it named for the log", () => {
    const { assistant, result } = named(UNKNOWN);
    const end = endOf(assistant, result);
    expect(end.failure).toBe('crashed');
    expect(end.said).toBe(
      'API Error: 400 messages.0.content: something this app has never met',
    );
    expect(JSON.parse(end.report ?? '{}')).toEqual({
      subtype: 'success',
      terminal: 'api_error',
      status: 400,
      error: 'unknown',
      words:
        'API Error: 400 messages.0.content: something this app has never met',
    });
  });

  it('keeps no more of them than the chat shows', () => {
    const long = 'x'.repeat(STUDIO_CHAT_SAID_MAX * 3);
    expect(stopOf({ result: long }).said).toHaveLength(STUDIO_CHAT_SAID_MAX);
    expect(stopOf({ result: '   ' })).toEqual({ failure: 'crashed' });
  });

  it('is the only kind that carries words or a report', () => {
    CASES.filter(([name]) => reasonOf(name) !== 'crashed').forEach(
      ([, { assistant, result }]) => {
        const end = endOf(assistant, result);
        expect(end.said).toBeUndefined();
        expect(end.report).toBeUndefined();
      },
    );
  });
});

describe('what one turn named', () => {
  it('is not held against the next', () => {
    const refusedKey = named('signed-out: a key Anthropic refuses');
    const ends: TEnd[] = [];
    const events = claudeCodeEvents(
      (event) => {
        if (event.type === 'end') {
          ends.push(event);
        }
      },
      () => undefined,
      () => undefined,
    );
    events.line(refusedKey.assistant);
    events.line(refusedKey.result);
    // The next turn ends with nothing said at all.
    events.line(
      JSON.stringify({
        type: 'result',
        subtype: 'error_during_execution',
        is_error: true,
      }),
    );
    expect(ends.map(({ failure }) => failure)).toEqual([
      'signed-out',
      'crashed',
    ]);
  });
});

describe('the reply a stop ends', () => {
  /** A reply begun and then ended by `lines`, as the chat keeps it. */
  const replyEndedBy = (...lines: string[]): TReply => {
    const entries: TStudioChatEntry[] = [];
    const turns = createChatTurns({
      queue: createChatQueue(() => undefined),
      upsert: (_projectId, entry) => {
        const at = entries.findIndex(({ id }) => id === entry.id);
        if (at === -1) {
          entries.push(entry);
        } else {
          entries[at] = entry;
        }
      },
      tell: () => undefined,
      save: () => undefined,
      saveWith: () => undefined,
      versionsOf: () => 'versions',
      entriesOf: () => entries,
      dropAsks: () => undefined,
    });
    const session: IChatSession = {
      process: {
        write: () => undefined,
        end: () => undefined,
        position: () => 0,
      },
      folder: 'scene',
      model: 'default',
      effort: 'default',
      brief: 'brief',
      stopping: false,
      sendingNow: false,
    };
    turns.begin('scene', session, [{ words: 'ok all good here review' }]);
    const events = claudeCodeEvents(
      (event) => {
        // The session's id and a tool's question go elsewhere in the chat.
        if (event.type !== 'session' && event.type !== 'permission') {
          turns.onEvent('scene', session, event);
        }
      },
      () => undefined,
      () => undefined,
    );
    lines.forEach((line) => events.line(line));
    const reply = entries.find(
      (entry): entry is TReply => entry.kind === 'claude',
    );
    if (!reply) {
      throw new Error('no reply was kept');
    }
    return reply;
  };

  it('says which limit and when it resets, and reads back the same from disk', () => {
    const { assistant, result } = named(WEEKLY);
    const reply = replyEndedBy(assistant, result);
    expect(reply).toMatchObject({
      state: 'failed',
      failure: 'limit',
      limit: { window: 'week', resetsAt: 1794751200 * 1000 },
    });
    expect(reply.said).toBeUndefined();
    expect(readEntry(JSON.parse(JSON.stringify(reply)))).toEqual(reply);
  });

  it("carries Claude Code's words on a stop with no notice, and reads them back", () => {
    const { assistant, result } = named(UNKNOWN);
    const reply = replyEndedBy(assistant, result);
    expect(reply).toMatchObject({
      state: 'failed',
      failure: 'crashed',
      said: 'API Error: 400 messages.0.content: something this app has never met',
    });
    expect(readEntry(JSON.parse(JSON.stringify(reply)))).toEqual(reply);
  });

  it('reads nothing from a saved reply that is not what the chat wrote', () => {
    const saved = (more: Record<string, unknown>) =>
      readEntry({
        kind: 'claude',
        id: 'reply',
        text: '',
        steps: [],
        state: 'failed',
        ...more,
      });
    expect(saved({ failure: 'on fire' })).not.toHaveProperty('failure');
    // No reason, nothing about it either.
    expect(saved({ limit: { window: 'week' }, said: 'words' })).toEqual(
      saved({}),
    );
    expect(
      saved({ failure: 'limit', limit: { window: 'month', resetsAt: 'soon' } }),
    ).toEqual(saved({ failure: 'limit' }));
    expect(
      saved({ failure: 'crashed', said: 'y'.repeat(STUDIO_CHAT_SAID_MAX * 2) }),
    ).toMatchObject({ said: 'y'.repeat(STUDIO_CHAT_SAID_MAX) });
    // The control: a limit as the chat writes it is read whole.
    expect(
      saved({ failure: 'limit', limit: { window: 'opus', resetsAt: 5 } }),
    ).toMatchObject({ limit: { window: 'opus', resetsAt: 5 } });
  });
});
