import {
  FORUM_ISSUES_BOARD,
  type IForumTopicSummary,
  type TForumAuthState,
  type TForumResult,
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
 * One list's rows, latest activity first, page after page until the pages
 * reach activity that is all read (`allReadAt`) or run out. Below that line
 * nothing can be new, so after "Mark all as read" this is one page.
 */
const gatherRecent = async (
  board: string,
  ticket: number,
): Promise<TForumResult<IForumTopicSummary[]>> => {
  const gathered: IForumTopicSummary[] = [];
  const page = async (cursor?: string): Promise<TForumResult<null>> => {
    const result = await call(() =>
      bridge()?.forumTopics?.({
        board,
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
  return result.ok ? { ok: true, value: gathered } : result;
};

const byLatest = (a: IForumTopicSummary, b: IForumTopicSummary) =>
  b.updatedAt.localeCompare(a.updatedAt);

/**
 * What the new ones are picked from: every board's topics and the
 * repository's issues (Ivan, 2026-10-16: "be able to see the yellow number
 * for the issue too"), latest activity first.
 *
 * The issues come from a file of their own, so a failure to read them keeps
 * the issues already known and still shows what is new in the topics; a
 * failure to read the topics is the failure.
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
  const [topics, issues] = await Promise.all([
    gatherRecent('', ticket),
    gatherRecent(FORUM_ISSUES_BOARD, ticket),
  ]);
  if (ticket !== tickets.recent) {
    return;
  }
  if (!topics.ok) {
    publish({
      recentStatus: 'error',
      ...(reportFailure ? { error: failureOf(topics) } : {}),
    });
    return;
  }
  const knownIssues = forumNow().recent.filter((row) => row.issue);
  publish({
    recent: [...topics.value, ...(issues.ok ? issues.value : knownIssues)].sort(
      byLatest,
    ),
    recentStatus: 'ready',
  });
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
