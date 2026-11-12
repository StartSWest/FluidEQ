/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Higgsfield, the Studio's one maker (Ivan, 2026-11-11: "let's remove GPT
 * then and let's only use Higgsfield for image gen, videos and everything
 * Higgsfield can do"): read out of what the member's Claude Code lists,
 * however it was connected — Ivan's is a claude.ai connector — its tools
 * shown in the chat as Higgsfield making something under either name, and
 * no card left that asks who makes it.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createChatAsks } from '../../../main/studioChat/chatAsks';
import { stepOf } from '../../../main/studioChat/chatStream';
import { readHiggsfieldServer } from '../../../main/studioChat/studioMakers';

/** What `claude mcp list` prints, as Claude Code 2.1 printed it. */
const listed = (...lines: string[]) =>
  ['Checking MCP server health...', '', ...lines, ''].join('\n');

describe('Higgsfield among the servers Claude Code lists', () => {
  it('is ready when Claude Code says it is connected', () => {
    expect(
      readHiggsfieldServer(
        listed(
          'sentry: https://mcp.sentry.dev/mcp (HTTP) - ✔ Connected',
          'higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected',
        ),
      ),
    ).toEqual({ name: 'higgsfield', account: { state: 'ready' } });
  });

  it('is signed out when Claude Code says it needs authentication', () => {
    expect(
      readHiggsfieldServer(
        listed(
          'higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ! Needs authentication',
        ),
      ),
    ).toEqual({ name: 'higgsfield', account: { state: 'signed-out' } });
  });

  it('is unreachable on anything else Claude Code says of it', () => {
    expect(
      readHiggsfieldServer(
        listed(
          'higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✗ Failed to connect',
        ),
      ),
    ).toEqual({ name: 'higgsfield', account: { state: 'unreachable' } });
  });

  it('is found by its address under the name the member gave it', () => {
    expect(
      readHiggsfieldServer(
        listed(
          'claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ! Needs authentication',
        ),
      ),
    ).toEqual({
      name: 'claude.ai Higgsfield',
      account: { state: 'signed-out' },
    });
  });

  it('prefers the one that is connected when it is there twice', () => {
    expect(
      readHiggsfieldServer(
        listed(
          'claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ! Needs authentication',
          'higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected',
        ),
      ),
    ).toEqual({ name: 'higgsfield', account: { state: 'ready' } });
  });

  it('is not a server that only carries its name', () => {
    expect(
      readHiggsfieldServer(
        listed(
          'higgsfield: https://example.com/mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected',
          'higgsfield-local: npx -y higgsfield-mcp - ✔ Connected',
          'plugin:playwright:playwright: npx @playwright/mcp@latest - ✔ Connected',
        ),
      ),
    ).toBeUndefined();
  });

  it('is not there in an empty list, or no answer at all', () => {
    expect(readHiggsfieldServer(listed())).toBeUndefined();
    expect(readHiggsfieldServer('')).toBeUndefined();
  });
});

// Read-only, from Ivan's own `claude mcp list` on 2026-11-11, addresses and
// all; only the order of the other connectors is his.
describe('a Higgsfield connected as a claude.ai connector', () => {
  it('is ready, under the name Claude Code gives it', () => {
    expect(
      readHiggsfieldServer(
        listed(
          'claude.ai Claude Docs: https://api.anthropic.com/v1/pages/mcp - ✔ Connected',
          'claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ✔ Connected',
          'claude.ai Google Drive: https://drivemcp.googleapis.com/mcp/v1 - ✔ Connected',
          'claude.ai Slack: https://mcp.slack.com/mcp - ! Needs authentication',
          'plugin:playwright:playwright: npx @playwright/mcp@latest - ✘ Failed to connect — CONNECTION_CLOSED: Connection closed',
        ),
      ),
    ).toEqual({ name: 'claude.ai Higgsfield', account: { state: 'ready' } });
  });
});

describe("Higgsfield's tools in the chat", () => {
  it('show as Higgsfield making something, under either name its server has', () => {
    expect(stepOf('a', 'mcp__higgsfield__generate_image', {}).kind).toBe(
      'make',
    );
    expect(
      stepOf('b', 'mcp__claude_ai_Higgsfield__generate_video', {}).kind,
    ).toBe('make');
    // The controls: another connector's tool, and FluidEQ's own.
    expect(stepOf('c', 'mcp__claude_ai_Gmail__search', {}).kind).toBe('other');
    expect(stepOf('d', 'mcp__fluideq__pack_artwork', {}).kind).toBe('pack');
  });
});

describe('the cards the chat puts up', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-makers-'));
  });
  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('are only ever about one of the member’s own tools', async () => {
    const shown: unknown[] = [];
    const asks = createChatAsks({
      root,
      show: (_projectId, ask) => shown.push(ask),
    });
    // Nothing is left to ask who makes a picture, or to connect ChatGPT.
    expect(Object.keys(asks).sort()).toEqual(
      ['answer', 'drop', 'forget', 'standing', 'tool'].sort(),
    );
    const answer = asks.tool(
      'p',
      { tool: 'mcp__claude_ai_Higgsfield__generate_image', detail: 'a moon' },
      new AbortController().signal,
    );
    expect(shown).toEqual([
      expect.objectContaining({
        kind: 'tool',
        tool: 'mcp__claude_ai_Higgsfield__generate_image',
      }),
    ]);
    asks.answer(asks.standing('p')?.id ?? '', 'yes');
    await expect(answer).resolves.toBe('yes');
  });
});
