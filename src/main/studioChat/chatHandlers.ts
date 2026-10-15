/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IStudioChat,
  IStudioChatLimits,
  TStudioChatAvailability,
  TStudioChatEntry,
  TStudioChatRestore,
} from '../../common/studioChat';
import type { TAgentProject } from '../studioAgent/agentProject';
import type { IChatSession } from './chatLaunch';
import { restoreReplyVersion } from './chatVersions';
import type createChatWindow from './chatWindow';
import { claudeCodeAvailability, signInToClaudeCode } from './claudeCode';
import endProcessTree from './endProcessTree';

interface IChatHandlersDeps {
  handle: ReturnType<typeof createChatWindow>['handle'];
  agentProject(): TAgentProject;
  sessions: ReadonlyMap<string, IChatSession>;
  isBusy(projectId: string): boolean;
  activeChat(): IStudioChat | undefined;
  send(raw: unknown): Promise<void>;
  compact(raw: unknown): Promise<void>;
  /** A queued message taken back. */
  unqueue(projectId: string, id: string): void;
  /** A card waiting on the member, or a picture being made, ends. */
  dropAsks(projectId: string): void;
  entriesOf(projectId: string): readonly TStudioChatEntry[];
  versionsOf(projectId: string): string;
  limits(): IStudioChatLimits | undefined;
}

/** What the window asks of the chat, each answered for the open project only. */
const registerChatHandlers = ({
  handle,
  agentProject,
  sessions,
  isBusy,
  activeChat,
  send,
  compact,
  unqueue,
  dropAsks,
  entriesOf,
  versionsOf,
  limits,
}: IChatHandlersDeps) => {
  const missing: Promise<TStudioChatAvailability> = Promise.resolve({
    state: 'missing',
  });
  handle('studio-chat-availability', missing, () => claudeCodeAvailability());
  handle('studio-chat-sign-in', missing, () =>
    signInToClaudeCode().then(() => claudeCodeAvailability()),
  );
  handle('studio-chat-load', undefined, activeChat);
  handle('studio-chat-send', undefined, send);
  handle('studio-chat-compact', undefined, compact);
  handle('studio-chat-limits', undefined, limits);
  handle('studio-chat-unqueue', undefined, (id) => {
    const project = agentProject();
    if (project.ok && typeof id === 'string') {
      unqueue(project.id, id);
    }
  });
  handle('studio-chat-stop', undefined, () => {
    const project = agentProject();
    const session = project.ok ? sessions.get(project.id) : undefined;
    if (project.ok && session?.reply) {
      session.stopping = true;
      // A picture being made, or a card waiting on the member, ends with it.
      session.controller?.abort();
      dropAsks(project.id);
      endProcessTree(session.child);
    }
  });
  handle<TStudioChatRestore>(
    'studio-chat-restore',
    { ok: false, reason: 'no-project' },
    (entryId) => {
      const project = agentProject();
      if (!project.ok) {
        return { ok: false, reason: 'no-project' };
      }
      return isBusy(project.id)
        ? { ok: false, reason: 'busy' }
        : restoreReplyVersion(
            entriesOf(project.id),
            versionsOf(project.id),
            project.folder,
            entryId,
          );
    },
  );
};

export default registerChatHandlers;
