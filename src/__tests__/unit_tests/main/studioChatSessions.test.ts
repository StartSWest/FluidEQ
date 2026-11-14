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
import type {
  TStudioChatEntry,
  TStudioChatModel,
} from '../../../common/studioChat';
import type { IChatSession } from '../../../main/studioChat/chatLaunch';
import type { TChatPictures } from '../../../main/studioChat/chatPictures';
import type {
  IChatAdoption,
  IChatLauncher,
  IChatProcess,
  IChatProcessEvents,
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
    offered,
    logger,
  }: {
    restarting?: boolean;
    held?: ((adopt: (adoption: IChatAdoption) => void) => void)[];
    skills?: () => { dir: string; digest: string } | undefined;
    offered?: (model: TStudioChatModel) => boolean;
    logger?: { info(message: string): void; warn(message: string): void };
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
  const attached: { events: IChatProcessEvents }[] = [];
  const launcher: IChatLauncher & { close: jest.Mock } = {
    start: (_projectId, command, events) => {
      commands.push(command);
      attached.push({ events });
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
  /** How many times the member's servers were changed from FluidEQ. */
  const servers = { changed: 0 };
  const noteServers = jest.fn();
  const pictures = {
    asks: { tool: jest.fn(async () => true) },
    address,
    serversChanged: () => servers.changed,
    noteServers,
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
    ...(offered ? { offered } : {}),
    ...(logger ? { logger } : {}),
  });
  return {
    chat,
    sessions,
    queue,
    turns,
    launcher,
    started,
    commands,
    attached,
    address,
    transcriptOf,
    servers,
    noteServers,
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

describe('the model a chat is started on', () => {
  // Ivan, 2026-11-09: "make sure model list gets updated when app is
  // restarted": a line by Claude Code's own name for it, which it resolves
  // to the line's newest model, and a line the plan lacks as Default.
  it('starts a line by its name, and one this account cannot use as Default', async () => {
    const root = tmp();
    try {
      const fluid = setUp(root, { offered: (model) => model !== 'haiku' });
      await fluid.chat.sessionFor('lake', 'C:/Lake', {
        ...message(''),
        model: 'sonnet',
      });
      const sonnet = fluid.commands[0].args;
      expect(sonnet[sonnet.indexOf('--model') + 1]).toBe('sonnet');
      await fluid.chat.sessionFor('lake', 'C:/Lake', {
        ...message(''),
        model: 'haiku',
      });
      expect(fluid.commands[1].args).not.toContain('--model');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

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

  // Ivan, 2026-11-11: a new chat said it could not reach Higgsfield. A
  // Claude Code reads its tool servers once, at its start, so one started
  // before Higgsfield was set up never has its tools.
  it('starts a chat again on the same conversation once its servers were changed, between replies', async () => {
    const root = tmp();
    try {
      const fluid = setUp(root);
      fluid.transcriptOf('lake').sessionId = 'conversation-1';
      const first = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      // The control: nothing changed, the running process answers.
      expect(await fluid.chat.sessionFor('lake', 'C:/Lake', message(''))).toBe(
        first,
      );
      fluid.servers.changed += 1;
      const after = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      expect(after).not.toBe(first);
      expect(first?.process.end).toHaveBeenCalled();
      expect(startedWith(fluid.commands[1]).resume).toBe('conversation-1');
      // Started on the change, it is current from then on.
      expect(await fluid.chat.sessionFor('lake', 'C:/Lake', message(''))).toBe(
        after,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('never ends a reply being written for a change to its servers', async () => {
    const root = tmp();
    try {
      const fluid = setUp(root);
      const first = await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      if (!first) {
        throw new Error('no session');
      }
      fluid.turns.begin('lake', first, [message('make it rain')]);
      fluid.servers.changed += 1;
      // Compared as a yes or no: a session printed whole on a failure is a
      // cycle that takes Jest down with it.
      const same =
        (await fluid.chat.sessionFor('lake', 'C:/Lake', message(''))) === first;
      expect(same).toBe(true);
      expect(first.process.end).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('tells the Accounts card what servers its Claude Code really has, as each turn starts', async () => {
    const root = tmp();
    try {
      const fluid = setUp(root);
      await fluid.chat.sessionFor('lake', 'C:/Lake', message(''));
      const [{ events }] = fluid.attached;
      events.line(
        say({
          type: 'system',
          subtype: 'init',
          session_id: 's',
          mcp_servers: [{ name: 'claude.ai Higgsfield', status: 'needs-auth' }],
        }),
      );
      events.line(words('Rain.'));
      expect(fluid.noteServers).toHaveBeenCalledTimes(1);
      expect(fluid.noteServers).toHaveBeenCalledWith(
        new Map([['claude.ai Higgsfield', 'needs-auth']]),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('writes down what Claude Code named when a reply ends on something the chat has no notice for, and nothing where it has one', async () => {
    const root = tmp();
    try {
      const warn = jest.fn();
      const fluid = setUp(root, { logger: { info: () => undefined, warn } });
      const session = await fluid.chat.sessionFor(
        'lake',
        'C:/Lake',
        message(''),
      );
      if (!session) {
        throw new Error('no session was started');
      }
      const [{ events }] = fluid.attached;
      const ended = (result: string, status: number) =>
        events.line(
          say({
            type: 'result',
            subtype: 'success',
            is_error: true,
            terminal_reason: 'api_error',
            api_error_status: status,
            result,
          }),
        );
      // A stop with a notice of its own (`chatStop.ts`): nothing to report.
      fluid.turns.begin('lake', session, [message('make it rain')]);
      ended('API Error: 529 Overloaded.', 529);
      expect(warn).not.toHaveBeenCalled();
      fluid.turns.begin('lake', session, [message('again')]);
      ended('API Error: 400 something new', 400);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('has no notice for');
      expect(warn.mock.calls[0][0]).toContain(
        '"status":400,"words":"API Error: 400 something new"',
      );
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
