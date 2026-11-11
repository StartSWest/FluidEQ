/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  isStudioMakerChoice,
  type IGptPlugin,
  type THiggsfieldAccount,
  type TStudioMakerChoice,
} from '../../common/studioMakers';
import writeFileAtomically from '../atomicWrite';

/**
 * The two makers of pictures the Studio's chat can reach outside FluidEQ, as
 * they are in the member's own Claude Code (`common/studioMakers.ts`): their
 * GPT plugin, Higgsfield's hosted tool server, and which of them the member
 * said to use.
 *
 * Read, never held: the plugin from Claude Code's own list of what the
 * member switched on, Higgsfield from what Claude Code says of its servers.
 * Claude Code keeps the sign-in; FluidEQ never opens where it is kept.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A GPT plugin by the name Claude Code lists it under: `<name>@<marketplace>`. */
const GPT_PLUGIN = /^gpt-studio(?:@|$)/;

/** Where Claude Code keeps the member's own settings. */
export const claudeSettingsFile = (
  env: NodeJS.ProcessEnv = process.env,
  home: string = os.homedir(),
) =>
  path.join(
    env.CLAUDE_CONFIG_DIR ?? path.join(home, '.claude'),
    'settings.json',
  );

/**
 * The member's GPT plugin, when it is switched on in their Claude Code:
 * `enabledPlugins` there maps each plugin to whether it is on.
 */
export const readGptPlugin = (settingsText: string | undefined): IGptPlugin => {
  if (settingsText === undefined) {
    return { found: false };
  }
  let settings: unknown;
  try {
    settings = JSON.parse(settingsText);
  } catch {
    // A settings file being written, or not JSON: no plugin can be told.
    return { found: false };
  }
  const enabled = isRecord(settings) ? settings.enabledPlugins : undefined;
  const name = isRecord(enabled)
    ? Object.keys(enabled).find(
        (key) => GPT_PLUGIN.test(key) && enabled[key] === true,
      )
    : undefined;
  return name === undefined ? { found: false } : { found: true, name };
};

export const gptPlugin = (file: string = claudeSettingsFile()): IGptPlugin => {
  try {
    return readGptPlugin(fs.readFileSync(file, 'utf8'));
  } catch {
    // No settings file: Claude Code has none of the member's plugins on.
    return { found: false };
  }
};

/** Higgsfield's hosted tool server, the one address it is published at. */
export const HIGGSFIELD_MCP_URL = 'https://mcp.higgsfield.ai/mcp';
/** The name FluidEQ adds it under, which is the name its tools then carry. */
export const HIGGSFIELD_SERVER = 'higgsfield';

/** Higgsfield among the member's servers: the name it has there, and its state. */
export interface IHiggsfieldServer {
  name: string;
  account: THiggsfieldAccount;
}

/**
 * Higgsfield in what `claude mcp list` prints, one server a line:
 *
 *     higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected
 *     claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ! Needs authentication
 *
 * Found by the address, whatever it is called: a member may have added it
 * themselves, or have it as a claude.ai connector, which Claude Code lists
 * as `claude.ai <name>`. One that is connected is preferred to one that is
 * not. The state is read from Claude Code's own words; a line that says
 * neither is a server Claude Code could not reach.
 */
export const readHiggsfieldServer = (
  listed: string,
): IHiggsfieldServer | undefined => {
  const found = listed.split(/\r?\n/).flatMap((line): IHiggsfieldServer[] => {
    const split = /^(.+?):\s+(\S+).*?\s-\s+(.*)$/.exec(line.trim());
    if (!split) {
      return [];
    }
    const [, name, address, status] = split;
    let host: string;
    try {
      ({ host } = new URL(address));
    } catch {
      // A command, not an address: not a hosted server.
      return [];
    }
    if (host !== new URL(HIGGSFIELD_MCP_URL).host) {
      return [];
    }
    let state: THiggsfieldAccount['state'] = 'unreachable';
    if (/\bConnected\b/.test(status)) {
      state = 'ready';
    } else if (/Needs authentication/i.test(status)) {
      state = 'signed-out';
    }
    return [{ name, account: { state } }];
  });
  return found.find(({ account }) => account.state === 'ready') ?? found[0];
};

const CHOICE_FILE = 'makers.json';

/** The member's "use this one" kept across launches, beside the chat's files. */
export const createMakerChoice = (root: string) => {
  const file = path.join(root, CHOICE_FILE);
  const read = (): TStudioMakerChoice => {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      const choice = isRecord(raw) ? raw.choice : undefined;
      return isStudioMakerChoice(choice) ? choice : 'ask';
    } catch {
      // Never chosen: asked each time.
      return 'ask';
    }
  };
  let choice = read();
  return {
    get: () => choice,
    set: (next: TStudioMakerChoice) => {
      choice = next;
      writeFileAtomically(file, JSON.stringify({ choice: next }));
    },
  };
};

export type TMakerChoice = ReturnType<typeof createMakerChoice>;
