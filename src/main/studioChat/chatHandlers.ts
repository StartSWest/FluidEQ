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
import { restoreReplyVersion } from './chatVersions';
import type createChatWindow from './chatWindow';
import { claudeCodeAvailability, signInToClaudeCode } from './claudeCode';

interface IChatHandlersDeps {
  handle: ReturnType<typeof createChatWindow>['handle'];
  agentProject(): TAgentProject;
  isBusy(projectId: string): boolean;
  activeChat(): IStudioChat | undefined;
  send(raw: unknown): Promise<void>;
  compact(raw: unknown): Promise<void>;
  /** The failed reply at the end of the chat, answered again in its place. */
  retry(raw: unknown): Promise<void>;
  /** A queued message taken back. */
  unqueue(projectId: string, id: string): void;
  /** What Claude is doing in the project, stopped (`chatTurns.ts`). */
  stop(projectId: string): void;
  /** What waits, read by Claude now (`chatTurns.ts`). */
  sendNow(raw: unknown): Promise<void>;
  entriesOf(projectId: string): readonly TStudioChatEntry[];
  versionsOf(projectId: string): string;
  limits(): IStudioChatLimits | undefined;
}

/** What the window asks of the chat, each answered for the open project only. */
const registerChatHandlers = ({
  handle,
  agentProject,
  isBusy,
  activeChat,
  send,
  compact,
  retry,
  unqueue,
  stop,
  sendNow,
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
  handle('studio-chat-retry', undefined, retry);
  handle('studio-chat-limits', undefined, limits);
  handle('studio-chat-unqueue', undefined, (id) => {
    const project = agentProject();
    if (project.ok && typeof id === 'string') {
      unqueue(project.id, id);
    }
  });
  handle('studio-chat-send-now', undefined, sendNow);
  handle('studio-chat-stop', undefined, () => {
    const project = agentProject();
    if (project.ok) {
      stop(project.id);
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
