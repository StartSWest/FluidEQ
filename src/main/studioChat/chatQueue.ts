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
 * Read the way Claude Code reads its own (2026-10-16: "queue needs to work
 * as claude code so they are read faster not when the turn ends"): a message
 * waits here only until Claude's next step starts, is then handed to Claude
 * Code, and Claude reads it the moment that step returns, in the middle of
 * the reply (`chatTurns.ts`). Waiting, it can be taken back; handed over, it
 * is Claude's, and leaves the queue when Claude Code says it read it.
 *
 * Nothing here is lost to a stop (2026-10-16: "when I stoped I lossed the
 * queue"): a stop ends what Claude is doing and what waits goes on. A
 * failure keeps it waiting for the member's next press; Claude Code ending
 * before it read one puts that one back to wait.
 *
 * Held in memory only: a queue is the next few seconds or minutes of one
 * sitting.
 */

interface IQueued {
  id: string;
  message: IChatMessage;
  /** Handed to Claude Code, which has not said it read it yet. */
  sent: boolean;
}

const createChatQueue = (
  /** The window is told the queue's new state. */
  tell: (projectId: string, queued: IStudioChatQueued[]) => void,
) => {
  const queues = new Map<string, IQueued[]>();
  const of = (projectId: string) => queues.get(projectId) ?? [];

  const list = (projectId: string): IStudioChatQueued[] =>
    of(projectId).map(({ id, message, sent }) => ({
      id,
      text: message.words,
      picture: message.picture !== undefined,
      sent,
    }));

  const set = (projectId: string, next: IQueued[]) => {
    if (next.length > 0) {
      queues.set(projectId, next);
    } else {
      queues.delete(projectId);
    }
    tell(projectId, list(projectId));
  };

  return {
    list,

    add: (projectId: string, message: IChatMessage) =>
      set(projectId, [
        ...of(projectId),
        { id: randomUUID(), message, sent: false },
      ]),

    /** The member took one back before it was handed over. */
    remove: (projectId: string, id: string) => {
      const queue = of(projectId);
      if (queue.some((entry) => entry.id === id && !entry.sent)) {
        set(
          projectId,
          queue.filter((entry) => entry.id !== id),
        );
      }
    },

    /** Whether Claude Code holds messages it has not read yet. */
    hasSent: (projectId: string) => of(projectId).some((entry) => entry.sent),

    /** Every waiting message, handed to Claude Code now: their ids and words. */
    send: (projectId: string) => {
      const queue = of(projectId);
      const waiting = queue.filter((entry) => !entry.sent);
      if (waiting.length > 0) {
        set(
          projectId,
          queue.map((entry) => ({ ...entry, sent: true })),
        );
      }
      return {
        ids: waiting.map(({ id }) => id),
        messages: waiting.map(({ message }) => message),
      };
    },

    /** Claude Code read these: taken off the queue, to join the conversation. */
    read: (projectId: string, ids: readonly string[]): IChatMessage[] => {
      const queue = of(projectId);
      const taken = queue.filter((entry) => ids.includes(entry.id));
      if (taken.length > 0) {
        set(
          projectId,
          queue.filter((entry) => !ids.includes(entry.id)),
        );
      }
      return taken.map(({ message }) => message);
    },

    /** Claude Code ended without reading these: they wait again. */
    unsend: (projectId: string, ids: readonly string[]) => {
      const queue = of(projectId);
      if (queue.some((entry) => entry.sent && ids.includes(entry.id))) {
        set(
          projectId,
          queue.map((entry) =>
            ids.includes(entry.id) ? { ...entry, sent: false } : entry,
          ),
        );
      }
    },

    /** The waiting messages taken off, to go with the member's next message. */
    takeWaiting: (projectId: string): IChatMessage[] => {
      const queue = of(projectId);
      const waiting = queue.filter((entry) => !entry.sent);
      if (waiting.length > 0) {
        set(
          projectId,
          queue.filter((entry) => entry.sent),
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
