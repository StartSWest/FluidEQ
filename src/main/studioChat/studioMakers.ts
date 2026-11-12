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
 * A server Claude Code lists from claude.ai rather than the member's own
 * settings: it names every one `claude.ai <name>`.
 */
export const isConnector = (name: string) => name.startsWith('claude.ai ');

/**
 * Higgsfield in what `claude mcp list` prints, one server a line:
 *
 *     higgsfield: https://mcp.higgsfield.ai/mcp (HTTP) - ✔ Connected
 *     claude.ai Higgsfield: https://mcp.higgsfield.ai/mcp - ✔ Connected
 *
 * Found by the address, whatever it is called: a member may have added it
 * through FluidEQ or themselves, or have it as a claude.ai connector (Ivan's
 * is one, checked against his own list on 2026-11-11). Every line that is
 * Higgsfield, in the list's order. The state is read from Claude Code's own
 * words; a line that says neither is a server Claude Code could not reach.
 */
export const readHiggsfieldServers = (listed: string): IHiggsfieldServer[] =>
  listed.split(/\r?\n/).flatMap((line): IHiggsfieldServer[] => {
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

/**
 * A server's status as a chat's own Claude Code reported it at the start of
 * its latest turn (the stream's `init`): `connected`, `pending`,
 * `needs-auth`, `failed` or `disabled`, by the server's name.
 */
export type TServersSeen = ReadonlyMap<string, string>;

/**
 * One listed Higgsfield as the chat can use it. `claude mcp list` connects
 * to every server afresh and is not what the chat gets: a claude.ai
 * connector it called Connected came up in every headless Claude Code as
 * `needs-auth` with no tools (2.1.321, 2026-11-11; Claude Code's own issue
 * 89604 and its duplicates), so a chat's own report outranks the list, and
 * a connector counts as out of the chat's reach until a chat has reported it
 * connected. A server of the member's own still connecting there (`pending`)
 * is taken at the list's word, which has just connected to it.
 */
const asTheChatSees = (
  server: IHiggsfieldServer,
  seen: TServersSeen | undefined,
): IHiggsfieldServer => {
  const status = seen?.get(server.name);
  if (isConnector(server.name)) {
    return status === 'connected'
      ? server
      : { name: server.name, account: { state: 'connector' } };
  }
  if (status === 'needs-auth') {
    return { name: server.name, account: { state: 'signed-out' } };
  }
  if (status === 'failed' || status === 'disabled') {
    return { name: server.name, account: { state: 'unreachable' } };
  }
  return server;
};

/**
 * The Higgsfield the card shows and the chat works with: one the chat can
 * use first, then the member's own server over a claude.ai connector — the
 * one a set-up signs in to — then whichever was listed first.
 */
export const chooseHiggsfield = (
  listed: readonly IHiggsfieldServer[],
  seen?: TServersSeen,
): IHiggsfieldServer | undefined => {
  const servers = listed.map((server) => asTheChatSees(server, seen));
  return (
    servers.find(({ account }) => account.state === 'ready') ??
    servers.find(({ name }) => !isConnector(name)) ??
    servers[0]
  );
};

/** Higgsfield in what `claude mcp list` prints, as the card shows it. */
export const readHiggsfieldServer = (
  listed: string,
  seen?: TServersSeen,
): IHiggsfieldServer | undefined =>
  chooseHiggsfield(readHiggsfieldServers(listed), seen);

/**
 * The servers a chat's Claude Code reports at the start of a turn, from one
 * line of its stream: undefined for any line that is not that report.
 */
export const readServersSeen = (line: string): TServersSeen | undefined => {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (
    typeof message !== 'object' ||
    message === null ||
    !('type' in message) ||
    message.type !== 'system' ||
    !('subtype' in message) ||
    message.subtype !== 'init' ||
    !('mcp_servers' in message) ||
    !Array.isArray(message.mcp_servers)
  ) {
    return undefined;
  }
  return new Map(
    message.mcp_servers.flatMap((server: unknown): [string, string][] =>
      typeof server === 'object' &&
      server !== null &&
      'name' in server &&
      typeof server.name === 'string' &&
      'status' in server &&
      typeof server.status === 'string'
        ? [[server.name, server.status]]
        : [],
    ),
  );
};
