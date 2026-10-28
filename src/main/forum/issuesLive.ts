import {
  FORUM_ISSUES_BOARD,
  type IForumComment,
  type IForumPerson,
  type IForumTopic,
} from '../../common/forum/forumTypes';
import ForumError from './forumError';
import {
  arr,
  authorRole,
  excerptOf,
  httpsUrl,
  isRecord,
  num,
  person,
  rec,
  str,
} from './forumRead';

/**
 * The repository's issues as GitHub has them this second (Ivan, 2026-10-27:
 * "I am refreshing and the new post is not displayed").
 *
 * The published `issues.json` is rebuilt seconds after a comment, but
 * raw.githubusercontent.com serves it with `Cache-Control: max-age=300`, so
 * for five minutes after a reply every read of it — the app's included —
 * was the thread before the reply. Lists and threads are read from GitHub's
 * REST API instead, with no token: issues on a public repository are public,
 * and the sign-in's app holds no permission for issues to lend.
 *
 * Unauthenticated reads are limited to sixty an hour per address, so each URL
 * is asked for with the ETag of its last answer: a 304 says nothing changed
 * and costs nothing against that limit, which is what makes reading the
 * list on every return to the window affordable. A failure of any kind —
 * offline, the limit spent — is the caller's to answer with the published
 * file (`forumIssues.ts`), which is never more than five minutes behind.
 */

export interface IIssuesLive {
  /** Every issue, latest activity first; pull requests left out. */
  list(): Promise<IForumTopic[]>;
  /** One issue and every comment on it. */
  thread(number: number): Promise<IForumTopic>;
}

interface IIssuesLiveDeps {
  owner: string;
  name: string;
  fetchImpl?: typeof fetch;
}

const API = 'https://api.github.com';

/** Asks for the HTML GitHub renders and the plain text beside the markdown. */
const FULL = 'application/vnd.github.full+json';

/** `<url>; rel="next"` out of GitHub's Link header, when there is a next page. */
export const nextPage = (link: string | null): string | undefined =>
  link
    ?.split(',')
    .map((part) => /<([^>]+)>\s*;\s*rel="next"/.exec(part)?.[1])
    .find((url): url is string => url !== undefined);

const userOf = (value: unknown): IForumPerson => {
  const user = rec(value);
  return person({
    login: str(user.login),
    avatarUrl: str(user.avatar_url),
    url: str(user.html_url),
  });
};

/** The 👍 count, which is what a vote is everywhere in the Forum. */
const thumbsOf = (node: Record<string, unknown>): number =>
  num(rec(node.reactions)['+1']);

const labelsOf = (value: unknown): string[] =>
  arr(value)
    .map((label) => (typeof label === 'string' ? label : str(rec(label).name)))
    .filter((label) => label !== '');

export const readLiveIssue = (value: unknown): IForumTopic | undefined => {
  const node = rec(value);
  const number = num(node.number);
  // The issues endpoint lists pull requests too; they are not issues here.
  if (number <= 0 || node.pull_request !== undefined) {
    return undefined;
  }
  const author = userOf(node.user);
  const createdAt = str(node.created_at);
  const url = httpsUrl(node.html_url) ?? '';
  const votes = thumbsOf(node);
  const replies = num(node.comments);
  return {
    id: str(node.node_id),
    number,
    title: str(node.title),
    excerpt: excerptOf(str(node.body_text) || str(node.body)),
    createdAt,
    updatedAt: str(node.updated_at) || createdAt,
    url,
    board: FORUM_ISSUES_BOARD,
    answered: false,
    locked: node.locked === true,
    replyCount: replies,
    votes,
    author,
    issue: {
      closed: str(node.state) === 'closed',
      labels: labelsOf(node.labels),
    },
    post: {
      id: str(node.node_id),
      bodyHtml: str(node.body_html),
      createdAt,
      url,
      author,
      authorRole: authorRole(node.author_association),
      votes,
      minimized: false,
    },
    postKind: 'discussion',
    comments: [],
    commentTotal: replies,
  };
};

export const readLiveComment = (value: unknown): IForumComment => {
  const node = rec(value);
  const id = str(node.node_id);
  return {
    id,
    threadId: id,
    bodyHtml: str(node.body_html),
    createdAt: str(node.created_at),
    url: httpsUrl(node.html_url) ?? '',
    author: userOf(node.user),
    authorRole: authorRole(node.author_association),
    votes: thumbsOf(node),
    minimized: false,
    isAnswer: false,
    replies: [],
    replyTotal: 0,
  };
};

export const createIssuesLive = ({
  owner,
  name,
  fetchImpl = fetch,
}: IIssuesLiveDeps): IIssuesLive => {
  const remembered = new Map<string, { etag: string; body: unknown }>();

  /** One page, by its ETag when it has been read before. */
  const page = async (
    url: string,
  ): Promise<{ body: unknown; next?: string }> => {
    const known = remembered.get(url);
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          Accept: FULL,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(known ? { 'If-None-Match': known.etag } : {}),
        },
      });
    } catch (error) {
      throw new ForumError('network', `GitHub could not be reached: ${error}`);
    }
    const next = nextPage(response.headers.get('link'));
    if (response.status === 304 && known) {
      return { body: known.body, ...(next ? { next } : {}) };
    }
    if (!response.ok) {
      throw new ForumError(
        response.status === 403 || response.status === 429
          ? 'rate_limited'
          : 'network',
        `GitHub answered ${response.status} for ${url}.`,
      );
    }
    const body: unknown = await response.json();
    const etag = response.headers.get('etag');
    if (etag) {
      remembered.set(url, { etag, body });
    }
    return { body, ...(next ? { next } : {}) };
  };

  /** Every page of a list, following GitHub's own next links. */
  const all = async (first: string): Promise<unknown[]> => {
    const rows: unknown[] = [];
    let url: string | undefined = first;
    while (url) {
      // eslint-disable-next-line no-await-in-loop -- each page's address comes from the answer before it.
      const { body, next } = await page(url);
      rows.push(...arr(body));
      url = next;
    }
    return rows;
  };

  const repo = `${API}/repos/${owner}/${name}`;

  return {
    list: async () =>
      (
        await all(
          `${repo}/issues?state=all&sort=updated&direction=desc&per_page=100`,
        )
      )
        .map(readLiveIssue)
        .filter((issue): issue is IForumTopic => issue !== undefined),

    thread: async (number) => {
      const [{ body }, comments] = await Promise.all([
        page(`${repo}/issues/${number}`),
        all(`${repo}/issues/${number}/comments?per_page=100`),
      ]);
      const issue = isRecord(body) ? readLiveIssue(body) : undefined;
      if (!issue) {
        throw new ForumError('not_found', `GitHub has no issue ${number}.`);
      }
      const read = comments.map(readLiveComment);
      return {
        ...issue,
        comments: read,
        replyCount: Math.max(issue.replyCount, read.length),
        commentTotal: Math.max(issue.commentTotal, read.length),
      };
    },
  };
};
