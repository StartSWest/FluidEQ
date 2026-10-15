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
 * When the reply in progress ends well, every message waiting goes at once,
 * as one turn (Ivan, 2026-10-14: "if I have 3 all at once so we save
 * tokens"): one answer reads the conversation once, where three would each
 * read it again and each be answered without the others. A reply that is stopped, fails or is cut short takes the queue
 * with it — the member pressed Stop, or the plan's limit or a sign-in would
 * refuse the next message the same way — and the window is told.
 *
 * Held in memory only: a queue is the next few seconds or minutes of one
 * sitting, and FluidEQ closing ends the reply it was waiting on anyway.
 */

interface IQueued {
  id: string;
  message: IChatMessage;
}

const createChatQueue = (
  /** The window is told the queue's new state. */
  tell: (projectId: string, queued: IStudioChatQueued[]) => void,
) => {
  const queues = new Map<string, IQueued[]>();

  const list = (projectId: string): IStudioChatQueued[] =>
    (queues.get(projectId) ?? []).map(({ id, message }) => ({
      id,
      text: message.words,
      picture: message.picture !== undefined,
    }));

  const changed = (projectId: string) => tell(projectId, list(projectId));

  return {
    list,

    add: (projectId: string, message: IChatMessage) => {
      queues.set(projectId, [
        ...(queues.get(projectId) ?? []),
        { id: randomUUID(), message },
      ]);
      changed(projectId);
    },

    /** The member took one back before it went. */
    remove: (projectId: string, id: string) => {
      const queue = queues.get(projectId) ?? [];
      if (queue.some((entry) => entry.id === id)) {
        queues.set(
          projectId,
          queue.filter((entry) => entry.id !== id),
        );
        changed(projectId);
      }
    },

    /** Every message waiting, oldest first, taken off the queue to go now. */
    takeAll: (projectId: string): IChatMessage[] => {
      const waiting = queues.get(projectId) ?? [];
      if (waiting.length > 0) {
        queues.delete(projectId);
        changed(projectId);
      }
      return waiting.map(({ message }) => message);
    },

    clear: (projectId: string) => {
      if ((queues.get(projectId) ?? []).length > 0) {
        queues.delete(projectId);
        changed(projectId);
      }
    },
  };
};

export default createChatQueue;
