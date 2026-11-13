/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  isStudioChatEffort,
  isStudioChatModel,
  type IStudioChat,
  type IStudioChatPicks,
  type TStudioChatEffort,
  type TStudioChatModel,
} from 'common/studioChat';
import { readStored } from '../../utils/graphStorage';

/**
 * Each chat's own model and effort (Ivan, 2026-11-09: "each chat needs to
 * have its own model select and effort, I cannot change in one and get it
 * changed on all other"; 2026-11-13: "still, when I change the model it
 * changes in all the chats", and, asked what a new chat starts on, "solo es
 * por chat" - it is only per chat).
 *
 * The cause of the second report: the picks were kept here by PROJECT, and
 * every pick also became "the last pick", which a chat with none of its own
 * read each time it was shown. So one pick moved every chat nobody had
 * picked in, which is most of them, and a project's new chat and its earlier
 * ones had one pick between them.
 *
 * A pick is now the chat's and nothing else's. Main keeps it in the chat's
 * own file (`IStudioChatPicks`, `main/studioChat/chatShown.ts`), so it goes
 * aside with the chat and comes back with it, and this module only mirrors
 * the open chats'. There is no last pick any more: nothing a pick could move
 * that another chat reads.
 *
 * A chat with none takes its own the first time it is shown, and keeps them:
 * - a new chat, and one brought in from Claude Code's own history, start on
 *   the default below, whatever was picked anywhere;
 * - a chat from before the picks lived in the chats takes what it was
 *   standing on then, so the update moves nobody's model: its project's
 *   pick, or, with something said in it, the last pick as that version left
 *   it. Both are only read here, never written again.
 *
 * They go with every message the chat sends, and main starts that chat's
 * Claude Code on them; a reply already being written keeps the ones it began
 * with, and a change counts from the next.
 */

type IChatPicks = IStudioChatPicks;

/**
 * What a new chat starts on: the model Claude Code is set to, at Medium
 * (Ivan, 2026-10-09: "set medium as default").
 */
const DEFAULT_PICKS: IChatPicks = { model: 'default', effort: 'medium' };

/**
 * Where the version before kept the last pick and each project's pick. Read
 * only, for the chats that were standing on them; no pick is written here.
 */
const LAST_BEFORE_MODEL_KEY = 'fluideq.studio.chatModel';
const LAST_BEFORE_EFFORT_KEY = 'fluideq.studio.chatEffort';
const BY_PROJECT_BEFORE_KEY = 'fluideq.studio.chatPicks';

/**
 * A picker shown with no chat behind it (Help's figure of the composer): its
 * pick is kept for the page's life and told to nobody.
 */
const NO_CHAT = '';

/**
 * Medium unless the member picked another level: the dots offer no "Claude
 * Code's own", so one stored before they existed reads as Medium too.
 */
const readEffort = (value: unknown): TStudioChatEffort =>
  isStudioChatEffort(value) && value !== 'default'
    ? value
    : DEFAULT_PICKS.effort;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Picks as they were stored, checked; undefined when they are not picks. */
const readPicks = (value: unknown): IChatPicks | undefined =>
  isRecord(value) && isStudioChatModel(value.model)
    ? { model: value.model, effort: readEffort(value.effort) }
    : undefined;

/** The last pick as the version before left it. */
const storedLastBefore = (): IChatPicks => {
  const model = readStored(LAST_BEFORE_MODEL_KEY);
  return {
    model: isStudioChatModel(model) ? model : DEFAULT_PICKS.model,
    effort: readEffort(readStored(LAST_BEFORE_EFFORT_KEY)),
  };
};

/** The picks it kept by project, each checked; anything else is left out. */
const storedByProjectBefore = (): Record<string, IChatPicks> => {
  let raw: unknown;
  try {
    raw = JSON.parse(readStored(BY_PROJECT_BEFORE_KEY) ?? '{}');
  } catch {
    return {};
  }
  const picks: Record<string, IChatPicks> = {};
  if (isRecord(raw)) {
    Object.entries(raw).forEach(([key, value]) => {
      const read = readPicks(value);
      if (read) {
        picks[key] = read;
      }
    });
  }
  return picks;
};

interface IPicksState {
  /** Each project's open chat's own picks, as main keeps them in the chat. */
  own: Readonly<Record<string, IChatPicks>>;
  lastBefore: IChatPicks;
  byProjectBefore: Readonly<Record<string, IChatPicks>>;
}

const initialState = (): IPicksState => ({
  own: {},
  lastBefore: storedLastBefore(),
  byProjectBefore: storedByProjectBefore(),
});

let state: IPicksState = initialState();
const listeners = new Set<() => void>();

/**
 * A project's open chat's picks. Before main has handed the chat over, the
 * default: there is nothing else a chat could be standing on.
 */
export const chatPicksOf = (projectId: string | undefined): IChatPicks =>
  state.own[projectId ?? NO_CHAT] ?? DEFAULT_PICKS;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A project's open chat's picks, kept current for a component. */
export const useChatPicks = (projectId: string | undefined): IChatPicks =>
  useSyncExternalStore(
    subscribe,
    () => chatPicksOf(projectId),
    () => chatPicksOf(projectId),
  );

const mirror = (key: string, picks: IChatPicks) => {
  state = { ...state, own: { ...state.own, [key]: picks } };
  listeners.forEach((listener) => listener());
};

/** The chat's own from here on: mirrored, and written into the chat by main. */
const own = (projectId: string, picks: IChatPicks) => {
  mirror(projectId, picks);
  window.electron?.ipcRenderer
    ?.studioChatPicks?.({ projectId, ...picks })
    ?.catch(() => undefined);
};

/**
 * What a chat with no picks of its own was standing on, met as its project's
 * open chat: the project's pick from when they were kept by project; then,
 * where something has been said in it, the last pick as that version left
 * it. A chat with nothing said in it and no project pick is as good as new.
 */
const stoodOn = (chat: IStudioChat): IChatPicks =>
  state.byProjectBefore[chat.projectId] ??
  (chat.entries.length > 0 ? state.lastBefore : DEFAULT_PICKS);

/**
 * A chat as main just handed it over: its picks mirrored, or, where it has
 * none, given its own. `fresh`: it began a moment ago - a new chat, or one
 * brought in from Claude Code's own history - and never stood on anything.
 */
export const noteChatPicks = (chat: IStudioChat, fresh = false) => {
  const kept = readPicks(chat.picks);
  if (kept) {
    const mirrored = state.own[chat.projectId];
    if (mirrored?.model !== kept.model || mirrored.effort !== kept.effort) {
      mirror(chat.projectId, kept);
    }
    return;
  }
  own(chat.projectId, fresh ? DEFAULT_PICKS : stoodOn(chat));
};

/** A pick for one chat, and for nothing else: no other chat reads it. */
const pick = (projectId: string | undefined, change: Partial<IChatPicks>) => {
  const next = { ...chatPicksOf(projectId), ...change };
  if (projectId === undefined) {
    mirror(NO_CHAT, next);
  } else {
    own(projectId, next);
  }
};

/** The model for one chat, from its next message. */
export const setChatModel = (
  projectId: string | undefined,
  model: TStudioChatModel,
) => pick(projectId, { model });

/** How hard one chat's Claude thinks, from its next message. */
export const setChatEffort = (
  projectId: string | undefined,
  effort: TStudioChatEffort,
) => pick(projectId, { effort });

/** As a new window starts: nothing mirrored, the rest read from storage. */
export const resetChatPicksForTesting = () => {
  state = initialState();
  listeners.forEach((listener) => listener());
};
