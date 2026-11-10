/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import type { BrowserWindow } from 'electron';
import {
  isStudioChatModelOffered,
  type IStudioChat,
  type TStudioChatEntry,
} from '../../common/studioChat';
import { createChatTargets, type IChatTarget } from './chatTargets';
import removeAnimatorChats from './oldAnimatorChats';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IStudioLook } from '../studioAgent/studioTools';
import {
  readChatMessage,
  readChatPicks,
  retryOf,
  type IChatMessage,
} from './chatMessage';
import createChatDrafts from './chatDraft';
import type { IChatSession } from './chatLaunch';
import { createChatPictures } from './chatPictures';
import type { IChatLauncher } from './chatProcess';
import createChatQueue from './chatQueue';
import createChatSessions from './chatSessions';
import createChatTurns from './chatTurns';
import createChatUsage from './chatUsage';
import createUsageRead from './chatUsageRead';
import createChatWindow from './chatWindow';
import registerChatHandlers from './chatHandlers';
import { createPastChats } from './pastChats';
import { createTranscripts } from './chatTranscript';
import createTranscriptCache from './transcriptCache';
import { findClaudeCode, startClaudeCode, systemEnv } from './claudeCode';
import { createClaudeModels } from './claudeModels';
import {
  readShippedSkills,
  removeOldChatPlugin,
  shippedPluginDir,
  skillsDigest,
} from './studioSkills';

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
 * is started again on the next message with the session it was in
 * (`chatSessions.ts`).
 */

export interface IStudioChatDeps {
  userDataDir: string;
  getMainWindow: () => BrowserWindow | null | undefined;
  /** The open project, as the door finds it: the member's own and usable. */
  agentProject(folder?: string): TAgentProject;
  /** The agent door's look and hear, carried on the chat's own door. */
  door: IStudioLook;
  version: string;
  /** How its Claude Code is started (`chatProcess.ts`). */
  launcher: IChatLauncher;
  /** A reply finished, however it finished: its project's files may have changed. */
  onReplyEnded?: (projectId: string) => void;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const createStudioChat = ({
  userDataDir,
  getMainWindow,
  agentProject,
  door,
  version,
  launcher,
  onReplyEnded,
  logger,
}: IStudioChatDeps) => {
  const root = path.join(userDataDir, 'studio-chat');
  // What Claude Code offers, asked once in this run of the app.
  const claudeModels = createClaudeModels({ dir: root, logger });
  const transcripts = createTranscripts(root);
  const { transcriptOf, save, saveWith, unload } = createTranscriptCache(
    transcripts,
    logger,
  );
  const chatWindow = createChatWindow(getMainWindow);
  const { pageOf, fromWindow, handle } = chatWindow;
  // The message being written, kept per project until it is sent.
  createChatDrafts({ root, handle });

  /** Already aborted: what a project with no reply running is handed. */
  const nothingRunning = new AbortController();
  nothingRunning.abort();
  // Each project's running Claude Code (`chatSessions.ts`).
  const sessions = new Map<string, IChatSession>();
  const pictures = createChatPictures({
    root,
    pageOf,
    fromWindow,
    projectAt: (folder) => agentProject(folder),
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
    if (entry.kind === 'claude' && entry.state !== 'working') {
      onReplyEnded?.(projectId);
    }
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
    entriesOf: (projectId) => transcriptOf(projectId).entries,
    dropAsks: pictures.asks.drop,
  });

  // The copy of the skills the first version kept here: the chat loads
  // them from what FluidEQ ships now.
  try {
    removeOldChatPlugin(root);
  } catch (error) {
    logger?.warn(
      `The Studio chat's old copy of FluidEQ's skills was not removed: ${String(error)}`,
    );
  }
  // The animations' own chats are gone (Ivan, 2026-11-10: "remove that
  // second chat"); what they left on disk goes with them, once.
  try {
    removeAnimatorChats(
      root,
      (folderName) =>
        transcripts.read(decodeURIComponent(folderName)).sessionId,
    );
  } catch (error) {
    logger?.warn(
      `The Studio's old animator chats were not all removed: ${String(error)}`,
    );
  }

  const chatSessions = createChatSessions({
    root,
    offered: (model) => isStudioChatModelOffered(claudeModels.known(), model),
    sessions,
    launcher,
    transcriptOf,
    save,
    upsert,
    turns,
    queue,
    pictures,
    noteUsage: (projectId, use) => usage.note(projectId, use),
    skills: () => {
      const dir = shippedPluginDir();
      try {
        const shipped = readShippedSkills(dir);
        return shipped.length > 0
          ? { dir, digest: skillsDigest(shipped) }
          : undefined;
      } catch (error) {
        logger?.warn(
          `FluidEQ's agent skills could not be read for the chat: ${String(error)}`,
        );
        return undefined;
      }
    },
    ...(logger ? { logger } : {}),
  });
  const { sessionFor, askUsage } = chatSessions;

  const { sceneChat } = createChatTargets(agentProject);

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
  const compact = async (
    chat: IChatTarget | undefined,
    raw: unknown,
  ): Promise<void> => {
    await chatSessions.ready;
    const picks = readChatPicks(raw);
    if (!chat || !picks || isBusy(chat.key)) {
      return;
    }
    if (transcriptOf(chat.key).entries.length === 0) {
      return;
    }
    const session = await sessionFor(chat.key, chat.folder, picks);
    if (session) {
      turns.begin(chat.key, session, [{ words: '/compact' }]);
    }
  };

  /**
   * A message from the window: sent now, with anything a failure left
   * waiting, or queued for Claude to read at its next step.
   */
  const send = async (
    chat: IChatTarget | undefined,
    raw: unknown,
  ): Promise<void> => {
    // A chat still being taken up after a restart is busy, and a message
    // to it waits in its queue like any other.
    await chatSessions.ready;
    const message = readChatMessage(raw);
    if (!message || !chat) {
      return;
    }
    if (isBusy(chat.key)) {
      turns.queueMessage(chat.key, message);
      return;
    }
    await dispatch(chat.key, chat.folder, [
      ...queue.takeWaiting(chat.key),
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
  const retry = async (
    chat: IChatTarget | undefined,
    raw: unknown,
  ): Promise<void> => {
    await chatSessions.ready;
    const picks = readChatPicks(raw);
    if (!chat || !picks || isBusy(chat.key)) {
      return;
    }
    const transcript = transcriptOf(chat.key);
    const again = retryOf(transcript.entries);
    if (!again) {
      return;
    }
    chatSessions.end(chat.key);
    const session = await sessionFor(chat.key, chat.folder, picks);
    if (!session) {
      return;
    }
    const at = transcript.entries.findIndex(({ id }) => id === again.replyId);
    if (at !== -1) {
      transcript.entries.splice(at, 1);
    }
    turns.begin(chat.key, session, again.messages, again.replyId);
  };

  /**
   * Send now: with a reply running, Claude Code ends the step it is on and
   * reads what waits next (`chatTurns.ts`); with none, what waits goes as
   * a message of its own.
   */
  const sendNow = async (
    chat: IChatTarget | undefined,
    raw: unknown,
  ): Promise<void> => {
    await chatSessions.ready;
    const picks = readChatPicks(raw);
    if (!chat || !picks) {
      return;
    }
    const session = sessions.get(chat.key);
    if (session && turns.sendNow(chat.key, session)) {
      return;
    }
    if (isBusy(chat.key)) {
      return;
    }
    const waiting = queue.takeWaiting(chat.key);
    if (waiting.length > 0) {
      await dispatch(chat.key, chat.folder, waiting);
    }
  };

  /** A chat as the window shows it; its `projectId` is the chat's key. */
  const chatOf = (chat: IChatTarget | undefined): IStudioChat | undefined => {
    if (!chat) {
      return undefined;
    }
    const { entries, context } = transcriptOf(chat.key);
    // The reply being written joins the transcript only when it ends.
    const reply = sessions.get(chat.key)?.reply;
    const ask = pictures.asks.standing(chat.key);
    const queued = queue.list(chat.key);
    return {
      projectId: chat.key,
      entries: reply ? [...entries, { ...reply }] : entries,
      busy: isBusy(chat.key),
      ...(ask ? { ask } : {}),
      ...(queued.length ? { queued } : {}),
      ...(context ? { context } : {}),
    };
  };
  const activeChat = () => chatOf(sceneChat());

  /**
   * Another chat takes the open one's place: its Claude Code ended, so the
   * next message starts on the chat now open, and the copy in memory
   * dropped, so it is read from disk again.
   */
  const letGo = (projectId: string) => {
    chatSessions.end(projectId);
    unload(projectId);
    pictures.asks.forget(projectId);
    pictures.close(projectId).catch(() => undefined);
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
    models: claudeModels.list,
    agentProject,
    isBusy,
    activeChat,
    send: (raw) => send(sceneChat(), raw),
    compact: (raw) => compact(sceneChat(), raw),
    retry: (raw) => retry(sceneChat(), raw),
    unqueue: (projectId, id) =>
      turns.unqueue(projectId, sessions.get(projectId), id),
    sendNow: (raw) => sendNow(sceneChat(), raw),
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
        askUsage(running.process);
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
      chatSessions.dispose();
    },
  };
};
