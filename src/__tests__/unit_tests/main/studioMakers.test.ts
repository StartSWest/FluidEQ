/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Higgsfield beside GPT in the Studio's chat (Ivan, 2026-11-11: "quiero que
 * Fluid esté preparado para usar Higgsfield. Y que pida si quiere usar GPT
 * o Higgsfield"): which of the member's own two makers are in their Claude
 * Code, which one makes the next thing, the card that asks when both can,
 * and the tool Claude asks through - which makes nothing and never tells
 * Claude to set anything up.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { TStudioChatAsk } from '../../../common/studioChat';
import {
  connectedMakers,
  makersFor,
  makerToUse,
  type IStudioMakers,
} from '../../../common/studioMakers';
import type { IMcpToolResult } from '../../../main/studioAgent/mcpProtocol';
import { createChatAsks } from '../../../main/studioChat/chatAsks';
import createChooseMakerTool from '../../../main/studioChat/chooseMakerTool';
import {
  createMakerChoice,
  readGptPlugin,
  readHiggsfieldServer,
} from '../../../main/studioChat/studioMakers';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-makers-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const makers = (
  gpt: boolean,
  higgsfield: IStudioMakers['higgsfield']['state'],
  choice: IStudioMakers['choice'] = 'ask',
): IStudioMakers => ({
  gpt: gpt ? { found: true, name: 'gpt-studio@a-market' } : { found: false },
  higgsfield: { state: higgsfield },
  choice,
});

describe('which of the two makes the next thing', () => {
  it('counts a maker only while it can be used', () => {
    expect(connectedMakers(makers(true, 'ready'))).toEqual([
      'gpt',
      'higgsfield',
    ]);
    expect(connectedMakers(makers(true, 'signed-out'))).toEqual(['gpt']);
    expect(connectedMakers(makers(false, 'unreachable'))).toEqual([]);
    expect(connectedMakers(makers(false, 'missing'))).toEqual([]);
  });

  it('uses the only one connected, whatever was chosen', () => {
    expect(makerToUse('higgsfield', ['gpt'])).toBe('gpt');
    expect(makerToUse('ask', ['higgsfield'])).toBe('higgsfield');
  });

  it('asks when both are connected and nothing is chosen', () => {
    expect(makerToUse('ask', ['gpt', 'higgsfield'])).toBe('ask');
  });

  it('uses the one the member chose while both are connected', () => {
    expect(makerToUse('gpt', ['gpt', 'higgsfield'])).toBe('gpt');
    expect(makerToUse('higgsfield', ['gpt', 'higgsfield'])).toBe('higgsfield');
  });

  it('says there is none when neither is connected', () => {
    expect(makerToUse('gpt', [])).toBe('none');
  });

  it('gives a 3D model to Higgsfield alone: a GPT plugin draws pictures', () => {
    expect(makersFor('model', makers(true, 'ready'))).toEqual(['higgsfield']);
    expect(makersFor('model', makers(true, 'signed-out'))).toEqual([]);
    // The control: pictures and frames are both makers'.
    expect(makersFor('picture', makers(true, 'ready'))).toEqual([
      'gpt',
      'higgsfield',
    ]);
    expect(makersFor('frames', makers(true, 'ready'))).toEqual([
      'gpt',
      'higgsfield',
    ]);
  });
});

describe("the member's GPT plugin, read from Claude Code's own settings", () => {
  it('is found when it is switched on', () => {
    expect(
      readGptPlugin(
        JSON.stringify({
          enabledPlugins: { 'other@x': true, 'gpt-studio@a-market': true },
        }),
      ),
    ).toEqual({ found: true, name: 'gpt-studio@a-market' });
  });

  it('is not found when it is switched off', () => {
    expect(
      readGptPlugin(
        JSON.stringify({ enabledPlugins: { 'gpt-studio@a-market': false } }),
      ),
    ).toEqual({ found: false });
  });

  it('is not another plugin whose name only starts the same', () => {
    expect(
      readGptPlugin(
        JSON.stringify({ enabledPlugins: { 'gpt-studio-tools@x': true } }),
      ),
    ).toEqual({ found: false });
  });

  it('is not found in no settings, or settings that cannot be read', () => {
    expect(readGptPlugin(undefined)).toEqual({ found: false });
    expect(readGptPlugin('{ "enabledPlugins": ')).toEqual({ found: false });
    expect(readGptPlugin('[]')).toEqual({ found: false });
    expect(readGptPlugin('{"enabledPlugins":["gpt-studio@x"]}')).toEqual({
      found: false,
    });
  });
});

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

describe("the member's choice of maker", () => {
  it('is to be asked until they choose', () => {
    expect(createMakerChoice(root).get()).toBe('ask');
  });

  it('is kept for the next launch', () => {
    createMakerChoice(root).set('higgsfield');
    expect(createMakerChoice(root).get()).toBe('higgsfield');
    createMakerChoice(root).set('ask');
    expect(createMakerChoice(root).get()).toBe('ask');
  });

  it('is to be asked when what was kept is not a choice', () => {
    fs.writeFileSync(path.join(root, 'makers.json'), '{"choice":"dall-e"}');
    expect(createMakerChoice(root).get()).toBe('ask');
    fs.writeFileSync(path.join(root, 'makers.json'), 'not json');
    expect(createMakerChoice(root).get()).toBe('ask');
  });
});

/** The chat's asks, with every card it puts up or takes down written down. */
const asksWith = () => {
  const shown: (TStudioChatAsk | undefined)[] = [];
  const asks = createChatAsks({
    root,
    show: (_projectId, ask) => shown.push(ask),
  });
  const up = () => {
    const card = shown[shown.length - 1];
    if (!card) {
      throw new Error('no card is up');
    }
    return card;
  };
  return { asks, shown, up };
};

describe('the card that asks which maker', () => {
  it('goes up with what is made and why, and answers the maker pressed', async () => {
    const { asks, shown, up } = asksWith();
    const asked = asks.maker('lake', { what: 'picture', why: 'A heron.' });
    expect(up()).toMatchObject({
      projectId: 'lake',
      kind: 'maker',
      what: 'picture',
      why: 'A heron.',
    });
    asks.answerMaker(up().id, 'higgsfield');
    await expect(asked).resolves.toBe('higgsfield');
    // Taken down once answered.
    expect(shown[shown.length - 1]).toBeUndefined();
  });

  it('answers nothing for "not now"', async () => {
    const { asks, up } = asksWith();
    const asked = asks.maker('lake', { what: 'frames', why: 'A bird.' });
    asks.answer(up().id, 'no');
    await expect(asked).resolves.toBeUndefined();
  });

  it('answers nothing when the reply ends with the card still up', async () => {
    const { asks } = asksWith();
    const asked = asks.maker('lake', { what: 'picture', why: 'A heron.' });
    asks.drop('lake');
    await expect(asked).resolves.toBeUndefined();
  });

  it('takes no maker for a card that asks something else', async () => {
    const { asks, up } = asksWith();
    const asked = asks.tool(
      'lake',
      { tool: 'Bash', detail: 'git --version' },
      new AbortController().signal,
    );
    const { id } = up();
    asks.answerMaker(id, 'gpt');
    // Still standing: the press of a maker is no answer to it.
    expect(asks.standing('lake')?.id).toBe(id);
    asks.answer(id, 'no');
    await expect(asked).resolves.toBe('no');
  });

  it('keeps one press from answering the next card', async () => {
    const { asks, up } = asksWith();
    const first = asks.maker('lake', { what: 'picture', why: 'A heron.' });
    asks.answerMaker(up().id, 'gpt');
    await expect(first).resolves.toBe('gpt');
    const second = asks.maker('lake', { what: 'picture', why: 'A reed.' });
    asks.answer(up().id, 'no');
    await expect(second).resolves.toBeUndefined();
  });
});

describe('choose_maker, the tool Claude asks through', () => {
  const toolWith = (now: IStudioMakers, open = true) => {
    const { asks, shown, up } = asksWith();
    const tool = createChooseMakerTool({
      project: () =>
        open
          ? { ok: true, id: 'lake', folder: root }
          : { ok: false, reason: 'none-open' },
      asks,
      makers: async () => now,
    });
    return { tool, asks, shown, up };
  };
  const said = async (answer: Promise<IMcpToolResult>) =>
    (await answer).content
      .map((part) => ('text' in part ? part.text : ''))
      .join('');
  const heron = { what: 'picture', why: 'A heron for the shore.' };

  it('says neither is connected, and never to set one up itself', async () => {
    const { tool, shown } = toolWith(makers(false, 'missing'));
    const words = await said(tool.call(heron));
    expect(words).toContain('Neither of the two makers is connected');
    expect(words).toContain('Set up Higgsfield');
    expect(words).toContain(
      'Do not install, add or sign in to anything yourself',
    );
    expect(shown).toEqual([]);
  });

  it('names the only one connected without asking', async () => {
    const gptOnly = toolWith(makers(true, 'signed-out'));
    expect(await said(gptOnly.tool.call(heron))).toContain(
      "Use the member's own GPT plugin in their Claude Code (gpt-studio)",
    );
    expect(gptOnly.shown).toEqual([]);

    const higgsfieldOnly = toolWith(makers(false, 'ready'));
    const words = await said(higgsfieldOnly.tool.call(heron));
    expect(words).toContain('Use Higgsfield');
    expect(words).toContain('fluideq-higgsfield');
    expect(higgsfieldOnly.shown).toEqual([]);
  });

  it('uses the member’s standing choice without asking', async () => {
    const { tool, shown } = toolWith(makers(true, 'ready', 'higgsfield'));
    expect(await said(tool.call(heron))).toContain('Use Higgsfield');
    expect(shown).toEqual([]);
  });

  it('asks the member when both are connected, and uses what they press', async () => {
    const { tool, asks, up } = toolWith(makers(true, 'ready'));
    const answer = tool.call(heron);
    await Promise.resolve();
    await Promise.resolve();
    expect(up()).toMatchObject({
      kind: 'maker',
      what: 'picture',
      why: 'A heron for the shore.',
    });
    asks.answerMaker(up().id, 'gpt');
    expect(await said(answer)).toContain("Use the member's own GPT plugin");
  });

  it('tells Claude to draw it when the member says not now', async () => {
    const { tool, asks, up } = toolWith(makers(true, 'ready'));
    const answer = tool.call(heron);
    await Promise.resolve();
    await Promise.resolve();
    asks.answer(up().id, 'no');
    const words = await said(answer);
    expect(words).toContain('The member said not now');
    expect(words).not.toContain('Use Higgsfield');
  });

  it('never asks for a 3D model: only Higgsfield builds one', async () => {
    const both = toolWith(makers(true, 'ready'));
    expect(
      await said(both.tool.call({ what: 'model', why: 'A camel.' })),
    ).toContain('Use Higgsfield');
    expect(both.shown).toEqual([]);

    // Chosen GPT, and still Higgsfield: the choice is between picture makers.
    const chosen = toolWith(makers(true, 'ready', 'gpt'));
    expect(
      await said(chosen.tool.call({ what: 'model', why: 'A camel.' })),
    ).toContain('Use Higgsfield');

    const gptOnly = toolWith(makers(true, 'missing'));
    const words = await said(
      gptOnly.tool.call({ what: 'model', why: 'A camel.' }),
    );
    expect(words).toContain('A 3D model needs Higgsfield');
    expect(words).not.toContain("Use the member's own GPT plugin");
    expect(gptOnly.shown).toEqual([]);
  });

  it('refuses what a scene cannot use, before anything is looked up', async () => {
    const { tool, shown } = toolWith(makers(true, 'ready'));
    const video = await tool.call({ what: 'video', why: 'A clip.' });
    expect(video.isError).toBe(true);
    expect((await tool.call({ what: 'picture', why: '  ' })).isError).toBe(
      true,
    );
    expect((await tool.call({ what: 'picture' })).isError).toBe(true);
    expect(shown).toEqual([]);
  });

  it('refuses when the chat’s project is not open', async () => {
    const { tool, shown } = toolWith(makers(true, 'ready'), false);
    expect((await tool.call(heron)).isError).toBe(true);
    expect(shown).toEqual([]);
  });

  it('makes nothing itself, and says so to Claude Code', () => {
    const { tool } = toolWith(makers(true, 'ready'));
    expect(tool.name).toBe('choose_maker');
    expect(tool.annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
    });
  });
});
