/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { IStudioChat, IStudioChatPast } from '../../common/studioChat';
import writeFileAtomically from '../atomicWrite';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { TTranscripts } from './chatTranscript';
import { listClaudeHistory, loadClaudeHistory, titleOf } from './claudeHistory';

/**
 * A project's earlier chats (Ivan, 2026-10-09: "how can I recover a
 * previous chat if I create a new one", then "yes, do past chats").
 *
 * "New chat" used to erase the chat it replaced. Now it moves it aside,
 * whole — its messages, its pictures and the versions its replies can bring
 * back — under `past/<id>/` beside the project's chat, and any of them can
 * be opened again, which moves the open one aside in its turn. Claude Code
 * carries on from where that chat left off, because the chat keeps the
 * conversation it was in.
 *
 * Beside them, the chats Claude Code kept for the project's folder that
 * FluidEQ does not have (`claudeHistory.ts`): the ones erased before this,
 * and any the member had there on their own. Opening one brings it in as a
 * chat of FluidEQ's, without versions to bring back.
 */

const PAST_DIR = 'past';
const META_FILE = 'meta.json';
const CHAT_FILE = 'chat.json';
const VERSIONS_DIR = 'versions';
/** The newest this many earlier chats a project keeps; older ones go. */
const MAX_PAST_CHATS = 30;
const PAST_ID = /^[a-f0-9-]{36}$/;
const HISTORY_PREFIX = 'claude-code:';

interface IPastMeta {
  title: string;
  savedAt: number;
  sessionId?: string;
}

const readMeta = (dir: string): IPastMeta | undefined => {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(dir, META_FILE), 'utf8'),
    );
    if (typeof raw !== 'object' || raw === null) {
      return undefined;
    }
    const { title, savedAt, sessionId } = raw as Record<string, unknown>;
    return typeof title === 'string' && typeof savedAt === 'number'
      ? {
          title,
          savedAt,
          ...(typeof sessionId === 'string' ? { sessionId } : {}),
        }
      : undefined;
  } catch {
    return undefined;
  }
};

/** Moves `from` to `to` when it is there; a plain file or folder of ours. */
const moveIfThere = (from: string, to: string) => {
  try {
    const stats = fs.lstatSync(from);
    if (stats.isSymbolicLink()) {
      return;
    }
  } catch {
    return;
  }
  fs.renameSync(from, to);
};

export interface IPastChatsDeps {
  root: string;
  transcripts: TTranscripts;
  agentProject(): TAgentProject;
  fromWindow(event: IpcMainInvokeEvent): boolean;
  isBusy(projectId: string): boolean;
  /**
   * Before another chat takes the open one's place: its Claude Code ended,
   * so the next message starts on the chat now open, and the copy in
   * memory dropped, so it is read again from disk.
   */
  letGo(projectId: string): void;
  activeChat(): IStudioChat | undefined;
  logger?: { warn(message: string): void };
}

export const createPastChats = ({
  root,
  transcripts,
  agentProject,
  fromWindow,
  isBusy,
  letGo,
  activeChat,
  logger,
}: IPastChatsDeps) => {
  const projectDir = (projectId: string) =>
    path.join(root, encodeURIComponent(projectId));
  const pastDir = (projectId: string) =>
    path.join(projectDir(projectId), PAST_DIR);

  /** The project's earlier chats kept by FluidEQ, newest first. */
  const kept = (projectId: string) => {
    let names: string[];
    try {
      names = fs.readdirSync(pastDir(projectId));
    } catch {
      return [];
    }
    return names
      .filter((name) => PAST_ID.test(name))
      .flatMap((id) => {
        const meta = readMeta(path.join(pastDir(projectId), id));
        return meta ? [{ id, ...meta }] : [];
      })
      .sort((a, b) => b.savedAt - a.savedAt);
  };

  /** The oldest past the limit, gone: only folders this module made. */
  const prune = (projectId: string) => {
    kept(projectId)
      .slice(MAX_PAST_CHATS)
      .forEach(({ id }) =>
        fs.rmSync(path.join(pastDir(projectId), id), {
          recursive: true,
          force: true,
        }),
      );
  };

  /** The open chat moved aside whole, when it has anything in it. */
  const putAside = (projectId: string) => {
    const transcript = transcripts.read(projectId);
    if (transcript.entries.length === 0) {
      return;
    }
    const id = randomUUID();
    const dir = path.join(pastDir(projectId), id);
    fs.mkdirSync(dir, { recursive: true });
    moveIfThere(
      path.join(projectDir(projectId), CHAT_FILE),
      path.join(dir, CHAT_FILE),
    );
    moveIfThere(
      transcripts.versionsOf(projectId),
      path.join(dir, VERSIONS_DIR),
    );
    const meta: IPastMeta = {
      title: titleOf(transcript.entries),
      savedAt: Date.now(),
      ...(transcript.sessionId ? { sessionId: transcript.sessionId } : {}),
    };
    writeFileAtomically(path.join(dir, META_FILE), JSON.stringify(meta));
    prune(projectId);
  };

  /** Every conversation FluidEQ has for the project, by Claude Code's id. */
  const knownSessions = (projectId: string) =>
    new Set(
      [
        transcripts.read(projectId).sessionId,
        ...kept(projectId).map((chat) => chat.sessionId),
      ].filter((id): id is string => id !== undefined),
    );

  const list = async (): Promise<IStudioChatPast[]> => {
    const project = agentProject();
    if (!project.ok) {
      return [];
    }
    const ours: IStudioChatPast[] = kept(project.id).map(
      ({ id, title, savedAt }) => ({
        id,
        title,
        savedAt,
        source: 'fluideq',
      }),
    );
    const history = await listClaudeHistory(
      project.folder,
      knownSessions(project.id),
    );
    return [
      ...ours,
      ...history.map(({ sessionId, title, savedAt }): IStudioChatPast => ({
        id: `${HISTORY_PREFIX}${sessionId}`,
        title,
        savedAt,
        source: 'claude-code',
      })),
    ];
  };

  const open = async (id: unknown): Promise<IStudioChat | undefined> => {
    const project = agentProject();
    if (!project.ok || typeof id !== 'string' || isBusy(project.id)) {
      return activeChat();
    }
    const projectId = project.id;
    try {
      if (id.startsWith(HISTORY_PREFIX)) {
        const transcript = await loadClaudeHistory(
          project.folder,
          id.slice(HISTORY_PREFIX.length),
        );
        if (!transcript) {
          return activeChat();
        }
        letGo(projectId);
        putAside(projectId);
        transcripts.write(projectId, transcript);
      } else if (PAST_ID.test(id)) {
        const dir = path.join(pastDir(projectId), id);
        if (!readMeta(dir)) {
          return activeChat();
        }
        letGo(projectId);
        putAside(projectId);
        moveIfThere(
          path.join(dir, CHAT_FILE),
          path.join(projectDir(projectId), CHAT_FILE),
        );
        moveIfThere(
          path.join(dir, VERSIONS_DIR),
          transcripts.versionsOf(projectId),
        );
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (error) {
      logger?.warn(`A past Studio chat could not be opened: ${String(error)}`);
    }
    return activeChat();
  };

  const remove = async (id: unknown): Promise<IStudioChatPast[]> => {
    const project = agentProject();
    if (project.ok && typeof id === 'string' && PAST_ID.test(id)) {
      fs.rmSync(path.join(pastDir(project.id), id), {
        recursive: true,
        force: true,
      });
    }
    return list();
  };

  ipcMain.handle('studio-chat-past', (event) =>
    fromWindow(event) ? list() : [],
  );
  ipcMain.handle('studio-chat-open-past', (event, id: unknown) =>
    fromWindow(event) ? open(id) : undefined,
  );
  ipcMain.handle('studio-chat-delete-past', (event, id: unknown) =>
    fromWindow(event) ? remove(id) : [],
  );

  return {
    /** "New chat": the open one moved aside, never erased. */
    putAside,
    dispose: () =>
      [
        'studio-chat-past',
        'studio-chat-open-past',
        'studio-chat-delete-past',
      ].forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
