import type {
  IForumBoard,
  IForumComment,
  IForumPost,
  IForumTopic,
  TForumAuthorRole,
} from '../../common/forum/forumTypes';
import ForumError from './forumError';
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
 * The forum for somebody who has not signed in to GitHub.
 *
 * GitHub's API wants a token even for discussions anybody can read on the
 * website, so a reader with no GitHub sign-in reads the file the repository's
 * own workflow publishes on every discussion event — the same file
 * fluideq.com reads. It is a few minutes behind at worst and needs no
 * credential of any kind.
 *
 * Fetched conditionally: the ETag comes back as a 304 with no body when
 * nothing changed, so opening the tab again costs a round trip and nothing
 * more. Concurrent callers share one request.
 */

export interface IForumFeed {
  boards: IForumBoard[];
  topics: IForumTopic[];
}

export interface IForumFeedSource {
  load(): Promise<IForumFeed>;
}

const ROLES: readonly TForumAuthorRole[] = ['maker', 'maintainer', 'none'];

const roleOf = (value: unknown): TForumAuthorRole =>
  ROLES.find((role) => role === value) ?? 'none';

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Plain text as paragraphs, for the older feed that carried comment bodies as
 * text only. Escaped here and allow-listed again by the renderer like any
 * other body, so the one path to the screen stays the one path.
 */
export const textToHtml = (text: string): string =>
  text
    .trim()
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim() !== '')
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`,
    )
    .join('\n');

const bodyHtmlOf = (node: Record<string, unknown>): string =>
  str(node.bodyHtml) || textToHtml(str(node.body));

const feedPost = (value: unknown): IForumPost => {
  const node = rec(value);
  return {
    id: str(node.id),
    bodyHtml: bodyHtmlOf(node),
    createdAt: str(node.createdAt),
    url: httpsUrl(node.url) ?? '',
    author: person(node.author),
    authorRole: roleOf(node.role),
    upvotes: num(node.upvotes),
    minimized: bool(node.isMinimized),
  };
};

const feedComment = (value: unknown): IForumComment => {
  const node = rec(value);
  const post = feedPost(node);
  const replies = arr(node.replies).map(feedPost);
  return {
    ...post,
    threadId: post.id,
    isAnswer: bool(node.isAnswer),
    replies,
    replyTotal: Math.max(replies.length, num(node.replyTotal)),
  };
};

const feedTopic = (value: unknown): IForumTopic | undefined => {
  const node = rec(value);
  const number = num(node.number);
  if (number <= 0) {
    return undefined;
  }
  const comments = arr(node.comments).map(feedComment);
  const url = httpsUrl(node.url) ?? '';
  const author = person(node.author);
  const createdAt = str(node.createdAt);
  const upvotes = num(node.upvotes);
  return {
    id: str(node.id),
    number,
    title: str(node.title),
    // The whole text first: the feed's own excerpt is cut at a character
    // count, mid-word, and a second cut here could not put the word back.
    excerpt: excerptOf(str(node.body) || str(node.excerpt)),
    createdAt,
    updatedAt: str(node.updatedAt) || createdAt,
    url,
    board: str(node.categorySlug),
    answered: bool(node.answered),
    locked: bool(node.locked),
    replyCount: num(node.replies),
    upvotes,
    author,
    post: {
      id: str(node.postId) || str(node.id),
      bodyHtml: bodyHtmlOf(node),
      createdAt,
      url,
      author,
      authorRole: roleOf(node.role),
      upvotes,
      minimized: false,
    },
    postKind: bool(node.viaSite) ? 'comment' : 'discussion',
    comments,
    commentTotal: Math.max(comments.length, num(node.replies)),
  };
};

const feedBoard = (value: unknown): IForumBoard => {
  const node = rec(value);
  return {
    id: str(node.id),
    slug: str(node.slug),
    name: str(node.name),
    emoji: str(node.emoji),
    description: str(node.description),
    isAnswerable: bool(node.isAnswerable),
  };
};

/**
 * The boards, from the feed's own list when it has one. The older feed had
 * none, so they are gathered from the topics instead — which misses empty
 * boards and cannot know which ones take answers, except GitHub's default
 * Q&A, whose slug is fixed.
 */
const boardsOf = (
  payload: Record<string, unknown>,
  topics: readonly IForumTopic[],
): IForumBoard[] => {
  const listed = arr(payload.categories)
    .map(feedBoard)
    .filter((board) => board.slug !== '');
  const boards: IForumBoard[] = listed.length
    ? listed
    : arr(payload.topics).reduce<IForumBoard[]>((found, value) => {
        const node = rec(value);
        const slug = str(node.categorySlug);
        if (slug && !found.some((board) => board.slug === slug)) {
          found.push({
            id: '',
            slug,
            name: str(node.category) || slug,
            emoji: str(node.emoji),
            description: '',
            isAnswerable: slug === 'q-a',
          });
        }
        return found;
      }, []);
  return boards.map((board) => ({
    ...board,
    topicCount: topics.filter((topic) => topic.board === board.slug).length,
  }));
};

export const readFeed = (payload: unknown): IForumFeed => {
  if (!isRecord(payload)) {
    throw new ForumError('network', 'The discussions feed is unreadable.');
  }
  const topics = arr(payload.topics)
    .map(feedTopic)
    .filter((topic): topic is IForumTopic => topic !== undefined);
  return { boards: boardsOf(payload, topics), topics };
};

export const createForumFeed = (
  url: string,
  fetchImpl: typeof fetch = fetch,
): IForumFeedSource => {
  let cached: { etag: string; feed: IForumFeed } | undefined;
  let inFlight: Promise<IForumFeed> | undefined;

  const fetchFeed = async (): Promise<IForumFeed> => {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: cached ? { 'If-None-Match': cached.etag } : {},
      });
    } catch (error) {
      if (cached) {
        // Offline with a copy in hand: the copy is a better answer than an
        // error page, and the next attempt will try the network again.
        return cached.feed;
      }
      throw new ForumError(
        'network',
        `The feed could not be reached: ${error}`,
      );
    }
    if (response.status === 304 && cached) {
      return cached.feed;
    }
    if (!response.ok) {
      if (cached) {
        return cached.feed;
      }
      throw new ForumError('network', `The feed answered ${response.status}.`);
    }
    const feed = readFeed(await response.json());
    const etag = response.headers.get('etag');
    cached = etag ? { etag, feed } : undefined;
    return feed;
  };

  return {
    load: () => {
      inFlight =
        inFlight ??
        fetchFeed().finally(() => {
          inFlight = undefined;
        });
      return inFlight;
    },
  };
};
