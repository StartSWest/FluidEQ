import { useSyncExternalStore } from 'react';
import type {
  ICommunityChannel,
  ICommunityMention,
  ICommunityMessage,
  ICommunityProfile,
  TCommunityFailure,
} from 'main/community/communityApi';
import type { ILiveEvent, TLiveStatus } from 'main/community/communityLive';
import type { TCommunityResult } from 'main/ipc/community';

/**
 * The community, as one snapshot the panel reads.
 *
 * Messages are kept per channel, ascending by id, and de-duplicated by id —
 * a message the panel just sent comes back twice, once as the reply to the
 * send and once over the live feed, and it must appear once. Authors are
 * remembered separately because a live insert carries the row alone; the
 * handle and name are filled in from what has already been seen, and a
 * message from somebody never seen before triggers one refetch of the newest
 * page rather than showing an anonymous row.
 *
 * Nothing here reaches the network. The main process owns the socket and the
 * requests; this side asks, and is told.
 */

export interface ICommunityState {
  channels: ICommunityChannel[];
  activeChannelId: string;
  messagesByChannel: Readonly<Record<string, readonly ICommunityMessage[]>>;
  hasMoreByChannel: Readonly<Record<string, boolean>>;
  loadingChannel?: string;
  profile?: ICommunityProfile;
  /** Whether the profile has been asked for at least once. */
  profileLoaded: boolean;
  blocks: readonly string[];
  unreadMentions: readonly ICommunityMention[];
  live: TLiveStatus;
  /** The last failure, until the next successful action clears it. */
  error?: TCommunityFailure;
  /** Id of a message just reported, for the row to acknowledge it. */
  reported: readonly number[];
}

const PAGE = 50;

const INITIAL: ICommunityState = {
  channels: [],
  activeChannelId: 'general',
  messagesByChannel: {},
  hasMoreByChannel: {},
  profileLoaded: false,
  blocks: [],
  unreadMentions: [],
  live: 'closed',
  reported: [],
};

interface IAuthor {
  handle: string;
  displayName: string;
  role: ICommunityMessage['role'];
}

let state: ICommunityState = INITIAL;
const listeners = new Set<() => void>();
const authors = new Map<string, IAuthor>();
let unsubscribeEvents: () => void = () => {};
let unsubscribeStatus: () => void = () => {};
let opened = false;

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: Partial<ICommunityState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const fail = (failure: TCommunityFailure) => publish({ error: failure });

const unwrap = <T>(result: TCommunityResult<T> | undefined): T | undefined => {
  if (!result) {
    return undefined;
  }
  if (!result.ok) {
    fail(result.failure);
    return undefined;
  }
  return result.value;
};

const rememberAuthors = (messages: readonly ICommunityMessage[]) => {
  messages.forEach((message) => {
    if (message.handle) {
      authors.set(message.userId, {
        handle: message.handle,
        displayName: message.displayName,
        role: message.role,
      });
    }
  });
};

const withAuthor = (message: ICommunityMessage): ICommunityMessage => {
  if (message.handle) {
    return message;
  }
  const known = authors.get(message.userId);
  return known ? { ...message, ...known } : message;
};

/** Merge into a channel's list: ascending, unique by id. */
const merge = (
  existing: readonly ICommunityMessage[],
  incoming: readonly ICommunityMessage[],
): ICommunityMessage[] => {
  const byId = new Map<number, ICommunityMessage>();
  existing.forEach((message) => byId.set(message.id, message));
  incoming.forEach((message) => byId.set(message.id, withAuthor(message)));
  return [...byId.values()].sort((a, b) => a.id - b.id);
};

const setChannelMessages = (
  channelId: string,
  messages: readonly ICommunityMessage[],
  hasMore?: boolean,
) => {
  publish({
    messagesByChannel: { ...state.messagesByChannel, [channelId]: messages },
    hasMoreByChannel:
      hasMore === undefined
        ? state.hasMoreByChannel
        : { ...state.hasMoreByChannel, [channelId]: hasMore },
  });
};

const loadNewest = async (channelId: string) => {
  publish({ loadingChannel: channelId });
  const page = unwrap(await bridge()?.communityMessages?.(channelId));
  if (page) {
    rememberAuthors(page);
    setChannelMessages(
      channelId,
      merge(state.messagesByChannel[channelId] ?? [], page),
      page.length >= PAGE,
    );
  }
  publish({ loadingChannel: undefined });
};

const onEvent = (event: ILiveEvent) => {
  const { message } = event;
  const current = state.messagesByChannel[message.channelId];
  if (event.kind === 'deleted') {
    if (current) {
      setChannelMessages(
        message.channelId,
        current.filter((entry) => entry.id !== message.id),
      );
    }
    return;
  }
  if (state.blocks.includes(message.userId)) {
    return;
  }
  if (!current) {
    // A channel not loaded yet: nothing to append to; it loads when opened.
    return;
  }
  const filled = withAuthor(message);
  if (!filled.handle) {
    // Somebody never seen before. One refetch of the newest page brings their
    // handle with it; cheaper than an anonymous row that has to be fixed later.
    loadNewest(message.channelId).catch(() => undefined);
    return;
  }
  setChannelMessages(message.channelId, merge(current, [filled]));
  const me = state.profile;
  if (
    me &&
    filled.userId !== me.userId &&
    filled.body.toLowerCase().includes(`@${me.handle}`)
  ) {
    publish({
      unreadMentions: [
        ...state.unreadMentions,
        { messageId: filled.id, channelId: filled.channelId },
      ],
    });
  }
};

export const subscribeCommunity = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getCommunitySnapshot = (): ICommunityState => state;

export const useCommunity = (): ICommunityState =>
  useSyncExternalStore(
    subscribeCommunity,
    getCommunitySnapshot,
    getCommunitySnapshot,
  );

/**
 * The tab came on screen: open the live feed and fetch what the panel needs.
 * Idempotent, so a re-render cannot open two sockets.
 */
export const openCommunity = async () => {
  if (opened) {
    return;
  }
  opened = true;
  const api = bridge();
  unsubscribeEvents = api?.onCommunityEvent?.(onEvent) ?? (() => {});
  unsubscribeStatus =
    api?.onCommunityLiveStatus?.((live) => publish({ live })) ?? (() => {});
  const live = await api?.communityOpen?.();
  if (live) {
    publish({ live });
  }
  const [profile, channels, blocks, mentions] = await Promise.all([
    api?.communityProfile?.(),
    api?.communityChannels?.(),
    api?.communityBlocks?.(),
    api?.communityMentions?.(),
  ]);
  publish({
    profile: unwrap(profile) ?? undefined,
    profileLoaded: true,
    channels: unwrap(channels) ?? state.channels,
    blocks: unwrap(blocks) ?? state.blocks,
    unreadMentions: unwrap(mentions) ?? state.unreadMentions,
  });
  if (
    state.channels.length > 0 &&
    !state.channels.some((channel) => channel.id === state.activeChannelId)
  ) {
    publish({ activeChannelId: state.channels[0].id });
  }
  await loadNewest(state.activeChannelId);
};

/** The tab left: close the socket. Everything loaded is kept for next time. */
export const closeCommunity = () => {
  if (!opened) {
    return;
  }
  opened = false;
  unsubscribeEvents();
  unsubscribeStatus();
  unsubscribeEvents = () => {};
  unsubscribeStatus = () => {};
  bridge()
    ?.communityClose?.()
    .catch(() => undefined);
  publish({ live: 'closed' });
};

export const selectChannel = async (channelId: string) => {
  publish({ activeChannelId: channelId, error: undefined });
  if (!state.messagesByChannel[channelId]) {
    await loadNewest(channelId);
  }
  // Seeing the channel reads the mentions in it.
  const inChannel = state.unreadMentions.filter(
    (mention) => mention.channelId === channelId,
  );
  if (inChannel.length > 0) {
    publish({
      unreadMentions: state.unreadMentions.filter(
        (mention) => mention.channelId !== channelId,
      ),
    });
    await bridge()?.communityMentionsRead?.(
      inChannel.map((mention) => mention.messageId),
    );
  }
};

export const loadOlder = async () => {
  const channelId = state.activeChannelId;
  const current = state.messagesByChannel[channelId] ?? [];
  const oldest = current[0]?.id;
  if (oldest === undefined || state.loadingChannel) {
    return;
  }
  publish({ loadingChannel: channelId });
  const page = unwrap(await bridge()?.communityMessages?.(channelId, oldest));
  if (page) {
    rememberAuthors(page);
    setChannelMessages(channelId, merge(current, page), page.length >= PAGE);
  }
  publish({ loadingChannel: undefined });
};

export const sendMessage = async (body: string): Promise<boolean> => {
  const channelId = state.activeChannelId;
  const sent = unwrap(await bridge()?.communitySend?.(channelId, body));
  if (!sent) {
    return false;
  }
  rememberAuthors([sent]);
  setChannelMessages(
    channelId,
    merge(state.messagesByChannel[channelId] ?? [], [sent]),
  );
  publish({ error: undefined });
  return true;
};

export const createProfile = async (
  handle: string,
  displayName: string,
): Promise<boolean> => {
  const profile = unwrap(
    await bridge()?.communityCreateProfile?.(handle, displayName),
  );
  if (!profile) {
    return false;
  }
  publish({ profile, error: undefined });
  return true;
};

export const acceptConduct = async (): Promise<boolean> => {
  const result = await bridge()?.communityAcceptConduct?.();
  if (!result?.ok) {
    if (result) {
      fail(result.failure);
    }
    return false;
  }
  if (state.profile) {
    publish({
      profile: { ...state.profile, acceptedConductAt: Date.now() },
      error: undefined,
    });
  }
  return true;
};

export const deleteMessage = async (id: number) => {
  const result = await bridge()?.communityDelete?.(id);
  if (result?.ok) {
    const channelId = state.activeChannelId;
    setChannelMessages(
      channelId,
      (state.messagesByChannel[channelId] ?? []).filter(
        (message) => message.id !== id,
      ),
    );
  } else if (result) {
    fail(result.failure);
  }
};

export const reportMessage = async (id: number, reason: string) => {
  const result = await bridge()?.communityReport?.(id, reason);
  if (result?.ok) {
    publish({ reported: [...state.reported, id] });
  } else if (result) {
    fail(result.failure);
  }
};

export const blockUser = async (userId: string) => {
  const result = await bridge()?.communityBlock?.(userId);
  if (!result?.ok) {
    if (result) {
      fail(result.failure);
    }
    return;
  }
  const blocks = [...state.blocks, userId];
  const messagesByChannel = Object.fromEntries(
    Object.entries(state.messagesByChannel).map(([channel, messages]) => [
      channel,
      messages.filter((message) => message.userId !== userId),
    ]),
  );
  publish({ blocks, messagesByChannel });
};

export const unblockUser = async (userId: string) => {
  const result = await bridge()?.communityUnblock?.(userId);
  if (result?.ok) {
    publish({ blocks: state.blocks.filter((entry) => entry !== userId) });
    // Their messages come back on the next load of each channel.
    publish({ messagesByChannel: {} });
    await loadNewest(state.activeChannelId);
  } else if (result) {
    fail(result.failure);
  }
};

export const clearCommunityError = () => publish({ error: undefined });

/** For tests: a clean module between runs. */
export const resetCommunityStore = () => {
  closeCommunity();
  authors.clear();
  listeners.clear();
  state = INITIAL;
};
