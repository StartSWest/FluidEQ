/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  readStudioChatPicks,
  type IStudioChat,
  type IStudioChatQueued,
  type TStudioChatAsk,
  type TStudioChatEntry,
} from '../../common/studioChat';
import type { IChatTarget } from './chatTargets';
import type { IChatTranscript } from './chatTranscript';

type TReply = Extract<TStudioChatEntry, { kind: 'claude' }>;

interface IChatShownDeps {
  transcriptOf(projectId: string): IChatTranscript;
  save(projectId: string): void;
  saveWith(projectId: string, reply: TReply): void;
  /** The reply being written in a project's chat, when one is. */
  replyOf(projectId: string): TReply | undefined;
  isBusy(projectId: string): boolean;
  standingAsk(projectId: string): TStudioChatAsk | undefined;
  queuedOf(projectId: string): IStudioChatQueued[];
}

/**
 * A chat as the window shows it, and the model and effort the window sets
 * on it.
 *
 * The picks are the chat's own and live in its file (`IStudioChatPicks`).
 * The cause they were moved here for: the window kept them by project and
 * let a chat with none read the last pick made anywhere, so changing the
 * model in one chat changed it in every chat nobody had picked for, and a
 * project's new chat and its earlier ones were one pick between them.
 */
const createChatShown = ({
  transcriptOf,
  save,
  saveWith,
  replyOf,
  isBusy,
  standingAsk,
  queuedOf,
}: IChatShownDeps) => {
  /** A chat as the window shows it; its `projectId` is the chat's key. */
  const chatOf = (chat: IChatTarget | undefined): IStudioChat | undefined => {
    if (!chat) {
      return undefined;
    }
    const { entries, context, picks } = transcriptOf(chat.key);
    // The reply being written joins the transcript only when it ends.
    const reply = replyOf(chat.key);
    const ask = standingAsk(chat.key);
    const queued = queuedOf(chat.key);
    return {
      projectId: chat.key,
      entries: reply ? [...entries, { ...reply }] : entries,
      busy: isBusy(chat.key),
      ...(ask ? { ask } : {}),
      ...(queued.length ? { queued } : {}),
      ...(context ? { context } : {}),
      ...(picks ? { picks } : {}),
    };
  };

  /**
   * The member's pick for the open project's chat, written into that chat.
   * Only where the window made it on the project that is open: a pick that
   * arrives after the member moved to another project is not that chat's.
   * A reply being written keeps the picks it began with (`chatSessions.ts`
   * starts Claude Code anew on the next message when they differ), and is
   * written to disk with the chat, as every save mid-reply does.
   */
  const setPicks = (chat: IChatTarget | undefined, raw: unknown) => {
    const picks = readStudioChatPicks(raw);
    if (
      !chat ||
      !picks ||
      (raw as { projectId?: unknown }).projectId !== chat.key
    ) {
      return;
    }
    transcriptOf(chat.key).picks = picks;
    const reply = replyOf(chat.key);
    if (reply) {
      saveWith(chat.key, reply);
    } else {
      save(chat.key);
    }
  };

  return { chatOf, setPicks };
};

export default createChatShown;
