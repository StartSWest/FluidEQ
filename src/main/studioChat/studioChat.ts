/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import path from 'path';
import type { ChildProcess } from 'child_process';
import type { BrowserWindow } from 'electron';
import {
  type IStudioChat,
  type TStudioChatEffort,
  type TStudioChatEntry,
  type TStudioChatFailure,
  type TStudioChatModel,
} from '../../common/studioChat';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IStudioLook } from '../studioAgent/studioTools';
import {
  launchClaudeCode,
  watchClaudeCode,
  type IChatSession,
} from './chatLaunch';
import {
  readChatMessage,
  readChatPicks,
  retryOf,
  type IChatMessage,
} from './chatMessage';
import { createChatPictures } from './chatPictures';
import createChatQueue from './chatQueue';
import createChatTurns from './chatTurns';
import createChatUsage, { usageRequestLine } from './chatUsage';
import createUsageRead from './chatUsageRead';
import createChatWindow from './chatWindow';
import registerChatHandlers from './chatHandlers';
import endProcessTree from './endProcessTree';
import { createPastChats } from './pastChats';
import { createTranscripts } from './chatTranscript';
import createTranscriptCache from './transcriptCache';
import { findClaudeCode, startClaudeCode, systemEnv } from './claudeCode';

/**
 * The Studio's chat (Ivan, 2026-10-09: "they connect their claude sub account
 * … and they can chat right there in the fluid to create vizualizers").
 *
 * What FluidEQ does, and what it will not, follow Anthropic's conditions for
 * a product running Claude Code (code.claude.com/docs/en/legal-and-compliance),
 * written out where Claude Code is started (`chatLaunch.ts`). Nothing runs
 * unless the member sent a message or pressed something: a reply is one
 * answer to one turn, and no loop asks Claude anything.
 *
 * One Claude Code process a project, kept for as long as the chat goes on, so
 * a second message is answered without starting anew; a process that ends
 * is started again on the next message with the session it was in.
 */

export interface IStudioChatDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null | undefined;
  /** The open project, as the door finds it: the member's own and usable. */
  agentProject(): TAgentProject;
  /** The agent door's look and hear, carried on the chat's own door. */
  door: IStudioLook;
  version: string;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const createStudioChat = ({
  userDataDir,
  getMainWindow,
  agentProject,
  door,
  version,
  logger,
}: IStudioChatDeps) => {
  const root = path.join(userDataDir, 'studio-chat');
  const transcripts = createTranscripts(root);
  const sessions = new Map<string, IChatSession>();
  const { transcriptOf, save, saveWith, unload } = createTranscriptCache(
    transcripts,
    logger,
  );
  const chatWindow = createChatWindow(getMainWindow);
  const { pageOf, fromWindow, handle } = chatWindow;

  /** Already aborted: what a project with no reply running is handed. */
  const nothingRunning = new AbortController();
  nothingRunning.abort();
  const pictures = createChatPictures({
    root,
    pageOf,
    fromWindow,
    project: agentProject,
    signalOf: (projectId) =>
      sessions.get(projectId)?.controller?.signal ?? nothingRunning.signal,
    door,
    version,
    ...(logger ? { logger } : {}),
  });

  const isBusy = (projectId: string) =>
    turns.isWorking(projectId, sessions.get(projectId));

  /** One entry changed: the window upserts it by id. */
  const tell = (projectId: string, entry: TStudioChatEntry) => {
    pageOf()?.send('studio-chat-entry', {
      projectId,
      entry,
      busy: isBusy(projectId),
    });
  };

  const usage = createChatUsage({
    root,
    contextOf: (projectId) => transcriptOf(projectId).context,
    setContext: (projectId, context) => {
      transcriptOf(projectId).context = context;
    },
    send: (channel, payload) => pageOf()?.send(channel, payload),
    ...(logger ? { logger } : {}),
  });

  // The plan's usage, asked of Claude Code: of a chat's own process when one
  // runs (`askUsage`), of one started for the question when none does.
  const usageRead = createUsageRead({
    executable: () => findClaudeCode(systemEnv()),
    start: (executable, args, cwd) =>
      startClaudeCode(executable, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      }),
    cwd: root,
    onUsage: (use) => usage.note(undefined, use),
  });
  const askUsage = (child: ChildProcess) => {
    child.stdin?.write(usageRequestLine());
  };

  const queue = createChatQueue((projectId, queued) =>
    pageOf()?.send('studio-chat-queue', { projectId, queued }),
  );

  const upsert = (projectId: string, entry: TStudioChatEntry) => {
    const transcript = transcriptOf(projectId);
    const at = transcript.entries.findIndex((known) => known.id === entry.id);
    if (at === -1) {
      transcript.entries.push(entry);
    } else {
      transcript.entries[at] = entry;
    }
    tell(projectId, entry);
  };

  const turns = createChatTurns({
    queue,
    upsert,
    tell,
    save,
    saveWith,
    versionsOf: transcripts.versionsOf,
    dropAsks: pictures.asks.drop,
  });

  const start = (
    projectId: string,
    folder: string,
    executable: string,
    brief: string,
    tools: { url: string; key: string } | undefined,
    model: TStudioChatModel,
    effort: TStudioChatEffort,
  ): IChatSession => {
    const child = launchClaudeCode({
      own: path.join(root, encodeURIComponent(projectId)),
      folder,
      executable,
      brief,
      tools,
      model,
      effort,
      sessionId: transcriptOf(projectId).sessionId,
    });
    const session: IChatSession = {
      child,
      folder,
      model,
      effort,
      stopping: false,
      sendingNow: false,
    };
    watchClaudeCode(
      child,
      (event) => {
        if (event.type === 'session') {
          const transcript = transcriptOf(projectId);
          if (transcript.sessionId !== event.sessionId) {
            transcript.sessionId = event.sessionId;
            save(projectId);
          }
          return;
        }
        turns.onEvent(projectId, session, event);
        // Each answer spent some of the plan: the card reads it again.
        if (event.type === 'end') {
          askUsage(child);
        }
        // A Claude Code that answered "signed out" holds the sign-in it
        // started with, and a sign-in renewed since does not reach it: it
        // ends, and the next message starts one that reads the sign-in
        // afresh (the head said "Max plan" over a reply saying signed out).
        if (event.type === 'end' && event.failure === 'signed-out') {
          endProcessTree(child);
        }
      },
      (use) => usage.note(projectId, use),
      (failure, errors) => {
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
    sessions.set(projectId, session);
    askUsage(child);
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
   * The project's Claude Code, running on the picks given: the one running
   * when they match, else a new one on the same conversation; undefined,
   * with the chat told, when Claude Code is not installed.
   */
  const sessionFor = async (
    projectId: string,
    folder: string,
    picks: Pick<IChatMessage, 'brief' | 'model' | 'effort'>,
  ): Promise<IChatSession | undefined> => {
    const executable = findClaudeCode(systemEnv());
    if (!executable) {
      failNow(projectId, 'missing');
      return undefined;
    }
    const running = sessions.get(projectId);
    // A model or an effort is fixed for a Claude Code process: a new pick
    // ends the one running and starts another on the same conversation.
    if (
      running &&
      running.model === picks.model &&
      running.effort === picks.effort
    ) {
      return running;
    }
    if (running) {
      sessions.delete(projectId);
      endProcessTree(running.child);
    }
    let tools: { url: string; key: string } | undefined;
    try {
      tools = await pictures.address();
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
  };

  /**
   * Messages to Claude, now, as one turn: each shown as the member wrote it,
   * then all written to Claude Code together, on the latest one's picks.
   */
  const dispatch = async (
    projectId: string,
    folder: string,
    messages: readonly IChatMessage[],
  ): Promise<void> => {
    const latest = messages[messages.length - 1];
    if (!latest) {
      return;
    }
    turns.show(projectId, messages);
    const session = await sessionFor(projectId, folder, latest);
    if (session) {
      turns.begin(projectId, session, messages);
    }
  };

  /**
   * Claude Code's own /compact: the conversation shrunk into a summary so
   * Claude can go on without running out of room. Shown as a reply with
   * one step, sized before and after, and nothing sent in the member's name.
   */
  const compact = async (raw: unknown): Promise<void> => {
    const project = agentProject();
    const picks = readChatPicks(raw);
    if (!project.ok || !picks || isBusy(project.id)) {
      return;
    }
    if (transcriptOf(project.id).entries.length === 0) {
      return;
    }
    const session = await sessionFor(project.id, project.folder, picks);
    if (session) {
      turns.begin(project.id, session, [{ words: '/compact' }]);
    }
  };

  /**
   * A message from the window: sent now, with anything a failure left
   * waiting, or queued for Claude to read at its next step.
   */
  const send = async (raw: unknown): Promise<void> => {
    const message = readChatMessage(raw);
    const project = agentProject();
    if (!message || !project.ok) {
      return;
    }
    if (isBusy(project.id)) {
      turns.queueMessage(project.id, message);
      return;
    }
    await dispatch(project.id, project.folder, [
      ...queue.takeWaiting(project.id),
      message,
    ]);
  };

  /**
   * The failed reply at the end of the chat answered again, in its place, on
   * the member's words before it (Ivan, 2026-10-16: "after signed in with
   * claude it needs to auto refresh"): signing in from the reply's card ends
   * here, so the message goes on its own rather than being typed again. On
   * a Claude Code started afresh, which reads the sign-in as it is now.
   */
  const retry = async (raw: unknown): Promise<void> => {
    const project = agentProject();
    const picks = readChatPicks(raw);
    if (!project.ok || !picks || isBusy(project.id)) {
      return;
    }
    const transcript = transcriptOf(project.id);
    const again = retryOf(transcript.entries);
    if (!again) {
      return;
    }
    const stale = sessions.get(project.id);
    if (stale) {
      sessions.delete(project.id);
      endProcessTree(stale.child);
    }
    const session = await sessionFor(project.id, project.folder, picks);
    if (!session) {
      return;
    }
    const at = transcript.entries.findIndex(({ id }) => id === again.replyId);
    if (at !== -1) {
      transcript.entries.splice(at, 1);
    }
    turns.begin(project.id, session, again.messages, again.replyId);
  };

  /**
   * Send now: with a reply running, Claude Code ends the step it is on and
   * reads what waits next (`chatTurns.ts`); with none, what waits goes as
   * a message of its own.
   */
  const sendNow = async (raw: unknown): Promise<void> => {
    const project = agentProject();
    const picks = readChatPicks(raw);
    if (!project.ok || !picks) {
      return;
    }
    const session = sessions.get(project.id);
    if (session && turns.sendNow(project.id, session)) {
      return;
    }
    if (isBusy(project.id)) {
      return;
    }
    const waiting = queue.takeWaiting(project.id);
    if (waiting.length > 0) {
      await dispatch(project.id, project.folder, waiting);
    }
  };

  const activeChat = (): IStudioChat | undefined => {
    const project = agentProject();
    if (!project.ok) {
      return undefined;
    }
    const { entries, context } = transcriptOf(project.id);
    // The reply being written joins the transcript only when it ends.
    const reply = sessions.get(project.id)?.reply;
    const ask = pictures.asks.standing(project.id);
    const queued = queue.list(project.id);
    return {
      projectId: project.id,
      entries: reply ? [...entries, { ...reply }] : entries,
      busy: isBusy(project.id),
      ...(ask ? { ask } : {}),
      ...(queued.length ? { queued } : {}),
      ...(context ? { context } : {}),
    };
  };

  /**
   * Another chat takes the open one's place: its Claude Code ended, so the
   * next message starts on the chat now open, and the copy in memory
   * dropped, so it is read from disk again.
   */
  const letGo = (projectId: string) => {
    const session = sessions.get(projectId);
    if (session) {
      sessions.delete(projectId);
      endProcessTree(session.child);
    }
    unload(projectId);
    pictures.asks.forget(projectId);
    queue.clear(projectId);
  };

  const past = createPastChats({
    root,
    transcripts,
    agentProject,
    fromWindow,
    isBusy,
    letGo,
    activeChat,
    ...(logger ? { logger } : {}),
  });

  registerChatHandlers({
    handle,
    agentProject,
    isBusy,
    activeChat,
    send,
    compact,
    retry,
    unqueue: (projectId, id) =>
      turns.unqueue(projectId, sessions.get(projectId), id),
    sendNow,
    stop: (projectId) => {
      const session = sessions.get(projectId);
      if (session) {
        turns.stop(projectId, session);
      }
    },
    entriesOf: (projectId) => transcriptOf(projectId).entries,
    versionsOf: transcripts.versionsOf,
    // The card shows the last reading at once and asks for a new one, which
    // reaches it as a report.
    limits: () => {
      const running = sessions.values().next().value;
      if (running) {
        askUsage(running.child);
      } else {
        usageRead.read();
      }
      return usage.limits();
    },
  });

  return {
    dispose: () => {
      chatWindow.dispose();
      usageRead.dispose();
      pictures.dispose().catch(() => undefined);
      past.dispose();
      // A reply FluidEQ's closing cuts short is kept as it stood, stopped,
      // with any version it had made, so the chat opens on it next time
      // and can carry on from there.
      sessions.forEach((session, projectId) => {
        session.stopping = true;
        turns.ended(projectId, session, 'crashed');
        endProcessTree(session.child);
      });
      sessions.clear();
    },
  };
};
