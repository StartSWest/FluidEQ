/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import {
  isStudioChatEffort,
  isStudioChatModel,
  STUDIO_CHAT_MAX_TEXT,
  type IStudioChat,
  type IStudioChatMessage,
  type TStudioChatEffort,
  type TStudioChatEntry,
  type TStudioChatFailure,
  type TStudioChatModel,
  type TStudioChatRestore,
} from '../../common/studioChat';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IStudioLook } from '../studioAgent/studioTools';
import { chatPictureFromBytes } from './chatPicture';
import { launchClaudeCode } from './chatLaunch';
import { createChatPictures } from './chatPictures';
import endProcessTree from './endProcessTree';
import { createPastChats } from './pastChats';
import { createLineReader, readStreamLine } from './chatStream';
import { bringBackVersion, keepVersion, projectVersion } from './chatVersions';
import { createTranscripts } from './chatTranscript';
import withEvent from './replyEvents';
import createTranscriptCache from './transcriptCache';
import {
  claudeCodeAvailability,
  findClaudeCode,
  signInToClaudeCode,
  systemEnv,
} from './claudeCode';

/**
 * The Studio's chat (Ivan, 2026-10-09: "they connect their claude sub account
 * … and they can chat right there in the fluid to create vizualizers").
 *
 * What FluidEQ does, and what it will not, follow Anthropic's conditions for
 * a product running Claude Code (code.claude.com/docs/en/legal-and-compliance):
 *
 * - It runs the member's own Claude Code, unmodified, as installed, signed in
 *   by the member through Claude Code's own sign-in. It never reads, keeps or
 *   sends that sign-in, and pays for or meters nothing: the use is the
 *   member's own plan's.
 * - Nothing runs unless the member sent a message or pressed something. A
 *   reply is one answer to one message; no loop asks Claude anything.
 * - Claude works in the open project's folder and nowhere else: its tools are
 *   reading, searching and writing files there (`--permission-mode dontAsk`
 *   refuses everything else without asking), and FluidEQ's tools on the
 *   chat's own door (`chatServer.ts`): look at and hear the scene, and make
 *   pictures with the member's ChatGPT, which asks the member every time
 *   (`chatPictures.ts`).
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

interface ISession {
  child: ChildProcess;
  folder: string;
  /** What it was started with: a different pick starts it again. */
  model: TStudioChatModel;
  effort: TStudioChatEffort;
  /** The reply being written, when one is. */
  reply?: Extract<TStudioChatEntry, { kind: 'claude' }>;
  /** Aborted when that reply ends or is stopped: what it started ends too. */
  controller?: AbortController;
  stopping: boolean;
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
  const sessions = new Map<string, ISession>();
  const { transcriptOf, save, saveWith, unload } = createTranscriptCache(
    transcripts,
    logger,
  );
  const pageOf = () => {
    const window = getMainWindow();
    return window && !window.isDestroyed() ? window.webContents : undefined;
  };
  /** Only the app's own window may drive the chat, never another page. */
  const fromWindow = (event: IpcMainInvokeEvent) => pageOf() === event.sender;

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
    session: ISession,
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
    const wrote = reply.steps.some(
      (step) =>
        (step.kind === 'write' || step.kind === 'pack') &&
        step.state === 'done',
    );
    let version: number | undefined;
    if (wrote) {
      const kept = keepVersion(
        folder,
        path.join(transcripts.versionsOf(projectId), reply.id),
      );
      version = kept ? projectVersion(folder) : undefined;
    }
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
  };

  const start = (
    projectId: string,
    folder: string,
    executable: string,
    brief: string,
    tools: { url: string; key: string } | undefined,
    model: TStudioChatModel,
    effort: TStudioChatEffort,
  ): ISession => {
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
    const session: ISession = {
      child,
      folder,
      model,
      effort,
      stopping: false,
    };
    let errors = '';

    const reader = createLineReader((line) => {
      readStreamLine(line).forEach((event) => {
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
      });
    });
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => reader.push(chunk));
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      errors = `${errors}${chunk}`.slice(-2000);
    });
    const ended = (failure: TStudioChatFailure) => {
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
    };
    child.on('error', () => ended('missing'));
    child.on('close', () => ended('crashed'));
    // A write to a process that has just ended is reported here, and its
    // close follows; the reply is finished there.
    child.stdin?.on('error', () => undefined);
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

  const send = async (raw: unknown): Promise<void> => {
    if (typeof raw !== 'object' || raw === null) {
      return;
    }
    const { text, stage, brief, model, effort } =
      raw as Partial<IStudioChatMessage>;
    const pickedModel = isStudioChatModel(model) ? model : 'default';
    const pickedEffort = isStudioChatEffort(effort) ? effort : 'default';
    const words = typeof text === 'string' ? text.trim() : '';
    if (
      !words ||
      words.length > STUDIO_CHAT_MAX_TEXT ||
      typeof brief !== 'string'
    ) {
      return;
    }
    const project = agentProject();
    if (!project.ok) {
      return;
    }
    const { id: projectId, folder } = project;
    if (isBusy(projectId)) {
      return;
    }
    const picture =
      stage instanceof Uint8Array && stage.byteLength > 0 ? stage : undefined;
    const shown = picture ? chatPictureFromBytes(picture) : undefined;
    upsert(projectId, {
      kind: 'me',
      id: randomUUID(),
      text: words,
      ...(shown ? { picture: shown } : {}),
    });
    const executable = findClaudeCode(systemEnv());
    if (!executable) {
      failNow(projectId, 'missing');
      return;
    }
    let session = sessions.get(projectId);
    // A model or an effort is fixed for a Claude Code process: a new pick
    // ends the one running and starts another on the same conversation.
    if (
      session &&
      (session.model !== pickedModel || session.effort !== pickedEffort)
    ) {
      sessions.delete(projectId);
      endProcessTree(session.child);
      session = undefined;
    }
    if (!session) {
      let tools: { url: string; key: string } | undefined;
      try {
        tools = await pictures.address();
      } catch (error) {
        // Claude still answers; it cannot look, hear or make pictures.
        logger?.warn(`The Studio chat's tools did not open: ${String(error)}`);
      }
      session = start(
        projectId,
        folder,
        executable,
        brief,
        tools,
        pickedModel,
        pickedEffort,
      );
    }
    session.reply = {
      kind: 'claude',
      id: randomUUID(),
      text: '',
      steps: [],
      state: 'working',
    };
    session.controller = new AbortController();
    tell(projectId, session.reply);
    const content = [
      ...(picture
        ? [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: Buffer.from(picture).toString('base64'),
              },
            },
          ]
        : []),
      { type: 'text', text: words },
    ];
    session.child.stdin?.write(
      `${JSON.stringify({ type: 'user', message: { role: 'user', content } })}\n`,
    );
    saveWith(projectId, { ...session.reply });
  };

  const activeChat = (): IStudioChat | undefined => {
    const project = agentProject();
    if (!project.ok) {
      return undefined;
    }
    const { entries } = transcriptOf(project.id);
    // The reply being written joins the transcript only when it ends.
    const reply = sessions.get(project.id)?.reply;
    const ask = pictures.asks.standing(project.id);
    return {
      projectId: project.id,
      entries: reply ? [...entries, { ...reply }] : entries,
      busy: reply !== undefined,
      ...(ask ? { ask } : {}),
    };
  };

  ipcMain.handle('studio-chat-availability', (event) =>
    fromWindow(event) ? claudeCodeAvailability() : { state: 'missing' },
  );

  ipcMain.handle('studio-chat-sign-in', async (event) => {
    if (!fromWindow(event)) {
      return { state: 'missing' };
    }
    await signInToClaudeCode();
    return claudeCodeAvailability();
  });

  ipcMain.handle('studio-chat-load', (event) =>
    fromWindow(event) ? activeChat() : undefined,
  );

  ipcMain.handle('studio-chat-send', (event, message: unknown) =>
    fromWindow(event) ? send(message) : undefined,
  );

  ipcMain.handle('studio-chat-stop', (event) => {
    const project = agentProject();
    const session = project.ok ? sessions.get(project.id) : undefined;
    if (fromWindow(event) && project.ok && session?.reply) {
      session.stopping = true;
      // A picture being made, or a card waiting on the member, ends with it.
      session.controller?.abort();
      pictures.asks.drop(project.id);
      endProcessTree(session.child);
    }
  });

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

  // A new chat moves the open one aside, never erases it (`pastChats.ts`).
  ipcMain.handle('studio-chat-new', (event) => {
    const project = agentProject();
    if (!fromWindow(event) || !project.ok || isBusy(project.id)) {
      return activeChat();
    }
    letGo(project.id);
    try {
      past.putAside(project.id);
    } catch (error) {
      logger?.warn(
        `The Studio's chat could not be put aside: ${String(error)}`,
      );
    }
    return activeChat();
  });

  ipcMain.handle(
    'studio-chat-restore',
    (event, entryId: unknown): TStudioChatRestore => {
      const project = agentProject();
      if (!fromWindow(event) || !project.ok) {
        return { ok: false, reason: 'no-project' };
      }
      if (isBusy(project.id)) {
        return { ok: false, reason: 'busy' };
      }
      const known = transcriptOf(project.id).entries.some(
        (entry) =>
          entry.id === entryId &&
          entry.kind === 'claude' &&
          entry.version !== undefined,
      );
      if (!known || typeof entryId !== 'string') {
        return { ok: false, reason: 'gone' };
      }
      return bringBackVersion(
        path.join(transcripts.versionsOf(project.id), entryId),
        project.folder,
      )
        ? { ok: true }
        : { ok: false, reason: 'failed' };
    },
  );

  return {
    dispose: () => {
      [
        'studio-chat-availability',
        'studio-chat-sign-in',
        'studio-chat-load',
        'studio-chat-send',
        'studio-chat-stop',
        'studio-chat-new',
        'studio-chat-restore',
      ].forEach((channel) => ipcMain.removeHandler(channel));
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
