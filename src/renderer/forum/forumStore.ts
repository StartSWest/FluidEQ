import type {
  TForumAuthState,
  TForumFilter,
  TForumPostKind,
  TForumResult,
} from 'common/forum/forumTypes';
import { loadNewTopics, loadRecent, showNewTopics } from './forumNew';
import {
  bridge,
  call,
  failureOf,
  forumNow,
  listKey,
  NEW_BOARD,
  publish,
  resetForumState,
  tickets,
} from './forumState';
import { markTopicRead, readForumRead, readUpTo } from './forumUnread';

export {
  type IForumState,
  type TForumView,
  type TLoadStatus,
  listKey,
  NEW_BOARD,
  useForum,
} from './forumState';
export { isListedTopicNew, markAllForumRead, newTopics } from './forumNew';

/**
 * The forum's loads and writes.
 *
 * Nothing here reaches the network. The main process owns GitHub and the
 * feed; this side asks and is told, and keeps only what is on screen: the
 * boards, the page of topics under the current board or search, and the one
 * thread that is open (`forumState.ts`).
 */

let unsubscribe: (() => void) | undefined;

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
  if (forumNow().board === NEW_BOARD) {
    await loadNewTopics();
    return;
  }
  tickets.list += 1;
  const ticket = tickets.list;
  const cursor = more ? forumNow().cursor : undefined;
  const asked = listKey(forumNow());
  publish({ listStatus: more ? 'more' : 'loading' });
  const result = await call(() =>
    bridge()?.forumTopics?.({
      board: forumNow().board,
      filter: forumNow().filter,
      search: forumNow().search,
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
  const seen = new Set(
    more ? forumNow().topics.map((topic) => topic.number) : [],
  );
  publish({
    topics: [
      ...(more ? forumNow().topics : []),
      ...page.topics.filter((topic) => !seen.has(topic.number)),
    ],
    listedFor: asked,
    total: page.total,
    cursor: page.cursor,
    listStatus: 'ready',
  });
};

const loadTopic = async (number: number, more = false) => {
  tickets.topic += 1;
  const ticket = tickets.topic;
  const { topic } = forumNow();
  const current = topic?.number === number ? topic : undefined;
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
  // Opening a topic reads it, and so does every reload while it is open:
  // what is on screen has been seen.
  publish({
    read: markTopicRead(forumNow().read, loaded),
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
  const { view } = forumNow();
  await Promise.all([
    loadBoards(),
    loadList(),
    // The new ones' list reads them itself.
    forumNow().board === NEW_BOARD ? Promise.resolve() : loadRecent(),
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
  publish({ read: readForumRead() });
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
  if (forumNow().cursor && forumNow().listStatus === 'ready') {
    loadList(true).catch(() => undefined);
  }
};

export const openTopic = (number: number) => {
  publish({
    view: { kind: 'topic', number },
    openedReadAt: readUpTo(forumNow().read, number),
  });
  loadTopic(number).catch(() => undefined);
};

export const loadMoreComments = () => {
  const { topic } = forumNow();
  if (topic?.commentsCursor && forumNow().topicStatus === 'ready') {
    loadTopic(topic.number, true).catch(() => undefined);
  }
};

export const backToList = () => {
  publish({ view: { kind: 'list' } });
  // A topic read from the new ones' list leaves it on the way back.
  showNewTopics();
};

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
  const { view } = forumNow();
  if (view.kind === 'topic') {
    await loadTopic(view.number);
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
 * A vote changes one number and one state on one post, so it is patched in
 * place from GitHub's answer rather than reading the whole thread again.
 */
export const vote = async (id: string, on: boolean): Promise<void> => {
  const result = await call(() => bridge()?.forumVote?.(id, on));
  if (!result.ok) {
    publish({ error: failureOf(result) });
    return;
  }
  const { topic } = forumNow();
  if (!topic) {
    return;
  }
  const patch = <
    T extends { id: string; votes: number; viewer?: { hasVoted: boolean } },
  >(
    post: T,
  ): T =>
    post.id === id && post.viewer
      ? {
          ...post,
          votes: result.value.votes,
          viewer: { ...post.viewer, hasVoted: result.value.hasVoted },
        }
      : post;
  publish({
    topic: {
      ...topic,
      post: patch(topic.post),
      votes: topic.post.id === id ? result.value.votes : topic.votes,
      comments: topic.comments.map((comment) => ({
        ...patch(comment),
        replies: comment.replies.map(patch),
      })),
    },
  });
};

export const previewMarkdown = (body: string) =>
  call(() => bridge()?.forumPreview?.(body));

/** Test seam: back to a fresh store. */
export const resetForumStore = () => {
  closeForum();
  resetForumState();
  readFrom = 'feed';
};
