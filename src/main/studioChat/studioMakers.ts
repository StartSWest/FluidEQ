/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { THiggsfieldAccount } from '../../common/studioMakers';

/**
 * Higgsfield as it is in the member's own Claude Code
 * (`common/studioMakers.ts`): read from what Claude Code says of its
 * servers, never held. Claude Code keeps the sign-in; FluidEQ never opens
 * where it is kept.
 *
 * A `makers.json` an older FluidEQ wrote — which of GPT and Higgsfield to
 * use — is left alone and never read: there is nothing left to choose.
 */

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
 *     claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ✔ Connected
 *
 * Found by the address, whatever it is called: a member may have added it
 * through FluidEQ or themselves, or have it as a claude.ai connector, which
 * Claude Code lists as `claude.ai <name>` (Ivan's is one, checked against his
 * own list on 2026-11-11). One that is connected is preferred to one that is
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
