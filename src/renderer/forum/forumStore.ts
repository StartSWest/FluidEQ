import { useSyncExternalStore } from 'react';
import type {
  IForumBoard,
  IForumFailure,
  IForumTopic,
  IForumTopicSummary,
  TForumAuthState,
  TForumFilter,
  TForumPostKind,
  TForumResult,
} from 'common/forum/forumTypes';

/**
 * The forum, as one snapshot the panel reads.
 *
 * Nothing here reaches the network. The main process owns GitHub and the
 * feed; this side asks and is told, and keeps only what is on screen: the
 * boards, the page of topics under the current board or search, and the one
 * thread that is open.
 *
 * Answers can arrive out of order — switch boards twice quickly and the first
 * board's topics may land last — so every load carries a ticket, and an
 * answer whose ticket is no longer the current one is dropped rather than
 * painted over the newer one.
 */

export type TForumView =
  { kind: 'list' } | { kind: 'topic'; number: number } | { kind: 'compose' };

export type TLoadStatus = 'idle' | 'loading' | 'more' | 'ready' | 'error';

export interface IForumState {
  auth: TForumAuthState;
  boards: IForumBoard[];
  canStartIn: string[];
  boardsStatus: TLoadStatus;
  /** A board's slug, or empty for every board. */
  board: string;
  filter: TForumFilter;
  /** The search that produced the list — not what is being typed. */
  search: string;
  topics: IForumTopicSummary[];
  total: number;
  cursor?: string;
  listStatus: TLoadStatus;
  view: TForumView;
  topic?: IForumTopic;
  topicStatus: TLoadStatus;
  /** The last failure, until dismissed or something succeeds. */
  error?: IForumFailure;
}

const INITIAL: IForumState = {
  auth: { status: 'signed-out' },
  boards: [],
  canStartIn: [],
  boardsStatus: 'idle',
  board: '',
  filter: 'all',
  search: '',
  topics: [],
  total: 0,
  listStatus: 'idle',
  view: { kind: 'list' },
  topicStatus: 'idle',
};

let state: IForumState = INITIAL;
const listeners = new Set<() => void>();
const tickets = { boards: 0, list: 0, topic: 0 };
let unsubscribe: (() => void) | undefined;

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: Partial<IForumState>) => {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
};

const failureOf = (result: TForumResult<unknown>): IForumFailure | undefined =>
  result.ok
    ? undefined
    : {
        failure: result.failure,
        ...(result.retryAt === undefined ? {} : { retryAt: result.retryAt }),
        ...(result.detail === undefined ? {} : { detail: result.detail }),
      };

/** A bridge that is not there (tests, a broken preload) reads as offline. */
const OFFLINE: IForumFailure = { failure: 'network' };

const call = async <T>(
  request: (() => Promise<TForumResult<T>> | undefined) | undefined,
): Promise<TForumResult<T>> => (await request?.()) ?? { ok: false, ...OFFLINE };

const loadBoards = async () => {
  tickets.boards += 1;
  const ticket = tickets.boards;
  publish({ boardsStatus: 'loading' });
  const result = await call(() => bridge()?.forumBoards?.());
  if (ticket !== tickets.boards) {
    return;
  }
  if (result.ok) {
    publish({
      boards: result.value.boards,
      canStartIn: result.value.canStartIn,
      boardsStatus: 'ready',
    });
  } else {
    publish({ boardsStatus: 'error', error: failureOf(result) });
  }
};

const loadList = async (more = false) => {
  tickets.list += 1;
  const ticket = tickets.list;
  const cursor = more ? state.cursor : undefined;
  publish({ listStatus: more ? 'more' : 'loading' });
  const result = await call(() =>
    bridge()?.forumTopics?.({
      board: state.board,
      filter: state.filter,
      search: state.search,
      ...(cursor ? { cursor } : {}),
    }),
  );
  if (ticket !== tickets.list) {
    return;
  }
  if (!result.ok) {
    publish({ listStatus: 'error', error: failureOf(result) });
    return;
  }
  const page = result.value;
  // A page appended under a list that already shows some of the same topics
  // (one moved up while reading) keeps each topic once, where it was first.
  const seen = new Set(more ? state.topics.map((topic) => topic.number) : []);
  publish({
    topics: [
      ...(more ? state.topics : []),
      ...page.topics.filter((topic) => !seen.has(topic.number)),
    ],
    total: page.total,
    cursor: page.cursor,
    listStatus: 'ready',
  });
};

const loadTopic = async (number: number, more = false) => {
  tickets.topic += 1;
  const ticket = tickets.topic;
  const current = state.topic?.number === number ? state.topic : undefined;
  const cursor = more ? current?.commentsCursor : undefined;
  publish({
    topicStatus: more ? 'more' : 'loading',
    ...(current ? {} : { topic: undefined }),
  });
  const result = await call(() => bridge()?.forumTopic?.(number, cursor));
  if (ticket !== tickets.topic) {
    return;
  }
  if (!result.ok) {
    publish({ topicStatus: 'error', error: failureOf(result) });
    return;
  }
  const loaded = result.value;
  publish({
    topic:
      more && current
        ? {
            ...current,
            comments: [
              ...current.comments,
              ...loaded.comments.filter(
                (comment) =>
                  !current.comments.some((known) => known.id === comment.id),
              ),
            ],
            commentsCursor: loaded.commentsCursor,
          }
        : loaded,
    topicStatus: 'ready',
  });
};

/** Everything on screen again, from whichever source now answers. */
export const refreshForum = async (): Promise<void> => {
  const { view } = state;
  await Promise.all([
    loadBoards(),
    loadList(),
    view.kind === 'topic' ? loadTopic(view.number) : Promise.resolve(),
  ]);
};

/**
 * Which source what is on screen was read from. Signing in or out changes
 * which one answers — and what the reader may do to every post — so a change
 * of source reads everything again. "Signing in" is still the feed: the
 * browser is open and nothing on screen has changed yet.
 */
type TSource = 'github' | 'feed';
const sourceOf = (auth: TForumAuthState): TSource =>
  auth.status === 'signed-in' ? 'github' : 'feed';
let readFrom: TSource = 'feed';

const onAuth = (auth: TForumAuthState) => {
  publish({ auth });
  const source = sourceOf(auth);
  if (source !== readFrom) {
    readFrom = source;
    refreshForum().catch(() => undefined);
  }
};

/** The tab is on screen: listen for sign-in changes and read the forum. */
export const openForum = async (): Promise<void> => {
  const api = bridge();
  unsubscribe?.();
  unsubscribe = api?.onForumState?.(onAuth);
  const auth = await api?.forumState?.();
  if (auth) {
    publish({ auth });
    readFrom = sourceOf(auth);
  }
  await refreshForum();
};

export const closeForum = () => {
  unsubscribe?.();
  unsubscribe = undefined;
};

export const clearForumError = () => publish({ error: undefined });

export const selectBoard = (board: string) => {
  publish({ board, search: '', filter: 'all', view: { kind: 'list' } });
  loadList().catch(() => undefined);
};

export const setFilter = (filter: TForumFilter) => {
  publish({ filter });
  loadList().catch(() => undefined);
};

export const searchForum = (text: string) => {
  publish({ search: text.trim(), view: { kind: 'list' } });
  loadList().catch(() => undefined);
};

export const loadMoreTopics = () => {
  if (state.cursor && state.listStatus === 'ready') {
    loadList(true).catch(() => undefined);
  }
};

export const openTopic = (number: number) => {
  publish({ view: { kind: 'topic', number } });
  loadTopic(number).catch(() => undefined);
};

export const loadMoreComments = () => {
  const { topic } = state;
  if (topic?.commentsCursor && state.topicStatus === 'ready') {
    loadTopic(topic.number, true).catch(() => undefined);
  }
};

export const backToList = () => publish({ view: { kind: 'list' } });

export const startCompose = () => publish({ view: { kind: 'compose' } });

export const signIn = async (locale: string): Promise<void> => {
  const result = await call(() => bridge()?.forumSignIn?.(locale));
  // Cancelling is the person's own choice and needs no sentence.
  if (!result.ok && result.failure !== 'cancelled') {
    publish({ error: failureOf(result) });
  }
};

export const cancelSignIn = () => {
  bridge()
    ?.forumCancelSignIn?.()
    .catch(() => undefined);
};

export const signOut = async (): Promise<void> => {
  const auth = await bridge()?.forumSignOut?.();
  if (auth) {
    onAuth(auth);
  }
};

/**
 * Runs a write, then reads the thread back so what is shown is what GitHub
 * now holds — including anything somebody else posted in the meantime.
 * Resolves to whether it worked, so a composer knows to clear itself.
 */
const write = async (
  request: () => Promise<TForumResult<unknown>> | undefined,
): Promise<boolean> => {
  const result = await call(request);
  if (!result.ok) {
    publish({ error: failureOf(result) });
    return false;
  }
  publish({ error: undefined });
  if (state.view.kind === 'topic') {
    await loadTopic(state.view.number);
  }
  return true;
};

export const createTopic = async (
  board: string,
  title: string,
  body: string,
): Promise<boolean> => {
  const result = await call(() =>
    bridge()?.forumCreateTopic?.({ board, title, body }),
  );
  if (!result.ok) {
    publish({ error: failureOf(result) });
    return false;
  }
  publish({ error: undefined, board, search: '', filter: 'all' });
  openTopic(result.value);
  loadList().catch(() => undefined);
  loadBoards().catch(() => undefined);
  return true;
};

export const reply = (topicId: string, body: string, replyToId?: string) =>
  write(() =>
    bridge()?.forumReply?.({
      topicId,
      body,
      ...(replyToId ? { replyToId } : {}),
    }),
  );

export const editPost = (id: string, kind: TForumPostKind, body: string) =>
  write(() => bridge()?.forumEdit?.({ id, kind, body }));

export const editTitle = (topicId: string, title: string) =>
  write(() => bridge()?.forumEditTitle?.(topicId, title));

export const deletePost = (id: string) =>
  write(() => bridge()?.forumDelete?.(id));

export const markAnswer = (id: string, on: boolean) =>
  write(() => bridge()?.forumMarkAnswer?.(id, on));

/**
 * An upvote changes one number and one state on one post, so it is patched
 * in place from GitHub's answer rather than reading the whole thread again.
 */
export const upvote = async (id: string, on: boolean): Promise<void> => {
  const result = await call(() => bridge()?.forumUpvote?.(id, on));
  if (!result.ok) {
    publish({ error: failureOf(result) });
    return;
  }
  const { topic } = state;
  if (!topic) {
    return;
  }
  const patch = <
    T extends { id: string; upvotes: number; viewer?: { hasUpvoted: boolean } },
  >(
    post: T,
  ): T =>
    post.id === id && post.viewer
      ? {
          ...post,
          upvotes: result.value.upvotes,
          viewer: { ...post.viewer, hasUpvoted: result.value.hasUpvoted },
        }
      : post;
  publish({
    topic: {
      ...topic,
      post: patch(topic.post),
      upvotes: topic.post.id === id ? result.value.upvotes : topic.upvotes,
      comments: topic.comments.map((comment) => ({
        ...patch(comment),
        replies: comment.replies.map(patch),
      })),
    },
  });
};

export const previewMarkdown = (body: string) =>
  call(() => bridge()?.forumPreview?.(body));

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => state;

export const useForum = (): IForumState =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/** Test seam: back to a fresh store. */
export const resetForumStore = () => {
  closeForum();
  state = INITIAL;
  readFrom = 'feed';
  tickets.boards = 0;
  tickets.list = 0;
  tickets.topic = 0;
};
