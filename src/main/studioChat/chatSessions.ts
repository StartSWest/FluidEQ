/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import path from 'path';
import type {
  TStudioChatEffort,
  TStudioChatEntry,
  TStudioChatFailure,
  TStudioChatModel,
} from '../../common/studioChat';
import {
  doorAt,
  keepSession,
  takeKeptSessions,
  takenUpEvents,
  writeKeptSessions,
} from './chatAdopt';
import {
  briefKey,
  claudeCodeCommand,
  claudeCodeEvents,
  type IChatSession,
} from './chatLaunch';
import type { IChatMessage } from './chatMessage';
import { answerPermission } from './chatPermission';
import type { TChatPictures } from './chatPictures';
import type { IChatAdoption, IChatLauncher, IChatProcess } from './chatProcess';
import type { TChatQueue } from './chatQueue';
import { takeChatQueues, writeChatQueues } from './chatQueueFile';
import type { TChatTurns } from './chatTurns';
import type { IChatTranscript } from './chatTranscript';
import { usageRequestLine, type TChatUsage } from './chatUsage';
import { findClaudeCode, systemEnv } from './claudeCode';

interface IChatSessionsDeps {
  root: string;
  /** Each project's running Claude Code, kept here and read by the chat. */
  sessions: Map<string, IChatSession>;
  launcher: IChatLauncher;
  transcriptOf(projectId: string): IChatTranscript;
  save(projectId: string): void;
  upsert(projectId: string, entry: TStudioChatEntry): void;
  turns: TChatTurns;
  queue: TChatQueue;
  pictures: TChatPictures;
  noteUsage(projectId: string, use: TChatUsage): void;
  /**
   * FluidEQ's agent skills as it ships them (`studioSkills.ts`): the plugin
   * folder Claude Code loads, and a hash of what they say.
   */
  skills?: () => { dir: string; digest: string } | undefined;
  /**
   * Whether Claude Code offers `model` to this account (`claudeModels.ts`):
   * a line it does not is started as `default`, as the picker says.
   */
  offered?: (model: TStudioChatModel) => boolean;
  logger?: { info(message: string): void; warn(message: string): void };
}

/**
 * Each project's running Claude Code: started on the picks given, followed
 * line by line into the chat, and - in development, where a change to
 * FluidEQ's own code restarts it - left running across the restart and
 * taken up again by the FluidEQ that follows (`chatRelayClient.ts`).
 */
const createChatSessions = ({
  root,
  sessions,
  launcher,
  transcriptOf,
  save,
  upsert,
  turns,
  queue,
  pictures,
  noteUsage,
  skills,
  offered,
  logger,
}: IChatSessionsDeps) => {
  /**
   * What a Claude Code process was started on, as one key: the brief this
   * FluidEQ wrote and the skills it ships. Either differing - FluidEQ
   * updated, or changed in development - starts the chat again on the same
   * conversation at its next message, which pays one cache rebuild; a
   * release that changes neither costs nothing, as the key is their text,
   * never the app's version.
   */
  const startedOn = (brief: string, digest = skills?.()?.digest ?? '') =>
    briefKey(`${brief}\u0000${digest}`);
  const keptFile = path.join(root, 'relay-sessions.json');
  const queueFile = path.join(root, 'queued.json');
  // What the member queued before FluidEQ last closed waits again now.
  takeChatQueues(queueFile).forEach((entries, projectId) =>
    queue.restore(projectId, entries),
  );

  /** The chat's own folder for a project, where its files are kept. */
  const ownOf = (projectId: string) =>
    path.join(root, encodeURIComponent(projectId));

  const askUsage = (process: IChatProcess) => {
    process.write(usageRequestLine());
  };

  /** What a project's Claude Code says, into its chat. */
  const follow = (projectId: string, sessionOf: () => IChatSession) =>
    claudeCodeEvents(
      (event) => {
        const session = sessionOf();
        if (event.type === 'session') {
          const transcript = transcriptOf(projectId);
          if (transcript.sessionId !== event.sessionId) {
            transcript.sessionId = event.sessionId;
            save(projectId);
          }
          return;
        }
        if (event.type === 'permission') {
          const answer = answerPermission(
            session.process,
            session.folder,
            event,
          );
          if (!answer.allowed) {
            logger?.warn(`The Studio refused ${event.tool}: ${event.detail}`);
          }
          return;
        }
        turns.onEvent(projectId, session, event);
        // Each answer spent some of the plan: the card reads it again.
        if (event.type === 'end') {
          askUsage(session.process);
        }
        // A Claude Code that answered "signed out" holds the sign-in it
        // started with, and a sign-in renewed since does not reach it: it
        // ends, and the next message starts one that reads the sign-in
        // afresh (the head said "Max plan" over a reply saying signed out).
        if (event.type === 'end' && event.failure === 'signed-out') {
          session.process.end();
        }
      },
      (use) => noteUsage(projectId, use),
      (failure, errors) => {
        const session = sessionOf();
        if (sessions.get(projectId) === session) {
          sessions.delete(projectId);
        }
        if (session.reply && !session.stopping) {
          logger?.warn(
            `Claude Code ended in the middle of a Studio reply: ${errors.trim().slice(-400)}`,
          );
        }
        turns.ended(projectId, session, failure);
      },
    );

  const start = (
    projectId: string,
    folder: string,
    executable: string,
    brief: string,
    tools: { url: string; key: string } | undefined,
    model: TStudioChatModel,
    effort: TStudioChatEffort,
  ): IChatSession => {
    const shipped = skills?.();
    const command = claudeCodeCommand({
      own: ownOf(projectId),
      folder,
      executable,
      brief,
      tools,
      model: offered && !offered(model) ? 'default' : model,
      effort,
      sessionId: transcriptOf(projectId).sessionId,
      ...(shipped ? { skills: shipped.dir } : {}),
    });
    // Its events reach the session only once it exists: a process reports
    // nothing from inside its own start.
    const session: IChatSession = {
      process: launcher.start(
        projectId,
        command,
        follow(projectId, () => session),
      ),
      folder,
      ...(tools ? { door: tools } : {}),
      model,
      effort,
      brief: startedOn(brief, shipped?.digest ?? ''),
      stopping: false,
      sendingNow: false,
    };
    sessions.set(projectId, session);
    askUsage(session.process);
    return session;
  };

  const failNow = (projectId: string, failure: TStudioChatFailure) => {
    upsert(projectId, {
      kind: 'claude',
      id: randomUUID(),
      text: '',
      steps: [],
      state: 'failed',
      failure,
    });
    save(projectId);
  };

  /**
   * A chat a FluidEQ before this one left running: its door opened again
   * where its Claude Code reaches it, its queue put back, the reply it was
   * writing opened again under its own id, and what it said meanwhile read
   * in. One that nothing was kept for (that FluidEQ crashed rather than
   * restarted) is ended: its reply reads as stopped, as after any crash.
   */
  const kept = takeKeptSessions(keptFile);
  const adopt = ({ child, process, attach }: IChatAdoption) => {
    const one = kept.get(child.id);
    kept.delete(child.id);
    if (!one) {
      process.end();
      return;
    }
    const { projectId, folder } = one;
    const transcript = transcriptOf(projectId);
    if (one.reply) {
      // It reads back from disk as stopped, at the last step it reached.
      const { id } = one.reply;
      transcript.entries = transcript.entries.filter(
        (entry) => entry.id !== id,
      );
    }
    const session: IChatSession = {
      process,
      folder,
      ...(one.door ? { door: one.door } : {}),
      model: one.model,
      effort: one.effort,
      // A chat kept by a FluidEQ before briefs were kept has none, which no
      // brief matches: its next message starts it again on the current one.
      brief: one.brief ?? '',
      stopping: one.stopping,
      sendingNow: one.sendingNow,
    };
    sessions.set(projectId, session);
    const at = one.door ? doorAt(one.door) : undefined;
    if (at) {
      pictures.address(projectId, folder, at).catch((error: unknown) => {
        logger?.warn(
          `The Studio chat's tools did not open again: ${String(error)}`,
        );
      });
    }
    if (one.reply) {
      turns.resume(projectId, session, one.reply.id);
      session.replyFrom = one.reply.from;
    }
    attach(
      takenUpEvents(
        follow(projectId, () => session),
        process.position,
        one,
      ),
    );
    logger?.info(`The Studio chat for ${projectId} went on across a restart.`);
  };
  // A line handed to a Claude Code nobody took up will never be read: its
  // messages wait again.
  const takenUp = launcher
    .takeUp(adopt)
    .catch(() => undefined)
    .then(() =>
      [...queue.all().keys()].forEach((projectId) => {
        if (!sessions.has(projectId)) {
          queue.unsend(projectId);
        }
      }),
    );

  return {
    askUsage,
    /**
     * Settled once every chat a FluidEQ before this one left running is
     * taken up: until then a project looks idle that is not.
     */
    ready: takenUp,

    /**
     * The project's Claude Code, running on the picks given: the one running
     * when they match, else a new one on the same conversation; undefined,
     * with the chat told, when Claude Code is not installed.
     */
    sessionFor: async (
      projectId: string,
      folder: string,
      picks: Pick<IChatMessage, 'brief' | 'model' | 'effort'>,
    ): Promise<IChatSession | undefined> => {
      // A chat left running by the FluidEQ before is this project's process.
      await takenUp;
      const executable = findClaudeCode(systemEnv());
      if (!executable) {
        failNow(projectId, 'missing');
        return undefined;
      }
      const running = sessions.get(projectId);
      // A model, an effort and a brief are fixed for a Claude Code process:
      // a new pick, or a newer brief - FluidEQ updated, or its brief changed
      // in development (Ivan, 2026-11-08: "make sure to update the latest AI
      // system prompt on all studio scenes") - ends the one running and
      // starts another on the same conversation, which loses nothing of it.
      if (
        running &&
        running.model === picks.model &&
        running.effort === picks.effort &&
        running.brief === startedOn(picks.brief)
      ) {
        return running;
      }
      if (running) {
        sessions.delete(projectId);
        running.process.end();
      }
      let tools: { url: string; key: string } | undefined;
      try {
        tools = await pictures.address(projectId, folder);
      } catch (error) {
        // Claude still answers; it cannot look, hear or make pictures.
        logger?.warn(`The Studio chat's tools did not open: ${String(error)}`);
      }
      return start(
        projectId,
        folder,
        executable,
        picks.brief,
        tools,
        picks.model,
        picks.effort,
      );
    },

    /** The project's Claude Code ended, when one runs. */
    end: (projectId: string) => {
      const session = sessions.get(projectId);
      if (session) {
        sessions.delete(projectId);
        session.process.end();
      }
    },

    /**
     * FluidEQ is going. Restarting for a change to its own code, every chat
     * is left running and what the next FluidEQ needs to take it up is
     * written down; really quitting, a reply cut short is kept as it stood,
     * stopped, with any version it had made, and every process ends.
     */
    dispose: () => {
      if (launcher.restarting()) {
        writeChatQueues(queueFile, queue.all());
        if (sessions.size > 0) {
          writeKeptSessions(
            keptFile,
            [...sessions].map(([projectId, session]) =>
              keepSession(projectId, session),
            ),
          );
        }
        sessions.clear();
        return;
      }
      sessions.forEach((session, projectId) => {
        session.stopping = true;
        turns.ended(projectId, session, 'crashed');
        session.process.end();
      });
      sessions.clear();
      launcher.close();
      // Every process ended above put back what it held unread.
      writeChatQueues(queueFile, queue.all());
    },
  };
};

export type TChatSessions = ReturnType<typeof createChatSessions>;

export default createChatSessions;
