/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  TStudioChatAnswer,
  TStudioChatAsk,
  TStudioChatCodex,
} from '../../common/studioChat';
import type { TStudioMaker } from '../../common/studioMakers';
import writeFileAtomically from '../atomicWrite';

/**
 * What the chat asks the member before Claude uses their ChatGPT (Ivan,
 * 2026-10-09: "it needs to ask the user if you connect gpt codex I can use
 * it to generate textures and so, and if so, also ask when it will use it").
 *
 * - CONNECT, once: the member says ChatGPT may be used for pictures at all.
 *   Kept across launches in `codex.json`; a "not now" is kept for the rest
 *   of the chat only, so the next chat may ask again, and Claude is told not
 *   to ask twice in one.
 * - EVERY PICTURE: what it is for and what ChatGPT will be asked to draw,
 *   answered yes, yes for the rest of this chat, or no.
 *
 * An ask waits on the member and on nothing else; a reply that is stopped
 * or ends answers it no, and the card goes with it.
 */

const CONNECTION_FILE = 'codex.json';
/** A chat's tools allowed always, in its project's own folder of the chat. */
const ALWAYS_FILE = 'allowed-tools.json';

interface IPending {
  ask: TStudioChatAsk;
  resolve: (answer: TStudioChatAnswer) => void;
}

export interface IChatAsksDeps {
  root: string;
  /** Tells the window an ask appeared, or (undefined) that it went. */
  show(projectId: string, ask: TStudioChatAsk | undefined): void;
}

type TAskWithoutId<T> = T extends unknown ? Omit<T, 'id' | 'projectId'> : never;

export const createChatAsks = ({ root, show }: IChatAsksDeps) => {
  const file = path.join(root, CONNECTION_FILE);
  const pending = new Map<string, IPending>();
  /** Per project, for the life of its chat: "not now" to connecting. */
  const declined = new Set<string>();
  /** Per project, for the life of its chat: "yes to every picture". */
  const allowed = new Set<string>();
  /**
   * Per project, for the life of its chat: tools said "Always allow" to
   * (Ivan, 2026-11-07: "always allow is per chat not global"). Kept on disk
   * beside the chat, so a restart of FluidEQ leaves the chat as it was, and
   * read once per project.
   */
  const allowedTools = new Map<string, Set<string>>();
  const alwaysFileOf = (projectId: string) =>
    path.join(root, encodeURIComponent(projectId), ALWAYS_FILE);
  const toolsOf = (projectId: string) => {
    const known = allowedTools.get(projectId);
    if (known) {
      return known;
    }
    let tools = new Set<string>();
    try {
      const raw: unknown = JSON.parse(
        fs.readFileSync(alwaysFileOf(projectId), 'utf8'),
      );
      const list =
        typeof raw === 'object' && raw !== null
          ? (raw as Record<string, unknown>).tools
          : undefined;
      if (Array.isArray(list)) {
        tools = new Set(
          list.filter((tool): tool is string => typeof tool === 'string'),
        );
      }
    } catch {
      // Nothing allowed always yet in this chat.
    }
    allowedTools.set(projectId, tools);
    return tools;
  };
  /** Per project, the tool asks waiting for the card standing to go. */
  const waiting = new Map<string, Array<() => void>>();
  /** By ask: the maker the member pressed on a "which makes this" card. */
  const pressed = new Map<string, TStudioMaker>();

  const readConnected = () => {
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      return (
        typeof raw === 'object' &&
        raw !== null &&
        (raw as Record<string, unknown>).connected === true
      );
    } catch {
      return false;
    }
  };
  let connected = readConnected();

  const setConnected = (next: boolean) => {
    connected = next;
    writeFileAtomically(file, JSON.stringify({ connected: next }));
  };

  const ask = (
    projectId: string,
    what: TAskWithoutId<TStudioChatAsk>,
    /** Told the card's id as it goes up, for an answer that names it. */
    made?: (id: string) => void,
  ): Promise<TStudioChatAnswer> => {
    // One card at a time: Claude asks for pictures one after another, and a
    // second ask while one stands is answered no rather than stacked.
    const standing = [...pending.values()].some(
      (entry) => entry.ask.projectId === projectId,
    );
    if (standing) {
      return Promise.resolve('no');
    }
    const id = randomUUID();
    const full: TStudioChatAsk =
      what.kind === 'connect'
        ? { ...what, id, projectId }
        : { ...what, id, projectId };
    made?.(id);
    return new Promise((resolve) => {
      pending.set(full.id, { ask: full, resolve });
      show(projectId, full);
    });
  };

  const standingOn = (projectId: string) =>
    [...pending.values()].some((entry) => entry.ask.projectId === projectId);

  const settle = (id: string, answer: TStudioChatAnswer) => {
    const entry = pending.get(id);
    if (!entry) {
      return;
    }
    pending.delete(id);
    show(entry.ask.projectId, undefined);
    entry.resolve(answer);
    // The next tool ask waiting on this project gets its card.
    waiting.get(entry.ask.projectId)?.shift()?.();
  };

  /** Resolves when the card standing on the project goes, or the reply does. */
  const nextTurn = (projectId: string, signal: AbortSignal): Promise<void> =>
    new Promise<void>((resolve) => {
      const queue = waiting.get(projectId) ?? [];
      // Out of the line whichever wakes it, so a stopped reply's ask never
      // takes the next one's turn.
      const wake = () => {
        signal.removeEventListener('abort', wake);
        const at = queue.indexOf(wake);
        if (at !== -1) {
          queue.splice(at, 1);
        }
        resolve();
      };
      queue.push(wake);
      waiting.set(projectId, queue);
      signal.addEventListener('abort', wake, { once: true });
    });

  return {
    isConnected: () => connected,
    disconnect: () => setConnected(false),

    /**
     * Whether ChatGPT may be used in this chat: connected before, or the
     * member says so now. `codex` is what the card offers to do first when
     * Codex is not ready (install it, or sign in).
     */
    connect: async (
      projectId: string,
      codex: TStudioChatCodex,
    ): Promise<boolean> => {
      if (connected && codex === 'ready') {
        return true;
      }
      if (declined.has(projectId)) {
        return false;
      }
      const answer = await ask(projectId, { kind: 'connect', codex });
      if (answer === 'no') {
        declined.add(projectId);
        return false;
      }
      setConnected(true);
      return true;
    },

    /** Whether this one picture may be made. */
    picture: async (
      projectId: string,
      what: Omit<
        Extract<TStudioChatAsk, { kind: 'picture' }>,
        'id' | 'projectId' | 'kind'
      >,
    ): Promise<boolean> => {
      if (allowed.has(projectId)) {
        return true;
      }
      const answer = await ask(projectId, { kind: 'picture', ...what });
      if (answer === 'chat') {
        allowed.add(projectId);
      }
      return answer !== 'no';
    },

    /**
     * Whether one of the member's own tools may run once (Ivan, 2026-11-07:
     * "claude need to have access to all plugins that claude has"): yes,
     * always, or no. Always is the member's own rule from then on, kept by
     * Claude Code in their user settings (`keptRules`), and remembered for
     * this chat besides, so a tool with no rule to keep asks no more here.
     * Claude can ask for several at once, so each waits its turn for the card
     * rather than being refused; the reply ending or stopped answers it no.
     */
    tool: async (
      projectId: string,
      what: { tool: string; detail: string; foreign?: true },
      signal: AbortSignal,
    ): Promise<TStudioChatAnswer> => {
      // In a scene from outside FluidEQ nothing is allowed for always: not
      // what was said in this chat before, and not from this card.
      const always = !what.foreign && toolsOf(projectId).has(what.tool);
      if (always) {
        return 'yes';
      }
      // Looked at again after every wait, and the card put up in the same
      // step as the last look: two questions arriving together both found
      // no card up, and the second was refused as one too many.
      while (standingOn(projectId) && !signal.aborted) {
        // eslint-disable-next-line no-await-in-loop -- one card at a time, in order
        await nextTurn(projectId, signal);
      }
      if (signal.aborted) {
        return 'no';
      }
      if (!what.foreign && toolsOf(projectId).has(what.tool)) {
        return 'yes';
      }
      const answer = await ask(projectId, { kind: 'tool', ...what });
      if (what.foreign) {
        return answer === 'no' ? 'no' : 'yes';
      }
      if (answer === 'chat') {
        const tools = toolsOf(projectId);
        tools.add(what.tool);
        writeFileAtomically(
          alwaysFileOf(projectId),
          JSON.stringify({ tools: [...tools] }),
          0o600,
        );
      }
      return answer;
    },

    /**
     * Which of the two makers makes this one thing, asked of the member
     * (`common/studioMakers.ts`): the one pressed, or nothing for "not
     * now", a card already standing, or a reply that ended first.
     */
    maker: async (
      projectId: string,
      what: Omit<
        Extract<TStudioChatAsk, { kind: 'maker' }>,
        'id' | 'projectId' | 'kind'
      >,
    ): Promise<TStudioMaker | undefined> => {
      let id = '';
      await ask(projectId, { kind: 'maker', ...what }, (made) => {
        id = made;
      });
      // Only a press of a maker names one (`answerMaker`): any other end of
      // the card left nothing here.
      const maker = pressed.get(id);
      pressed.delete(id);
      return maker;
    },

    /** The maker the member pressed on that card, from the window. */
    answerMaker: (id: string, maker: TStudioMaker) => {
      if (pending.get(id)?.ask.kind !== 'maker') {
        return;
      }
      pressed.set(id, maker);
      settle(id, 'yes');
    },

    /** The member's answer, from the window. */
    answer: settle,

    /** The card standing on a project, for a window that loads again. */
    standing: (projectId: string) =>
      [...pending.values()].find((entry) => entry.ask.projectId === projectId)
        ?.ask,

    /** A reply stopped or ended: what it asked goes unanswered, as no. */
    drop: (projectId: string) => {
      [...pending.values()]
        .filter((entry) => entry.ask.projectId === projectId)
        .forEach((entry) => settle(entry.ask.id, 'no'));
    },

    /** A new chat starts with nothing allowed and nothing declined. */
    forget: (projectId: string) => {
      declined.delete(projectId);
      allowed.delete(projectId);
      allowedTools.set(projectId, new Set());
      fs.rmSync(alwaysFileOf(projectId), { force: true });
    },
  };
};

export type TChatAsks = ReturnType<typeof createChatAsks>;
