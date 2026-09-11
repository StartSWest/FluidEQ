import type {
  IForumBoard,
  IForumComment,
  IForumPost,
  IForumPostViewer,
  IForumTopic,
  IForumTopicPage,
  IForumTopicSummary,
} from '../../common/forum/forumTypes';
import {
  arr,
  authorRole,
  bool,
  emojiOf,
  excerptOf,
  httpsUrl,
  isGiscus,
  isRecord,
  num,
  person,
  rec,
  str,
} from './forumRead';

/**
 * GitHub's GraphQL answers, reduced to the forum's model. The field names
 * read here are the ones `forumQueries.ts` asks for.
 */

export interface IRepositoryBoards {
  repositoryId: string;
  /** Admins and maintainers may open topics under Announcements. */
  canAnnounce: boolean;
  boards: IForumBoard[];
}

const readBoard = (value: unknown): IForumBoard => {
  const node = rec(value);
  return {
    id: str(node.id),
    slug: str(node.slug),
    name: str(node.name),
    emoji: emojiOf(node.emojiHTML),
    description: str(node.description),
    isAnswerable: bool(node.isAnswerable),
  };
};

export const readBoards = (data: unknown): IRepositoryBoards => {
  const repository = rec(rec(data).repository);
  const permission = str(repository.viewerPermission);
  return {
    repositoryId: str(repository.id),
    canAnnounce: permission === 'ADMIN' || permission === 'MAINTAIN',
    boards: arr(rec(repository.discussionCategories).nodes)
      .map(readBoard)
      .filter((board) => board.slug !== '' && board.id !== ''),
  };
};

/** Pairs `boardCountsQuery`'s `c0…cN` aliases back with their boards. */
export const readBoardCounts = (
  data: unknown,
  boards: readonly IForumBoard[],
): IForumBoard[] => {
  const repository = rec(rec(data).repository);
  return boards.map((board, index) => ({
    ...board,
    topicCount: num(rec(repository[`c${index}`]).totalCount),
  }));
};

const readViewer = (node: Record<string, unknown>): IForumPostViewer => ({
  canEdit: bool(node.viewerCanUpdate),
  canDelete: bool(node.viewerCanDelete),
  canUpvote: bool(node.viewerCanUpvote),
  hasUpvoted: bool(node.viewerHasUpvoted),
  canMarkAnswer: bool(node.viewerCanMarkAsAnswer),
  canUnmarkAnswer: bool(node.viewerCanUnmarkAsAnswer),
});

const readPost = (value: unknown): IForumPost => {
  const node = rec(value);
  const viewer = readViewer(node);
  const editedAt = str(node.lastEditedAt);
  return {
    id: str(node.id),
    bodyHtml: str(node.bodyHTML),
    // The source only travels when it can be edited; nobody else needs it.
    ...(viewer.canEdit ? { body: str(node.body) } : {}),
    createdAt: str(node.createdAt),
    ...(editedAt ? { editedAt } : {}),
    url: httpsUrl(node.url) ?? '',
    author: person(node.author),
    authorRole: authorRole(node.authorAssociation),
    upvotes: num(node.upvoteCount),
    minimized: bool(node.isMinimized),
    viewer,
  };
};

const readComment = (value: unknown): IForumComment => {
  const node = rec(value);
  const post = readPost(node);
  const replies = rec(node.replies);
  return {
    ...post,
    threadId: post.id,
    isAnswer: bool(node.isAnswer),
    replies: arr(replies.nodes).map(readPost),
    replyTotal: num(replies.totalCount),
  };
};

export const readTopicSummary = (
  value: unknown,
): IForumTopicSummary | undefined => {
  const node = rec(value);
  const number = num(node.number);
  if (number <= 0) {
    return undefined;
  }
  const author = person(node.author);
  const openingNode = arr(rec(node.opening).nodes)[0];
  const opening =
    isGiscus(author) && isRecord(openingNode) ? openingNode : undefined;
  return {
    id: str(node.id),
    number,
    title: str(node.title),
    excerpt: excerptOf(str(opening ? opening.bodyText : node.bodyText)),
    createdAt: str(node.createdAt),
    updatedAt: str(node.updatedAt),
    url: httpsUrl(node.url) ?? '',
    board: str(rec(node.category).slug),
    answered: isRecord(node.answer),
    locked: bool(node.locked),
    replyCount: Math.max(
      0,
      num(rec(node.comments).totalCount) - (opening ? 1 : 0),
    ),
    upvotes: num(node.upvoteCount),
    author: opening ? person(opening.author) : author,
  };
};

export const readTopicPage = (
  connection: unknown,
  total: number,
): IForumTopicPage => {
  const page = rec(connection);
  const info = rec(page.pageInfo);
  const cursor = bool(info.hasNextPage) ? str(info.endCursor) : '';
  return {
    topics: arr(page.nodes)
      .map(readTopicSummary)
      .filter((topic): topic is IForumTopicSummary => topic !== undefined),
    total,
    ...(cursor ? { cursor } : {}),
  };
};

/**
 * One thread. `firstPage` is false when this answer is a later page of
 * comments, which the caller merges into what it already has — the giscus
 * opening comment is only on the first page, so only the first page can
 * promote it.
 */
export const readTopic = (
  value: unknown,
  firstPage: boolean,
): IForumTopic | undefined => {
  const node = rec(value);
  const summary = readTopicSummary(node);
  if (!summary) {
    return undefined;
  }
  const thread = rec(node.thread);
  const info = rec(thread.pageInfo);
  const cursor = bool(info.hasNextPage) ? str(info.endCursor) : '';
  const nodes = arr(thread.nodes);
  const total = num(thread.totalCount);
  const discussionViewer = readViewer(node);
  const rest = {
    ...(cursor ? { commentsCursor: cursor } : {}),
    canEditTitle: discussionViewer.canEdit,
  };

  if (firstPage && nodes.length > 0 && isGiscus(person(node.author))) {
    const opening = readComment(nodes[0]);
    // What was said in reply to the opening comment is, to a reader, said
    // in reply to the topic. GitHub still files it under that comment, which
    // is where a reply to any of them has to go too.
    const lifted = opening.replies.map((reply): IForumComment => ({
      ...reply,
      threadId: opening.id,
      isAnswer: false,
      replies: [],
      replyTotal: 0,
    }));
    return {
      ...summary,
      post: readPost(nodes[0]),
      postKind: 'comment',
      comments: [...lifted, ...nodes.slice(1).map(readComment)],
      commentTotal: Math.max(0, total - 1) + lifted.length,
      ...rest,
    };
  }
  const comments = nodes.map(readComment);

  const editedAt = str(node.lastEditedAt);
  const post: IForumPost = {
    id: summary.id,
    bodyHtml: str(node.bodyHTML),
    ...(discussionViewer.canEdit ? { body: str(node.body) } : {}),
    createdAt: summary.createdAt,
    ...(editedAt ? { editedAt } : {}),
    url: summary.url,
    author: summary.author,
    authorRole: authorRole(node.authorAssociation),
    upvotes: summary.upvotes,
    minimized: false,
    viewer: discussionViewer,
  };
  return {
    ...summary,
    post,
    postKind: 'discussion',
    comments,
    commentTotal: total,
    ...rest,
  };
};

/** The upvote mutations answer with the subject's new state. */
export const readUpvote = (
  data: unknown,
  field: 'addUpvote' | 'removeUpvote',
): { upvotes: number; hasUpvoted: boolean } => {
  const subject = rec(rec(rec(data)[field]).subject);
  return {
    upvotes: num(subject.upvoteCount),
    hasUpvoted: bool(subject.viewerHasUpvoted),
  };
};
