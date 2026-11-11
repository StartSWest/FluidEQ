/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Set up Higgsfield" (Ivan, 2026-11-11: "que Fluid sea capaz de que la
 * gente pueda instalar el último MCP de Higgsfield"): what FluidEQ runs in
 * the member's own Claude Code, and only on a press from its own window -
 * the server added at the member's own scope, Claude Code's own sign-in to
 * it, and nothing a page or a scene could have supplied.
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TAgentProject } from '../../../main/studioAgent/agentProject';
import type { IStudioLook } from '../../../main/studioAgent/studioTools';
import { createChatPictures } from '../../../main/studioChat/chatPictures';
import type { IClaudeCodeEnv } from '../../../main/studioChat/claudeCode';
import {
  addHiggsfield,
  higgsfieldAccount,
  higgsfieldServer,
  signInToHiggsfield,
  signOutOfHiggsfield,
} from '../../../main/studioChat/higgsfieldMcp';
import type { IHiggsfieldServer } from '../../../main/studioChat/studioMakers';

const mockHandlers = new Map<
  string,
  (event: unknown, ...args: unknown[]) => unknown
>();

jest.mock('electron', () => ({
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, ...args: unknown[]) => unknown,
    ) => mockHandlers.set(name, handler),
    removeHandler: (name: string) => mockHandlers.delete(name),
  },
}));

/** Every process started, by what it was started with. */
const mockStarted: { executable: string; args: string[] }[] = [];
/** What the next `claude mcp list` prints. */
let mockListed = '';

const mockChild = (printed: string) => {
  const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter };
  child.stdout = new EventEmitter();
  queueMicrotask(() => {
    child.stdout.emit('data', Buffer.from(printed, 'utf8'));
    child.emit('close', 0);
  });
  return child;
};

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: (executable: string, args: string[]) => {
    mockStarted.push({ executable, args });
    return mockChild('');
  },
}));

jest.mock('../../../main/studioChat/claudeCode', () => ({
  ...jest.requireActual('../../../main/studioChat/claudeCode'),
  startClaudeCode: (executable: string, args: string[]) => {
    mockStarted.push({ executable, args });
    return mockChild(args[1] === 'list' ? mockListed : '');
  },
}));

// The commands are asked through these in the channel tests further down,
// and run for real (against the stand-in processes above) before them.
const mockServer = jest.fn<Promise<IHiggsfieldServer | undefined>, []>();
const mockRan: string[] = [];
let mockCommands = false;
jest.mock('../../../main/studioChat/higgsfieldMcp', () => {
  const real = jest.requireActual('../../../main/studioChat/higgsfieldMcp');
  return {
    ...real,
    higgsfieldServer: (...args: unknown[]) =>
      mockCommands ? mockServer() : real.higgsfieldServer(...args),
    addHiggsfield: async (...args: unknown[]) => {
      if (!mockCommands) {
        return real.addHiggsfield(...args);
      }
      mockRan.push('add');
      return undefined;
    },
    signInToHiggsfield: async (name: string, ...rest: unknown[]) => {
      if (!mockCommands) {
        return real.signInToHiggsfield(name, ...rest);
      }
      mockRan.push(`sign in to ${name}`);
      return undefined;
    },
    signOutOfHiggsfield: async (name: string, ...rest: unknown[]) => {
      if (!mockCommands) {
        return real.signOutOfHiggsfield(name, ...rest);
      }
      mockRan.push(`sign out of ${name}`);
      return undefined;
    },
  };
});

jest.mock('../../../main/studioChat/studioMakers', () => ({
  ...jest.requireActual('../../../main/studioChat/studioMakers'),
  gptPlugin: () => ({ found: true, name: 'gpt-studio@a-market' }),
}));

const CLAUDE = path.resolve('no-such-tools', 'claude.exe');

/** A computer with Claude Code on its PATH, or without it. */
const computer = (
  installed: boolean,
  platform: NodeJS.Platform = 'win32',
): IClaudeCodeEnv => ({
  platform,
  env: { PATH: path.dirname(CLAUDE), ComSpec: 'cmd.exe' },
  home: path.resolve('no-such-home'),
  isFile: (target) => installed && target === CLAUDE,
});

beforeEach(() => {
  mockStarted.length = 0;
  mockRan.length = 0;
  mockListed = '';
  mockCommands = false;
  mockServer.mockReset();
  mockHandlers.clear();
});

describe("what FluidEQ runs in the member's Claude Code", () => {
  it('asks Claude Code which servers it has, and reads Higgsfield out', async () => {
    mockListed =
      'Checking MCP server health...\n\nhiggsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ! Needs authentication\n';
    await expect(higgsfieldServer(computer(true))).resolves.toEqual({
      name: 'higgsfield',
      account: { state: 'signed-out' },
    });
    expect(mockStarted).toEqual([
      { executable: CLAUDE, args: ['mcp', 'list'] },
    ]);
  });

  it('calls it missing, and starts nothing, on a computer without Claude Code', async () => {
    await expect(higgsfieldAccount(computer(false))).resolves.toEqual({
      state: 'missing',
    });
    await addHiggsfield(computer(false));
    await signInToHiggsfield('higgsfield', computer(false));
    await signOutOfHiggsfield('higgsfield', computer(false));
    expect(mockStarted).toEqual([]);
  });

  it("adds Higgsfield's own hosted server, for the member alone", async () => {
    await addHiggsfield(computer(true));
    expect(mockStarted).toEqual([
      {
        executable: CLAUDE,
        args: [
          'mcp',
          'add',
          '--transport',
          'http',
          '--scope',
          'user',
          'higgsfield',
          'https://mcp.higgsfield.ai/mcp',
        ],
      },
    ]);
  });

  it("opens Claude Code's own sign-in to it in a window of its own on Windows", async () => {
    await signInToHiggsfield('claude.ai Higgsfield', computer(true));
    expect(mockStarted).toEqual([
      {
        executable: 'cmd.exe',
        args: [
          '/d',
          '/s',
          '/c',
          `"start "Higgsfield" /wait "${CLAUDE}" mcp login "claude.ai Higgsfield""`,
        ],
      },
    ]);
  });

  it("runs Claude Code's sign-in directly elsewhere", async () => {
    const mac: IClaudeCodeEnv = {
      platform: 'darwin',
      env: { PATH: '/usr/local/bin' },
      home: '/Users/member',
      isFile: (target) => target === path.join('/usr/local/bin', 'claude'),
    };
    await signInToHiggsfield('higgsfield', mac);
    expect(mockStarted).toEqual([
      {
        executable: path.join('/usr/local/bin', 'claude'),
        args: ['mcp', 'login', 'higgsfield'],
      },
    ]);
  });

  it('has Claude Code forget the sign-in, for another account', async () => {
    await signOutOfHiggsfield('higgsfield', computer(true));
    expect(mockStarted).toEqual([
      { executable: CLAUDE, args: ['mcp', 'logout', 'higgsfield'] },
    ]);
  });

  it.each([
    'higgsfield" & calc & "',
    'higgs%PATH%field',
    'higgsfield\nmcp remove x',
    '',
  ])(
    'starts nothing for a server name that could end the quoting: %j',
    async (name) => {
      await signInToHiggsfield(name, computer(true));
      await signOutOfHiggsfield(name, computer(true));
      expect(mockStarted).toEqual([]);
    },
  );
});

const door: IStudioLook = { look: jest.fn(), hear: jest.fn() };
const noProject = (): TAgentProject => ({ ok: false, reason: 'none-open' });

describe("the window's presses", () => {
  let root: string;
  let fromWindow: boolean;
  let pictures: ReturnType<typeof createChatPictures>;

  const press = (channel: string, ...args: unknown[]) => {
    const handler = mockHandlers.get(channel);
    if (!handler) {
      throw new Error(`${channel} is not handled`);
    }
    return handler({}, ...args);
  };
  const server = (
    state: IHiggsfieldServer['account']['state'],
    name = 'higgsfield',
  ): IHiggsfieldServer => ({ name, account: { state } });

  beforeEach(() => {
    mockCommands = true;
    fromWindow = true;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-higgsfield-'));
    pictures = createChatPictures({
      root,
      pageOf: () => undefined,
      fromWindow: () => fromWindow,
      projectAt: noProject,
      signalOf: () => new AbortController().signal,
      door,
      version: '0',
    });
  });
  afterEach(async () => {
    await pictures.dispose();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('are told what the member has of the two, and their choice', async () => {
    mockServer.mockResolvedValue(server('ready'));
    await expect(press('studio-chat-makers')).resolves.toEqual({
      gpt: { found: true, name: 'gpt-studio@a-market' },
      higgsfield: { state: 'ready' },
      choice: 'ask',
    });
    mockServer.mockResolvedValue(undefined);
    await expect(press('studio-chat-makers')).resolves.toMatchObject({
      higgsfield: { state: 'missing' },
    });
  });

  it('add Higgsfield where it is missing, then open its sign-in', async () => {
    mockServer
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(server('signed-out'))
      .mockResolvedValue(server('ready'));
    await expect(
      press('studio-chat-higgsfield-connect', false),
    ).resolves.toMatchObject({ higgsfield: { state: 'ready' } });
    expect(mockRan).toEqual(['add', 'sign in to higgsfield']);
  });

  it('only sign in where it is already there, under the name it has', async () => {
    mockServer.mockResolvedValue(server('signed-out', 'claude.ai Higgsfield'));
    await press('studio-chat-higgsfield-connect', false);
    expect(mockRan).toEqual(['sign in to claude.ai Higgsfield']);
  });

  it('do nothing to an account that is signed in', async () => {
    mockServer.mockResolvedValue(server('ready'));
    await press('studio-chat-higgsfield-connect', false);
    expect(mockRan).toEqual([]);
  });

  it('sign out first for "Use another account", then sign in', async () => {
    mockServer
      .mockResolvedValueOnce(server('ready'))
      .mockResolvedValue(server('signed-out'));
    await press('studio-chat-higgsfield-connect', true);
    expect(mockRan).toEqual([
      'sign out of higgsfield',
      'sign in to higgsfield',
    ]);
  });

  it('never sign in to a server that was added and still cannot be reached', async () => {
    mockServer
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue(server('unreachable'));
    await press('studio-chat-higgsfield-connect', false);
    expect(mockRan).toEqual(['add']);
  });

  it('keep the choice of maker, and only a real one', async () => {
    mockServer.mockResolvedValue(server('ready'));
    await expect(press('studio-chat-makers-choice', 'higgsfield')).toBe(
      'higgsfield',
    );
    expect(press('studio-chat-makers-choice', 'midjourney')).toBe('higgsfield');
    await expect(press('studio-chat-makers')).resolves.toMatchObject({
      choice: 'higgsfield',
    });
  });

  it('keep the maker pressed on the card only when told to remember it', async () => {
    mockServer.mockResolvedValue(server('ready'));
    press('studio-chat-maker-answer', 'no-such-card', 'gpt', false);
    await expect(press('studio-chat-makers')).resolves.toMatchObject({
      choice: 'ask',
    });
    press('studio-chat-maker-answer', 'no-such-card', 'gpt', true);
    await expect(press('studio-chat-makers')).resolves.toMatchObject({
      choice: 'gpt',
    });
    press('studio-chat-maker-answer', 'no-such-card', 'sora', true);
    await expect(press('studio-chat-makers')).resolves.toMatchObject({
      choice: 'gpt',
    });
  });

  it('do nothing at all from anywhere but FluidEQ’s own window', async () => {
    fromWindow = false;
    mockServer.mockResolvedValue(undefined);
    expect(await press('studio-chat-makers')).toBeUndefined();
    expect(
      await press('studio-chat-higgsfield-connect', false),
    ).toBeUndefined();
    expect(press('studio-chat-makers-choice', 'gpt')).toBe('ask');
    press('studio-chat-maker-answer', 'no-such-card', 'gpt', true);
    expect(mockRan).toEqual([]);
    expect(mockServer).not.toHaveBeenCalled();
    fromWindow = true;
    await expect(press('studio-chat-makers')).resolves.toMatchObject({
      choice: 'ask',
    });
  });
});
