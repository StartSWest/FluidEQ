import type {
  IForumTopicSummary,
  TForumAuthState,
  TForumResult,
} from 'common/forum/forumTypes';
import {
  bridge,
  call,
  failureOf,
  forumNow,
  type IForumState,
  listKey,
  NEW_BOARD,
  publish,
  tickets,
} from './forumState';
import { isTopicNew, markAllRead } from './forumUnread';

/**
 * What is new to this reader across every board: the rail's count, the
 * mark on a topic's row, and the list of only those, to answer one after
 * another (Ivan, 2026-10-13).
 */

const viewerOf = (auth: TForumAuthState) =>
  auth.status === 'signed-in' ? auth.viewer.login : undefined;

/** The topics with activity this reader has not seen, latest first. */
export const newTopics = (
  forum: Pick<IForumState, 'recent' | 'read' | 'auth'>,
): IForumTopicSummary[] =>
  forum.recent.filter((topic) =>
    isTopicNew(forum.read, topic, viewerOf(forum.auth)),
  );

/** Whether one topic shown in any list has something unread in it. */
export const isListedTopicNew = (
  forum: Pick<IForumState, 'read' | 'auth'>,
  topic: IForumTopicSummary,
): boolean => isTopicNew(forum.read, topic, viewerOf(forum.auth));

/**
 * Every board's topics, latest activity first, page after page until the
 * pages reach activity that is all read (`allReadAt`) or run out. Below
 * that line nothing can be new, so after "Mark all as read" this is one page.
 *
 * `reportFailure` false is the titlebar's count reading in the background: a
 * failure there leaves the count as it was and says nothing, because the
 * Forum's error bar would otherwise greet somebody who opens it later, online,
 * with a failure from before they arrived.
 */
export const loadRecent = async (reportFailure = true) => {
  tickets.recent += 1;
  const ticket = tickets.recent;
  publish({ recentStatus: 'loading' });
  const gathered: IForumTopicSummary[] = [];
  const page = async (cursor?: string): Promise<TForumResult<null>> => {
    const result = await call(() =>
      bridge()?.forumTopics?.({
        board: '',
        filter: 'all',
        search: '',
        ...(cursor ? { cursor } : {}),
      }),
    );
    if (!result.ok || ticket !== tickets.recent) {
      return result.ok ? { ok: true, value: null } : result;
    }
    const { topics } = result.value;
    gathered.push(
      ...topics.filter(
        (topic) => !gathered.some((known) => known.number === topic.number),
      ),
    );
    const oldest = topics[topics.length - 1];
    const reachedRead =
      oldest !== undefined &&
      Date.parse(oldest.updatedAt) <= forumNow().read.allReadAt;
    return result.value.cursor && !reachedRead
      ? page(result.value.cursor)
      : { ok: true, value: null };
  };
  const result = await page();
  if (ticket !== tickets.recent) {
    return;
  }
  if (result.ok) {
    publish({ recent: gathered, recentStatus: 'ready' });
  } else {
    publish({
      recentStatus: 'error',
      ...(reportFailure ? { error: failureOf(result) } : {}),
    });
  }
};

/** The new topics as the list's page, when the list is the new ones. */
export const showNewTopics = () => {
  const forum = forumNow();
  if (forum.board !== NEW_BOARD) {
    return;
  }
  const topics = newTopics(forum);
  publish({
    topics,
    listedFor: listKey(forum),
    total: topics.length,
    cursor: undefined,
    listStatus: forum.recentStatus === 'error' ? 'error' : 'ready',
  });
};

/** The new ones' list, read again from GitHub. */
export const loadNewTopics = async () => {
  tickets.list += 1;
  const ticket = tickets.list;
  publish({ listStatus: 'loading' });
  await loadRecent();
  if (ticket === tickets.list) {
    showNewTopics();
  }
};

/** Everything listed so far counts as read, here and in the new ones' list. */
export const markAllForumRead = () => {
  const forum = forumNow();
  publish({ read: markAllRead(forum.read, forum.recent) });
  showNewTopics();
};
