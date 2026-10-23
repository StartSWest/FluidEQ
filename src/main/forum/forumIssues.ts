import {
  FORUM_ISSUES_BOARD,
  type IForumComment,
  type IForumTopic,
} from '../../common/forum/forumTypes';
import ForumError from './forumError';
import {
  bodyHtmlOf,
  createJsonFeed,
  feedPost,
  roleOf,
  votesOf,
} from './forumFeed';
import {
  arr,
  bool,
  excerptOf,
  httpsUrl,
  isRecord,
  num,
  person,
  rec,
  str,
} from './forumRead';

/**
 * The repository's GitHub Issues, as the Forum shows them (Ivan, 2026-10-16:
 * "include github issues in the forums so all can see them there").
 *
 * Read from `issues.json`, which the same workflow as the discussions' file
 * publishes beside it, for everybody, signed in or not. GitHub's API would
 * want the app to hold permission to read issues, and a GitHub App's token
 * that lacks it is refused even on a public repository's issues — the file
 * needs no permission of anybody's, and is at most a minute behind.
 *
 * An issue is read here and never written: replying, closing and labelling
 * stay on GitHub, which the thread links to.
 */

export interface IForumIssuesSource {
  load(): Promise<IForumTopic[]>;
}

const issueComment = (value: unknown): IForumComment => {
  const post = feedPost(value);
  return {
    ...post,
    threadId: post.id,
    isAnswer: false,
    replies: [],
    replyTotal: 0,
  };
};

const feedIssue = (value: unknown): IForumTopic | undefined => {
  const node = rec(value);
  const number = num(node.number);
  if (number <= 0) {
    return undefined;
  }
  const comments = arr(node.comments).map(issueComment);
  const url = httpsUrl(node.url) ?? '';
  const author = person(node.author);
  const createdAt = str(node.createdAt);
  const votes = votesOf(node);
  return {
    id: str(node.id),
    number,
    title: str(node.title),
    excerpt: excerptOf(str(node.body)),
    createdAt,
    updatedAt: str(node.updatedAt) || createdAt,
    url,
    board: FORUM_ISSUES_BOARD,
    // An issue is never "answered": closing one is its own state, below.
    answered: false,
    locked: bool(node.locked),
    replyCount: Math.max(comments.length, num(node.replies)),
    votes,
    author,
    issue: {
      closed: str(node.state) === 'closed',
      labels: arr(node.labels).filter(
        (label): label is string => typeof label === 'string' && label !== '',
      ),
    },
    post: {
      id: str(node.id),
      bodyHtml: bodyHtmlOf(node),
      createdAt,
      url,
      author,
      authorRole: roleOf(node.role),
      votes,
      minimized: false,
    },
    postKind: 'discussion',
    comments,
    commentTotal: Math.max(comments.length, num(node.replies)),
  };
};

export const readIssues = (payload: unknown): IForumTopic[] => {
  if (!isRecord(payload)) {
    throw new ForumError('network', 'The issues feed is unreadable.');
  }
  return arr(payload.issues)
    .map(feedIssue)
    .filter((issue): issue is IForumTopic => issue !== undefined);
};

/** No file yet — before the workflow first publishes one, or in a fork. */
const NO_ISSUES: IForumTopic[] = [];

export const createForumIssues = (
  url: string,
  fetchImpl: typeof fetch = fetch,
): IForumIssuesSource => createJsonFeed(url, readIssues, fetchImpl, NO_ISSUES);
