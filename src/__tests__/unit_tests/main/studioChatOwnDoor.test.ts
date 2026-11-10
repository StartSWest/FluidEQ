/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Every scene's chat works on its own scene, side by side with the others
 * (Ivan, 2026-11-07: "all chats needs to be parallel and take its own
 * captures so I can work on multiple scenes at the same time"):
 *
 * - each project's chat has a door of its own whose look draws that
 *   project's folder, whatever the Studio shows, and whose pack_artwork
 *   writes into that project and no other;
 * - and a look, from a chat or any other AI, never switches the Studio to the
 *   project it looks at.
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  },
  nativeImage: {},
}));

interface IFakeServer {
  tools: IMcpTool[];
  closed: boolean;
}
const mockServers: IFakeServer[] = [];
jest.mock('../../../main/studioChat/chatServer', () => ({
  createChatServer: ({ tools }: { tools: IMcpTool[] }) => {
    const server: IFakeServer = { tools, closed: false };
    mockServers.push(server);
    return {
      address: async () => ({ url: 'http://127.0.0.1:1/mcp', key: 'k' }),
      close: async () => {
        server.closed = true;
      },
    };
  },
}));

/* eslint-disable import/first -- the mocks above must be installed first */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TAgentProject } from '../../../main/studioAgent/agentProject';
import type { ILookRequest } from '../../../main/studioAgent/lookRequest';
import type { IMcpTool } from '../../../main/studioAgent/mcpProtocol';
import type { TLookOutcome } from '../../../main/studioAgent/studioTools';
import { createStudioAgentDoor } from '../../../main/studioAgent/studioAgentDoor';
import { createChatPictures } from '../../../main/studioChat/chatPictures';

const A = { id: 'project-a', folder: path.join(os.tmpdir(), 'scene-a') };
const B = { id: 'project-b', folder: path.join(os.tmpdir(), 'scene-b') };

let listed: Array<{ id: string; folder: string }>;
const projectAt = (folder: string): TAgentProject => {
  const found = listed.find((project) => project.folder === folder);
  return found
    ? { ok: true, id: found.id, folder: found.folder }
    : { ok: false, reason: 'not-a-project' };
};

const looked: ILookRequest[] = [];
const door = {
  look: async (request: ILookRequest): Promise<TLookOutcome> => {
    looked.push(request);
    return { ok: false, reason: 'no-window' };
  },
  hear: async () => 'no-window' as const,
};

let root: string;
let pictures: ReturnType<typeof createChatPictures> | undefined;

beforeEach(() => {
  handlers.clear();
  mockServers.length = 0;
  looked.length = 0;
  listed = [A, B];
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-own-door-'));
  pictures = createChatPictures({
    root,
    pageOf: () => undefined,
    fromWindow: () => true,
    projectAt,
    signalOf: () => new AbortController().signal,
    door,
    version: '0',
  });
});

afterEach(async () => {
  await pictures?.dispose();
  pictures = undefined;
  fs.rmSync(root, { recursive: true, force: true });
});

const toolOf = (server: IFakeServer | undefined, name: string) => {
  const tool = server?.tools.find((each) => each.name === name);
  if (!tool) {
    throw new Error(`${name} is not offered`);
  }
  return tool;
};

const textOf = (result: { content: Array<{ type: string; text?: string }> }) =>
  result.content.map((part) => part.text ?? '').join('\n');

test('each chat looks at its own project, whichever the Studio shows', async () => {
  await pictures?.address(A.id, A.folder);
  await pictures?.address(B.id, B.folder);
  expect(mockServers).toHaveLength(2);
  const [serverA, serverB] = mockServers;
  await toolOf(serverA, 'look_at_scene').call({});
  await toolOf(serverB, 'look_at_scene').call({});
  // Even told another folder, a chat draws its own.
  await toolOf(serverA, 'look_at_scene').call({ folder: B.folder });
  expect(looked.map((request) => request.folder)).toEqual([
    A.folder,
    B.folder,
    A.folder,
  ]);
});

test("a chat's look offers no folder to name", async () => {
  await pictures?.address(A.id, A.folder);
  const schema = toolOf(mockServers[0], 'look_at_scene').inputSchema as {
    properties: Record<string, unknown>;
  };
  expect(Object.keys(schema.properties)).not.toContain('folder');
  // The rest of the look is still there to choose.
  expect(Object.keys(schema.properties)).toContain('shape');
});

test("pack_artwork works on the chat's own project, and refuses once it is gone", async () => {
  await pictures?.address(A.id, A.folder);
  const pack = toolOf(mockServers[0], 'pack_artwork');
  const pieces = { pieces: [{ id: 'cat', from: 'art/cat.png' }] };
  // Its own project is still listed: the tool goes on to read its folder.
  expect(textOf(await pack.call(pieces))).not.toMatch(
    /not in FluidEQ's Studio/,
  );

  // Taken off the list, another project now sits in that folder: refused,
  // never written into that one or into whichever the Studio shows.
  listed = [{ id: 'someone-else', folder: A.folder }, B];
  expect(textOf(await pack.call(pieces))).toMatch(/not in FluidEQ's Studio/);
});

test("a project's door is made once, made again for a moved folder, and closed with its chat", async () => {
  await pictures?.address(A.id, A.folder);
  await pictures?.address(A.id, A.folder);
  expect(mockServers).toHaveLength(1);

  const moved = path.join(os.tmpdir(), 'scene-a-renamed');
  listed = [{ id: A.id, folder: moved }, B];
  await pictures?.address(A.id, moved);
  expect(mockServers).toHaveLength(2);
  expect(mockServers[0].closed).toBe(true);

  await pictures?.address(B.id, B.folder);
  await pictures?.close(A.id);
  expect(mockServers[1].closed).toBe(true);
  expect(mockServers[2].closed).toBe(false);
});

test('a look never asks the window to switch the Studio', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-door-'));
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-project-'));
  const page = {
    send: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
    isDestroyed: () => false,
  };
  const agentDoor = createStudioAgentDoor({
    userDataDir: userData,
    getMainWindow: () =>
      ({ isDestroyed: () => false, webContents: page }) as never,
    agentProject: () => ({ ok: true, id: 'cat', folder: project }),
    appVersion: '1',
  });
  try {
    await handlers.get('studio-agent-ready')?.(
      { sender: page },
      {
        hears: true,
      },
    );
    const outcome = await agentDoor.look({
      shape: 'full-screen',
      sound: 'music',
      sliders: {},
    } as ILookRequest);
    // The positive control: the look found the project and read its folder
    // (an empty one, which does not build).
    expect(outcome).toMatchObject({ ok: false, reason: 'problems' });
    expect(page.send).not.toHaveBeenCalledWith(
      'studio-agent-show',
      expect.anything(),
    );
  } finally {
    await agentDoor.dispose();
    fs.rmSync(userData, { recursive: true, force: true });
    fs.rmSync(project, { recursive: true, force: true });
  }
});
