/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import type { IStudioChatQueued } from '../../common/studioChat';
import type { IChatMessage } from './chatMessage';

/**
 * Messages the member sent while Claude was still answering (Ivan,
 * 2026-10-14: "we need to be able to queue messages to claude"), per
 * project, oldest first.
 *
 * Read the way Claude Code reads its own (2026-10-16: "so they are read
 * faster not when the turn ends"), and all as one (2026-10-18: "all
 * messages need to be sent at once no one each"): everything waiting is
 * handed to Claude Code as ONE message when Claude's next step starts, and
 * Claude reads it the moment that step returns (`chatTurns.ts`). Each line
 * handed over carries a uuid of its own, which Claude Code echoes when it
 * reads it, and by which it can be taken back (`cancel_async_message`) until
 * then - so every message here can be taken back, handed over or not
 * (2026-10-18: "I need to remove message sent from the queue").
 *
 * Nothing here is lost to a stop: a stop ends what Claude is doing and what
 * waits goes on. A failure keeps it waiting; Claude Code ending before it
 * read a line puts that line back to wait. Held in memory only: a queue is
 * the next few seconds or minutes of one sitting.
 */

interface IQueued {
  id: string;
  message: IChatMessage;
  /** The uuid of the line it was handed to Claude Code in; none while it waits. */
  line?: string;
}

const createChatQueue = (
  /** The window is told the queue's new state. */
  tell: (projectId: string, queued: IStudioChatQueued[]) => void,
) => {
  const queues = new Map<string, IQueued[]>();
  const of = (projectId: string) => queues.get(projectId) ?? [];

  const list = (projectId: string): IStudioChatQueued[] =>
    of(projectId).map(({ id, message, line }) => ({
      id,
      text: message.words,
      picture: message.picture !== undefined,
      sent: line !== undefined,
    }));

  const set = (projectId: string, next: IQueued[]) => {
    if (next.length > 0) {
      queues.set(projectId, next);
    } else {
      queues.delete(projectId);
    }
    tell(projectId, list(projectId));
  };

  /** Lines handed over and not read yet, each once, oldest first. */
  const lines = (projectId: string) => [
    ...new Set(
      of(projectId).flatMap(({ line }) => (line === undefined ? [] : [line])),
    ),
  ];

  return {
    list,
    lines,

    add: (projectId: string, message: IChatMessage) =>
      set(projectId, [...of(projectId), { id: randomUUID(), message }]),

    /**
     * One message taken back. Its line, when it had been handed over, is
     * answered so the caller can withdraw it from Claude Code; the line's
     * other messages wait again, to go with the next.
     */
    remove: (projectId: string, id: string): string | undefined => {
      const queue = of(projectId);
      const taken = queue.find((entry) => entry.id === id);
      if (!taken) {
        return undefined;
      }
      set(
        projectId,
        queue
          .filter((entry) => entry.id !== id)
          .map((entry) =>
            taken.line !== undefined && entry.line === taken.line
              ? { id: entry.id, message: entry.message }
              : entry,
          ),
      );
      return taken.line;
    },

    /** Whether Claude Code holds messages it has not read yet. */
    hasSent: (projectId: string) =>
      of(projectId).some(({ line }) => line !== undefined),

    /** Every waiting message, handed to Claude Code now in the line `line`. */
    send: (projectId: string, line: string): IChatMessage[] => {
      const queue = of(projectId);
      const waiting = queue.filter((entry) => entry.line === undefined);
      if (waiting.length > 0) {
        set(
          projectId,
          queue.map((entry) =>
            entry.line === undefined ? { ...entry, line } : entry,
          ),
        );
      }
      return waiting.map(({ message }) => message);
    },

    /**
     * Claude Code read the line `line`, holding the words `words`: everything
     * handed in that line leaves the queue, and so does anything handed in
     * another line whose words it holds - Claude Code reads several waiting
     * lines at a turn's start as one, under the first one's uuid. Whether
     * anything of the queue was read.
     */
    read: (
      projectId: string,
      line: string | undefined,
      words: readonly string[],
    ): boolean => {
      const queue = of(projectId);
      const held = new Set(words.map((word) => word.trim()));
      const read = (entry: IQueued) =>
        entry.line !== undefined &&
        (entry.line === line || held.has(entry.message.words.trim()));
      if (!queue.some(read)) {
        return false;
      }
      set(
        projectId,
        queue.filter((entry) => !read(entry)),
      );
      return true;
    },

    /** Claude Code will not read these lines (or any, without a list): they wait again. */
    unsend: (projectId: string, only?: readonly string[]) => {
      const queue = of(projectId);
      const back = (entry: IQueued) =>
        entry.line !== undefined &&
        (only === undefined || only.includes(entry.line));
      if (queue.some(back)) {
        set(
          projectId,
          queue.map((entry) =>
            back(entry) ? { id: entry.id, message: entry.message } : entry,
          ),
        );
      }
    },

    /** The waiting messages taken off, to go with the member's next message. */
    takeWaiting: (projectId: string): IChatMessage[] => {
      const queue = of(projectId);
      const waiting = queue.filter((entry) => entry.line === undefined);
      if (waiting.length > 0) {
        set(
          projectId,
          queue.filter((entry) => entry.line !== undefined),
        );
      }
      return waiting.map(({ message }) => message);
    },

    clear: (projectId: string) => {
      if (of(projectId).length > 0) {
        set(projectId, []);
      }
    },
  };
};

export type TChatQueue = ReturnType<typeof createChatQueue>;

export default createChatQueue;
