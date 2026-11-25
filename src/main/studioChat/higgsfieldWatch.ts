/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import type { THiggsfieldAccount } from '../../common/studioMakers';
import writeFileAtomically from '../atomicWrite';
import {
  chooseHiggsfield,
  isConnector,
  withServersSeen,
  type IHiggsfieldServer,
  type TServersSeen,
} from './studioMakers';

/**
 * Higgsfield as FluidEQ last heard of it, kept so the chat's Accounts card
 * has an answer the moment it opens (Ivan, 2026-11-25: "I see accounts
 * don't show up ... it showed after a while and after asking the agent to
 * use it").
 *
 * The card used to draw nothing until `claude mcp list` had answered, every
 * time it opened, and that list health-checks every server the member has
 * before it prints a line: 3 to 6 s on his PC, longer behind a slow one.
 * And a chat's own report of its servers, which arrives with every turn and
 * costs nothing, was noted in main and never sent to the window, so the card
 * moved only when the window was focused again. Now:
 *
 * - the last answer is kept here and on disk, and the window is handed it
 *   at once, while a check runs behind it;
 * - a check of a server of the member's own asks for that server alone
 *   (`claude mcp get`), so it never waits on anybody else's;
 * - checks asked while one runs share it, never start a second Claude Code;
 * - a chat's report changes the answer the moment it arrives, and the
 *   window is told.
 */

/** The states a listed server can be in, as `readHiggsfieldServers` reads them. */
const LISTED_STATES = new Set(['ready', 'signed-out', 'unreachable']);

/** The servers kept on disk, or undefined when nothing readable is there. */
const readKept = (file: string): IHiggsfieldServer[] | undefined => {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    // Never written, or not ours to read: as if never checked.
    return undefined;
  }
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('servers' in raw) ||
    !Array.isArray(raw.servers)
  ) {
    return undefined;
  }
  const servers = raw.servers.flatMap((entry: unknown): IHiggsfieldServer[] =>
    typeof entry === 'object' &&
    entry !== null &&
    'name' in entry &&
    typeof entry.name === 'string' &&
    'state' in entry &&
    typeof entry.state === 'string' &&
    LISTED_STATES.has(entry.state)
      ? [
          {
            name: entry.name,
            account: { state: entry.state as THiggsfieldAccount['state'] },
          },
        ]
      : [],
  );
  return servers.length === raw.servers.length ? servers : undefined;
};

const keptText = (servers: readonly IHiggsfieldServer[]) =>
  JSON.stringify({
    servers: servers.map(({ name, account }) => ({
      name,
      state: account.state,
    })),
  });

export interface IHiggsfieldWatchDeps {
  /** Where the last list is kept between runs of the app. */
  file: string;
  /** Every Higgsfield among the member's servers (`claude mcp list`). */
  list(): Promise<IHiggsfieldServer[]>;
  /** The one server called `name`, if it is Higgsfield (`claude mcp get`). */
  named(name: string): Promise<IHiggsfieldServer | undefined>;
  /** Higgsfield as the chat can use it is not what the window was last told. */
  changed(account: THiggsfieldAccount): void;
  logger?: { warn(message: string): void };
}

export const createHiggsfieldWatch = ({
  file,
  list,
  named,
  changed,
  logger,
}: IHiggsfieldWatchDeps) => {
  /** The servers last listed; read from disk on first need. */
  let listed: IHiggsfieldServer[] | undefined;
  let loaded = false;
  /** What the latest chat's Claude Code reported at its latest turn. */
  let seen: TServersSeen | undefined;
  /** The check running now, which every check asked meanwhile shares. */
  let running: Promise<THiggsfieldAccount> | undefined;
  /** The answer the window was last told, so it is told each change once. */
  let told: THiggsfieldAccount['state'] | undefined;

  const servers = () => {
    if (!loaded) {
      loaded = true;
      listed = readKept(file);
    }
    return listed;
  };

  /**
   * Higgsfield as the chat can use it, from the last list and the latest
   * chat's report; undefined while neither has ever been heard.
   */
  const account = (): THiggsfieldAccount | undefined => {
    const known = servers();
    if (known === undefined && seen === undefined) {
      return undefined;
    }
    return (
      chooseHiggsfield(withServersSeen(known ?? [], seen), seen)?.account ?? {
        state: 'missing',
      }
    );
  };

  const tell = () => {
    const now = account();
    if (now && now.state !== told) {
      told = now.state;
      changed(now);
    }
  };

  /** Counted up as each check starts. */
  let asked = 0;
  /** The latest-started check whose answer was kept. */
  let keptFrom = 0;

  /**
   * A check's answer kept, unless one started after it was kept first: a
   * check behind a sign-in must not put back what the sign-in changed.
   */
  const record = (startedAt: number, fresh: IHiggsfieldServer[]) => {
    if (startedAt < keptFrom) {
      return;
    }
    keptFrom = startedAt;
    const before = servers();
    listed = fresh;
    if (before === undefined || keptText(before) !== keptText(fresh)) {
      try {
        writeFileAtomically(file, keptText(fresh));
      } catch (error) {
        // Kept in memory all the same: the next run checks from nothing.
        logger?.warn(`Could not keep Higgsfield's state: ${String(error)}`);
      }
    }
    tell();
  };

  /**
   * The servers now. A known server of the member's own is asked alone:
   * that is the one the card shows whenever it is there (`chooseHiggsfield`
   * puts it over a connector), and a connector's state is the chat's word,
   * not the list's. Anything else - nothing known yet, only a connector, or
   * the name gone or pointing elsewhere - takes the whole list, which is
   * the only way to find a Higgsfield under a name nobody knew.
   */
  const check = async (): Promise<IHiggsfieldServer[]> => {
    const known = servers() ?? [];
    const own = known.filter(({ name }) => !isConnector(name));
    const [only] = own;
    if (own.length === 1 && only) {
      const now = await named(only.name);
      if (now) {
        return known.map((server) => (server.name === now.name ? now : server));
      }
    }
    return list();
  };

  return {
    /** The last answer, with nothing started: what the card opens on. */
    known: account,
    /**
     * Higgsfield checked again, and the answer it came to. One check at a
     * time: a call while one runs gets that one's answer.
     */
    refresh: (): Promise<THiggsfieldAccount> => {
      if (running) {
        return running;
      }
      asked += 1;
      const startedAt = asked;
      const answer = check()
        .then((fresh) => record(startedAt, fresh))
        .then((): THiggsfieldAccount => account() ?? { state: 'missing' })
        .finally(() => {
          running = undefined;
        });
      running = answer;
      return answer;
    },
    /**
     * The whole list, asked now and kept: for the set-up, which has to see
     * exactly what Claude Code has after every step it takes.
     */
    listNow: async (): Promise<IHiggsfieldServer[]> => {
      asked += 1;
      const startedAt = asked;
      const fresh = await list();
      record(startedAt, fresh);
      return fresh;
    },
    /** The Higgsfield the chat would work with among `among`. */
    choose: (among: readonly IHiggsfieldServer[]) =>
      chooseHiggsfield(among, seen),
    /** A chat's Claude Code reported its servers at the start of a turn. */
    noteServers: (reported: TServersSeen) => {
      seen = reported;
      tell();
    },
    /**
     * The member's servers were changed here: every chat starts its Claude
     * Code again at its next message and reports afresh, and until then what
     * the last one reported is about servers that are no longer so.
     */
    forgetSeen: () => {
      seen = undefined;
      tell();
    },
  };
};

export type THiggsfieldWatch = ReturnType<typeof createHiggsfieldWatch>;
