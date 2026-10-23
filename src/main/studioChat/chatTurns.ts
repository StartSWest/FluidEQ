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
import { chatPictureFromBytes, chatPictureFromDataUrl } from './chatPicture';
import type { TChatQueue } from './chatQueue';
import type { TChatStreamEvent } from './chatStream';
import { keepReplyVersion } from './chatVersions';
import endProcessTree from './endProcessTree';
import withEvent from './replyEvents';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;
type TWords = Pick<IChatMessage, 'words' | 'picture'>;

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

/** One of Claude Code's own control requests, as a line of its input. */
const controlLine = (request: Record<string, unknown>) =>
  `${JSON.stringify({ type: 'control_request', request_id: randomUUID(), request })}\n`;

/**
 * A project's replies on its running Claude Code: how one begins, how a
 * message queued while it is written joins it, how it is stopped, sent past
 * and taken back, and how it ends.
 *
 * Every line written to Claude Code carries a uuid, which Claude Code echoes
 * when it reads the line (`--replay-user-messages`, measured 2026-10-18 on
 * 2.1.296): a queued line is matched by it, never by counting. Counting was
 * the first version, and it hung the chat: Claude Code reads several lines
 * waiting at a turn's start as ONE message under the first one's uuid
 * ("no dude WTF", "that suckjs" and "WTF" in one turn), so two of three
 * expected reads never came, the chat stayed busy with no reply running, and
 * Stop, which stopped only a reply, did nothing.
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
  const write = (session: IChatSession, line: string) => {
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
      return;
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
  };

  /**
   * Everything waiting, handed to Claude Code as one message, to read at its
   * next step. The line's uuid, or nothing when nothing waited.
   */
  const hand = (projectId: string, session: IChatSession) => {
    const line = randomUUID();
    const messages = queue.send(projectId, line);
    if (messages.length === 0) {
      return undefined;
    }
    write(session, userLine(line, ...messages));
    return line;
  };

  /** Claude Code read a line: when it was queued, it joins the chat there. */
  const read = (
    projectId: string,
    session: IChatSession,
    event: Extract<TChatStreamEvent, { type: 'read' }>,
  ) => {
    if (!queue.read(projectId, event.uuid, event.texts)) {
      return;
    }
    // The member's words land where Claude read them, as one message, in
    // the words Claude Code says it read; the reply so far ends there, and
    // what Claude does next is a reply of its own under them.
    close(projectId, session, 'done');
    const shown = event.picture
      ? chatPictureFromDataUrl(event.picture)
      : undefined;
    upsert(projectId, {
      kind: 'me',
      id: randomUUID(),
      text: event.texts.join('\n\n'),
      ...(shown ? { picture: shown } : {}),
    });
    open(projectId, session);
  };

  return {
    /** A reply begins on the member's words: shown working, then written. */
    begin: (
      projectId: string,
      session: IChatSession,
      messages: readonly TWords[],
      /** The failed reply this one takes the place of, by its id. */
      replacing?: string,
    ) => {
      open(projectId, session, replacing);
      write(session, userLine(randomUUID(), ...messages));
    },

    /** The member's messages as one, joining the conversation as written. */
    show: (projectId: string, messages: readonly TWords[]) => {
      const picture = messages.find((message) => message.picture)?.picture;
      const shown = picture ? chatPictureFromBytes(picture) : undefined;
      upsert(projectId, {
        kind: 'me',
        id: randomUUID(),
        text: messages.map(({ words }) => words).join('\n\n'),
        ...(shown ? { picture: shown } : {}),
      });
    },

    /** Whether Claude is answering, or about to answer what it was handed. */
    isWorking: (projectId: string, session: IChatSession | undefined) =>
      session?.reply !== undefined || queue.hasSent(projectId),

    /** A message sent while Claude answers: it waits for Claude's next step. */
    queueMessage: (projectId: string, message: IChatMessage) =>
      queue.add(projectId, message),

    /**
     * A queued message taken back: from the queue, and from Claude Code when
     * it had been handed over, which cancels its whole line - the line's
     * other messages wait again and go with the next.
     */
    unqueue: (
      projectId: string,
      session: IChatSession | undefined,
      id: string,
    ) => {
      const line = queue.remove(projectId, id);
      if (line !== undefined && session) {
        write(
          session,
          controlLine({ subtype: 'cancel_async_message', message_uuid: line }),
        );
      }
    },

    /**
     * Send now (Ivan, 2026-10-18: "I also need the send now that will send
     * it now"): what waits is handed over at once, and Claude Code's own
     * send-now ends the step Claude is on so the message is read next.
     * Whether there was a reply to cut short; without one the caller sends
     * what waits as a message of its own.
     */
    sendNow: (projectId: string, session: IChatSession) => {
      if (!session.reply) {
        return false;
      }
      const handed = queue.lines(projectId);
      const line = hand(projectId, session) ?? handed[handed.length - 1];
      if (line === undefined) {
        return true;
      }
      session.sendingNow = true;
      write(
        session,
        controlLine({
          subtype: 'interrupt',
          send_now: true,
          message_uuid: line,
        }),
      );
      return true;
    },

    /** One event of Claude Code's stream, into the reply it belongs to. */
    onEvent: (
      projectId: string,
      session: IChatSession,
      event: Exclude<TChatStreamEvent, { type: 'session' }>,
    ) => {
      if (event.type === 'read') {
        read(projectId, session, event);
        return;
      }
      const { reply } = session;
      if (!reply) {
        return;
      }
      if (event.type === 'end') {
        let state: 'done' | 'stopped' | 'failed' = 'done';
        if (session.stopping) {
          state = 'stopped';
        } else if (event.failure && !session.sendingNow) {
          state = 'failed';
        }
        session.stopping = false;
        session.sendingNow = false;
        close(projectId, session, state, event.failure);
        // Stopped or done, what waits goes on, read as Claude's next turn
        // (2026-10-16: "stop but read any pending message and continue with
        // those until user stop them"). A failure keeps it waiting: the
        // plan's limit or a sign-in would refuse it the same way.
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
      // A step began: what waits goes now, as one, read when it returns.
      if (event.type === 'step') {
        hand(projectId, session);
      }
    },

    /**
     * Stop. With a reply running, Claude Code ends the turn and keeps going,
     * so what waits is read next; pressed again before it has, the process
     * ends. With none running but lines handed over (Claude about to start
     * on them), they are withdrawn and wait again: Stop always does
     * something, and never leaves the chat busy with nothing to stop.
     */
    stop: (projectId: string, session: IChatSession) => {
      if (!session.reply) {
        const lines = queue.lines(projectId);
        lines.forEach((line) =>
          write(
            session,
            controlLine({
              subtype: 'cancel_async_message',
              message_uuid: line,
            }),
          ),
        );
        queue.unsend(projectId);
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
      write(session, controlLine({ subtype: 'interrupt' }));
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
      queue.unsend(projectId);
      const stopped = session.stopping;
      session.stopping = false;
      session.sendingNow = false;
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
