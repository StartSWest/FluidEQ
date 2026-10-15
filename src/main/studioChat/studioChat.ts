/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { randomUUID } from 'crypto';
import path from 'path';
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
import { chatPictureFromBytes } from './chatPicture';
import {
  launchClaudeCode,
  watchClaudeCode,
  type IChatSession,
} from './chatLaunch';
import {
  readChatMessage,
  readChatPicks,
  userLine,
  type IChatMessage,
} from './chatMessage';
import { createChatPictures } from './chatPictures';
import createChatQueue from './chatQueue';
import createChatUsage from './chatUsage';
import createChatWindow from './chatWindow';
import registerChatHandlers from './chatHandlers';
import endProcessTree from './endProcessTree';
import { createPastChats } from './pastChats';
import { keepReplyVersion } from './chatVersions';
import { createTranscripts } from './chatTranscript';
import withEvent from './replyEvents';
import createTranscriptCache from './transcriptCache';
import { findClaudeCode, systemEnv } from './claudeCode';

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
    sessions.get(projectId)?.reply !== undefined;

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

  /** A reply's end: its state, the version it left, and the chat saved. */
  const finish = (
    projectId: string,
    folder: string,
    session: IChatSession,
    failure?: TStudioChatFailure,
  ) => {
    const { reply } = session;
    if (!reply) {
      return;
    }
    session.reply = undefined;
    session.controller?.abort();
    session.controller = undefined;
    pictures.asks.drop(projectId);
    const version = keepReplyVersion(
      reply,
      folder,
      transcripts.versionsOf(projectId),
    );
    let state: 'done' | 'stopped' | 'failed' = 'done';
    if (session.stopping) {
      state = 'stopped';
    } else if (failure) {
      state = 'failed';
    }
    upsert(projectId, {
      ...reply,
      state,
      steps: reply.steps.map((step) =>
        step.state === 'running' ? { ...step, state: 'failed' } : step,
      ),
      ...(failure && state === 'failed' ? { failure } : {}),
      ...(version === undefined ? {} : { version }),
    });
    session.stopping = false;
    save(projectId);
    // What was queued goes, all as one turn, once this reply has ended well;
    // a stop or a failure takes the queue with it (`chatQueue.ts`).
    if (state !== 'done') {
      queue.clear(projectId);
      return;
    }
    const waiting = queue.takeAll(projectId);
    if (waiting.length > 0) {
      dispatch(projectId, folder, waiting).catch((error: unknown) =>
        logger?.warn(`A queued Studio message did not go: ${String(error)}`),
      );
    }
  };

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
    };
    watchClaudeCode(
      child,
      (event) => {
        const { reply } = session;
        if (event.type === 'session') {
          const transcript = transcriptOf(projectId);
          if (transcript.sessionId !== event.sessionId) {
            transcript.sessionId = event.sessionId;
            save(projectId);
          }
          return;
        }
        if (!reply) {
          return;
        }
        if (event.type === 'end') {
          finish(projectId, folder, session, event.failure);
          return;
        }
        session.reply = withEvent(reply, event);
        if (event.type !== 'text') {
          saveWith(projectId, { ...session.reply });
        }
        tell(projectId, { ...session.reply });
      },
      (use) => usage.note(projectId, use),
      (failure, errors) => {
        if (sessions.get(projectId) === session) {
          sessions.delete(projectId);
        }
        if (session.reply) {
          if (!session.stopping) {
            logger?.warn(
              `Claude Code ended in the middle of a Studio reply: ${errors.trim().slice(-400)}`,
            );
          }
          finish(projectId, folder, session, failure);
        }
      },
    );
    sessions.set(projectId, session);
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

  /** A reply begins: the chat shows it working, then Claude Code is written to. */
  const begin = (projectId: string, session: IChatSession, line: string) => {
    session.reply = {
      kind: 'claude',
      id: randomUUID(),
      text: '',
      steps: [],
      state: 'working',
    };
    session.controller = new AbortController();
    tell(projectId, session.reply);
    session.child.stdin?.write(line);
    saveWith(projectId, { ...session.reply });
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
    messages.forEach(({ words, picture }) => {
      const shown = picture ? chatPictureFromBytes(picture) : undefined;
      upsert(projectId, {
        kind: 'me',
        id: randomUUID(),
        text: words,
        ...(shown ? { picture: shown } : {}),
      });
    });
    const session = await sessionFor(projectId, folder, latest);
    if (session) {
      begin(projectId, session, userLine(...messages));
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
      begin(project.id, session, userLine({ ...picks, words: '/compact' }));
    }
  };

  /** A message from the window: sent now, or queued behind the reply being written. */
  const send = async (raw: unknown): Promise<void> => {
    const message = readChatMessage(raw);
    const project = agentProject();
    if (!message || !project.ok) {
      return;
    }
    if (isBusy(project.id)) {
      queue.add(project.id, message);
      return;
    }
    await dispatch(project.id, project.folder, [message]);
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
      busy: reply !== undefined,
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
    sessions,
    isBusy,
    activeChat,
    send,
    compact,
    unqueue: queue.remove,
    dropAsks: pictures.asks.drop,
    entriesOf: (projectId) => transcriptOf(projectId).entries,
    versionsOf: transcripts.versionsOf,
    limits: usage.limits,
  });

  return {
    dispose: () => {
      chatWindow.dispose();
      pictures.dispose().catch(() => undefined);
      past.dispose();
      // A reply FluidEQ's closing cuts short is kept as it stood, stopped,
      // with any version it had made, so the chat opens on it next time
      // and can carry on from there.
      sessions.forEach((session, projectId) => {
        session.stopping = true;
        finish(projectId, session.folder, session);
        endProcessTree(session.child);
      });
      sessions.clear();
    },
  };
};
