/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IChatSession } from './chatLaunch';
import type { TChatTurns } from './chatTurns';
import type { INoteMark } from './noteDue';

interface IChatRetireDeps {
  /** Each project's running Claude Code (`chatSessions.ts`). */
  sessions: Map<string, IChatSession>;
  turns: Pick<TChatTurns, 'isWorking'>;
  logger?: { info(message: string): void };
}

/**
 * The Studio's chats across a switch of Claude account (`accountSwitch.ts`).
 * A running Claude Code keeps the sign-in it started with, so a chat kept
 * running between messages went on answering, and spending, on the account
 * the member had just left - the one at its weekly limit, which is why he
 * switched (2026-11-28).
 *
 * At a switch every chat between replies ends at once, and its next message
 * starts a Claude Code on the account signed in now, on the same
 * conversation. A chat answering, or about to answer what it was handed, is
 * never cut off: it is marked `retiring`, is handed nothing more, and ends
 * at its reply's end (`retire`). Nothing queued is lost - what waits goes on
 * once the old process is gone (`goesOn`), unless the reply failed, which
 * keeps it waiting as any failure does.
 */
const createChatRetire = ({ sessions, turns, logger }: IChatRetireDeps) => {
  /**
   * A chat ended at the end of a reply that went well, until its process is
   * gone: only then is nothing more read from the old one's stream, and
   * nothing it held is put back to wait after what waits was sent on.
   */
  const continuing = new WeakSet<IChatSession>();
  /**
   * The scene as a retired chat's turns found it, for the next chat on the
   * same project: its update note is judged at that one's first good end,
   * as after any turn that ended with more to come.
   */
  const carried = new Map<string, INoteMark>();

  return {
    /** The member switched Claude accounts. */
    switched: () => {
      let now = 0;
      let later = 0;
      sessions.forEach((session, projectId) => {
        if (turns.isWorking(projectId, session)) {
          session.retiring = true;
          later += 1;
          return;
        }
        sessions.delete(projectId);
        session.process.end();
        now += 1;
      });
      if (now + later > 0) {
        logger?.info(
          `The Claude account changed: ${now} Studio chats end now, ${later} at the end of their reply.`,
        );
      }
    },

    /** A retiring chat's reply ended, well (`goOn`) or not: it ends. */
    retire: (projectId: string, session: IChatSession, goOn: boolean) => {
      if (sessions.get(projectId) === session) {
        sessions.delete(projectId);
      }
      if (session.noteMark) {
        carried.set(projectId, session.noteMark);
      }
      if (goOn) {
        continuing.add(session);
      }
      session.process.end();
    },

    /** A chat's process is gone: whether what waits for it goes on now. */
    goesOn: (session: IChatSession) => continuing.delete(session),

    /** The scene as a retired chat on this project left it, taken once. */
    takeMark: (projectId: string) => {
      const mark = carried.get(projectId);
      carried.delete(projectId);
      return mark;
    },
  };
};

export default createChatRetire;
