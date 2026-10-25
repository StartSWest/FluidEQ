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
  type IStudioChatCodexState,
  type IStudioChatLimits,
  type IStudioChatPast,
  type TStudioChatAnswer,
  type TStudioChatAsk,
  type TStudioChatAvailability,
  type TStudioChatEffort,
  type TStudioChatEntry,
  type TStudioChatModel,
  type TStudioChatRestore,
} from 'common/studioChat';
import { CHATGPT_PICTURES_OPEN } from 'common/studioChatPictures';
import { readStored, writeStored } from '../../utils/graphStorage';
import chatBrief from './chatBrief';
import packArtwork from './chatPack';

const MODEL_KEY = 'fluideq.studio.chatModel';
const EFFORT_KEY = 'fluideq.studio.chatEffort';
const ZOOM_KEY = 'fluideq.studio.chatZoom';

/**
 * The chat's own sizes (Ivan, 2026-10-09: "I need to be able to zoom the
 * chat a bit if desired"), as fractions of the app's: the whole window's
 * Ctrl and plus already belongs to the app, so the chat scales on its own.
 */
export const STUDIO_CHAT_ZOOMS = [0.85, 1, 1.15, 1.3, 1.5] as const;

/**
 * The Studio's chat as the window last heard it from main
 * (`main/studioChat/studioChat.ts`): whether Claude Code can be used here,
 * and the open project's conversation. One copy for the pane and the tab
 * that stands in for it in a narrow window, so the two never disagree.
 *
 * Main sends each entry as it changes — a reply grows word by word — and
 * only for the open project; a change for another project (a reply that
 * went on after the member opened a different one) waits for that project
 * to be loaded again.
 */

interface IChatState {
  availability: TStudioChatAvailability;
  chat?: IStudioChat;
  /** Claude Code's sign-in window is open. */
  signingIn: boolean;
  /** The member's picks, kept for the next visit and every project. */
  model: TStudioChatModel;
  effort: TStudioChatEffort;
  /** A card the chat put up for the member: connect ChatGPT, or a picture. */
  ask?: TStudioChatAsk;
  /** ChatGPT's pictures here: Codex's state, and whether it is connected. */
  codex?: IStudioChatCodexState;
  /** Codex's sign-in window is open. */
  codexSigningIn: boolean;
  /** The open project's earlier chats, once asked for. */
  past?: IStudioChatPast[];
  /** How large the conversation is drawn, one of STUDIO_CHAT_ZOOMS. */
  zoom: number;
  /** The Claude plan's limits, as Claude Code last reported them. */
  limits?: IStudioChatLimits;
}

const storedModel = (): TStudioChatModel => {
  const stored = readStored(MODEL_KEY);
  return isStudioChatModel(stored) ? stored : 'default';
};
/**
 * Medium unless the member picked another level (Ivan, 2026-10-09: "set
 * medium as default"): the dots offer no "Claude Code's own", so one stored
 * before they existed reads as Medium too.
 */
const storedEffort = (): TStudioChatEffort => {
  const stored = readStored(EFFORT_KEY);
  return isStudioChatEffort(stored) && stored !== 'default' ? stored : 'medium';
};

const storedZoom = () => {
  const stored = Number(readStored(ZOOM_KEY));
  return STUDIO_CHAT_ZOOMS.find((zoom) => zoom === stored) ?? 1;
};

const initialState = (): IChatState => ({
  zoom: storedZoom(),
  availability: { state: 'checking' },
  signingIn: false,
  codexSigningIn: false,
  model: storedModel(),
  effort: storedEffort(),
});

let state: IChatState = initialState();
const listeners = new Set<() => void>();
let unlisten: (() => void) | undefined;

const bridge = () => window.electron?.ipcRenderer;

const set = (next: Partial<IChatState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

/** A changed entry put in its place, or added at the end. */
export const withEntry = (
  entries: readonly TStudioChatEntry[],
  entry: TStudioChatEntry,
): TStudioChatEntry[] => {
  const at = entries.findIndex((known) => known.id === entry.id);
  if (at === -1) {
    return [...entries, entry];
  }
  const next = [...entries];
  next[at] = entry;
  return next;
};

const listen = () => {
  if (unlisten) {
    return;
  }
  const api = bridge();
  const stops = [
    api?.onStudioChatEntry?.(({ projectId, entry, busy }) => {
      if (state.chat?.projectId !== projectId) {
        return;
      }
      set({
        chat: {
          ...state.chat,
          busy,
          entries: withEntry(state.chat.entries, entry),
        },
      });
    }),
    api?.onStudioChatQueue?.(({ projectId, queued }) => {
      if (state.chat?.projectId === projectId) {
        set({ chat: { ...state.chat, queued } });
      }
    }),
    api?.onStudioChatContext?.(({ projectId, context }) => {
      if (state.chat?.projectId === projectId) {
        set({ chat: { ...state.chat, context } });
      }
    }),
    api?.onStudioChatLimits?.((limits) => set({ limits })),
    api?.onStudioChatAsk?.(({ projectId, ask }) => {
      if (state.chat?.projectId === projectId) {
        set({ ask });
      }
    }),
    // Claude's pack_artwork: main laid the artwork out, the page draws and
    // encodes it (only a page encodes WebP) and hands the bytes back.
    api?.onStudioChatPack?.((ask) => {
      packArtwork(ask)
        .catch((): { ok: false; reason: 'failed' } => ({
          ok: false,
          reason: 'failed',
        }))
        .then((answer) => api.studioChatPacked?.(ask.id, answer))
        .catch(() => undefined);
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

export const useStudioChat = (): IChatState =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/** Asks Claude Code again whether it is installed and signed in. */
export const checkStudioChat = async () => {
  const answer = await bridge()?.studioChatAvailability?.();
  if (answer) {
    set({ availability: answer });
  }
};

/** Claude Code's own sign-in; the answer is asked again once it has ended. */
export const signInToStudioChat = async () => {
  set({ signingIn: true });
  try {
    const answer = await bridge()?.studioChatSignIn?.();
    if (answer) {
      set({ availability: answer });
    }
    return answer;
  } finally {
    set({ signingIn: false });
  }
};

/**
 * The failed reply at the end of the chat answered again in its place, on
 * the member's picks: what a sign-in from that reply's card ends with.
 */
export const retryStudioChat = (folder: string) =>
  bridge()?.studioChatRetry?.({
    brief: chatBrief(folder),
    model: state.model,
    effort: state.effort,
  }) ?? Promise.resolve();

/** The open project's conversation, as main keeps it. */
export const loadStudioChat = async () => {
  const chat = await bridge()?.studioChatLoad?.();
  set({ chat: chat ?? undefined, ask: chat?.ask });
};

/** The Claude plan's limits as last reported, kept from earlier sittings too. */
export const checkStudioChatLimits = async () => {
  const limits = await bridge()?.studioChatLimits?.();
  if (limits) {
    set({ limits });
  }
};

/** The member's answer to the card standing in the chat. */
export const answerStudioChat = (id: string, answer: TStudioChatAnswer) => {
  set({ ask: undefined });
  return bridge()?.studioChatAnswer?.(id, answer) ?? Promise.resolve();
};

/**
 * Asks Codex again whether it is here and signed in with ChatGPT. Nothing is
 * asked while ChatGPT pictures are closed (`studioChatPictures.ts`): the
 * chat then never knows Codex, so nothing it draws offers it.
 */
export const checkStudioChatCodex = async () => {
  if (!CHATGPT_PICTURES_OPEN) {
    return;
  }
  const codex = await bridge()?.studioChatCodex?.();
  if (codex) {
    set({ codex });
  }
};

/** Codex's own sign-in, in a window of its own. */
export const signInToStudioChatCodex = async () => {
  if (!CHATGPT_PICTURES_OPEN) {
    return;
  }
  set({ codexSigningIn: true });
  try {
    const codex = await bridge()?.studioChatCodexSignIn?.();
    if (codex) {
      set({ codex });
    }
  } finally {
    set({ codexSigningIn: false });
  }
};

/** ChatGPT's pictures off: the next picture asks to connect again. */
export const disconnectStudioChatCodex = async () => {
  if (!CHATGPT_PICTURES_OPEN) {
    return;
  }
  const codex = await bridge()?.studioChatCodexDisconnect?.();
  if (codex) {
    set({ codex });
  }
};

export const setStudioChatModel = (model: TStudioChatModel) => {
  writeStored(MODEL_KEY, model);
  set({ model });
};

/** One size up or down the steps, held at either end; 0 is back to 1. */
export const stepStudioChatZoom = (direction: -1 | 0 | 1) => {
  const at = STUDIO_CHAT_ZOOMS.findIndex((zoom) => zoom === state.zoom);
  const next =
    direction === 0
      ? 1
      : STUDIO_CHAT_ZOOMS[
          Math.min(STUDIO_CHAT_ZOOMS.length - 1, Math.max(0, at + direction))
        ];
  writeStored(ZOOM_KEY, String(next));
  set({ zoom: next });
};

export const setStudioChatEffort = (effort: TStudioChatEffort) => {
  writeStored(EFFORT_KEY, effort);
  set({ effort });
};

/**
 * A message to Claude about the project in `folder`, with the brief and the
 * member's model and effort picks; and the stage's picture when attached.
 */
export const sendToStudioChat = (
  text: string,
  folder: string,
  stage?: Uint8Array,
) =>
  bridge()?.studioChatSend?.({
    text,
    brief: chatBrief(folder),
    model: state.model,
    effort: state.effort,
    ...(stage ? { stage } : {}),
  }) ?? Promise.resolve();

/**
 * Claude Code's /compact on the conversation about the project in `folder`:
 * the picks go with it, because a different one starts Claude Code anew.
 */
export const compactStudioChat = (folder: string) =>
  bridge()?.studioChatCompact?.({
    brief: chatBrief(folder),
    model: state.model,
    effort: state.effort,
  }) ?? Promise.resolve();

/** A queued message taken back before it went. */
/** What waits in the queue, read by Claude now, on the member's picks. */
export const sendNowStudioChat = (folder: string) =>
  bridge()?.studioChatSendNow?.({
    brief: chatBrief(folder),
    model: state.model,
    effort: state.effort,
  }) ?? Promise.resolve();

export const unqueueStudioChat = (id: string) =>
  bridge()?.studioChatUnqueue?.(id) ?? Promise.resolve();

export const stopStudioChat = () =>
  bridge()?.studioChatStop?.() ?? Promise.resolve();

export const newStudioChat = async () => {
  const chat = await bridge()?.studioChatNew?.();
  set({ chat: chat ?? undefined, ask: chat?.ask });
};

/** The open project's earlier chats, asked again each time they are shown. */
export const loadPastStudioChats = async () => {
  set({ past: undefined });
  const past = await bridge()?.studioChatPast?.();
  set({ past: past ?? [] });
};

/** An earlier chat in place of the open one, which joins the list. */
export const openPastStudioChat = async (id: string) => {
  const chat = await bridge()?.studioChatOpenPast?.(id);
  set({ chat: chat ?? undefined, ask: chat?.ask });
};

export const deletePastStudioChat = async (id: string) => {
  const past = await bridge()?.studioChatDeletePast?.(id);
  if (past) {
    set({ past });
  }
};

export const restoreStudioChatVersion = (
  entryId: string,
): Promise<TStudioChatRestore> =>
  bridge()?.studioChatRestore?.(entryId) ??
  Promise.resolve({ ok: false, reason: 'failed' });

/** For tests: forget everything, as a new window does. */
export const resetStudioChatStore = () => {
  unlisten?.();
  unlisten = undefined;
  state = initialState();
};
