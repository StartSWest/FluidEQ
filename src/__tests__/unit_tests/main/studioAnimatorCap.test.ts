/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene's chat starts animators without asking the member, and each is
 * a Claude Code of its own: a note planted in a shared project could have
 * it start forty. At most `MAX_ANIMATORS_AT_ONCE` work at once, counting
 * those just started whose Claude Code has not come up yet, and the chat is
 * told why the next one waits.
 */

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
  nativeImage: {},
}));

interface IFakeServer {
  tools: IMcpTool[];
}
const mockServers: IFakeServer[] = [];
jest.mock('../../../main/studioChat/chatServer', () => ({
  createChatServer: ({ tools }: { tools: IMcpTool[] }) => {
    mockServers.push({ tools });
    return {
      address: async () => ({ url: 'http://127.0.0.1:1/mcp', key: 'k' }),
      close: async () => undefined,
    };
  },
}));

/* eslint-disable import/first -- the electron mock must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TAgentProject } from '../../../main/studioAgent/agentProject';
import type { IMcpTool } from '../../../main/studioAgent/mcpProtocol';
import { createChatPictures } from '../../../main/studioChat/chatPictures';
import { MAX_ANIMATORS_AT_ONCE } from '../../../main/studioChat/startAnimatorTool';
/* eslint-enable import/first */

const PROJECT = { id: 'project-a', folder: path.join(os.tmpdir(), 'scene-a') };
const projectAt = (): TAgentProject => ({ ok: true, ...PROJECT });

let root: string;
let sent: unknown[];
let animators: { live: string[]; working: string[] };
let pictures: ReturnType<typeof createChatPictures>;

const startTool = async () => {
  await pictures.address(PROJECT.id, PROJECT.folder);
  const tool = mockServers[mockServers.length - 1].tools.find(
    (one) => one.name === 'start_animator',
  );
  if (!tool) {
    throw new Error('the scene chat has no start_animator');
  }
  return tool;
};

const start = (tool: IMcpTool, name: string) =>
  tool.call({ name, task: `Make ${name}, a walk cycle of 8 frames.` });

beforeEach(() => {
  mockServers.length = 0;
  sent = [];
  animators = { live: [], working: [] };
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-animator-cap-'));
  pictures = createChatPictures({
    root,
    pageOf: () =>
      ({
        send: (_channel: string, payload: unknown) => sent.push(payload),
      }) as never,
    fromWindow: () => true,
    projectAt,
    signalOf: () => new AbortController().signal,
    door: {
      look: async () => ({ ok: false, reason: 'no-window' }),
      hear: async () => 'no-window' as const,
    },
    version: '0',
    animatorsOf: () => animators,
  });
});

afterEach(async () => {
  await pictures.dispose();
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the animators the scene chat starts', () => {
  it('start at most three in a burst, and the chat hears why the rest wait', async () => {
    const tool = await startTool();
    const names = [
      'wolf-walk',
      'fox-trot',
      'bird-flap',
      'deer-run',
      'bear-sit',
    ];
    const results = await Promise.all(names.map((name) => start(tool, name)));
    expect(results.map((result) => result.isError === true)).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(sent).toHaveLength(MAX_ANIMATORS_AT_ONCE);
    expect(JSON.stringify(results[3].content)).toContain(
      '3 animators are already working (wolf-walk, fox-trot, bird-flap)',
    );
  });

  it('control: one at a time, each the first of its kind, all start', async () => {
    const tool = await startTool();
    expect((await start(tool, 'wolf-walk')).isError).toBeUndefined();
    expect(sent).toHaveLength(1);
  });

  it('count the ones running as much as the ones starting, and free a slot when one finishes', async () => {
    const tool = await startTool();
    animators = {
      live: ['wolf-walk', 'fox-trot'],
      working: ['wolf-walk', 'fox-trot'],
    };
    expect((await start(tool, 'bird-flap')).isError).toBeUndefined();
    expect((await start(tool, 'deer-run')).isError).toBe(true);
    // The wolf's animator finished its reply: its slot is free again, while
    // the bird, started and not yet up, still holds one.
    animators = { live: ['wolf-walk', 'fox-trot'], working: ['fox-trot'] };
    expect((await start(tool, 'deer-run')).isError).toBeUndefined();
    expect((await start(tool, 'bear-sit')).isError).toBe(true);
    // The bird's Claude Code came up and has already finished: running is
    // what counts now, and only the deer is still starting.
    animators = {
      live: ['wolf-walk', 'fox-trot', 'bird-flap'],
      working: ['fox-trot'],
    };
    expect((await start(tool, 'bear-sit')).isError).toBeUndefined();
  });

  it('hand a new task to an animator already working, whatever the count', async () => {
    const tool = await startTool();
    animators = {
      live: ['wolf-walk', 'fox-trot', 'bird-flap'],
      working: ['wolf-walk', 'fox-trot', 'bird-flap'],
    };
    expect((await start(tool, 'wolf-walk')).isError).toBeUndefined();
    expect((await start(tool, 'deer-run')).isError).toBe(true);
  });
});
