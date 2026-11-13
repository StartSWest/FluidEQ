/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each chat's model and effort are its own, kept in the chat's own file
 * (`chatShown.ts`; Ivan, 2026-11-13: "still, when I change the model it
 * changes in all the chats, not good"). Run on real folders, through the
 * modules main runs: the transcripts, their cache, the chat as the window
 * is shown it, and the earlier chats' moving aside and back. "After a
 * restart" is a second set of them on the same folder.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IStudioChat, TStudioChatEntry } from '../../../common/studioChat';
import createChatShown from '../../../main/studioChat/chatShown';
import { createTranscripts } from '../../../main/studioChat/chatTranscript';
import { createPastChats } from '../../../main/studioChat/pastChats';
import createTranscriptCache from '../../../main/studioChat/transcriptCache';

type THandler = (event: unknown, arg?: unknown) => unknown;
const mockHandlers = new Map<string, THandler>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: THandler) =>
      mockHandlers.set(channel, listener),
    removeHandler: (channel: string) => mockHandlers.delete(channel),
  },
}));

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

let outer: string;
let root: string;
let said = 0;

/** The chat's modules on `root`, as main makes them at launch. */
const launch = () => {
  mockHandlers.clear();
  const transcripts = createTranscripts(root);
  const { transcriptOf, save, saveWith, unload } =
    createTranscriptCache(transcripts);
  let open = A;
  let reply: TReply | undefined;
  const target = () => ({ key: open, folder: path.join(outer, 'scene') });
  const { chatOf, setPicks } = createChatShown({
    transcriptOf,
    save,
    saveWith,
    replyOf: () => reply,
    isBusy: () => false,
    standingAsk: () => undefined,
    queuedOf: () => [],
  });
  const chat = (): IStudioChat => {
    const shown = chatOf(target());
    if (!shown) {
      throw new Error('no chat is open');
    }
    return shown;
  };
  createPastChats({
    root,
    transcripts,
    agentProject: () => ({ ok: true, ...target(), id: open }),
    fromWindow: () => true,
    isBusy: () => false,
    letGo: unload,
    activeChat: chat,
  });
  const ask = (channel: string, arg?: unknown) => {
    const handler = mockHandlers.get(channel);
    if (!handler) {
      throw new Error(`${channel} is not handled`);
    }
    return handler({}, arg);
  };
  return {
    chat,
    /** The member moves to another project. */
    go: (projectId: string) => {
      open = projectId;
    },
    /** A pick from the window, made on `projectId`. */
    pick: (projectId: string, model: unknown, effort: unknown = 'medium') =>
      setPicks(target(), { projectId, model, effort }),
    /** Something said in the open chat, and saved as a turn's end saves it. */
    say: (text: string) => {
      said += 1;
      transcriptOf(open).entries.push({
        kind: 'me',
        id: `said-${said}`,
        text,
      });
      save(open);
    },
    writing: (next: TReply | undefined) => {
      reply = next;
    },
    newChat: () => ask('studio-chat-new'),
    openPast: (id: string) => ask('studio-chat-open-past', id),
    /** The open project's earlier chats, by their first line. */
    pastByTitle: () => {
      const dir = path.join(root, encodeURIComponent(open), 'past');
      return Object.fromEntries(
        fs.readdirSync(dir).map((id) => {
          const meta = JSON.parse(
            fs.readFileSync(path.join(dir, id, 'meta.json'), 'utf8'),
          ) as { title: string };
          return [meta.title, id];
        }),
      );
    },
  };
};

const fileOf = (projectId: string) =>
  path.join(root, encodeURIComponent(projectId), 'chat.json');

beforeEach(() => {
  outer = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-chat-picks-'));
  root = path.join(outer, 'studio-chat');
  fs.mkdirSync(root);
});

afterEach(() => {
  fs.rmSync(outer, { recursive: true, force: true });
});

describe("a chat's own model and effort, as main keeps them", () => {
  it('change in one project and stay as they were in another, also after a restart', () => {
    const main = launch();
    // The control: a chat nobody picked for has none.
    expect(main.chat().picks).toBeUndefined();
    main.pick(A, 'fable', 'high');
    main.go(B);
    expect(main.chat().picks).toBeUndefined();
    main.pick(B, 'sonnet', 'low');
    main.go(A);
    main.pick(A, 'opus', 'max');
    expect(main.chat().picks).toEqual({ model: 'opus', effort: 'max' });
    main.go(B);
    expect(main.chat().picks).toEqual({ model: 'sonnet', effort: 'low' });

    const again = launch();
    expect(again.chat().picks).toEqual({ model: 'opus', effort: 'max' });
    again.go(B);
    expect(again.chat().picks).toEqual({ model: 'sonnet', effort: 'low' });
  });

  it("are not a project's new chat's, and are the earlier chat's again when it is opened", async () => {
    const main = launch();
    main.say('the first chat');
    main.pick(A, 'opus', 'high');
    await main.newChat();
    // The new chat has nothing of the one put aside: no words and no picks.
    expect(main.chat().entries).toEqual([]);
    expect(main.chat().picks).toBeUndefined();
    main.pick(A, 'haiku', 'low');
    main.say('the second chat');

    await main.openPast(main.pastByTitle()['the first chat']);
    expect(main.chat().entries.map(({ text }) => text)).toEqual([
      'the first chat',
    ]);
    expect(main.chat().picks).toEqual({ model: 'opus', effort: 'high' });

    // And the second, put aside in its turn, kept its own: after a restart.
    const again = launch();
    expect(again.chat().picks).toEqual({ model: 'opus', effort: 'high' });
    await again.openPast(again.pastByTitle()['the second chat']);
    expect(again.chat().picks).toEqual({ model: 'haiku', effort: 'low' });
  });

  it('are taken only for the project that is open', () => {
    const main = launch();
    main.go(B);
    // A pick made on A reaching main after the member moved to B.
    main.pick(A, 'opus');
    expect(main.chat().picks).toBeUndefined();
    main.go(A);
    expect(main.chat().picks).toBeUndefined();
    // The control: made on the open project, the same pick is taken.
    main.pick(A, 'opus');
    expect(main.chat().picks).toEqual({ model: 'opus', effort: 'medium' });
  });

  it('are not taken from what is not a model and an effort', () => {
    const main = launch();
    main.pick(A, 'opus', 'high');
    main.pick(A, 'claude-opus-4-1 --dangerously', 'high');
    main.pick(A, 'opus', 'loudest');
    main.pick(A, undefined);
    expect(main.chat().picks).toEqual({ model: 'opus', effort: 'high' });
  });

  it('read as none from a file that holds something else there', () => {
    fs.mkdirSync(path.dirname(fileOf(A)), { recursive: true });
    fs.writeFileSync(
      fileOf(A),
      JSON.stringify({
        entries: [{ kind: 'me', id: 'one', text: 'hello' }],
        picks: { model: '../../etc', effort: 'high' },
      }),
    );
    const main = launch();
    expect(main.chat().entries).toHaveLength(1);
    expect(main.chat().picks).toBeUndefined();
  });

  it('are written with the reply being written, which a save alone would drop', () => {
    const main = launch();
    main.say('make it rain');
    const reply: TReply = {
      kind: 'claude',
      id: 'reply',
      text: 'Raining',
      steps: [],
      state: 'working',
    };
    main.writing(reply);
    main.pick(A, 'sonnet', 'low');
    const onDisk = JSON.parse(fs.readFileSync(fileOf(A), 'utf8')) as {
      entries: { id: string }[];
      picks: unknown;
    };
    expect(onDisk.entries.map(({ id }) => id)).toContain('reply');
    expect(onDisk.picks).toEqual({ model: 'sonnet', effort: 'low' });
    // The reply joins the chat itself only when it ends.
    main.writing(undefined);
    expect(main.chat().entries.map(({ id }) => id)).not.toContain('reply');
  });
});
