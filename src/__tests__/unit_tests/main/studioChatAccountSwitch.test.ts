/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The Studio's chats across a switch of Claude account (`accountSwitch.ts`,
 * `chatRetire.ts`). A chat's Claude Code is kept running between messages
 * and keeps the sign-in it started with, so after "Use another account" the
 * next message of an open chat ran on, and spent, the account just left -
 * the one at its weekly limit (2026-11-28). Every case stands beside its
 * control: the same account's sign-in written again, as every other Claude
 * Code session on the machine does when it renews its own, ends nothing.
 */

jest.mock('../../../main/studioChat/chatVersions', () => ({
  keepReplyVersion: jest.fn(() => undefined),
  nextReplyVersion: jest.fn(() => 1),
}));
jest.mock('../../../main/studioChat/claudeCode', () => ({
  findClaudeCode: () => 'claude',
  systemEnv: () => ({ platform: 'win32', env: {} }),
}));

/* eslint-disable import/first -- the mocks above must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TStudioChatEntry } from '../../../common/studioChat';
import createAccountSwitch from '../../../main/studioChat/accountSwitch';
import {
  keepSession,
  takeKeptSessions,
  writeKeptSessions,
} from '../../../main/studioChat/chatAdopt';
import type { IChatSession } from '../../../main/studioChat/chatLaunch';
import type { TChatPictures } from '../../../main/studioChat/chatPictures';
import type {
  IChatLauncher,
  IChatProcess,
  IChatProcessEvents,
} from '../../../main/studioChat/chatProcess';
import createChatQueue from '../../../main/studioChat/chatQueue';
import createChatSessions from '../../../main/studioChat/chatSessions';
import type { IChatTranscript } from '../../../main/studioChat/chatTranscript';
import createChatTurns from '../../../main/studioChat/chatTurns';
/* eslint-enable import/first */

const CREDENTIALS = '.credentials.json';
const AMY = 'ready:amy@example.com';
const BEA = 'ready:bea@example.com';

/** Every answer already given has been read: a few turns of the microtask queue. */
const settled = (turns = 10): Promise<void> =>
  turns === 0
    ? Promise.resolve()
    : Promise.resolve().then(() => settled(turns - 1));

const say = (message: Record<string, unknown>) => JSON.stringify(message);
/** Claude Code begins a step: a read, which writes no picture. */
const stepLine = (id: string) =>
  say({
    type: 'assistant',
    message: {
      content: [
        { type: 'tool_use', id, name: 'Read', input: { file_path: 'a.frag' } },
      ],
    },
  });
const doneLine = say({ type: 'result', subtype: 'success', is_error: false });
const failedLine = say({
  type: 'result',
  subtype: 'success',
  is_error: true,
  terminal_reason: 'api_error',
  api_error_status: 529,
  result: 'API Error: 529 Overloaded.',
});

/** The chat's last entry: the reply that just ended. */
const lastEntry = ({ entries }: IChatTranscript) => entries[entries.length - 1];

const message = (words: string) => ({
  words,
  brief: 'brief',
  model: 'default' as const,
  effort: 'default' as const,
});

interface IWritten {
  type: string;
  uuid?: string;
  message?: { content: { type: string; text?: string }[] };
  request?: { subtype?: string; message_uuid?: string };
}

/** A Claude Code that keeps every line written to it. */
const fakeProcess = () => {
  const written: IWritten[] = [];
  const process: IChatProcess & { end: jest.Mock } = {
    write: (line: string) => {
      written.push(JSON.parse(line) as IWritten);
    },
    end: jest.fn(),
    position: () => written.length,
  };
  return { process, written };
};

/** Who Claude Code answers is signed in, and the one folder watch. */
const fakeAccount = (first: string) => {
  const state = { now: first as string | undefined };
  let heard: ((name: string | undefined) => void) | undefined;
  const who = jest.fn(async () => state.now);
  return {
    state,
    who,
    watch: jest.fn(
      (_folder: string, changed: (name: string | undefined) => void) => {
        heard = changed;
        return () => {
          heard = undefined;
        };
      },
    ),
    /** Claude Code's sign-in file was written, signed in as `now`. */
    signIn: async (now: string | undefined, name = CREDENTIALS) => {
      state.now = now;
      heard?.(name);
      await settled();
    },
  };
};

/** The chats' own folders the cases made, removed after each. */
const roots: string[] = [];
afterEach(() => {
  roots
    .splice(0)
    .forEach((root) => fs.rmSync(root, { recursive: true, force: true }));
});

const setUp = (first = AMY) => {
  const account = fakeAccount(first);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-account-'));
  roots.push(root);
  const transcripts = new Map<string, IChatTranscript>();
  const transcriptOf = (projectId: string) => {
    const known = transcripts.get(projectId) ?? { entries: [] };
    transcripts.set(projectId, known);
    return known;
  };
  const upsert = (projectId: string, entry: TStudioChatEntry) => {
    const { entries } = transcriptOf(projectId);
    const at = entries.findIndex(({ id }) => id === entry.id);
    if (at === -1) {
      entries.push(entry);
    } else {
      entries[at] = entry;
    }
  };
  const queue = createChatQueue(() => undefined);
  const turns = createChatTurns({
    queue,
    upsert,
    tell: () => undefined,
    save: () => undefined,
    saveWith: () => undefined,
    versionsOf: () => 'versions',
    entriesOf: () => [],
    dropAsks: () => undefined,
  });
  const started: ReturnType<typeof fakeProcess>[] = [];
  const commands: { args: string[] }[] = [];
  const attached: IChatProcessEvents[] = [];
  const launcher: IChatLauncher = {
    start: (_projectId, command, events) => {
      commands.push(command);
      attached.push(events);
      const one = fakeProcess();
      started.push(one);
      return one.process;
    },
    restarting: () => false,
    takeUp: async () => undefined,
    close: () => undefined,
  };
  const pictures = {
    asks: { tool: jest.fn(async () => true) },
    address: jest.fn(async () => ({
      url: 'http://127.0.0.1:5000/mcp',
      key: 'k',
    })),
    serversChanged: () => 0,
    noteServers: () => undefined,
  } as unknown as TChatPictures;
  const sessions = new Map<string, IChatSession>();
  const retired = jest.fn();
  // Wired as the app wires them (`studioChat.ts`).
  const chat = createChatSessions({
    root,
    sessions,
    launcher,
    transcriptOf,
    save: () => undefined,
    upsert,
    turns,
    queue,
    pictures,
    noteUsage: () => undefined,
    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- called only once a chat starts, after both exist
    following: () => accountSwitch.follow(),
    retired,
  });
  const accountSwitch = createAccountSwitch({
    who: account.who,
    folder: () => 'C:/Users/member/.claude',
    file: CREDENTIALS,
    watch: account.watch,
    switched: chat.switched,
  });
  /** A chat on the lake, its first answer about who is signed in read. */
  const open = async () => {
    const session = await chat.sessionFor('lake', 'C:/Lake', message(''));
    if (!session) {
      throw new Error('no session was started');
    }
    await settled();
    return session;
  };
  const users = (at: number) =>
    started[at].written.filter(({ type }) => type === 'user');
  return {
    account,
    chat,
    sessions,
    queue,
    turns,
    started,
    commands,
    attached,
    retired,
    transcriptOf,
    open,
    users,
    accountSwitch,
  };
};

describe('who is signed in to Claude Code, followed', () => {
  it('is not followed before a chat runs, and then only through the sign-in file', async () => {
    const fluid = setUp();
    fluid.accountSwitch.check();
    expect(fluid.account.watch).not.toHaveBeenCalled();
    expect(fluid.account.who).not.toHaveBeenCalled();
    await fluid.open();
    expect(fluid.account.watch).toHaveBeenCalledTimes(1);
    expect(fluid.account.who).toHaveBeenCalledTimes(1);
    // A session's history changing says nothing about who is signed in.
    await fluid.account.signIn(BEA, 'history.jsonl');
    expect(fluid.account.who).toHaveBeenCalledTimes(1);
    expect(fluid.started[0].process.end).not.toHaveBeenCalled();
  });

  it('an answer nobody can read is not taken for another account', async () => {
    const fluid = setUp();
    await fluid.open();
    await fluid.account.signIn(undefined);
    expect(fluid.started[0].process.end).not.toHaveBeenCalled();
    // The control: the next readable answer is still compared with Amy.
    await fluid.account.signIn(AMY);
    expect(fluid.started[0].process.end).not.toHaveBeenCalled();
    await fluid.account.signIn(BEA);
    expect(fluid.started[0].process.end).toHaveBeenCalledTimes(1);
  });

  it("hears FluidEQ's own sign-in, where a keychain writes no file", async () => {
    const fluid = setUp();
    await fluid.open();
    fluid.accountSwitch.check();
    await settled();
    expect(fluid.started[0].process.end).not.toHaveBeenCalled();
    fluid.account.state.now = BEA;
    fluid.accountSwitch.check();
    await settled();
    expect(fluid.started[0].process.end).toHaveBeenCalledTimes(1);
  });

  it('counts a change heard before the first answer as a switch, as that answer may already be the new account', async () => {
    const run = async (changeHeard: boolean) => {
      const fluid = setUp();
      let answer: (who: string) => void = () => undefined;
      fluid.account.who.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            answer = resolve;
          }),
      );
      await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      if (changeHeard) {
        await fluid.account.signIn(BEA);
      }
      answer(BEA);
      await settled();
      return fluid.started[0].process.end.mock.calls.length;
    };
    expect(await run(true)).toBe(1);
    // The control: nothing heard, the first answer is who the chat is on.
    expect(await run(false)).toBe(0);
  });
});

describe('the Studio chats across a switch of Claude account', () => {
  it('ends a chat between replies, and its next message starts on the same conversation', async () => {
    const fluid = setUp();
    fluid.transcriptOf('lake').sessionId = 'conversation-1';
    const first = await fluid.open();
    // The control: Amy's sign-in renewed by another session ends nothing.
    await fluid.account.signIn(AMY);
    expect(first.process.end).not.toHaveBeenCalled();
    expect(await fluid.chat.sessionFor('lake', 'C:/Lake', message(''))).toBe(
      first,
    );
    await fluid.account.signIn(BEA);
    expect(first.process.end).toHaveBeenCalledTimes(1);
    expect(fluid.sessions.has('lake')).toBe(false);
    const next = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
    expect(next === first).toBe(false);
    expect(fluid.started).toHaveLength(2);
    const { args } = fluid.commands[1];
    expect(args[args.indexOf('--resume') + 1]).toBe('conversation-1');
  });

  it('lets a reply being written finish, then ends it and sends on what waited', async () => {
    const fluid = setUp();
    const session = await fluid.open();
    fluid.turns.begin('lake', session, [message('make it rain')]);
    await fluid.account.signIn(BEA);
    // Never cut off mid-reply.
    expect(session.process.end).not.toHaveBeenCalled();
    fluid.turns.queueMessage('lake', message('and snow'));
    fluid.attached[0].line(stepLine('read-1'));
    // Handed nothing more on the account left.
    expect(fluid.users(0)).toHaveLength(1);
    fluid.attached[0].line(doneLine);
    expect(session.process.end).toHaveBeenCalledTimes(1);
    expect(fluid.sessions.has('lake')).toBe(false);
    expect(lastEntry(fluid.transcriptOf('lake'))).toMatchObject({
      kind: 'claude',
      state: 'done',
    });
    // What waits goes on only once the old process is gone, and is still
    // there to go.
    expect(fluid.retired).not.toHaveBeenCalled();
    expect(fluid.queue.list('lake')).toMatchObject([
      { text: 'and snow', sent: false },
    ]);
    fluid.attached[0].closed();
    expect(fluid.retired).toHaveBeenCalledWith('lake', 'C:/Lake');
    expect(fluid.queue.list('lake')).toMatchObject([
      { text: 'and snow', sent: false },
    ]);
  });

  it('the control: the same account signing in again leaves a reply and its queue as they were', async () => {
    const fluid = setUp();
    const session = await fluid.open();
    fluid.turns.begin('lake', session, [message('make it rain')]);
    await fluid.account.signIn(AMY);
    fluid.turns.queueMessage('lake', message('and snow'));
    fluid.attached[0].line(stepLine('read-1'));
    // Handed at the step, as always.
    expect(fluid.users(0)).toHaveLength(2);
    fluid.attached[0].line(doneLine);
    expect(session.process.end).not.toHaveBeenCalled();
    expect(fluid.sessions.get('lake') === session).toBe(true);
    fluid.attached[0].closed();
    expect(fluid.retired).not.toHaveBeenCalled();
  });

  it('takes back what it was handed before the switch and had not read', async () => {
    const fluid = setUp();
    const session = await fluid.open();
    fluid.turns.begin('lake', session, [message('make it rain')]);
    fluid.turns.queueMessage('lake', message('and snow'));
    fluid.attached[0].line(stepLine('read-1'));
    const handed = fluid.users(0)[1]?.uuid;
    expect(handed).toBeDefined();
    await fluid.account.signIn(BEA);
    fluid.attached[0].line(doneLine);
    expect(
      fluid.started[0].written.some(
        ({ request }) =>
          request?.subtype === 'cancel_async_message' &&
          request.message_uuid === handed,
      ),
    ).toBe(true);
    expect(fluid.queue.list('lake')).toMatchObject([
      { text: 'and snow', sent: false },
    ]);
    expect(session.process.end).toHaveBeenCalledTimes(1);
    fluid.attached[0].closed();
    expect(fluid.retired).toHaveBeenCalledTimes(1);
  });

  it('a reply that fails on the account left keeps what waits for the member', async () => {
    const fluid = setUp();
    const session = await fluid.open();
    fluid.turns.begin('lake', session, [message('make it rain')]);
    await fluid.account.signIn(BEA);
    fluid.turns.queueMessage('lake', message('and snow'));
    fluid.attached[0].line(failedLine);
    expect(session.process.end).toHaveBeenCalledTimes(1);
    fluid.attached[0].closed();
    // A failure keeps it waiting, as any failure does: Try again, or the
    // next message, takes it, on a Claude Code on the new account.
    expect(fluid.retired).not.toHaveBeenCalled();
    expect(fluid.queue.list('lake')).toMatchObject([
      { text: 'and snow', sent: false },
    ]);
    const next = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
    expect(next === session).toBe(false);
  });

  it('send now on the account left ends the step, and what waits is read on the new one', async () => {
    const fluid = setUp();
    const session = await fluid.open();
    fluid.turns.begin('lake', session, [message('make it rain')]);
    await fluid.account.signIn(BEA);
    fluid.turns.queueMessage('lake', message('and snow'));
    expect(fluid.turns.sendNow('lake', session)).toBe(true);
    const controls = fluid.started[0].written.flatMap(({ request }) =>
      request ? [request] : [],
    );
    // An interrupt carrying no line of the member's to the old account.
    expect(controls).toEqual([{ subtype: 'interrupt' }]);
    expect(fluid.users(0)).toHaveLength(1);
    fluid.attached[0].line(failedLine);
    // The interrupted turn reads as done, so what waits goes on.
    expect(lastEntry(fluid.transcriptOf('lake'))).toMatchObject({
      state: 'done',
    });
    fluid.attached[0].closed();
    expect(fluid.retired).toHaveBeenCalledWith('lake', 'C:/Lake');
  });

  it('a chat stopped before it began on what it was handed is never answered on the account left', async () => {
    const run = async (now: string) => {
      const fluid = setUp();
      const session = await fluid.open();
      // Handed a line, not read yet: about to answer, so it is not cut off.
      fluid.queue.add('lake', message('make it rain'));
      fluid.queue.send('lake', 'line-1');
      await fluid.account.signIn(now);
      expect(session.process.end).not.toHaveBeenCalled();
      // Stop takes the line back: the chat is between replies again.
      fluid.turns.stop('lake', session);
      return (
        (await fluid.chat.sessionFor('lake', 'C:/Lake', message(''))) ===
        session
      );
    };
    expect(await run(BEA)).toBe(false);
    // The control: on the same account the running one answers.
    expect(await run(AMY)).toBe(true);
  });

  it('is still left on the old account after a restart in development', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-account-kept-'));
    roots.push(root);
    const session: IChatSession = {
      process: fakeProcess().process,
      folder: 'C:/Lake',
      model: 'default',
      effort: 'default',
      brief: 'brief-key',
      stopping: false,
      sendingNow: false,
    };
    const file = path.join(root, 'relay-sessions.json');
    writeKeptSessions(file, [
      keepSession('lake', { ...session, retiring: true }),
      keepSession('pond', session),
    ]);
    const kept = takeKeptSessions(file);
    expect(kept.get('lake')?.retiring).toBe(true);
    // The control: one never marked reads as never marked.
    expect(kept.get('pond')?.retiring).toBeUndefined();
  });
});
