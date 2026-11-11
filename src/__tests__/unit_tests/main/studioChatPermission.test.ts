/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The member's own Claude Code tools in the Studio's chat (Ivan, 2026-11-07:
 * "claude need to have access to all plugins that claude has"): the chat
 * starts their Claude Code with everything they set it up with, and anything
 * their settings do not allow is asked of them on a card before it runs.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TStudioChatAsk } from '../../../common/studioChat';
import { createChatAsks } from '../../../main/studioChat/chatAsks';
import {
  chatTools,
  claudeCodeCommand,
} from '../../../main/studioChat/chatLaunch';
import {
  keptRules,
  permissionAnswerLine,
} from '../../../main/studioChat/chatPermission';
import { readStreamLine } from '../../../main/studioChat/chatStream';

/** The line Claude Code writes when it asks (measured on 2.1.316). */
const asking = (request: Record<string, unknown>) =>
  JSON.stringify({
    type: 'control_request',
    request_id: 'r-1',
    request: { subtype: 'can_use_tool', tool_use_id: 't-1', ...request },
  });

describe("Claude Code's question", () => {
  it('is read with the command it would run', () => {
    expect(
      readStreamLine(
        asking({
          tool_name: 'Bash',
          display_name: 'Bash',
          input: { command: 'node make-picture.js --prompt "a lake"' },
          description: 'Make a picture',
        }),
      ),
    ).toEqual([
      {
        type: 'permission',
        requestId: 'r-1',
        name: 'Bash',
        tool: 'Bash',
        detail: 'node make-picture.js --prompt "a lake"',
        input: { command: 'node make-picture.js --prompt "a lake"' },
        suggestions: [],
      },
    ]);
  });

  it("is read with a skill's name, or Claude Code's own description", () => {
    const [skill] = readStreamLine(
      asking({ tool_name: 'Skill', input: { skill: 'gpt-studio:image' } }),
    );
    expect(skill).toMatchObject({ tool: 'Skill', detail: 'gpt-studio:image' });
    const [write] = readStreamLine(
      asking({
        tool_name: 'Write',
        input: { content: 'hi' },
        description: 'C:\\outside\\x.txt',
      }),
    );
    expect(write).toMatchObject({ detail: 'C:\\outside\\x.txt' });
  });

  it('is nothing when it is some other control line', () => {
    expect(
      readStreamLine(
        JSON.stringify({
          type: 'control_request',
          request_id: 'r-2',
          request: { subtype: 'interrupt' },
        }),
      ),
    ).toEqual([]);
  });
});

describe("the chat's answer", () => {
  it('a yes hands the input back unchanged; a no says it is final', () => {
    const input = { command: 'echo hi' };
    expect(JSON.parse(permissionAnswerLine('r-1', input, true))).toEqual({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: 'r-1',
        response: { behavior: 'allow', updatedInput: input },
      },
    });
    const no = JSON.parse(permissionAnswerLine('r-1', input, false));
    expect(no.response.response.behavior).toBe('deny');
    expect(no.response.response.message).toMatch(/Do not try/);
    expect(permissionAnswerLine('r-1', input, false).endsWith('\n')).toBe(true);
  });

  // Always allow is the member's own rule from then on (Ivan, 2026-11-10:
  // "para cargar cada nuevo plugin debe pedir permiso"): the rules Claude
  // Code suggested, kept in their user settings, and nothing else.
  it("an Always allow keeps the suggested rules in the member's own settings, and only rules", () => {
    const [event] = readStreamLine(
      asking({
        tool_name: 'Bash',
        input: { command: 'node C:/plugins/gpt-studio/scripts/image.mjs' },
        permission_suggestions: [
          {
            type: 'addRules',
            rules: [
              {
                toolName: 'Bash',
                ruleContent: 'node C:/plugins/gpt-studio/scripts/image.mjs:*',
              },
            ],
            behavior: 'allow',
            destination: 'localSettings',
          },
          {
            type: 'addDirectories',
            directories: ['C:/'],
            destination: 'session',
          },
          {
            type: 'setMode',
            mode: 'bypassPermissions',
            destination: 'session',
          },
        ],
      }),
    );
    if (event?.type !== 'permission') {
      throw new Error('not a question');
    }
    const kept = keptRules(event.suggestions);
    expect(kept).toEqual([
      {
        type: 'addRules',
        rules: [
          {
            toolName: 'Bash',
            ruleContent: 'node C:/plugins/gpt-studio/scripts/image.mjs:*',
          },
        ],
        behavior: 'allow',
        destination: 'userSettings',
      },
    ]);
    const always = JSON.parse(
      permissionAnswerLine('r-1', event.input, true, kept),
    );
    expect(always.response.response.updatedPermissions).toEqual(kept);
    // The control: a plain yes keeps nothing.
    const once = JSON.parse(permissionAnswerLine('r-1', event.input, true));
    expect(once.response.response.updatedPermissions).toBeUndefined();
  });
});

describe('the cards', () => {
  let root: string;
  let asks: ReturnType<typeof createChatAsks>;
  let onCard: ((ask: TStudioChatAsk) => void) | undefined;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-permission-'));
    onCard = undefined;
    asks = createChatAsks({
      root,
      show: (_id, ask) => {
        if (ask) {
          onCard?.(ask);
        }
      },
    });
  });

  /** The next card put up, waited for as the window would see it. */
  const nextCard = () =>
    new Promise<TStudioChatAsk>((resolve) => {
      onCard = resolve;
    });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const standing = () => {
    const ask = asks.standing('p');
    if (!ask) {
      throw new Error('no card is standing');
    }
    return ask;
  };

  it('come one at a time, in order, and none is refused for waiting', async () => {
    const reply = new AbortController();
    const firstCard = nextCard();
    const first = asks.tool('p', { tool: 'Bash', detail: 'one' }, reply.signal);
    const second = asks.tool(
      'p',
      { tool: 'Skill', detail: 'two' },
      reply.signal,
    );
    expect(await firstCard).toMatchObject({ kind: 'tool', detail: 'one' });
    // The second card comes up once the first is answered.
    const secondCard = nextCard();
    asks.answer(standing().id, 'yes');
    expect(await first).toBe('yes');
    expect(await secondCard).toMatchObject({ kind: 'tool', detail: 'two' });
    asks.answer(standing().id, 'no');
    expect(await second).toBe('no');
  });

  it('a tool allowed for the chat asks no more, until a new chat', async () => {
    const reply = new AbortController();
    const card = nextCard();
    const asked = asks.tool('p', { tool: 'Bash', detail: 'a' }, reply.signal);
    await card;
    asks.answer(standing().id, 'chat');
    expect(await asked).toBe('chat');
    expect(
      await asks.tool('p', { tool: 'Bash', detail: 'b' }, reply.signal),
    ).toBe('yes');
    expect(asks.standing('p')).toBeUndefined();

    asks.forget('p');
    const again = nextCard();
    asks.tool('p', { tool: 'Bash', detail: 'c' }, reply.signal);
    expect(await again).toMatchObject({ detail: 'c' });
  });

  it('Always allow outlives a restart of FluidEQ, never the chat', async () => {
    const reply = new AbortController();
    const card = nextCard();
    const asked = asks.tool('p', { tool: 'Bash', detail: 'a' }, reply.signal);
    await card;
    asks.answer(standing().id, 'chat');
    expect(await asked).toBe('chat');

    // The FluidEQ after a restart reads it back: no card.
    const restarted = createChatAsks({ root, show: () => undefined });
    expect(
      await restarted.tool('p', { tool: 'Bash', detail: 'b' }, reply.signal),
    ).toBe('yes');
    // Only for the tool said yes to, and only on its own chat.
    expect(restarted.standing('p')).toBeUndefined();

    // A new chat begins with it gone, on disk too.
    restarted.forget('p');
    const again = createChatAsks({
      root,
      show: (_id, ask) => {
        if (ask) {
          onCard?.(ask);
        }
      },
    });
    const asksAgain = nextCard();
    again.tool('p', { tool: 'Bash', detail: 'c' }, reply.signal);
    expect(await asksAgain).toMatchObject({ detail: 'c' });
  });

  it('a reply stopped answers no, and its waiting ask never takes the next turn', async () => {
    const stopped = new AbortController();
    const up = nextCard();
    const standingAsk = asks.tool(
      'p',
      { tool: 'Bash', detail: 'up' },
      stopped.signal,
    );
    const waitingAsk = asks.tool(
      'p',
      { tool: 'Bash', detail: 'queued' },
      stopped.signal,
    );
    await up;
    stopped.abort();
    asks.drop('p');
    expect(await standingAsk).toBe('no');
    expect(await waitingAsk).toBe('no');

    // The next reply's question comes up at once.
    const next = new AbortController();
    const nextUp = nextCard();
    asks.tool('p', { tool: 'Bash', detail: 'next' }, next.signal);
    expect(await nextUp).toMatchObject({ detail: 'next' });
  });

  it('an ask stopped while waiting leaves the line, so the one behind it is next', async () => {
    const live = new AbortController();
    const gone = new AbortController();
    const up = nextCard();
    asks.tool('p', { tool: 'Bash', detail: 'up' }, live.signal);
    await up;
    const stopped = asks.tool(
      'p',
      { tool: 'Bash', detail: 'gone' },
      gone.signal,
    );
    asks.tool('p', { tool: 'Skill', detail: 'behind' }, live.signal);
    gone.abort();
    expect(await stopped).toBe('no');
    const behind = nextCard();
    asks.answer(standing().id, 'yes');
    expect(await behind).toMatchObject({ detail: 'behind' });
  });
});

describe("the member's Claude Code, started for a chat", () => {
  it('has everything it was set up with, asks through the chat, and never runs unasked', () => {
    const own = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-launch-'));
    try {
      const { args } = claudeCodeCommand({
        own,
        folder: 'C:/Scenes/Lake',
        executable: 'claude',
        brief: 'brief',
        tools: { url: 'http://127.0.0.1:1/mcp', key: 'k' },
        model: 'default',
        effort: 'default',
        sessionId: undefined,
      });
      // The plugins' skills, and the files and shell they run through, and
      // nothing that costs every message without making a scene: Claude
      // Code's other built-in tools, and the member's own tool servers.
      expect(args[args.indexOf('--tools') + 1]).toBe(chatTools());
      // PowerShell is Claude Code's on Windows alone.
      expect(chatTools('win32')).toBe(
        'Read,Edit,Write,Glob,Grep,Bash,PowerShell,Skill,ToolSearch',
      );
      expect(chatTools('darwin')).toBe(
        'Read,Edit,Write,Glob,Grep,Bash,Skill,ToolSearch',
      );
      expect(chatTools('linux')).toBe(
        'Read,Edit,Write,Glob,Grep,Bash,Skill,ToolSearch',
      );
      // The member's own tool servers join FluidEQ's door (Ivan, 2026-11-10).
      expect(args).not.toContain('--strict-mcp-config');
      // The per-machine lines out of the system prompt, which with the same
      // brief for every project is one cache for every scene's chat.
      expect(args).toContain('--exclude-dynamic-system-prompt-sections');
      expect(args).not.toContain('--disable-slash-commands');
      expect(args).not.toContain('--bare');
      // Questions come to the chat; Claude Code's own mode that asks, never
      // one the member's settings chose that asks nobody.
      expect(args).toEqual(
        expect.arrayContaining(['--permission-prompt-tool', 'stdio']),
      );
      expect(args[args.indexOf('--permission-mode') + 1]).toBe('manual');
      expect(args).not.toContain('dontAsk');
      expect(args).not.toContain('bypassPermissions');
      // FluidEQ's door, the one tool server the chat has.
      expect(args).toContain('--mcp-config');
      // The member's own settings, never a scene folder's .claude.
      expect(args[args.indexOf('--setting-sources') + 1]).toBe('user');
    } finally {
      fs.rmSync(own, { recursive: true, force: true });
    }
  });
});
