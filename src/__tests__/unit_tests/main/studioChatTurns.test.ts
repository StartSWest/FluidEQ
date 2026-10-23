/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio chat's replies on a running Claude Code (`chatTurns.ts`) and
 * its queue (`chatQueue.ts`), held to what was measured of Claude Code
 * 2.1.296: every line carries a uuid it echoes when it reads it, several
 * lines waiting at a turn's start are read as ONE under the first's uuid
 * (which hung the first version), cancel_async_message takes back a line not
 * read yet, and an interrupt with send_now ends the step so it is read next.
 */

jest.mock('../../../main/studioChat/chatVersions', () => ({
  keepReplyVersion: jest.fn(() => undefined),
}));
jest.mock('../../../main/studioChat/chatPicture', () => ({
  chatPictureFromBytes: jest.fn(() => 'data:image/jpeg;base64,AA=='),
  chatPictureFromDataUrl: jest.fn(() => 'data:image/jpeg;base64,AA=='),
}));
jest.mock('../../../main/studioChat/endProcessTree', () => ({
  __esModule: true,
  default: jest.fn(),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import type { ChildProcess } from 'child_process';
import type { TStudioChatEntry } from '../../../common/studioChat';
import type { IChatSession } from '../../../main/studioChat/chatLaunch';
import type { IChatMessage } from '../../../main/studioChat/chatMessage';
import { retryOf } from '../../../main/studioChat/chatMessage';
import createChatQueue from '../../../main/studioChat/chatQueue';
import { readStreamLine } from '../../../main/studioChat/chatStream';
import createChatTurns from '../../../main/studioChat/chatTurns';
import endProcessTree from '../../../main/studioChat/endProcessTree';
/* eslint-enable import/first */

const PROJECT = 'project';

beforeEach(() => jest.clearAllMocks());

const message = (words: string): IChatMessage => ({
  words,
  brief: 'brief',
  model: 'default',
  effort: 'default',
});

interface IWritten {
  type: string;
  uuid?: string;
  message?: { content: { type: string; text?: string }[] };
  request?: Record<string, unknown>;
}

/** A chat on a fake Claude Code: every line written, every entry shown. */
const setUp = () => {
  const lines: IWritten[] = [];
  const entries: TStudioChatEntry[] = [];
  const queue = createChatQueue(() => undefined);
  const turns = createChatTurns({
    queue,
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
    dropAsks: () => undefined,
  });
  const session: IChatSession = {
    child: {
      stdin: {
        write: (line: string) => lines.push(JSON.parse(line) as IWritten),
      },
    } as unknown as ChildProcess,
    folder: 'folder',
    model: 'default',
    effort: 'default',
    stopping: false,
    sendingNow: false,
  };
  const texts = (line: IWritten) =>
    line.message?.content.flatMap(({ text }) => (text ? [text] : []));
  const users = () => lines.filter(({ type }) => type === 'user');
  const controls = () =>
    lines.flatMap(({ request }) => (request ? [request] : []));
  return { lines, entries, queue, turns, session, texts, users, controls };
};

const step = (id: string) => ({
  type: 'step' as const,
  step: {
    id,
    kind: 'write' as const,
    state: 'running' as const,
    file: 'scene.frag',
  },
});

describe('the Studio chat queue', () => {
  it('hands every waiting message over in one line, and keeps it till read', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('one'));
    queue.add(PROJECT, message('two'));
    expect(queue.send(PROJECT, 'line-a').map(({ words }) => words)).toEqual([
      'one',
      'two',
    ]);
    expect(queue.list(PROJECT).map(({ sent }) => sent)).toEqual([true, true]);
    expect(queue.lines(PROJECT)).toEqual(['line-a']);
  });

  it('a handed message taken back names its line, and the line’s others wait again', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('one'));
    queue.add(PROJECT, message('two'));
    queue.send(PROJECT, 'line-a');
    expect(queue.remove(PROJECT, queue.list(PROJECT)[0].id)).toBe('line-a');
    expect(queue.list(PROJECT)).toMatchObject([{ text: 'two', sent: false }]);
  });

  it('a read takes its line, and any other line whose words it holds', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('first'));
    queue.send(PROJECT, 'line-a');
    queue.add(PROJECT, message('second'));
    queue.send(PROJECT, 'line-b');
    queue.add(PROJECT, message('waiting'));
    expect(queue.read(PROJECT, 'line-a', ['first', 'second'])).toBe(true);
    expect(queue.list(PROJECT).map(({ text }) => text)).toEqual(['waiting']);
    expect(queue.read(PROJECT, 'unknown', ['nothing of ours'])).toBe(false);
  });

  it('unsend and takeWaiting', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('held'));
    queue.send(PROJECT, 'line-a');
    queue.add(PROJECT, message('waiting'));
    expect(queue.takeWaiting(PROJECT)).toEqual([message('waiting')]);
    expect(queue.hasSent(PROJECT)).toBe(true);
    queue.unsend(PROJECT);
    expect(queue.hasSent(PROJECT)).toBe(false);
  });
});

describe("the Studio chat's turns", () => {
  it('every line written carries a uuid', () => {
    const { users, turns, session } = setUp();
    turns.begin(PROJECT, session, [message('hello')]);
    expect(users()[0].uuid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('messages queued between steps go together, as one message, when the next step starts', () => {
    const { users, texts, turns, session } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('that sucks'));
    turns.queueMessage(PROJECT, message('WTF'));
    expect(users()).toHaveLength(1);
    turns.onEvent(PROJECT, session, step('edit-1'));
    expect(users()).toHaveLength(2);
    expect(texts(users()[1])).toEqual(['that sucks', 'WTF']);
  });

  it('a queued line read mid-reply joins the chat there as one message, and the reply goes on under it', () => {
    const { users, entries, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.onEvent(PROJECT, session, { type: 'text', text: 'Working on it.' });
    turns.queueMessage(PROJECT, message('make it red'));
    turns.queueMessage(PROJECT, message('and slower'));
    turns.onEvent(PROJECT, session, step('edit-1'));
    const before = session.reply?.id;
    turns.onEvent(PROJECT, session, {
      type: 'read',
      uuid: users()[1].uuid,
      texts: ['make it red', 'and slower'],
    });
    expect(entries.map((entry) => entry.kind)).toEqual(['claude', 'me']);
    expect(entries[0]).toMatchObject({ state: 'done', text: 'Working on it.' });
    expect(entries[1]).toMatchObject({ text: 'make it red\n\nand slower' });
    expect(session.reply?.state).toBe('working');
    expect(session.reply?.id).not.toBe(before);
    expect(queue.list(PROJECT)).toEqual([]);
  });

  it('lines read as one at a turn’s start do not leave the chat waiting for the others (the hang)', () => {
    const { users, entries, turns, session } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('no dude'));
    turns.onEvent(PROJECT, session, step('edit-1'));
    turns.queueMessage(PROJECT, message('that sucks'));
    turns.onEvent(PROJECT, session, step('edit-2'));
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(turns.isWorking(PROJECT, session)).toBe(true);
    turns.onEvent(PROJECT, session, {
      type: 'read',
      uuid: users()[1].uuid,
      texts: ['no dude', 'that sucks'],
    });
    expect(turns.isWorking(PROJECT, session)).toBe(true);
    expect(session.reply?.state).toBe('working');
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(turns.isWorking(PROJECT, session)).toBe(false);
    expect(entries.filter(({ kind }) => kind === 'me')).toHaveLength(1);
  });

  it("Claude Code reading the member's own line shows nothing new", () => {
    const { users, entries, turns, session } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.onEvent(PROJECT, session, {
      type: 'read',
      uuid: users()[0].uuid,
      texts: ['first'],
    });
    expect(entries).toEqual([]);
    expect(session.reply?.state).toBe('working');
  });

  it('a handed message taken back is withdrawn from Claude Code by its line', () => {
    const { users, controls, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('never mind'));
    turns.onEvent(PROJECT, session, step('edit-1'));
    turns.unqueue(PROJECT, session, queue.list(PROJECT)[0].id);
    expect(controls()).toEqual([
      { subtype: 'cancel_async_message', message_uuid: users()[1].uuid },
    ]);
    expect(queue.list(PROJECT)).toEqual([]);
    expect(turns.isWorking(PROJECT, session)).toBe(true);
  });

  it('a waiting message taken back writes nothing', () => {
    const { lines, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('never mind'));
    turns.unqueue(PROJECT, session, queue.list(PROJECT)[0].id);
    expect(lines).toHaveLength(1);
  });

  it('Send now hands what waits over and asks Claude Code to read it now; the reply it cuts ends well', () => {
    const { users, controls, entries, turns, session } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('do this instead'));
    expect(turns.sendNow(PROJECT, session)).toBe(true);
    expect(controls()).toEqual([
      { subtype: 'interrupt', send_now: true, message_uuid: users()[1].uuid },
    ]);
    turns.onEvent(PROJECT, session, { type: 'end', failure: 'crashed' });
    expect(entries[0]).toMatchObject({ state: 'done' });
  });

  it('Send now with no reply running leaves it to the caller', () => {
    const { lines, turns, session } = setUp();
    turns.queueMessage(PROJECT, message('waiting'));
    expect(turns.sendNow(PROJECT, session)).toBe(false);
    expect(lines).toEqual([]);
  });

  it('Stop asks Claude Code to stop and keeps it; a second press ends it', () => {
    const { controls, turns, session } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.stop(PROJECT, session);
    expect(controls()).toEqual([{ subtype: 'interrupt' }]);
    expect(endProcessTree).not.toHaveBeenCalled();
    turns.stop(PROJECT, session);
    expect(endProcessTree).toHaveBeenCalledWith(session.child);
  });

  it('Stop with no reply running withdraws what was handed over, and the chat is free', () => {
    const { users, controls, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('then this'));
    turns.onEvent(PROJECT, session, step('edit-1'));
    turns.onEvent(PROJECT, session, { type: 'end' });
    expect(turns.isWorking(PROJECT, session)).toBe(true);
    turns.stop(PROJECT, session);
    expect(controls()).toEqual([
      { subtype: 'cancel_async_message', message_uuid: users()[1].uuid },
    ]);
    expect(turns.isWorking(PROJECT, session)).toBe(false);
    expect(queue.list(PROJECT)).toMatchObject([
      { text: 'then this', sent: false },
    ]);
  });

  it('a stopped reply hands on what waits', () => {
    const { users, texts, entries, turns, session } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('then this'));
    turns.stop(PROJECT, session);
    turns.onEvent(PROJECT, session, { type: 'end', failure: 'crashed' });
    expect(entries[0]).toMatchObject({ state: 'stopped' });
    expect(texts(users()[users().length - 1])).toEqual(['then this']);
  });

  it('a failed reply keeps what waits, unsent', () => {
    const { users, entries, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('then this'));
    turns.onEvent(PROJECT, session, { type: 'end', failure: 'limit' });
    expect(entries[0]).toMatchObject({ state: 'failed', failure: 'limit' });
    expect(users()).toHaveLength(1);
    expect(queue.list(PROJECT)).toMatchObject([{ sent: false }]);
  });

  it('Claude Code ending before it read a line puts it back to wait', () => {
    const { turns, session, queue } = setUp();
    turns.begin(PROJECT, session, [message('first')]);
    turns.queueMessage(PROJECT, message('unread'));
    turns.onEvent(PROJECT, session, step('edit-1'));
    turns.ended(PROJECT, session, 'crashed');
    expect(queue.list(PROJECT)).toMatchObject([
      { text: 'unread', sent: false },
    ]);
    expect(turns.isWorking(PROJECT, session)).toBe(false);
  });

  it('a retry takes the failed reply’s place, by its id', () => {
    const { turns, session } = setUp();
    turns.begin(PROJECT, session, [message('again')], 'failed-reply');
    expect(session.reply?.id).toBe('failed-reply');
  });
});

describe('reading the stream and the chat', () => {
  it('a replayed line is read with its uuid and its words; a tool result is not', () => {
    expect(
      readStreamLine(
        JSON.stringify({
          type: 'user',
          isReplay: true,
          uuid: 'u-1',
          message: {
            role: 'user',
            content: [
              { type: 'text', text: 'no dude WTF\n' },
              { type: 'text', text: 'that suckjs\n' },
            ],
          },
        }),
      ),
    ).toEqual([
      { type: 'read', uuid: 'u-1', texts: ['no dude WTF', 'that suckjs'] },
    ]);
    expect(
      readStreamLine(
        JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 't1', content: 'ok' },
            ],
          },
        }),
      ),
    ).toEqual([{ type: 'step-end', id: 't1', failed: false }]);
  });

  it('retryOf answers the member’s messages since the last reply, only after a failed one', () => {
    const entries: TStudioChatEntry[] = [
      { kind: 'me', id: 'm1', text: 'old' },
      { kind: 'claude', id: 'c1', text: '', steps: [], state: 'done' },
      {
        kind: 'me',
        id: 'm2',
        text: 'make it red',
        picture: 'data:image/jpeg;base64,AQID',
      },
      { kind: 'me', id: 'm3', text: 'and blue' },
      {
        kind: 'claude',
        id: 'c2',
        text: '',
        steps: [],
        state: 'failed',
        failure: 'signed-out',
      },
    ];
    const again = retryOf(entries);
    expect(again?.replyId).toBe('c2');
    expect(again?.messages.map(({ words }) => words)).toEqual([
      'make it red',
      'and blue',
    ]);
    expect(Array.from(again?.messages[0].picture ?? [])).toEqual([1, 2, 3]);
    expect(retryOf(entries.slice(0, 2))).toBeUndefined();
  });
});
