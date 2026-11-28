/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  studioChatLimitsKey,
  type IStudioChat,
  type IStudioChatLimits,
  type IStudioChatLimitsNews,
  type IStudioChatPast,
  type TStudioChatAnswer,
  type TStudioChatAsk,
  type TStudioChatAvailability,
  type TStudioChatEntry,
  type TStudioChatModel,
  type TStudioChatRestore,
} from 'common/studioChat';
import { readStored, writeStored } from '../../utils/graphStorage';
import chatBrief from './chatBrief';
import { chatPicksOf, noteChatPicks, setChatModel } from './chatPicks';
import packArtwork from './chatPack';
import videoFrames from './chatVideo';

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
  /** A card the chat put up for the member: may Claude use this tool? */
  ask?: TStudioChatAsk;
  /** The open project's earlier chats, once asked for. */
  past?: IStudioChatPast[];
  /** How large the conversation is drawn, one of STUDIO_CHAT_ZOOMS. */
  zoom: number;
  /**
   * The Claude plan's last reading for the account `availability` names,
   * and never another account's (`limitsShown`).
   */
  limits?: IStudioChatLimits;
  /** Claude Code is being asked for a new reading now. */
  limitsChecking: boolean;
  /**
   * What each project's chat is doing, whether or not it is open (Ivan,
   * 2026-11-07: "I should be able to keep working in parallel on every
   * scene"): working while Claude answers, waiting while a card of its waits
   * on the member, replied once an answer finished on a project the member
   * was not on, until that project is opened.
   */
  work: Readonly<Record<string, TStudioChatWork>>;
}

export type TStudioChatWork = 'working' | 'waiting' | 'replied';

/** A project's chat after main said whether it is busy. */
const workAfter = (
  work: Readonly<Record<string, TStudioChatWork>>,
  projectId: string,
  busy: boolean,
  open: boolean,
): Readonly<Record<string, TStudioChatWork>> => {
  if (busy) {
    // A reply goes on growing while its card waits: still waiting.
    return work[projectId] === 'working' || work[projectId] === 'waiting'
      ? work
      : { ...work, [projectId]: 'working' };
  }
  if (
    !open &&
    (work[projectId] === 'working' || work[projectId] === 'waiting')
  ) {
    return { ...work, [projectId]: 'replied' };
  }
  if (open && work[projectId] !== undefined) {
    const rest = { ...work };
    delete rest[projectId];
    return rest;
  }
  return work;
};

/**
 * A project's chat after a card of its went up or came down: waiting while
 * one stands, answering again once it is answered. A card can wait on a
 * project the member is not on, and the reply waits with it, so the picker
 * has to say so or the member never finds out.
 */
const workAsked = (
  work: Readonly<Record<string, TStudioChatWork>>,
  projectId: string,
  asking: boolean,
): Readonly<Record<string, TStudioChatWork>> => {
  if (asking) {
    return work[projectId] === 'waiting'
      ? work
      : { ...work, [projectId]: 'waiting' };
  }
  return work[projectId] === 'waiting'
    ? { ...work, [projectId]: 'working' }
    : work;
};

const storedZoom = () => {
  const stored = Number(readStored(ZOOM_KEY));
  return STUDIO_CHAT_ZOOMS.find((zoom) => zoom === stored) ?? 1;
};

const initialState = (): IChatState => ({
  zoom: storedZoom(),
  availability: { state: 'checking' },
  signingIn: false,
  limitsChecking: false,
  work: {},
});

let state: IChatState = initialState();

/**
 * Every account's last reading heard in this window, by its key
 * (`studioChatLimitsKey`): a member switching back finds that account's
 * figures at once while new ones are read.
 */
let readings = new Map<string, IStudioChatLimits>();

/** The key of the account Claude Code says is signed in; none while it says nobody is. */
const shownKey = (availability: TStudioChatAvailability) =>
  availability.state === 'ready'
    ? studioChatLimitsKey(availability.email)
    : undefined;

/**
 * The reading shown beside an account: that account's own, or none. The
 * card once showed the previous account's figures under a new account's
 * name (Ivan, 2026-11-28), and while the new account's are read it shows
 * that they are being read instead (`StudioChatLimits.tsx`).
 */
const limitsShown = (availability: TStudioChatAvailability) => {
  const key = shownKey(availability);
  return key === undefined ? undefined : readings.get(key);
};

/**
 * The open chat's own model and effort (`chatPicks.ts`), which every chat
 * main hands over is noted for (`taken`). Before a chat has loaded, the
 * default a new chat starts on.
 */
const scenePicks = () => chatPicksOf(state.chat?.projectId);

/**
 * A chat as main handed it over, its picks noted on the way in. `fresh`: it
 * began a moment ago and never stood on any picks (`noteChatPicks`).
 */
const taken = (chat: IStudioChat | undefined, fresh = false) => {
  if (chat) {
    noteChatPicks(chat, fresh);
  }
  return chat ?? undefined;
};
const listeners = new Set<() => void>();
let unlisten: (() => void) | undefined;

const bridge = () => window.electron?.ipcRenderer;

const set = (next: Partial<IChatState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

/** Who Claude Code says is signed in, and the reading shown beside them with it. */
const setAvailability = (availability: TStudioChatAvailability) =>
  set({ availability, limits: limitsShown(availability) });

/** What main said of the plan's usage, kept under the account it is of. */
const hearLimits = (news: IStudioChatLimitsNews | undefined) => {
  if (!news) {
    return;
  }
  if (news.limits) {
    readings.set(studioChatLimitsKey(news.limits.account), news.limits);
  }
  set({
    limits: limitsShown(state.availability),
    limitsChecking: news.checking === true,
  });
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
      const open = state.chat?.projectId === projectId;
      const work = workAfter(state.work, projectId, busy, open);
      if (!state.chat || !open) {
        if (work !== state.work) {
          set({ work });
        }
        return;
      }
      set({
        work,
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
    api?.onStudioChatLimits?.((news) => {
      hearLimits(news);
      // A new reading names someone other than the account shown: Claude
      // Code has been signed in to another account since it was last asked
      // (in a terminal, or another app), so it is asked again, and the card
      // follows it to that account and its figures.
      const read = news.limits?.account;
      const key = shownKey(state.availability);
      if (
        read !== undefined &&
        key !== undefined &&
        studioChatLimitsKey(read) !== key
      ) {
        checkStudioChat().catch(() => undefined);
      }
    }),
    api?.onStudioChatAsk?.(({ projectId, ask }) => {
      const work = workAsked(state.work, projectId, ask !== undefined);
      if (state.chat?.projectId === projectId) {
        set({ ask, work });
      } else if (work !== state.work) {
        set({ work });
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
    // Claude's video_frames: only a page decodes video, so the page draws
    // the frames main asked for and hands them back as PNGs.
    api?.onStudioChatVideo?.((ask) => {
      videoFrames(ask)
        .catch((): { ok: false; reason: 'failed' } => ({
          ok: false,
          reason: 'failed',
        }))
        .then((answer) => api.studioChatVideoFrames?.(ask.id, answer))
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

/**
 * Hears every project's chat from the window's start, for its life. It
 * listened only once the Studio was opened in this window: after a reload
 * with a chat still at work, a reply that ended before the Studio was opened
 * again was never marked, and a pack_artwork asked for meanwhile waited on a
 * window that was not listening for it.
 */
export const watchStudioChat = () => {
  listen();
};

const snapshot = () => state;

export const useStudioChat = (): IChatState =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/**
 * Whether a project's chat is answering now, or waits on a card of its,
 * read at the moment it is asked: an ask it refused then waits for that
 * answer's end (`usePublishNote`).
 */
export const isStudioChatBusy = (projectId: string): boolean =>
  state.work[projectId] === 'working' || state.work[projectId] === 'waiting';

/** Asks Claude Code again whether it is installed and signed in. */
export const checkStudioChat = async () => {
  const answer = await bridge()?.studioChatAvailability?.();
  if (answer) {
    setAvailability(answer);
  }
};

/** Claude Code's own sign-in; the answer is asked again once it has ended. */
export const signInToStudioChat = async () => {
  set({ signingIn: true });
  try {
    const answer = await bridge()?.studioChatSignIn?.();
    if (answer) {
      setAvailability(answer);
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
export const retryStudioChat = () =>
  bridge()?.studioChatRetry?.({
    brief: chatBrief(),
    ...scenePicks(),
  }) ?? Promise.resolve();

/**
 * The failed reply answered again on another model, which becomes this
 * chat's own pick from here on, as a pick from the model list would: what
 * "Switch to Opus" does when Fable's own limit stopped a reply.
 */
export const retryStudioChatOn = (model: TStudioChatModel) => {
  setChatModel(state.chat?.projectId, model);
  return retryStudioChat();
};

/** The open project's conversation, as main keeps it. */
export const loadStudioChat = async () => {
  const chat = await bridge()?.studioChatLoad?.();
  // Opened, its reply is seen; still answering, or with a card up, it goes
  // on saying so.
  const work = chat
    ? workAsked(
        workAfter(state.work, chat.projectId, chat.busy, true),
        chat.projectId,
        chat.ask !== undefined,
      )
    : state.work;
  set({ chat: taken(chat), ask: chat?.ask, work });
};

/**
 * The plan's usage for the account shown: its last reading at once, kept
 * from earlier sittings too, and a new one asked of Claude Code unless that
 * account was read within the last minute (main decides, `planUsage.ts`).
 * `fresh` asks for a new reading whatever the minute says.
 */
export const checkStudioChatLimits = async ({
  fresh = false,
}: { fresh?: boolean } = {}) => {
  const { availability } = state;
  const account =
    availability.state === 'ready' ? availability.email : undefined;
  hearLimits(
    await bridge()?.studioChatLimits?.({
      ...(account ? { account } : {}),
      ...(fresh ? { fresh } : {}),
    }),
  );
};

/** The member's answer to the card standing in the chat. */
export const answerStudioChat = (id: string, answer: TStudioChatAnswer) => {
  set({ ask: undefined });
  return bridge()?.studioChatAnswer?.(id, answer) ?? Promise.resolve();
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

/**
 * A message to Claude about the open project, with the brief and the
 * member's model and effort picks; and the stage's picture when attached.
 */
export const sendToStudioChat = (text: string, stage?: Uint8Array) =>
  bridge()?.studioChatSend?.({
    text,
    brief: chatBrief(),
    ...scenePicks(),
    ...(stage ? { stage } : {}),
  }) ?? Promise.resolve();

/**
 * Claude Code's /compact on the open project's conversation: the picks go
 * with it, because a different one starts Claude Code anew.
 */
export const compactStudioChat = () =>
  bridge()?.studioChatCompact?.({
    brief: chatBrief(),
    ...scenePicks(),
  }) ?? Promise.resolve();

/**
 * The open project's chat asked to write the update note, for the publish
 * dialog; true when the ask went (`chatTurns.ts`).
 */
export const askStudioChatForNote = ({
  first,
  pressed = false,
}: {
  /** A first publication: the line says what the scene is, not what changed. */
  first: boolean;
  /** The member's press: it may start the scene's first conversation. */
  pressed?: boolean;
}): Promise<boolean> =>
  bridge()?.studioChatAskNote?.({
    brief: chatBrief(),
    ...scenePicks(),
    ...(first ? { first: true } : {}),
    ...(pressed ? { pressed: true } : {}),
  }) ?? Promise.resolve(false);

/**
 * The open project's chat asked to write the line the member set in the
 * publish dialog in every language; true when the ask went, false when there
 * is no chat to ask or a reply is running.
 *
 * Always the member's press — Send is pressed to ask it — so it may start
 * the scene's first conversation, as Write with AI may (Ivan, 2026-11-23:
 * "when there is only English note already is when it happens"). Without
 * it, a scene whose chat had never been opened refused every translation,
 * and its English line went out as written in every language.
 */
export const askStudioChatToTranslateNote = (
  line: string,
  from: string,
): Promise<boolean> =>
  bridge()?.studioChatAskNote?.({
    brief: chatBrief(),
    ...scenePicks(),
    translate: { line, from },
    pressed: true,
  }) ?? Promise.resolve(false);

/** A queued message taken back before it went. */
/** What waits in the queue, read by Claude now, on the member's picks. */
export const sendNowStudioChat = () =>
  bridge()?.studioChatSendNow?.({
    brief: chatBrief(),
    ...scenePicks(),
  }) ?? Promise.resolve();

export const unqueueStudioChat = (id: string) =>
  bridge()?.studioChatUnqueue?.(id) ?? Promise.resolve();

export const stopStudioChat = () =>
  bridge()?.studioChatStop?.() ?? Promise.resolve();

/**
 * A new chat in place of the open one, on the default model and effort
 * whatever the chat before it was on. Where main kept the open one (a reply
 * is running) it comes back with its own picks, and those stay.
 */
export const newStudioChat = async () => {
  const chat = await bridge()?.studioChatNew?.();
  set({ chat: taken(chat, true), ask: chat?.ask });
};

/** The open project's earlier chats, asked again each time they are shown. */
export const loadPastStudioChats = async () => {
  set({ past: undefined });
  const past = await bridge()?.studioChatPast?.();
  set({ past: past ?? [] });
};

/** An earlier chat in place of the open one, which joins the list. */
export const openPastStudioChat = async (id: string) => {
  // One Claude Code kept on its own was never a chat here: it starts on the
  // default, where one of FluidEQ's from before the chats kept their picks
  // takes what it stood on.
  const fresh =
    state.past?.find((past) => past.id === id)?.source === 'claude-code';
  const chat = await bridge()?.studioChatOpenPast?.(id);
  set({ chat: taken(chat, fresh), ask: chat?.ask });
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
  readings = new Map();
};
