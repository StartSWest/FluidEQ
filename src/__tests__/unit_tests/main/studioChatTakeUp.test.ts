/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * A chat taken up by the FluidEQ after a restart (`chatAdopt.ts`), and the
 * queue kept across any close (`chatQueueFile.ts`; Ivan, 2026-11-07:
 * "queued message needs to be kept when app restarts too"): what the chat
 * knew is read back as it was written, the reply being written comes out
 * whole and once, and a question still waiting is asked again.
 */

jest.mock('../../../main/studioChat/chatVersions', () => ({
  keepReplyVersion: jest.fn(() => undefined),
}));

/* eslint-disable import/first -- the mock above must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TStudioChatEntry } from '../../../common/studioChat';
import {
  keepSession,
  takeKeptSessions,
  takenUpEvents,
  writeKeptSessions,
} from '../../../main/studioChat/chatAdopt';
import type { IChatSession } from '../../../main/studioChat/chatLaunch';
import { claudeCodeEvents } from '../../../main/studioChat/chatLaunch';
import createChatQueue from '../../../main/studioChat/chatQueue';
import {
  takeChatQueues,
  writeChatQueues,
} from '../../../main/studioChat/chatQueueFile';
import createChatTurns from '../../../main/studioChat/chatTurns';
/* eslint-enable import/first */

const say = (message: Record<string, unknown>) => JSON.stringify(message);
const words = (text: string) =>
  say({
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    },
  });
const question = say({
  type: 'control_request',
  request_id: 'q-1',
  request: { subtype: 'can_use_tool', tool_name: 'Bash', input: {} },
});
const result = say({ type: 'result', subtype: 'success', result: 'done' });

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chat-take-up-'));

const message = (text: string, picture?: Uint8Array) => ({
  words: text,
  ...(picture ? { picture } : {}),
  brief: 'brief',
  model: 'opus' as const,
  effort: 'high' as const,
});

describe('a chat taken up across a restart', () => {
  it('is kept and read back as it stood, once', () => {
    const dir = tmp();
    try {
      const file = path.join(dir, 'kept.json');
      const session: IChatSession = {
        process: {
          write: () => undefined,
          end: () => undefined,
          position: () => 7,
        },
        folder: 'C:/Scenes/Lake',
        door: { url: 'http://127.0.0.1:4321/mcp', key: 'k' },
        model: 'opus',
        effort: 'high',
        brief: 'brief-key',
        reply: {
          kind: 'claude',
          id: 'r-1',
          text: 'so far',
          steps: [],
          state: 'working',
        },
        replyFrom: 3,
        stopping: true,
        sendingNow: false,
      };
      writeKeptSessions(file, [keepSession('lake', session)]);
      const kept = takeKeptSessions(file);
      expect(kept.get('lake')).toEqual({
        projectId: 'lake',
        folder: 'C:/Scenes/Lake',
        model: 'opus',
        effort: 'high',
        brief: 'brief-key',
        seen: 7,
        reply: { id: 'r-1', from: 3 },
        stopping: true,
        sendingNow: false,
        door: { url: 'http://127.0.0.1:4321/mcp', key: 'k' },
      });
      // Read once: a later FluidEQ finds nothing to take up.
      expect(takeKeptSessions(file).size).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writes its reply whole and once, from where it began, and asks a waiting question again', () => {
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
    // Lines 0 and 1 were before the reply began; it began at 2, and the
    // FluidEQ before had read up to 4 when it restarted.
    const backlog = [
      words('an earlier reply'),
      question,
      words('Looking. '),
      words('Drawing. '),
      words('Done.'),
      result,
    ];
    let position = 0;
    const session: IChatSession = {
      process: {
        write: () => undefined,
        end: () => undefined,
        position: () => position,
      },
      folder: 'C:/Scenes/Lake',
      model: 'default',
      effort: 'default',
      brief: 'brief-key',
      stopping: false,
      sendingNow: false,
    };
    turns.resume('lake', session, 'r-1');
    const questions: string[] = [];
    const events = takenUpEvents(
      claudeCodeEvents(
        (event) => {
          if (event.type === 'permission') {
            questions.push(event.requestId);
          } else if (event.type !== 'session') {
            turns.onEvent('lake', session, event);
          }
        },
        () => undefined,
        () => undefined,
      ),
      () => position,
      {
        projectId: 'lake',
        folder: 'C:/Scenes/Lake',
        model: 'default',
        effort: 'default',
        seen: 4,
        reply: { id: 'r-1', from: 2 },
        stopping: false,
        sendingNow: false,
      },
    );
    backlog.forEach((line, seq) => {
      position = seq + 1;
      events.line(line);
    });
    expect(entries).toEqual([
      expect.objectContaining({
        id: 'r-1',
        text: 'Looking. Drawing. Done.',
        state: 'done',
      }),
    ]);
    // Before the reply began only the question is acted on.
    expect(questions).toEqual(['q-1']);
  });
});

describe('the queue across a close', () => {
  it('keeps every project’s messages, pictures and handed lines, and is read once', () => {
    const dir = tmp();
    try {
      const file = path.join(dir, 'queued.json');
      const queue = createChatQueue(() => undefined);
      queue.add('lake', message('make it bluer', new Uint8Array([0xff, 0xd8])));
      queue.add('lake', message('and slower'));
      queue.send('lake', 'line-1');
      queue.add('city', message('more neon'));
      writeChatQueues(file, queue.all());

      const back = createChatQueue(() => undefined);
      takeChatQueues(file).forEach((entries, projectId) =>
        back.restore(projectId, entries),
      );
      expect(back.list('lake')).toEqual(queue.list('lake'));
      expect(back.list('city')).toEqual(queue.list('city'));
      expect(back.lines('lake')).toEqual(['line-1']);
      expect(back.takeWaiting('city')).toEqual([message('more neon')]);
      const [picture] = back.all().get('lake') ?? [];
      expect(Array.from(picture.message.picture ?? [])).toEqual([0xff, 0xd8]);
      expect(takeChatQueues(file).size).toBe(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('leaves no file when nothing is queued', () => {
    const dir = tmp();
    try {
      const file = path.join(dir, 'queued.json');
      fs.writeFileSync(file, '{}');
      writeChatQueues(file, createChatQueue(() => undefined).all());
      expect(fs.existsSync(file)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
