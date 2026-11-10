/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  animatorChatKey,
  chatAnimationOf,
  type IStudioChat,
  type TStudioChatAsk,
  type TStudioChatRestore,
} from 'common/studioChat';
import animatorBrief from './animatorBrief';
import { chatPicksOf } from './chatPicks';
import { withEntry } from './studioChatStore';

/**
 * The animators' chats as the window last heard them (Ivan, 2026-11-09: "when
 * I open it I will be able to see it working and chat with it"): the same
 * events as the scene's chat, keyed by each animator chat's own key
 * (`animatorChatKey`), so the two stores never take each other's.
 *
 * Every animator's busy state is kept from the window's start, opened or not:
 * an animation's card says while its animator works.
 */

interface IAnimatorState {
  /** The chats opened in this window, by key. */
  chats: Readonly<Record<string, IStudioChat>>;
  /** Whether each animator is writing a reply, by key. */
  busy: Readonly<Record<string, boolean>>;
  /** A card standing in an animator's chat, by key. */
  asks: Readonly<Record<string, TStudioChatAsk | undefined>>;
}

let state: IAnimatorState = { chats: {}, busy: {}, asks: {} };
const listeners = new Set<() => void>();
let unlisten: (() => void) | undefined;
const bridge = () => window.electron?.ipcRenderer;

const set = (next: Partial<IAnimatorState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const isAnimator = (key: string) => chatAnimationOf(key) !== undefined;

const listen = () => {
  if (unlisten) {
    return;
  }
  const api = bridge();
  const stops = [
    api?.onStudioChatEntry?.(({ projectId: key, entry, busy }) => {
      if (!isAnimator(key)) {
        return;
      }
      const chat = state.chats[key];
      set({
        busy: { ...state.busy, [key]: busy },
        ...(chat
          ? {
              chats: {
                ...state.chats,
                [key]: {
                  ...chat,
                  busy,
                  entries: withEntry(chat.entries, entry),
                },
              },
            }
          : {}),
      });
    }),
    api?.onStudioChatQueue?.(({ projectId: key, queued }) => {
      const chat = state.chats[key];
      if (isAnimator(key) && chat) {
        set({ chats: { ...state.chats, [key]: { ...chat, queued } } });
      }
    }),
    api?.onStudioChatContext?.(({ projectId: key, context }) => {
      const chat = state.chats[key];
      if (isAnimator(key) && chat) {
        set({ chats: { ...state.chats, [key]: { ...chat, context } } });
      }
    }),
    api?.onStudioChatAsk?.(({ projectId: key, ask }) => {
      if (isAnimator(key)) {
        set({ asks: { ...state.asks, [key]: ask } });
      }
    }),
  ];
  unlisten = () => stops.forEach((stop) => stop?.());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  listen();
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => state;

/** Every animator's state, read where it is shown. */
export const useAnimatorChats = (): IAnimatorState =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/** An animation's animator chat in the open project, as main keeps it. */
export const loadAnimatorChat = async (name: string) => {
  const chat = await bridge()?.studioAnimatorLoad?.(name);
  if (!chat) {
    return;
  }
  set({
    chats: { ...state.chats, [chat.projectId]: chat },
    busy: { ...state.busy, [chat.projectId]: chat.busy },
    asks: { ...state.asks, [chat.projectId]: chat.ask },
  });
};

/**
 * A message to an animation's animator, with its brief and that animator's
 * own model and effort (`chatPicks.ts`).
 */
export const sendToAnimator = (
  projectId: string,
  name: string,
  text: string,
  stage?: Uint8Array,
) =>
  bridge()?.studioAnimatorSend?.({
    animation: name,
    text,
    brief: animatorBrief(name),
    ...chatPicksOf(animatorChatKey(projectId, name)),
    ...(stage ? { stage } : {}),
  }) ?? Promise.resolve();

export const retryAnimator = (projectId: string, name: string) =>
  bridge()?.studioAnimatorRetry?.({
    animation: name,
    brief: animatorBrief(name),
    ...chatPicksOf(animatorChatKey(projectId, name)),
  }) ?? Promise.resolve();

export const sendNowToAnimator = (projectId: string, name: string) =>
  bridge()?.studioAnimatorSendNow?.({
    animation: name,
    brief: animatorBrief(name),
    ...chatPicksOf(animatorChatKey(projectId, name)),
  }) ?? Promise.resolve();

export const stopAnimator = (name: string) =>
  bridge()?.studioAnimatorStop?.(name) ?? Promise.resolve();

/** The project back to how one of the animator's replies left it. */
export const restoreAnimatorVersion = (
  name: string,
  entryId: string,
): Promise<TStudioChatRestore> =>
  bridge()?.studioAnimatorRestore?.(name, entryId) ??
  Promise.resolve({ ok: false, reason: 'failed' });

export const unqueueAnimator = (name: string, id: string) =>
  bridge()?.studioAnimatorUnqueue?.(name, id) ?? Promise.resolve();

/**
 * The scene's chat starting an animator (`start_animator`): the task goes to
 * that animation's animator as its message, said to come from the scene's
 * chat (`fromScene`), on the window's own brief for it. Heard for the
 * window's life, from wherever the member is.
 */
export const watchAnimatorStarts = (
  fromScene: (task: string) => string,
): (() => void) => {
  listen();
  const stop = bridge()?.onStudioAnimatorStart?.(
    ({ projectId, name, task }) => {
      bridge()
        ?.studioAnimatorSend?.({
          animation: name,
          projectId,
          text: fromScene(task),
          brief: animatorBrief(name),
          ...chatPicksOf(animatorChatKey(projectId, name)),
        })
        .catch(() => undefined);
    },
  );
  return () => stop?.();
};

/** An animator chat's key in a project, for reading the state above. */
export { animatorChatKey };

/** For tests: forget everything, as a new window does. */
export const resetAnimatorChatStore = () => {
  unlisten?.();
  unlisten = undefined;
  state = { chats: {}, busy: {}, asks: {} };
};
