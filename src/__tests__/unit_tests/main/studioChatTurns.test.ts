/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio chat's replies on a running Claude Code (`chatTurns.ts`) and
 * its queue (`chatQueue.ts`), held to what was measured of Claude Code on
 * 2026-10-16: a line written while a step runs is read when that step
 * returns, every line is reported read once and in order, and an interrupt
 * ends the turn but keeps the process, which reads what it was handed next.
 */

jest.mock('../../../main/studioChat/chatVersions', () => ({
  keepReplyVersion: jest.fn(() => undefined),
}));
jest.mock('../../../main/studioChat/chatPicture', () => ({
  chatPictureFromBytes: jest.fn(() => 'data:image/jpeg;base64,AA=='),
}));
jest.mock('../../../main/studioChat/endProcessTree', () => ({
  __esModule: true,
  default: jest.fn(),
}));

/* eslint-disable import/first -- the mocks must be installed first */
import type { ChildProcess } from 'child_process';
import type {
  IStudioChatQueued,
  TStudioChatEntry,
} from '../../../common/studioChat';
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

/** A chat on a fake Claude Code: every line written, every entry shown. */
const setUp = () => {
  const lines: string[] = [];
  const told: IStudioChatQueued[][] = [];
  const entries: TStudioChatEntry[] = [];
  const queue = createChatQueue((_projectId, queued) => told.push(queued));
  const upsert = (_projectId: string, entry: TStudioChatEntry) => {
    const at = entries.findIndex(({ id }) => id === entry.id);
    if (at === -1) {
      entries.push(entry);
    } else {
      entries[at] = entry;
    }
  };
  const turns = createChatTurns({
    queue,
    upsert,
    tell: () => undefined,
    save: () => undefined,
    saveWith: () => undefined,
    versionsOf: () => 'versions',
    dropAsks: () => undefined,
  });
  const session: IChatSession = {
    child: {
      stdin: { write: (line: string) => lines.push(line) },
    } as unknown as ChildProcess,
    folder: 'folder',
    model: 'default',
    effort: 'default',
    stopping: false,
    written: [],
  };
  const wordsOf = (line: string) =>
    (
      JSON.parse(line) as { message?: { content: { text?: string }[] } }
    ).message?.content.map(({ text }) => text);
  return { lines, told, entries, queue, turns, session, wordsOf };
};

const runningStep = {
  type: 'step' as const,
  step: { id: 'read-1', kind: 'read' as const, state: 'running' as const },
};

describe('the Studio chat queue', () => {
  it('waits until handed over, then can no longer be taken back', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('one'));
    const [waiting] = queue.list(PROJECT);
    expect(waiting.sent).toBe(false);
    const { ids, messages } = queue.send(PROJECT);
    expect(messages.map(({ words }) => words)).toEqual(['one']);
    expect(queue.list(PROJECT)[0].sent).toBe(true);
    queue.remove(PROJECT, ids[0]);
    expect(queue.list(PROJECT)).toHaveLength(1);
  });

  it('a waiting one is taken back', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('one'));
    queue.remove(PROJECT, queue.list(PROJECT)[0].id);
    expect(queue.list(PROJECT)).toEqual([]);
  });

  it('read takes exactly the messages named, unsend puts them back to wait', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('one'));
    const { ids } = queue.send(PROJECT);
    queue.add(PROJECT, message('two'));
    queue.unsend(PROJECT, ids);
    expect(queue.list(PROJECT).map(({ sent }) => sent)).toEqual([false, false]);
    const again = queue.send(PROJECT);
    expect(queue.read(PROJECT, again.ids.slice(0, 1))).toEqual([
      message('one'),
    ]);
    expect(queue.list(PROJECT).map(({ text }) => text)).toEqual(['two']);
  });

  it('takeWaiting leaves what Claude Code already holds', () => {
    const { queue } = setUp();
    queue.add(PROJECT, message('held'));
    queue.send(PROJECT);
    queue.add(PROJECT, message('waiting'));
    expect(queue.takeWaiting(PROJECT)).toEqual([message('waiting')]);
    expect(queue.list(PROJECT).map(({ text }) => text)).toEqual(['held']);
    expect(queue.hasSent(PROJECT)).toBe(true);
  });
});

describe("the Studio chat's turns", () => {
  it('a message queued while no step runs waits, and goes when the next step starts', () => {
    const { lines, turns, session, queue, wordsOf } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.queueMessage(PROJECT, session, message('also this'));
    expect(lines).toEqual(['first\n']);
    turns.onEvent(PROJECT, session, runningStep);
    expect(lines).toHaveLength(2);
    expect(wordsOf(lines[1])).toEqual(['also this']);
    expect(queue.list(PROJECT)[0].sent).toBe(true);
  });

  it('a message queued while a step runs is handed over at once', () => {
    const { lines, turns, session } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.onEvent(PROJECT, session, runningStep);
    turns.queueMessage(PROJECT, session, message('now'));
    expect(lines).toHaveLength(2);
  });

  it("Claude Code reading the member's own line shows nothing new", () => {
    const { entries, turns, session } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.onEvent(PROJECT, session, { type: 'read' });
    expect(session.written).toEqual([]);
    expect(entries).toEqual([]);
    expect(session.reply?.state).toBe('working');
  });

  it('a queued message read mid-reply joins the chat there, and the reply goes on under it', () => {
    const { entries, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.onEvent(PROJECT, session, { type: 'read' });
    turns.onEvent(PROJECT, session, { type: 'text', text: 'Working on it.' });
    turns.queueMessage(PROJECT, session, message('make it red'));
    turns.onEvent(PROJECT, session, runningStep);
    const before = session.reply?.id;
    turns.onEvent(PROJECT, session, { type: 'read' });
    expect(entries.map((entry) => entry.kind)).toEqual(['claude', 'me']);
    expect(entries[0]).toMatchObject({ state: 'done', text: 'Working on it.' });
    expect(entries[1]).toMatchObject({ kind: 'me', text: 'make it red' });
    expect(session.reply?.state).toBe('working');
    expect(session.reply?.id).not.toBe(before);
    expect(queue.list(PROJECT)).toEqual([]);
  });

  it('Stop asks Claude Code to stop and keeps it; a second press ends it', () => {
    const { lines, turns, session } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.stop(PROJECT, session);
    expect(JSON.parse(lines[1])).toMatchObject({
      type: 'control_request',
      request: { subtype: 'interrupt' },
    });
    expect(endProcessTree).not.toHaveBeenCalled();
    turns.stop(PROJECT, session);
    expect(endProcessTree).toHaveBeenCalledWith(session.child);
  });

  it('a stopped reply hands on what waits', () => {
    const { lines, entries, turns, session, queue, wordsOf } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.queueMessage(PROJECT, session, message('then this'));
    turns.stop(PROJECT, session);
    turns.onEvent(PROJECT, session, { type: 'end', failure: 'crashed' });
    expect(entries[0]).toMatchObject({ state: 'stopped' });
    expect(wordsOf(lines[lines.length - 1])).toEqual(['then this']);
    expect(queue.hasSent(PROJECT)).toBe(true);
    expect(turns.isWorking(PROJECT, session)).toBe(true);
  });

  it('a failed reply keeps what waits, unsent', () => {
    const { lines, entries, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.queueMessage(PROJECT, session, message('then this'));
    turns.onEvent(PROJECT, session, { type: 'end', failure: 'limit' });
    expect(entries[0]).toMatchObject({ state: 'failed', failure: 'limit' });
    expect(lines).toEqual(['first\n']);
    expect(queue.list(PROJECT)).toMatchObject([
      { text: 'then this', sent: false },
    ]);
    expect(turns.isWorking(PROJECT, session)).toBe(false);
  });

  it('Claude Code ending before it read a queued line puts it back to wait', () => {
    const { entries, turns, session, queue } = setUp();
    turns.begin(PROJECT, session, 'first\n');
    turns.onEvent(PROJECT, session, runningStep);
    turns.queueMessage(PROJECT, session, message('unread'));
    expect(queue.hasSent(PROJECT)).toBe(true);
    turns.ended(PROJECT, session, 'crashed');
    expect(queue.list(PROJECT)).toMatchObject([
      { text: 'unread', sent: false },
    ]);
    expect(entries[0]).toMatchObject({ state: 'failed', failure: 'crashed' });
    expect(session.written).toEqual([]);
  });

  it('a retry takes the failed reply’s place, by its id', () => {
    const { entries, turns, session } = setUp();
    turns.begin(PROJECT, session, 'again\n', 'failed-reply');
    expect(session.reply?.id).toBe('failed-reply');
    expect(entries).toEqual([]);
  });
});

describe('reading the stream and the chat for the queue and the retry', () => {
  it('a replayed user line is read as one read, a tool result is not', () => {
    expect(
      readStreamLine(
        JSON.stringify({
          type: 'user',
          isReplay: true,
          message: { role: 'user', content: [{ type: 'text', text: 'hi' }] },
        }),
      ),
    ).toEqual([{ type: 'read' }]);
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
