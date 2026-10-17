/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import type {
  TStudioChatEntry,
  TStudioChatFailure,
} from '../../common/studioChat';
import type { IChatSession } from './chatLaunch';
import { userLine, type IChatMessage } from './chatMessage';
import { chatPictureFromBytes } from './chatPicture';
import type { TChatQueue } from './chatQueue';
import type { TChatStreamEvent } from './chatStream';
import { keepReplyVersion } from './chatVersions';
import endProcessTree from './endProcessTree';
import withEvent from './replyEvents';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

interface IChatTurnsDeps {
  queue: TChatQueue;
  /** The entry put in the project's chat, and the window told. */
  upsert(projectId: string, entry: TStudioChatEntry): void;
  /** The window told of an entry that is not in the chat's file yet. */
  tell(projectId: string, entry: TStudioChatEntry): void;
  save(projectId: string): void;
  /** The chat saved with the reply being written in it, as far as it got. */
  saveWith(projectId: string, reply: TReply): void;
  versionsOf(projectId: string): string;
  /** A card waiting on the member, or a picture being made, ends. */
  dropAsks(projectId: string): void;
}

/** Claude Code's own way to stop a turn and keep the process (and its queue). */
const INTERRUPT = `${JSON.stringify({
  type: 'control_request',
  request_id: 'fluideq-stop',
  request: { subtype: 'interrupt' },
})}\n`;

/**
 * A project's replies on its running Claude Code: how one begins, how a
 * message queued while it is written joins it, how it is stopped, and how it
 * ends.
 *
 * A queued message is handed over when Claude starts a step, and Claude
 * reads it as that step returns (measured 2026-10-16: a line written while
 * a Read ran was read the moment its result came back, and answered in the
 * same reply). Claude Code says when it read each line; at that moment the
 * member's words join the conversation where Claude took them, and what
 * Claude says next is a reply of its own under them, as Claude Code itself
 * shows a message it took mid-turn.
 */
const createChatTurns = ({
  queue,
  upsert,
  tell,
  save,
  saveWith,
  versionsOf,
  dropAsks,
}: IChatTurnsDeps) => {
  const write = (session: IChatSession, line: string, ids: string[] = []) => {
    session.written.push(ids);
    session.child.stdin?.write(line);
  };

  /** A new reply, working, shown before Claude has said a word. */
  const open = (projectId: string, session: IChatSession, id?: string) => {
    session.reply = {
      kind: 'claude',
      id: id ?? randomUUID(),
      text: '',
      steps: [],
      state: 'working',
    };
    session.controller = new AbortController();
    tell(projectId, session.reply);
    saveWith(projectId, { ...session.reply });
  };

  /**
   * The reply being written closed as it stands, with the version it left;
   * nothing running is left running in it.
   */
  const close = (
    projectId: string,
    session: IChatSession,
    state: 'done' | 'stopped' | 'failed',
    failure?: TStudioChatFailure,
  ) => {
    const { reply } = session;
    if (!reply) {
      return undefined;
    }
    session.reply = undefined;
    session.controller?.abort();
    session.controller = undefined;
    dropAsks(projectId);
    const version = keepReplyVersion(
      reply,
      session.folder,
      versionsOf(projectId),
    );
    upsert(projectId, {
      ...reply,
      state,
      steps: reply.steps.map((step) =>
        step.state === 'running' ? { ...step, state: 'failed' } : step,
      ),
      ...(failure && state === 'failed' ? { failure } : {}),
      ...(version === undefined ? {} : { version }),
    });
    save(projectId);
    return state;
  };

  /** What waits in the queue, handed to Claude Code to read at its next step. */
  const hand = (projectId: string, session: IChatSession) => {
    const { ids, messages } = queue.send(projectId);
    if (messages.length > 0) {
      write(session, userLine(...messages), ids);
    }
  };

  /** The member's messages joining the conversation, as they were written. */
  const show = (projectId: string, messages: readonly IChatMessage[]) =>
    messages.forEach(({ words, picture }) => {
      const shown = picture ? chatPictureFromBytes(picture) : undefined;
      upsert(projectId, {
        kind: 'me',
        id: randomUUID(),
        text: words,
        ...(shown ? { picture: shown } : {}),
      });
    });

  /** Claude Code read the oldest line it had not read yet. */
  const read = (projectId: string, session: IChatSession) => {
    const ids = session.written.shift() ?? [];
    const messages = ids.length > 0 ? queue.read(projectId, ids) : [];
    if (messages.length === 0) {
      return;
    }
    close(projectId, session, 'done');
    show(projectId, messages);
    open(projectId, session);
  };

  return {
    /** A reply begins on the member's words: shown working, then written. */
    begin: (
      projectId: string,
      session: IChatSession,
      line: string,
      /** The failed reply this one takes the place of, by its id. */
      replacing?: string,
    ) => {
      open(projectId, session, replacing);
      write(session, line);
    },

    show,

    /** Whether Claude is answering, or about to answer what it was handed. */
    isWorking: (projectId: string, session: IChatSession | undefined) =>
      session?.reply !== undefined || queue.hasSent(projectId),

    /** A message sent while Claude answers: queued, and handed over at once if a step is running. */
    queueMessage: (
      projectId: string,
      session: IChatSession | undefined,
      message: IChatMessage,
    ) => {
      queue.add(projectId, message);
      if (session?.reply?.steps.some((step) => step.state === 'running')) {
        hand(projectId, session);
      }
    },

    /** One event of Claude Code's stream, into the reply it belongs to. */
    onEvent: (
      projectId: string,
      session: IChatSession,
      event: Exclude<TChatStreamEvent, { type: 'session' }>,
    ) => {
      if (event.type === 'read') {
        read(projectId, session);
        return;
      }
      const { reply } = session;
      if (!reply) {
        return;
      }
      if (event.type === 'end') {
        const stopped = session.stopping;
        session.stopping = false;
        let state: 'done' | 'stopped' | 'failed' = 'done';
        if (stopped) {
          state = 'stopped';
        } else if (event.failure) {
          state = 'failed';
        }
        close(projectId, session, state, event.failure);
        // Stopped or done, what waits goes on, read as Claude's next turn
        // (Ivan, 2026-10-16: "stop but read any pending message and
        // continue with those until user stop them"). A failure keeps it
        // waiting: the plan's limit or a sign-in would refuse it the same way.
        if (state !== 'failed') {
          hand(projectId, session);
        }
        return;
      }
      session.reply = withEvent(reply, event);
      if (event.type !== 'text') {
        saveWith(projectId, { ...session.reply });
      }
      tell(projectId, { ...session.reply });
      // A step began: whatever waits is read the moment it returns.
      if (event.type === 'step') {
        hand(projectId, session);
      }
    },

    /**
     * Stop: Claude Code ends the turn and keeps going, so what waits is read
     * next. Pressed again before it has, the process ends: a Claude Code that
     * does not answer its own stop is not left running.
     */
    stop: (projectId: string, session: IChatSession) => {
      if (!session.reply) {
        return;
      }
      if (session.stopping) {
        endProcessTree(session.child);
        return;
      }
      session.stopping = true;
      // A picture being made, or a card waiting on the member, ends with it.
      session.controller?.abort();
      dropAsks(projectId);
      session.child.stdin?.write(INTERRUPT);
    },

    /**
     * The process ended: the reply it was writing closed (stopped, when the
     * chat ended it), and what it was handed and never read waits again.
     */
    ended: (
      projectId: string,
      session: IChatSession,
      failure: TStudioChatFailure,
    ) => {
      const unread = session.written.flat();
      session.written = [];
      if (unread.length > 0) {
        queue.unsend(projectId, unread);
      }
      const stopped = session.stopping;
      session.stopping = false;
      close(
        projectId,
        session,
        stopped ? 'stopped' : 'failed',
        stopped ? undefined : failure,
      );
    },
  };
};

export type TChatTurns = ReturnType<typeof createChatTurns>;

export default createChatTurns;
