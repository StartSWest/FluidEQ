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
import {
  readHiggsfieldServer,
  readServersSeen,
} from '../../../main/studioChat/studioMakers';

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
          'my higgs: https://mcp.higgsfield.ai/mcp (HTTP) - ! Needs authentication',
        ),
      ),
    ).toEqual({ name: 'my higgs', account: { state: 'signed-out' } });
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
const IVANS_LIST = listed(
  'claude.ai Claude Docs: https://api.anthropic.com/v1/pages/mcp - ✔ Connected',
  'claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ✔ Connected',
  'claude.ai Google Drive: https://drivemcp.googleapis.com/mcp/v1 - ✔ Connected',
  'claude.ai Slack: https://mcp.slack.com/mcp - ! Needs authentication',
  'plugin:playwright:playwright: npx @playwright/mcp@latest - ✘ Failed to connect — CONNECTION_CLOSED: Connection closed',
);

/**
 * The first line of a headless Claude Code's turn, as 2.1.321 wrote it on
 * Ivan's machine on 2026-11-11 (fields it carries beside these left out):
 * the connector `claude mcp list` called Connected, needing sign-in.
 */
const IVANS_INIT = JSON.stringify({
  type: 'system',
  subtype: 'init',
  session_id: 's',
  tools: ['Read', 'ToolSearch'],
  mcp_servers: [
    { name: 'plugin:playwright:playwright', status: 'failed' },
    { name: 'claude.ai Claude Docs', status: 'connected' },
    { name: 'claude.ai Higgsfield', status: 'needs-auth' },
    { name: 'claude.ai Slack', status: 'needs-auth' },
  ],
});

describe('a Higgsfield connected as a claude.ai connector', () => {
  it('is out of the chat’s reach, whatever the list says, until a chat has it', () => {
    expect(readHiggsfieldServer(IVANS_LIST)).toEqual({
      name: 'claude.ai Higgsfield',
      account: { state: 'connector' },
    });
    expect(
      readHiggsfieldServer(IVANS_LIST, readServersSeen(IVANS_INIT)),
    ).toEqual({
      name: 'claude.ai Higgsfield',
      account: { state: 'connector' },
    });
  });

  it('is ready once a chat’s own Claude Code reports it connected', () => {
    const seen = new Map([['claude.ai Higgsfield', 'connected']]);
    expect(readHiggsfieldServer(IVANS_LIST, seen)).toEqual({
      name: 'claude.ai Higgsfield',
      account: { state: 'ready' },
    });
  });

  it('gives way to the member’s own server, the one a set-up signs in to', () => {
    const both = listed(
      'claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ✔ Connected',
      'higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ! Needs authentication',
    );
    expect(readHiggsfieldServer(both, readServersSeen(IVANS_INIT))).toEqual({
      name: 'higgsfield',
      account: { state: 'signed-out' },
    });
    // Signed in, it is the one the card and the chat go by, though the
    // chat that reported the connector started before it was there.
    expect(
      readHiggsfieldServer(
        listed(
          'claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ✔ Connected',
          'higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected',
        ),
        readServersSeen(IVANS_INIT),
      ),
    ).toEqual({ name: 'higgsfield', account: { state: 'ready' } });
  });
});

describe('the member’s own server as the chat reports it', () => {
  const own = listed(
    'higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected',
  );
  const seenAs = (status: string) =>
    readServersSeen(
      JSON.stringify({
        type: 'system',
        subtype: 'init',
        mcp_servers: [{ name: 'higgsfield', status }],
      }),
    );

  it('takes the chat’s word over the list’s', () => {
    expect(readHiggsfieldServer(own, seenAs('needs-auth'))?.account).toEqual({
      state: 'signed-out',
    });
    expect(readHiggsfieldServer(own, seenAs('failed'))?.account).toEqual({
      state: 'unreachable',
    });
    expect(readHiggsfieldServer(own, seenAs('disabled'))?.account).toEqual({
      state: 'unreachable',
    });
  });

  it('keeps the list’s word while the chat is still connecting to it', () => {
    expect(readHiggsfieldServer(own, seenAs('pending'))?.account).toEqual({
      state: 'ready',
    });
    expect(readHiggsfieldServer(own, seenAs('connected'))?.account).toEqual({
      state: 'ready',
    });
  });
});

describe('what a chat’s Claude Code reports at the start of a turn', () => {
  it('is read from its init line alone', () => {
    expect(readServersSeen(IVANS_INIT)?.get('claude.ai Higgsfield')).toBe(
      'needs-auth',
    );
    expect(
      readServersSeen(JSON.stringify({ type: 'system', subtype: 'status' })),
    ).toBeUndefined();
    expect(readServersSeen('{ not json')).toBeUndefined();
    expect(
      readServersSeen(
        JSON.stringify({
          type: 'system',
          subtype: 'init',
          mcp_servers: [{ name: 7 }, { name: 'higgsfield', status: 'pending' }],
        }),
      ),
    ).toEqual(new Map([['higgsfield', 'pending']]));
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
