/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  isStudioChatEffort,
  isStudioChatModel,
  type TStudioChatEffort,
  type TStudioChatModel,
} from 'common/studioChat';
import { readStored, writeStored } from '../../utils/graphStorage';

/**
 * Each chat's own model and effort, by its key, a scene's chat being its
 * project's id (Ivan, 2026-11-09: "each chat needs to have its own model
 * select and effort, I cannot change in one and get it changed on all
 * other"). They go with every message that chat sends,
 * and main starts that chat's Claude Code on them; a reply already being
 * written keeps the ones it began with, and a change counts from the next.
 *
 * A chat nobody has picked for yet starts on the last pick made in any chat,
 * which is also where every chat stood before they had picks of their own,
 * so nobody's choice moves when this arrives.
 */

export interface IChatPicks {
  model: TStudioChatModel;
  effort: TStudioChatEffort;
}

/** The last pick made in any chat: where a chat with none of its own starts. */
const MODEL_KEY = 'fluideq.studio.chatModel';
const EFFORT_KEY = 'fluideq.studio.chatEffort';
/** Every chat's own picks, by key. */
const PICKS_KEY = 'fluideq.studio.chatPicks';

const storedModel = (): TStudioChatModel => {
  const stored = readStored(MODEL_KEY);
  return isStudioChatModel(stored) ? stored : 'default';
};

/**
 * Medium unless the member picked another level (Ivan, 2026-10-09: "set
 * medium as default"): the dots offer no "Claude Code's own", so one stored
 * before they existed reads as Medium too.
 */
const readEffort = (value: unknown): TStudioChatEffort =>
  isStudioChatEffort(value) && value !== 'default' ? value : 'medium';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The stored picks, each checked; anything that is not one is left out. */
const storedPicks = (): Record<string, IChatPicks> => {
  let raw: unknown;
  try {
    raw = JSON.parse(readStored(PICKS_KEY) ?? '{}');
  } catch {
    return {};
  }
  if (!isRecord(raw)) {
    return {};
  }
  const picks: Record<string, IChatPicks> = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (isRecord(value) && isStudioChatModel(value.model)) {
      picks[key] = { model: value.model, effort: readEffort(value.effort) };
    }
  });
  return picks;
};

interface IPicksState {
  last: IChatPicks;
  byChat: Readonly<Record<string, IChatPicks>>;
}

let state: IPicksState = {
  last: { model: storedModel(), effort: readEffort(readStored(EFFORT_KEY)) },
  byChat: storedPicks(),
};
const listeners = new Set<() => void>();

/** A chat's picks: its own, or the last pick made in any chat. */
export const chatPicksOf = (key: string | undefined): IChatPicks =>
  (key !== undefined && state.byChat[key]) || state.last;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A chat's picks, kept current for a component. */
export const useChatPicks = (key: string | undefined): IChatPicks =>
  useSyncExternalStore(
    subscribe,
    () => chatPicksOf(key),
    () => chatPicksOf(key),
  );

const pick = (key: string | undefined, change: Partial<IChatPicks>) => {
  const next = { ...chatPicksOf(key), ...change };
  state = {
    last: next,
    byChat: key === undefined ? state.byChat : { ...state.byChat, [key]: next },
  };
  writeStored(MODEL_KEY, next.model);
  writeStored(EFFORT_KEY, next.effort);
  writeStored(PICKS_KEY, JSON.stringify(state.byChat));
  listeners.forEach((listener) => listener());
};

/** The model for one chat, from its next message. */
export const setChatModel = (
  key: string | undefined,
  model: TStudioChatModel,
) => pick(key, { model });

/** How hard one chat's Claude thinks, from its next message. */
export const setChatEffort = (
  key: string | undefined,
  effort: TStudioChatEffort,
) => pick(key, { effort });

/** Back to nothing picked, for tests. */
export const resetChatPicksForTesting = () => {
  state = {
    last: { model: storedModel(), effort: readEffort(readStored(EFFORT_KEY)) },
    byChat: storedPicks(),
  };
  listeners.forEach((listener) => listener());
};
