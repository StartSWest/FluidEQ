/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Each project's Claude Code across FluidEQ closing (`chatSessions.ts`): a
 * restart for a change to its own code leaves every chat running and writes
 * down what the next FluidEQ needs; the next one takes each chat up where
 * it was; a real quit ends them all and the helper with them (Ivan,
 * 2026-11-07: "make sure that process doesn't get loose when app closes");
 * and the queue is kept either way ("queued message needs to be kept when
 * app restarts too").
 */

jest.mock('../../../main/studioChat/chatVersions', () => ({
  keepReplyVersion: jest.fn(() => undefined),
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
import type { IChatSession } from '../../../main/studioChat/chatLaunch';
import type { TChatPictures } from '../../../main/studioChat/chatPictures';
import type {
  IChatAdoption,
  IChatLauncher,
  IChatProcess,
} from '../../../main/studioChat/chatProcess';
import createChatQueue from '../../../main/studioChat/chatQueue';
import createChatSessions from '../../../main/studioChat/chatSessions';
import type { IChatTranscript } from '../../../main/studioChat/chatTranscript';
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

const message = (text: string) => ({
  words: text,
  brief: 'brief',
  model: 'default' as const,
  effort: 'default' as const,
});

const fakeProcess = (): IChatProcess & { end: jest.Mock } => ({
  write: () => undefined,
  end: jest.fn(),
  position: () => 0,
});

const setUp = (
  root: string,
  {
    restarting = false,
    held = [],
    skills,
  }: {
    restarting?: boolean;
    held?: ((adopt: (adoption: IChatAdoption) => void) => void)[];
    skills?: () => { dir: string; digest: string } | undefined;
  } = {},
) => {
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
  const started: (IChatProcess & { end: jest.Mock })[] = [];
  const commands: { args: string[] }[] = [];
  const launcher: IChatLauncher & { close: jest.Mock } = {
    start: (_projectId, command) => {
      commands.push(command);
      const process = fakeProcess();
      started.push(process);
      return process;
    },
    restarting: () => restarting,
    // Later than the chat's own making, as a host's answer is.
    takeUp: async (adopt) => {
      await Promise.resolve();
      held.forEach((hand) => hand(adopt));
    },
    close: jest.fn(),
  };
  const address = jest.fn(async () => ({
    url: 'http://127.0.0.1:5000/mcp',
    key: 'new',
  }));
  const pictures = {
    asks: { tool: jest.fn(async () => true) },
    address,
  } as unknown as TChatPictures;
  const sessions = new Map<string, IChatSession>();
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
    ...(skills ? { skills } : {}),
  });
  return {
    chat,
    sessions,
    queue,
    turns,
    launcher,
    started,
    commands,
    address,
    transcriptOf,
  };
};

/** What a command started Claude Code with: its brief, conversation and plugin. */
const startedWith = ({ args }: { args: string[] }) => {
  const after = (flag: string) => {
    const at = args.indexOf(flag);
    return at === -1 ? undefined : args[at + 1];
  };
  const briefFile = after('--append-system-prompt-file');
  return {
    brief: briefFile ? fs.readFileSync(briefFile, 'utf8') : undefined,
    resume: after('--resume'),
    plugin: after('--plugin-dir'),
  };
};

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'chat-sessions-'));

describe("a project's Claude Code across FluidEQ closing", () => {
  it('starts a chat again on a newer brief, on the same conversation, and keeps it on the same one', async () => {
    // Ivan, 2026-11-08: "make sure to update the latest AI system prompt on
    // all studio scenes".
    const root = tmp();
    try {
      const fluid = setUp(root);
      const first = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      // The same brief: the running process answers.
      expect(await fluid.chat.sessionFor('lake', 'C:/Lake', message(''))).toBe(
        first,
      );
      expect(fluid.started).toHaveLength(1);
      // FluidEQ's brief changed: a new process, the old one ended.
      const newer = await fluid.chat.sessionFor('lake', 'C:/Lake', {
        ...message(''),
        brief: 'brief, newer',
      });
      expect(newer).not.toBe(first);
      expect(first?.process.end).toHaveBeenCalled();
      expect(fluid.started).toHaveLength(2);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  // Ivan, 2026-11-09: "when we update fluid it ships with fluid so when the
  // user opens a new chat or after chat cache expired it reads again the new
  // updated prompt".
  it('runs a conversation saved under one brief on the brief FluidEQ has now, as the same conversation', async () => {
    const root = tmp();
    try {
      const fluid = setUp(root);
      // A conversation kept from before FluidEQ was updated: nothing running.
      fluid.transcriptOf('lake').sessionId = 'conversation-1';
      await fluid.chat.sessionFor('lake', 'C:/Lake', {
        ...message(''),
        brief: 'the brief this FluidEQ ships',
      });
      expect(fluid.commands).toHaveLength(1);
      expect(startedWith(fluid.commands[0])).toEqual({
        brief: 'the brief this FluidEQ ships',
        resume: 'conversation-1',
        plugin: undefined,
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('loads the skills FluidEQ ships, and starts a chat again on the same conversation when they change', async () => {
    const root = tmp();
    try {
      let digest = 'skills as shipped';
      const fluid = setUp(root, {
        skills: () => ({
          dir: 'C:/FluidEQ/resources/assets/studio/fluideq',
          digest,
        }),
      });
      fluid.transcriptOf('lake').sessionId = 'conversation-1';
      const first = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      expect(startedWith(fluid.commands[0]).plugin).toBe(
        'C:/FluidEQ/resources/assets/studio/fluideq',
      );
      // The same brief and skills: the running process answers.
      expect(await fluid.chat.sessionFor('lake', 'C:/Lake', message(''))).toBe(
        first,
      );
      // FluidEQ's skills changed, the brief did not: started again, on the
      // same conversation.
      digest = 'skills, newer';
      const newer = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      expect(newer).not.toBe(first);
      expect(first?.process.end).toHaveBeenCalled();
      expect(startedWith(fluid.commands[1]).resume).toBe('conversation-1');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a restart leaves every chat running and writes down what the next FluidEQ needs', async () => {
    const root = tmp();
    try {
      const before = setUp(root, { restarting: true });
      const session = await before.chat.sessionFor(
        'lake',
        'C:/Lake',
        message(''),
      );
      if (!session) {
        throw new Error('no session');
      }
      before.turns.begin('lake', session, [message('make it rain')]);
      before.queue.add('lake', message('and thunder'));
      before.chat.dispose();
      expect(session.process.end).not.toHaveBeenCalled();
      expect(before.launcher.close).not.toHaveBeenCalled();

      // The FluidEQ after it takes the chat up.
      const process = fakeProcess();
      let position = 0;
      process.position = () => position;
      const replyId = session.reply?.id ?? '';
      const after = setUp(root, {
        held: [
          (adopt) =>
            adopt({
              child: {
                id: 'lake',
                lines: [],
                next: 0,
                ended: false,
                failed: false,
              },
              process,
              attach: (events) => {
                [words('Rain '), words('falls.')].forEach((line, seq) => {
                  position = seq + 1;
                  events.line(line);
                });
              },
            }),
        ],
      });
      // The reply read back from disk as stopped is replaced, not doubled.
      after.transcriptOf('lake').entries.push({
        kind: 'claude',
        id: replyId,
        text: 'Rai',
        steps: [],
        state: 'stopped',
      });
      expect(await after.chat.sessionFor('lake', 'C:/Lake', message(''))).toBe(
        after.sessions.get('lake'),
      );
      const taken = after.sessions.get('lake');
      expect(taken?.process).toBe(process);
      expect(taken?.reply).toMatchObject({ id: replyId, text: 'Rain falls.' });
      expect(after.transcriptOf('lake').entries).toEqual([]);
      // Its door opens again where its Claude Code reaches it.
      expect(after.address).toHaveBeenCalledWith('lake', 'C:/Lake', {
        port: 5000,
        key: 'new',
      });
      expect(after.queue.list('lake')).toEqual([
        {
          id: expect.any(String),
          text: 'and thunder',
          picture: false,
          sent: false,
        },
      ]);
      expect(after.started).toEqual([]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a chat nothing was kept for is ended, and a handed line nobody took up waits again', async () => {
    const root = tmp();
    try {
      // Kept as handed: a restart keeps the Claude Code it was handed to.
      fs.writeFileSync(
        path.join(root, 'queued.json'),
        JSON.stringify({
          city: [{ id: 'm', line: 'line-1', words: 'more neon', brief: 'b' }],
        }),
      );
      const stray = fakeProcess();
      const after = setUp(root, {
        held: [
          (adopt) =>
            adopt({
              child: {
                id: 'lake',
                lines: [],
                next: 0,
                ended: false,
                failed: false,
              },
              process: stray,
              attach: () => undefined,
            }),
        ],
      });
      await after.chat.sessionFor('other', 'C:/Other', message(''));
      expect(stray.end).toHaveBeenCalled();
      expect(after.sessions.has('lake')).toBe(false);
      expect(after.queue.list('city')).toEqual([
        { id: 'm', text: 'more neon', picture: false, sent: false },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('a real quit ends every chat and the helper, and keeps the queue to wait again', async () => {
    const root = tmp();
    try {
      const fluid = setUp(root);
      const session = await fluid.chat.sessionFor(
        'lake',
        'C:/Lake',
        message(''),
      );
      if (!session) {
        throw new Error('no session');
      }
      fluid.queue.add('lake', message('and thunder'));
      fluid.queue.send('lake', 'line-1');
      fluid.chat.dispose();
      expect(session.process.end).toHaveBeenCalled();
      expect(fluid.launcher.close).toHaveBeenCalled();
      expect(fs.existsSync(path.join(root, 'relay-sessions.json'))).toBe(false);

      const next = setUp(root);
      expect(next.queue.list('lake')).toEqual([
        {
          id: expect.any(String),
          text: 'and thunder',
          picture: false,
          sent: false,
        },
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
