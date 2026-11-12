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
} from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';

/**
 * What the chat asks the member before Claude uses one of their own Claude
 * Code tools that their settings do not already allow: a plugin's skill, a
 * command, a tool server (Ivan, 2026-11-07: "claude need to have access to
 * all plugins that claude has").
 *
 * The cards that asked before ChatGPT was used — to connect it, before each
 * picture, and which of two makers to use — went with it (Ivan, 2026-11-11:
 * "let's remove GPT then and let's only use Higgsfield"). A `codex.json` an
 * older FluidEQ wrote is left alone and never read.
 *
 * An ask waits on the member and on nothing else; a reply that is stopped
 * or ends answers it no, and the card goes with it.
 */

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

export const createChatAsks = ({ root, show }: IChatAsksDeps) => {
  const pending = new Map<string, IPending>();
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

  const standingOn = (projectId: string) =>
    [...pending.values()].some((entry) => entry.ask.projectId === projectId);

  const put = (
    projectId: string,
    what: Omit<TStudioChatAsk, 'id' | 'projectId'>,
  ): Promise<TStudioChatAnswer> => {
    const full: TStudioChatAsk = { ...what, id: randomUUID(), projectId };
    return new Promise((resolve) => {
      pending.set(full.id, { ask: full, resolve });
      show(projectId, full);
    });
  };

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
    /**
     * Whether one of the member's own tools may run once: yes, always, or
     * no. Always is the member's own rule from then on, kept by Claude Code
     * in their user settings (`keptRules`), and remembered for this chat
     * besides, so a tool with no rule to keep asks no more here. Claude can
     * ask for several at once, so each waits its turn for the card rather
     * than being refused; the reply ending or stopped answers it no.
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
      const answer = await put(projectId, { kind: 'tool', ...what });
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

    /** A new chat starts with nothing allowed. */
    forget: (projectId: string) => {
      allowedTools.set(projectId, new Set());
      fs.rmSync(alwaysFileOf(projectId), { force: true });
    },
  };
};

export type TChatAsks = ReturnType<typeof createChatAsks>;
